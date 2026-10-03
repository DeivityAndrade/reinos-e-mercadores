'use strict';
// Browser checks and real WebGL screenshots in an isolated Chrome session.
// node tools/capture-buildings.js PORTA_CDP [PORTA_JOGO] [--preview]
const fs = require('node:fs/promises'), path = require('node:path'), assert = require('node:assert/strict');
const origin = `http://127.0.0.1:${Number(process.argv[3] || 8081)}`;
const output = path.resolve(__dirname, '../preview-interface');
(async () => {
  const tabs = await (await fetch(`http://127.0.0.1:${Number(process.argv[2])}/json/list`)).json();
  const target = tabs.find(t => t.type === 'page' && t.url.startsWith(origin + '/'));
  assert(target, 'Abra o jogo em uma sessão isolada com CDP');
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let id = 0; const pending = new Map(), errors = [];
  socket.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails);
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') errors.push(m.params.entry);
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args);
    if (!m.id || !pending.has(m.id)) return;
    const p = pending.get(m.id); pending.delete(m.id); clearTimeout(p.timeout);
    m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result);
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const n = ++id, timeout = setTimeout(() => { pending.delete(n); reject(new Error('Timeout: ' + method)); }, 30000);
    pending.set(n, { resolve, reject, timeout }); socket.send(JSON.stringify({ id: n, method, params }));
  });
  const evaluate = async expression => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  };
  const settle = () => evaluate('document.fonts.ready.then(() => new Promise(r => setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(r)), 250)))');
  const metrics = (width, height) => send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  const capture = async name => {
    await settle();
    const shot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
    await fs.writeFile(path.join(output, name), Buffer.from(shot.data, 'base64'));
    console.log(name + ': ' + (await fs.stat(path.join(output, name))).size + ' bytes');
  };
  try {
    await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable');
    await metrics(1440, 1000);
    const captureUrl = origin + '/?capture=buildings-' + Date.now();
    await send('Page.navigate', { url: captureUrl });
    const started = Date.now();
    while (!await evaluate(`location.href === ${JSON.stringify(captureUrl)} && Boolean(window.KM && KM.R && KM.R.ready)`)) {
      if (Date.now() - started > 90000) throw new Error('Assets não carregaram: ' + JSON.stringify(errors));
      await new Promise(r => setTimeout(r, 200));
    }
    await fs.mkdir(output, { recursive: true });
    const scene = await evaluate(`(() => {
      KM.save = () => {}; KM.input.update = () => {}; KM.ambient = () => {}; KM.music.stop(); KM.musicOn = false;
      KM.R.setGfx('high');
      // Deterministic demonstration town, with actual game models and house lifecycle.
      const S = KM.newState({seed:4,diff:'normal',opponents:1,allUnlocked:true});
      S.map = KM.emptyMap(48,48); KM.setMapSize(48,48); S.map.explored.fill(3);
      S.houses = {}; S.units = {}; S.army = {}; S.sites = []; S.protected = []; S.zones = null; S.fx = []; S.paused = true;
      S.players.forEach(p => {p.built = {};p.homeStore = 0;});
      const m = S.map;
      for(let y=9;y<=15;y++) for(let x=15;x<=31;x++) {
        if((x-23)**2/75+(y-12)**2/10>1) continue;
        const i=y*m.W+x; m.terrain[i]=2;
        if(y>=13 && x%3===0) {m.ore[i]=3;m.oreAmt[i]=25;}
      }
      for(let y=10;y<=13;y++) for(let x=18;x<=29;x++) m.hv[y*49+x]=3;
      for(let y=15;y<32;y++) for(let x=8;x<35;x++) if((x<12||x>32)&&KM.hash(x,y,4)<0.6) m.tree[y*48+x]=4;
      const store=KM.addHouse(S,'storehouse',0,18,25,true); store.inv={wood:48,stone:36,gold:20,bread:24};
      KM.addHouse(S,'school',0,24,25,true); KM.addHouse(S,'sawmill',0,12,22,true);
      const a=KM.addHouse(S,'goldmine',0,17,18,true), b=KM.addHouse(S,'goldmine',0,22,18,true);
      const site=KM.addHouse(S,'goldmine',0,27,18,false); site.state='site'; site.used=2; site.mat.wood.have=2;
      for(let x=14;x<=29;x++){m.road[21*48+x]=2;m.rown[21*48+x]=0;}
      for(let y=21;y<=28;y++){m.road[y*48+20]=2;m.rown[y*48+20]=0;}
      for(const h of Object.values(S.houses)) {
        for(let y=h.ey;y<=Math.max(21,h.ey);y++){const i=y*48+h.ex;if(!m.house[i]){m.road[i]=2;m.rown[i]=0;}}
      }
      KM.afterLoad(S); KM.ui.setTool(null); KM.ui.clearSel(); KM.ui.update(0.3);
      KM.R.centerOn(22,20); KM.R.dist=22; KM.R.pitch=0.85;
      KM.R.frame(S,0.016,KM.ui); KM.R.frame(S,0.016,KM.ui);
      document.querySelectorAll('.toast').forEach(t=>t.remove());
      document.querySelector('[data-build="goldmine"]').scrollIntoView({block:'center'});
      window.buildingDemo={a:a.id,b:b.id,site:site.id};
      return {counts:KM.ui.houseCounts().goldmine,drawCalls:KM.R.renderer.info.render.calls};
    })()`);
    assert.deepEqual(scene.counts, { built: 2, site: 1, plan: 0 }); assert(scene.drawCalls > 0);
    await capture('construcoes-contadores.png');
    const focused = await evaluate(`(() => {
      document.querySelector('[data-build="goldmine"]').click(); KM.ui.update(0.3); KM.R.frame(KM.S,0.016,KM.ui);
      const badge=document.querySelector('[data-build="goldmine"] .bcount'), works=document.querySelector('[data-build="goldmine"] .bworks');
      return {badge:badge.textContent,works:works.textContent,focus:KM.ui.buildFocusType(),
        unmuted:!KM.R.houseVis[buildingDemo.a].userData.mutedHouseMaterials,
        muted:Object.values(KM.R.houseVis).filter(g=>g.userData.mutedHouseMaterials).length,
        locator:!!document.querySelector('[data-act2="locate:goldmine"]'),
        allVisible:[buildingDemo.a,buildingDemo.b,buildingDemo.site].every(id=>{const g=KM.R.houseVis[id],q=KM.R.toScreen(g.position.x,g.position.y+(g.userData.top||1.2),g.position.z);return !q.behind&&q.x>312&&q.x<innerWidth&&q.y>70&&q.y<innerHeight-180;}),
        overflow:document.querySelector('#selpanel').scrollWidth>document.querySelector('#selpanel').clientWidth};
    })()`);
    assert.equal(focused.badge, '2'); assert.equal(focused.works, '+1 obra'); assert.equal(focused.focus, 'goldmine');
    assert(focused.unmuted && focused.muted > 0 && focused.locator && focused.allVisible && !focused.overflow, JSON.stringify(focused));
    await capture('construcoes-destaque.png');
    if (process.argv.includes('--preview')) return;
    const locating = await evaluate(`(() => {
      const before=KM.checksum(KM.S), seen=[];
      for(let i=0;i<4;i++){document.querySelector('[data-act2="locate:goldmine"]').click();seen.push(KM.ui.selHouse);}
      KM.R.frame(KM.S,0.016,KM.ui); KM.ui.update(0.3);
      return {seen,expected:[buildingDemo.a,buildingDemo.b,buildingDemo.site,buildingDemo.a],tool:KM.ui.tool,
        unchanged:before===KM.checksum(KM.S),focus:KM.ui.buildFocusType()};
    })()`);
    assert.deepEqual(locating.seen, locating.expected); assert.equal(locating.tool, null); assert(locating.unchanged);
    await capture('construcoes-localizar.png');
    // Actual mouse placement preview, valid/invalid colours survive the focus effect.
    const placement = await evaluate(`(() => {
      const spot=KM.findSpot(KM.S,'goldmine',0,31,19,12);
      KM.ui.setTool({build:'goldmine'}); KM.ui.hover={tx:spot.x+1,ty:spot.y+1}; KM.R.frame(KM.S,0.016,KM.ui);
      const colors=()=>KM.R.toolGroup.children.filter(g=>g.geometry?.attributes?.color).map(g=>Array.from(g.geometry.attributes.color.array).slice(0,3));
      const green=colors().some(c=>c[1]>0.9&&c[0]<0.5);
      KM.ui.hover={tx:18,ty:19}; KM.R.frame(KM.S,0.016,KM.ui);
      const red=colors().some(c=>c[0]>0.9&&c[1]<0.5);
      KM.ui.hover={tx:spot.x+1,ty:spot.y+1}; KM.R.frame(KM.S,0.016,KM.ui);
      return {valid:KM.canPlace(KM.S,'goldmine',spot.x,spot.y,0,0).ok,green,red,ghost:!!KM.R.ghost,
        originalGhost:!KM.R.ghost.userData.mutedHouseMaterials,drawCalls:KM.R.renderer.info.render.calls};
    })()`);
    assert(placement.valid && placement.green && placement.red && placement.ghost && placement.originalGhost && placement.drawCalls>0, JSON.stringify(placement));
    await capture('construcoes-posicionamento.png');
    // Live updates in an already open menu, including completion and cancelled plans.
    const lifecycle = await evaluate(`(() => {
      document.querySelector('[data-build="goldmine"]').focus();
      KM.finishHouse(KM.S,KM.S.houses[buildingDemo.site],true); KM.ui.update(0.3);
      const completed=document.querySelector('[data-build="goldmine"] .bcount').textContent;
      const focusPreserved=document.activeElement.dataset.build==='goldmine';
      KM.removeHouse(KM.S,KM.S.houses[buildingDemo.b],false); KM.ui.update(0.3);
      const removed=document.querySelector('[data-build="goldmine"] .bcount').textContent;
      const plan=KM.addHouse(KM.S,'goldmine',0,22,18,false); KM.ui.update(0.3);
      const planned=document.querySelector('[data-build="goldmine"] .bworks').textContent;
      KM.removeHouse(KM.S,plan,false); KM.ui.update(0.3);
      const cancelled=!document.querySelector('[data-build="goldmine"] .bworks');
      KM.ui.setTool({build:'ironmine'}); KM.ui.update(0.3);
      const disabled=document.querySelector('[data-act2="locate:ironmine"]').disabled;
      return {completed,removed,planned,cancelled,disabled,focusPreserved};
    })()`);
    assert.deepEqual(lifecycle, {completed:'3',removed:'2',planned:'+1 obra',cancelled:true,disabled:true,focusPreserved:true});
    await metrics(844, 390);
    const mobile = await evaluate(`(() => {
      KM.R.resize(); KM.ui.setTool(null); KM.touchUI=true; document.body.classList.add('touch','sb-open');
      document.querySelector('[data-build="goldmine"]').click(); KM.ui.update(0.3); KM.R.frame(KM.S,0.016,KM.ui);
      const p=document.querySelector('#selpanel'),b=document.querySelector('[data-act2="locate:goldmine"]'),r=b.getBoundingClientRect();
      return {overflow:p.scrollWidth>p.clientWidth,visible:r.width>0&&r.height>0&&r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight,
        clickable:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===b,sidebarClosed:!document.body.classList.contains('sb-open')};
    })()`);
    assert(!mobile.overflow && mobile.visible && mobile.clickable && mobile.sidebarClosed, JSON.stringify(mobile));
    await capture('construcoes-mobile.png');
    await metrics(1440, 1000);
    await evaluate(`KM.R.resize(); KM.touchUI=false; document.body.classList.remove('touch'); KM.R.setGfx('low'); KM.ui.setTool({build:'goldmine'}); KM.ui.hover=null; KM.ui.update(0.3); KM.R.frame(KM.S,0.016,KM.ui);`);
    await settle();
    const low = await evaluate('({calls:KM.R.renderer.info.render.calls,muted:Object.values(KM.R.houseVis).some(g=>g.userData.mutedHouseMaterials)})');
    assert(low.calls>0 && low.muted);
    await evaluate(`KM.ui.setTool(null); KM.ui.clearSel(); KM.R.frame(KM.S,0.016,KM.ui);`);
    assert(await evaluate('Object.values(KM.R.houseVis).every(g=>!g.userData.mutedHouseMaterials)'), 'effect must clear on cancel');
    assert.equal(errors.length, 0, JSON.stringify(errors));
    console.log('BROWSER_BUILDINGS_PASS: ' + JSON.stringify({scene,focused,locating,placement,lifecycle,mobile,low}));
  } finally { socket.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
