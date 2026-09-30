'use strict';
/* Laço principal (tick fixo + lockstep), salvamento, efeitos sonoros e música */
(function (KM) {
  const $ = (s) => document.querySelector(s);
  KM.S = null;
  let acc = 0, last = 0, autosaveT = 0, ambT = 0;

  KM.step = function (S, dt) {
    if (S.cmdq.length) { const q = S.cmdq; S.cmdq = []; for (const c of q) KM.exec(S, c); }
    S.time += dt; S.tick++;
    for (const id in S.units) { const u = S.units[id]; if (u) KM.updateUnit(S, u, dt); }
    for (const id in S.houses) { const h = S.houses[id]; if (h) KM.updateHouse(S, h, dt); }
    KM.updateProjectiles(S, dt);
    const t = S.tick;
    if (KM.rt.roadsDirty) KM.computeRoadComps(S);
    for (let o = 0; o < S.players.length; o++) {
      if (!S.players[o].eco || S.players[o].out) continue;
      if (t % 10 === o) { KM.logistics(S, o); KM.assignLaborers(S, o); }
      if (t % 20 === 5 + o) KM.assignWorkers(S, o);
      if (t % 60 === 7 + o) KM.autoTrain(S, o);
    }
    if (t % 40 === 11) KM.growMap(S, 40 * dt);
    if (t % 10 === 3) KM.updateFog(S);
    if (t % 20 === 13) { KM.updateAI(S, 20 * dt); KM.cleanGroups(S); }
    if (t % 40 === 17) KM.checkGoals(S);
    if (t % 600 === 19) KM.recordHist(S);
  };

  // histórico a cada 30 s de jogo (gráficos da tela final): cidadãos, soldados, casas prontas, recursos guardados
  KM.recordHist = function (S) {
    const H = S.hist || (S.hist = { t: [], d: S.players.map(() => []) });
    const row = S.players.map(() => [0, 0, 0, 0]);
    for (const id in S.units) { const u = S.units[id]; const r = row[u.owner]; if (r) r[KM.isSoldier(u.type) ? 1 : 0]++; }
    for (const id in S.houses) {
      const h = S.houses[id], r = row[h.owner];
      if (!r || h.state !== 'built') continue;
      r[2]++;
      if (h.type === 'storehouse') for (const k in h.inv) r[3] += h.inv[k];
    }
    H.t.push(Math.round(S.time));
    row.forEach((r, o) => H.d[o].push(r));
  };

  // soma de verificação para detectar dessincronização no multijogador
  KM.checksum = function (S) {
    let h = S.nid * 31 + S.tick;
    for (const id in S.units) { const u = S.units[id]; h = (h * 33 + ((u.x * 100) | 0) + ((u.y * 100) | 0) * 7 + (u.hp | 0)) | 0; }
    for (const id in S.houses) { const b = S.houses[id]; h = (h * 17 + b.id + (b.hp | 0)) | 0; }
    return h;
  };

  function simulate(S, el) {
    const mp = S.mp && KM.net && KM.net.active;
    if (!mp && (S.paused || (S.over && S.over !== 'ignored'))) return;
    acc += el * S.speed;
    let n = 0;
    while (acc >= KM.DT && n < 20) {
      if (mp && S.tick % KM.TURN === 0) {
        const turn = S.tick / KM.TURN;
        if (!KM.net.ready(turn)) { KM.net.stalled(el); acc = Math.min(acc, KM.DT * 2); break; }
        for (const c of KM.net.take(turn)) KM.exec(S, c);
        KM.net.send(turn);
        if (turn % 50 === 0) KM.net.sendHash(turn, KM.checksum(S));
      }
      KM.step(S, KM.DT);
      acc -= KM.DT; n++;
    }
    if (n >= 20) acc = 0;
  }

  function frame(ts) {
    const now = ts / 1000;
    const el = Math.min(0.25, now - (last || now));
    last = now;
    const S = KM.S;
    if (S && !S.editor) {
      KM.simS = S;
      simulate(S, el);
      if (!S.mp && !S.paused) { autosaveT += el; if (autosaveT > 180) { autosaveT = 0; KM.save(0); } }
      ambT -= el;
      if (ambT <= 0 && !S.paused) { ambT = 0.35; KM.ambient(S); }
      if (S.paused || (S.over && S.over !== 'ignored')) KM.ambientStop();
    }
    if (S) KM.input.update(el);
    KM.R.frame(S, el, KM.ui);
    KM.ui.update(el);
    requestAnimationFrame(frame);
  }

  KM.afterLoad = function (S) {
    KM.S = S; KM.simS = S;
    KM.setMapSize(S.map.W, S.map.H);
    KM.rt = { comp: null, roadsDirty: true };
    KM.computeRoadComps(S);
    KM.R.sprites = {};
    KM.R.buildBase(S);
    KM.ui.clearSel(); KM.ui.setTool(null);
    KM.ui.mmImg = null; KM.ui.lastTop = ''; KM.ui.lastTabHtml = ''; KM.ui.lastPanel = null;
    $('#menu').classList.add('hidden');
    $('#endscreen').classList.add('hidden');
    $('#brief').classList.add('hidden');
    $('#hud').classList.remove('hidden');
    document.body.classList.toggle('editing', !!S.editor);
    KM.ui.setTab('build');
    const st = Object.values(S.houses).find((h) => h.owner === KM.me && h.type === 'storehouse');
    const p = st ? { x: st.ex, y: st.ey } : S.starts[KM.me] || S.starts[0] || { x: S.map.W / 2, y: S.map.H / 2 };
    KM.R.dist = 18; KM.R.yaw = 0; KM.R.pitch = 0.9;
    KM.R.centerOn(p.x, p.y);
    acc = 0; autosaveT = 0;
  };

  KM.startGame = function (opts) {
    KM.me = opts.me || 0;
    const S = KM.newState(opts);
    KM.afterLoad(S);
    KM.music && KM.music.start();
    if (S.mission === 'm1' && !opts.noTutorial) KM.tutorial.start(S);
    if (S.mission) { S.paused = true; KM.ui.showBriefing(S); return; }
    if (S.mp) { KM.ui.toast(`🌐 Partida multijogador iniciada. Você é ${S.players[KM.me].name}. Enter abre o chat.`, 'ok'); return; }
    KM.ui.toast('👑 Bem-vindo, senhor! Construa sua economia e prepare-se para a guerra.', 'info');
    KM.ui.toast('💡 Dica: ligue cada casa ao Armazém com estradas (R). Carregadores só andam por elas, e cada trecho custa 1 pedra.', 'info');
  };

  KM.quitToMenu = function () {
    if (KM.net && KM.net.active) KM.net.close();
    KM.S = null; KM.simS = null; KM.me = 0;
    KM.tutorial.hide();
    KM.ambientStop();
    document.body.classList.remove('editing');
    $('#hud').classList.add('hidden');
    $('#endscreen').classList.add('hidden');
    $('#brief').classList.add('hidden');
    $('#menu').classList.remove('hidden');
    KM.ui.refreshMenu();
  };

  // ---------- salvar/carregar ----------
  KM.save = function (slot) {
    const S = KM.S;
    if (!S || S.mp || S.editor) return;
    try {
      localStorage.setItem('rm_save_' + slot, JSON.stringify(Object.assign({}, S, { fx: [] })));
      localStorage.setItem('rm_meta_' + slot, JSON.stringify({ time: S.time, date: Date.now(), diff: S.diff, v: KM.VERSION, v3: true, name: S.mission ? KM.MISSIONS.find((x) => x.id === S.mission).n : 'Escaramuça ' + KM.DIFF[S.diff].n }));
    } catch (e) { KM.ui.toast('Não foi possível salvar: ' + e.message, 'danger'); }
  };
  KM.saveMeta = function (slot) {
    try { const m = localStorage.getItem('rm_meta_' + slot); return m ? JSON.parse(m) : null; } catch (e) { return null; }
  };
  KM.load = function (slot) {
    try {
      const raw = localStorage.getItem('rm_save_' + slot);
      if (!raw) { KM.ui.toast('Nenhum jogo salvo nesse espaço.', 'warn'); return false; }
      const S = JSON.parse(raw);
      if ((S.v || 1) < KM.SAVE_V) { KM.ui.toast('Esse jogo salvo é de uma versão antiga e não é compatível.', 'warn'); return false; }
      S.fx = []; S.paused = false; S.cmdq = [];
      // saves antigos: reconstrói a progressão a partir das casas existentes
      S.players.forEach((p, o) => {
        if (p.built) return;
        p.built = {};
        for (const id in S.houses) { const h = S.houses[id]; if (h.owner === o && h.state === 'built') p.built[h.type] = 1; }
      });
      if (S.over === 'win' || S.over === 'lose') S.over = null;
      KM.me = 0;
      KM.afterLoad(S);
      return true;
    } catch (e) { KM.ui.toast('Falha ao carregar: ' + e.message, 'danger'); return false; }
  };

  // Com a aba oculta o navegador congela o requestAnimationFrame. No multijogador isso travaria
  // o outro jogador, então um Web Worker mantém a simulação andando em segundo plano.
  let bgLast = 0;
  function backgroundTick() {
    const S = KM.S;
    if (!document.hidden || !S || !S.mp || !KM.net || !KM.net.active) { bgLast = 0; return; }
    const now = performance.now() / 1000;
    const el = Math.min(0.25, bgLast ? now - bgLast : 0.05);
    bgLast = now;
    KM.simS = S;
    simulate(S, el);
  }
  try {
    const src = 'setInterval(function(){postMessage(0)},50)';
    const w = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
    w.onmessage = backgroundTick;
  } catch (e) { setInterval(backgroundTick, 50); }

  window.addEventListener('load', () => {
    if (location.protocol === 'file:') {
      const lb = $('#loadbar');
      if (lb) { lb.dataset.t = 'Abra o jogo pelo arquivo Jogar.bat (os modelos 3D precisam do servidor local)'; lb.style.setProperty('--p', '0%'); lb.style.height = '40px'; }
    }
    KM.R.init($('#game'));
    KM.input.init($('#game'));
    KM.ui.init();
    requestAnimationFrame(frame);
  });
})(window.KM);
