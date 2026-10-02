'use strict';
// Captura uma sessão Chrome separada via a porta local informada pelo chamador.
// Uso: node tools/capture-ui.js PORTA
const fs = require('node:fs/promises'), path = require('node:path'), assert = require('node:assert/strict');
const output = path.resolve(__dirname, '../preview-interface');
(async () => {
  const tabs = await (await fetch(`http://127.0.0.1:${Number(process.argv[2])}/json/list`)).json();
  const target = tabs.find(t => t.type === 'page' && t.url.startsWith('http://localhost:8080'));
  assert(target, 'Sessão de captura do jogo não encontrada');
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let id = 0; const pending = new Map(), errors = [];
  socket.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails);
    if (!m.id || !pending.has(m.id)) return;
    const p = pending.get(m.id); pending.delete(m.id); clearTimeout(p.timeout);
    m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result);
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const n = ++id;
    const timeout = setTimeout(() => { pending.delete(n); reject(new Error('Tempo esgotado: ' + method)); }, 30000);
    pending.set(n, { resolve, reject, timeout }); socket.send(JSON.stringify({ id: n, method, params }));
  });
  const evaluate = async expression => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  };
  try {
    await send('Page.enable'); await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    const started = Date.now();
    while (!await evaluate('Boolean(window.KM && KM.R && KM.R.ready)')) {
      if (Date.now() - started > 90000) throw new Error('Modelos do jogo não carregaram: ' + JSON.stringify(errors));
      await new Promise(r => setTimeout(r, 200));
    }
    await fs.mkdir(output, { recursive: true });
    const status = await evaluate(`(() => {
      KM.save = () => {}; KM.input.update = () => {};
      KM.startGame({diff:'normal',opponents:1,seed:4,allUnlocked:true,noTutorial:true});
      KM.S.paused = true;
      document.querySelectorAll('.toast').forEach(t => t.remove());
      const school = Object.values(KM.S.houses).find(h => h.owner === 0 && h.type === 'school');
      KM.R.centerOn(school.ex,school.ey); KM.ui.selectHouse(school.id); KM.ui.update(0.3);
      KM.R.frame(KM.S,0.016,KM.ui); KM.R.frame(KM.S,0.016,KM.ui);
      return {peopleReady:KM.PEOPLE.ready,portraits:KM.PROF_ORDER.filter(t=>KM.R.icons['p_'+t]).length,
        buttons:document.querySelectorAll('.tgrid button').length,drawCalls:KM.R.renderer.info.render.calls,
        labels:[...document.querySelectorAll('.tgrid button small')].map(e=>e.textContent),
        panelFits:document.querySelector('#selpanel').scrollHeight <= document.querySelector('#selpanel').clientHeight};
    })()`);
    assert(status.peopleReady && status.portraits === 14 && status.buttons === 14 && status.drawCalls > 0, JSON.stringify(status));
    await evaluate('document.fonts.ready.then(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))))');
    async function capture(name) {
      const image = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
      const file = path.join(output, name); await fs.writeFile(file, Buffer.from(image.data, 'base64'));
      console.log(name + ': ' + (await fs.stat(file)).size + ' bytes');
    }
    await capture('escola.png');
    const portraits = await evaluate('KM.PROF_ORDER.map(t=>({name:KM.PROF[t].n,image:KM.R.icons["p_"+t]}))');
    await evaluate('KM.ui.clearSel(); KM.ui.setTab("stock"); KM.ui.update(0.3)');
    await capture('recursos.png');
    // Montagem dos PNGs gerados pelo renderer real, sem redesenhar os personagens.
    const sheet = `<!doctype html><meta charset="utf-8"><style>
      *{box-sizing:border-box}body{margin:0;padding:32px 40px;background:#1d1510;color:#efe3c8;font:20px Georgia,serif}
      h1{color:#f6dc93;font-size:32px;margin:0 0 10px}p{color:#b3a283;font:17px system-ui;margin:0 0 24px}
      main{display:grid;grid-template-columns:repeat(7,1fr);gap:18px}
      figure{margin:0;background:radial-gradient(ellipse at 50% 28%,#65523b,#2a2119 75%);border:1px solid #9a7330;border-radius:10px;overflow:hidden}
      img{display:block;width:100%;aspect-ratio:1}figcaption{text-align:center;padding:14px 6px;font-size:17px;white-space:nowrap}
      </style><h1>Profissionais da Escola</h1><p>Retratos renderizados no jogo · busto · 256 × 256 pixels</p><main>${portraits.map(p=>`<figure><img src="${p.image}"><figcaption>${p.name}</figcaption></figure>`).join('')}</main>`;
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 680, deviceScaleFactor: 1, mobile: false });
    // Uma página nova encerra os callbacks do jogo antes de montar a galeria.
    await send('Page.navigate', { url: 'about:blank' });
    while (!await evaluate('location.href === "about:blank" && document.readyState === "complete"'))
      await new Promise(r => setTimeout(r, 50));
    await send('Page.setDocumentContent', { frameId: (await send('Page.getFrameTree')).frameTree.frame.id, html: sheet });
    await evaluate('Promise.all([...document.images].map(i=>i.decode()))');
    await capture('personagens-escola.png');
    assert.equal(errors.length, 0, JSON.stringify(errors));
    console.log('CAPTURE_PASS: ' + JSON.stringify(status));
  } finally {
    await send('Browser.close').catch(() => {}); socket.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
