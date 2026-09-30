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
      if (ambT <= 0 && !S.paused) { ambT = 0.35; ambient(S); }
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

  // ---------- sons sintetizados (Web Audio, sem arquivos) ----------
  KM.audioOn = true;
  let actx = null, noiseBuf = null;
  function ctx() {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (!noiseBuf) {
      noiseBuf = actx.createBuffer(1, actx.sampleRate * 0.6, actx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    return actx;
  }
  function tone(f, d, type, vol, delay, f2, dest) {
    const t = actx.currentTime + (delay || 0);
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.08, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g).connect(dest || actx.destination);
    o.start(t); o.stop(t + d + 0.05);
  }
  function noise(d, freq, q, vol, delay, type, dest) {
    const t = actx.currentTime + (delay || 0);
    const s = actx.createBufferSource(); s.buffer = noiseBuf;
    const f = actx.createBiquadFilter(); f.type = type || 'bandpass'; f.frequency.value = freq; f.Q.value = q || 1;
    const g = actx.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    s.connect(f).connect(g).connect(dest || actx.destination);
    s.start(t, Math.random() * 0.3); s.stop(t + d + 0.05);
  }
  KM.sfx = function (name, vol) {
    if (!KM.audioOn) return;
    try {
      ctx();
      const v = vol == null ? 1 : vol;
      if (name === 'place') { tone(520, 0.08, 'triangle', 0.06 * v); tone(780, 0.1, 'triangle', 0.05 * v, 0.06); }
      else if (name === 'click' || name === 'order') { tone(440, 0.07, 'square', 0.025 * v); noise(0.05, 2000, 2, 0.02 * v); }
      else if (name === 'error') tone(180, 0.15, 'sawtooth', 0.04 * v);
      else if (name === 'demolish') { tone(200, 0.25, 'sawtooth', 0.05 * v, 0, 60); noise(0.3, 400, 0.7, 0.08 * v); }
      else if (name === 'horn') { tone(196, 0.6, 'sawtooth', 0.05 * v); tone(294, 0.8, 'sawtooth', 0.04 * v, 0.4); tone(392, 0.4, 'sawtooth', 0.02 * v, 0.4); }
      else if (name === 'alarm') { for (let k = 0; k < 3; k++) { tone(900, 0.25, 'sine', 0.04 * v, k * 0.28); tone(1350, 0.2, 'sine', 0.015 * v, k * 0.28); } }
      else if (name === 'built') { [392, 523, 659].forEach((f, i) => tone(f, 0.25, 'triangle', 0.045 * v, i * 0.09)); }
      else if (name === 'win') [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.3, 'triangle', 0.06 * v, i * 0.15));
      else if (name === 'chop') { noise(0.08, 900, 3, 0.18 * v); tone(140, 0.08, 'triangle', 0.05 * v); }
      else if (name === 'hammer') { tone(1800, 0.12, 'sine', 0.05 * v); tone(2700, 0.08, 'sine', 0.025 * v); noise(0.03, 3000, 2, 0.06 * v); }
      else if (name === 'pick') { noise(0.06, 2500, 4, 0.12 * v); tone(900, 0.05, 'square', 0.02 * v); }
      else if (name === 'saw') { noise(0.35, 1800, 6, 0.06 * v, 0, 'bandpass'); }
      else if (name === 'hit') { noise(0.07, 3500, 5, 0.12 * v); tone(700 + Math.random() * 400, 0.1, 'square', 0.02 * v); }
      else if (name === 'arrow') { noise(0.15, 5000, 1, 0.03 * v, 0, 'highpass'); }
      else if (name === 'collapse') { noise(0.9, 180, 0.5, 0.25 * v, 0, 'lowpass'); noise(0.5, 600, 1, 0.1 * v, 0.1); }
      else if (name === 'bird') { const f = 2200 + Math.random() * 1200; tone(f, 0.08, 'sine', 0.012 * v, 0, f * 1.3); tone(f * 1.1, 0.1, 'sine', 0.01 * v, 0.12, f * 0.9); }
    } catch (e) { /* áudio indisponível */ }
  };
  // som posicional: mais baixo quanto mais longe do centro da tela
  KM.sfxAt = function (name, x, y) {
    if (!KM.audioOn || !KM.R) return;
    const f = KM.R.focus, d = Math.hypot(x + 0.5 - f.x, y + 0.5 - f.y);
    if (d > 22) return;
    KM.sfx(name, Math.max(0.1, 1 - d / 22) * KM.clamp(24 / KM.R.dist, 0.4, 1.2));
  };
  function ambient(S) {
    if (!KM.audioOn || !KM.R.vis) return;
    const v = KM.R.vis, cand = [];
    for (const id in S.units) {
      const u = S.units[id];
      if (u.inside || u.tx < v.x0 || u.tx > v.x1 || u.ty < v.y0 || u.ty > v.y1) continue;
      if (u.work || (u.task && (u.task.type === 'build' || u.task.type === 'repair') && u.wt > 0)) cand.push(u);
      else if (u.atkA > 0.25) cand.push(u);
    }
    if (cand.length) {
      const u = cand[Math.floor(Math.random() * cand.length)];
      const t = u.task;
      const s = KM.isSoldier(u.type) ? (KM.SOLDIERS[u.type].range ? 'arrow' : 'hit')
        : t && t.type === 'gather' ? ({ chop: 'chop', mine: 'pick', plant: 'pick', harvest: 'chop' })[t.kind]
          : t && (t.type === 'build' || t.type === 'repair') ? 'hammer' : t && (t.type === 'road' || t.type === 'level' || t.type === 'field') ? 'pick' : null;
      if (s) KM.sfxAt(s, u.x, u.y);
    }
    for (const id in S.houses) {
      const h = S.houses[id];
      if (!h.work || h.ex < v.x0 || h.ex > v.x1 || h.ey < v.y0 || h.ey > v.y1 || Math.random() > 0.12) continue;
      const s = { sawmill: 'saw', weaponsmithy: 'hammer', armorsmithy: 'hammer', ironsmithy: 'hammer', weaponworkshop: 'saw', armorworkshop: 'hammer' }[h.type];
      if (s) KM.sfxAt(s, h.ex, h.ey);
      break;
    }
    if (Math.random() < 0.04) KM.sfx('bird', 0.8);
  }

  // ---------- música ambiente medieval procedural ----------
  KM.musicOn = true;
  KM.music = {
    playing: false, beat: 0, timer: null,
    start() {
      if (this.playing || !KM.musicOn) return;
      try { ctx(); } catch (e) { return; }
      if (actx.state === 'suspended') actx.resume();
      this.playing = true;
      this.master = actx.createGain(); this.master.gain.value = 0.05; this.master.connect(actx.destination);
      this.nextT = actx.currentTime + 0.2;
      this.timer = setInterval(() => this.schedule(), 200);
    },
    stop() { this.playing = false; clearInterval(this.timer); if (this.master) { this.master.disconnect(); this.master = null; } },
    pluck(f, t, d, vol) {
      const o = actx.createOscillator(), o2 = actx.createOscillator(), g = actx.createGain(), lp = actx.createBiquadFilter();
      o.type = 'triangle'; o2.type = 'sawtooth'; o.frequency.value = f; o2.frequency.value = f * 1.003;
      lp.type = 'lowpass'; lp.frequency.setValueAtTime(2400, t); lp.frequency.exponentialRampToValueAtTime(500, t + d);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      const g2 = actx.createGain(); g2.gain.value = 0.25;
      o.connect(g); o2.connect(g2).connect(g); g.connect(lp).connect(this.master);
      o.start(t); o2.start(t); o.stop(t + d + 0.05); o2.stop(t + d + 0.05);
    },
    drum(t, vol) {
      const o = actx.createOscillator(), g = actx.createGain();
      o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.25);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      o.connect(g).connect(this.master); o.start(t); o.stop(t + 0.35);
    },
    schedule() {
      if (!this.playing || !this.master) return;
      // ré dórico em compasso ternário; em batalha fica mais rápido e ganha tambores
      const scale = [293.66, 329.63, 349.23, 392.0, 440.0, 493.88, 523.25, 587.33];
      const chords = [[0, 2, 4], [6, 1, 3], [3, 5, 0], [4, 6, 1]];
      while (this.nextT < actx.currentTime + 0.6) {
        const b = this.beat, bar = Math.floor(b / 3) % 16, ch = chords[Math.floor(bar / 4) % 4];
        const battle = KM.S && KM.S.lastWarn && KM.S.time - KM.S.lastWarn < 30;
        const beatLen = battle ? 0.3 : 0.42;
        if (b % 3 === 0) this.pluck(scale[ch[0]] / 4, this.nextT, 1.4, 0.5);
        if (battle && b % 3 !== 1) this.drum(this.nextT, b % 3 === 0 ? 0.9 : 0.5);
        if (Math.random() < 0.72) {
          const n = ch[Math.floor(Math.random() * 3)] + (Math.random() < 0.3 ? 1 : 0);
          this.pluck(scale[n % 8] * (n >= 8 ? 2 : 1), this.nextT, 0.7, 0.28);
        }
        if (b % 6 === 4 && Math.random() < 0.5) this.pluck(scale[(ch[1] + 2) % 8] * 2, this.nextT + beatLen / 2, 0.4, 0.14);
        this.nextT += beatLen;
        this.beat++;
      }
    },
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
