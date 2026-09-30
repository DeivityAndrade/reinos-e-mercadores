'use strict';
/* Áudio procedural (Web Audio, sem arquivos): efeitos, ambiente, vozes e música medieval.
   Instrumentos: alaúde (Karplus-Strong), flauta doce com vibrato, sanfona (bordão), tambor de moldura.
   Tudo passa por uma reverberação de salão gerada na hora. */
(function (KM) {
  const VOL_KEY = 'rm_audio';
  const cfg = { master: 0.8, music: 0.55, sfx: 0.8, voices: false };
  try { Object.assign(cfg, JSON.parse(localStorage.getItem(VOL_KEY) || '{}')); } catch (e) { /* ok */ }
  KM.audioCfg = cfg;
  KM.audioOn = true;
  try { KM.audioOn = localStorage.getItem('rm_sfx') !== '0'; } catch (e) { /* ok */ }
  KM.musicOn = true;

  let A = null, noiseBuf = null, master, sfxBus, musicBus, verb, verbSend, ambBus;
  const ksCache = {};

  function ctx() {
    if (A) return A;
    A = new (window.AudioContext || window.webkitAudioContext)();
    master = A.createGain(); master.connect(A.destination);
    // compressor leve para o volume não estourar em batalhas grandes
    const comp = A.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.005; comp.release.value = 0.2;
    comp.connect(master);
    sfxBus = A.createGain(); sfxBus.connect(comp);
    musicBus = A.createGain(); musicBus.connect(comp);
    ambBus = A.createGain(); ambBus.connect(comp);
    // reverberação: resposta ao impulso sintética (ruído com decaimento exponencial, estéreo)
    verb = A.createConvolver();
    const len = Math.floor(A.sampleRate * 2.4), ir = A.createBuffer(2, len, A.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2) * (i < 80 ? i / 80 : 1); }
    verb.buffer = ir;
    verbSend = A.createGain(); verbSend.gain.value = 0.5;
    verbSend.connect(verb).connect(comp);
    noiseBuf = A.createBuffer(1, A.sampleRate * 1.0, A.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    applyVolumes();
    return A;
  }
  function applyVolumes() {
    if (!A) return;
    master.gain.value = cfg.master;
    sfxBus.gain.value = KM.audioOn ? cfg.sfx : 0;
    ambBus.gain.value = KM.audioOn ? cfg.sfx * 0.9 : 0;
    musicBus.gain.value = cfg.music;
  }
  KM.setAudio = function (k, v) {
    cfg[k] = v;
    try { localStorage.setItem(VOL_KEY, JSON.stringify(cfg)); localStorage.setItem('rm_sfx', KM.audioOn ? '1' : '0'); } catch (e) { /* ok */ }
    applyVolumes();
  };
  KM.toggleSfx = function () { KM.audioOn = !KM.audioOn; KM.setAudio('sfx', cfg.sfx); };
  // navegadores só liberam o áudio depois de um gesto do usuário
  const unlock = () => { try { ctx(); if (A.state === 'suspended') A.resume(); } catch (e) { /* ok */ } };
  window.addEventListener('pointerdown', unlock, { once: false, passive: true });
  window.addEventListener('keydown', unlock, { once: false, passive: true });

  // ---------------- blocos de síntese ----------------
  const T = () => A.currentTime;
  function env(g, t, a, peak, d, sustain) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    if (sustain) g.gain.setValueAtTime(peak, t + a + sustain);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + (sustain || 0) + d);
  }
  function out(node, bus, wet, pan) {
    let n = node;
    if (pan && A.createStereoPanner) { const p = A.createStereoPanner(); p.pan.value = KM.clamp(pan, -1, 1); n.connect(p); n = p; }
    n.connect(bus);
    if (wet) { const s = A.createGain(); s.gain.value = wet; n.connect(s).connect(verbSend); }
  }
  function osc(type, f, t, d, vol, o) {
    o = o || {};
    const s = A.createOscillator(), g = A.createGain();
    s.type = type; s.frequency.setValueAtTime(f, t);
    if (o.f2) s.frequency.exponentialRampToValueAtTime(o.f2, t + (o.glide || d));
    if (o.detune) s.detune.value = o.detune;
    env(g, t, o.a || 0.005, vol, d, o.hold);
    let n = s.connect(g);
    if (o.lp) { const f2 = A.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = o.lp; n = n.connect(f2); }
    out(n, o.bus || sfxBus, o.wet == null ? 0.12 : o.wet, o.pan);
    s.start(t); s.stop(t + (o.a || 0.005) + (o.hold || 0) + d + 0.05);
    return s;
  }
  function nz(t, d, freq, q, vol, o) {
    o = o || {};
    const s = A.createBufferSource(); s.buffer = noiseBuf;
    const f = A.createBiquadFilter(); f.type = o.type || 'bandpass'; f.frequency.setValueAtTime(freq, t); f.Q.value = q || 1;
    if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t + d);
    const g = A.createGain();
    env(g, t, o.a || 0.002, vol, d, o.hold);
    out(s.connect(f).connect(g), o.bus || sfxBus, o.wet == null ? 0.1 : o.wet, o.pan);
    s.start(t, Math.random() * 0.5); s.stop(t + (o.a || 0.002) + (o.hold || 0) + d + 0.05);
  }
  // corda dedilhada (Karplus-Strong) pré-calculada e guardada em cache
  function ks(f, dur, bright) {
    const key = Math.round(f * 10) + ':' + dur + ':' + bright;
    if (ksCache[key]) return ksCache[key];
    const sr = A.sampleRate, n = Math.floor(sr * dur), buf = A.createBuffer(1, n, sr), d = buf.getChannelData(0);
    const N = Math.max(2, Math.round(sr / f)), line = new Float32Array(N);
    let prev = 0;
    for (let i = 0; i < N; i++) { const r = Math.random() * 2 - 1; prev = prev + (r - prev) * bright; line[i] = prev; }
    const decay = 0.996 + Math.min(0.0035, f / 200000);
    let p = 0;
    for (let i = 0; i < n; i++) {
      const a = line[p], b = line[(p + 1) % N];
      const v = (a + b) * 0.5 * decay;
      line[p] = v; d[i] = a;
      p = (p + 1) % N;
    }
    // ataque suave para não estalar
    for (let i = 0; i < 64 && i < n; i++) d[i] *= i / 64;
    return (ksCache[key] = buf);
  }
  function pluck(f, t, vol, o) {
    o = o || {};
    const s = A.createBufferSource(); s.buffer = ks(f, o.dur || 1.6, o.bright || 0.55);
    const g = A.createGain(); g.gain.value = vol;
    const body = A.createBiquadFilter(); body.type = 'peaking'; body.frequency.value = 280; body.Q.value = 1.2; body.gain.value = 5;
    out(s.connect(body).connect(g), o.bus || musicBus, o.wet == null ? 0.35 : o.wet, o.pan);
    s.start(t);
  }
  function flute(f, t, d, vol, o) {
    o = o || {};
    const s = A.createOscillator(), s2 = A.createOscillator(), g = A.createGain(), lfo = A.createOscillator(), lg = A.createGain();
    s.type = 'sine'; s2.type = 'triangle';
    s.frequency.value = f; s2.frequency.value = f * 2;
    lfo.frequency.value = 5.2; lg.gain.value = f * 0.006;
    lfo.connect(lg); lg.connect(s.frequency); lg.connect(s2.frequency);
    const g2 = A.createGain(); g2.gain.value = 0.12;
    const a = Math.min(0.08, d * 0.3);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + a);
    g.gain.setValueAtTime(vol * 0.85, t + Math.max(a, d - 0.08)); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.12);
    s.connect(g); s2.connect(g2).connect(g);
    out(g, o.bus || musicBus, 0.45, o.pan);
    // sopro
    nz(t, Math.min(0.12, d), f * 2, 2, vol * 0.25, { bus: o.bus || musicBus, wet: 0.2, a: 0.02 });
    for (const x of [s, s2, lfo]) { x.start(t); x.stop(t + d + 0.2); }
  }
  function drone(f, t, d, vol) {
    const s = A.createOscillator(), s2 = A.createOscillator(), g = A.createGain(), lp = A.createBiquadFilter();
    s.type = 'sawtooth'; s2.type = 'sawtooth'; s.frequency.value = f; s2.frequency.value = f * 1.5; s2.detune.value = 4;
    lp.type = 'lowpass'; lp.frequency.value = 700; lp.Q.value = 0.7;
    const g2 = A.createGain(); g2.gain.value = 0.5;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.6);
    g.gain.setValueAtTime(vol, t + d - 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    s.connect(lp); s2.connect(g2).connect(lp); lp.connect(g);
    out(g, musicBus, 0.3);
    for (const x of [s, s2]) { x.start(t); x.stop(t + d + 0.05); }
  }
  function drum(t, vol, low, bus) {
    osc('sine', low ? 110 : 190, t, low ? 0.35 : 0.18, vol, { f2: low ? 48 : 90, glide: 0.2, bus: bus || musicBus, wet: 0.25 });
    nz(t, 0.08, low ? 300 : 1200, 0.8, vol * 0.5, { type: 'lowpass', bus: bus || musicBus, wet: 0.2 });
  }

  // ---------------- efeitos ----------------
  const SFX = {
    place(v) { const t = T(); nz(t, 0.09, 700, 1.5, 0.35 * v, { type: 'lowpass' }); osc('triangle', 330, t, 0.1, 0.12 * v); osc('triangle', 495, t + 0.05, 0.12, 0.08 * v); },
    click(v) { const t = T(); osc('triangle', 880, t, 0.05, 0.05 * v, { wet: 0 }); nz(t, 0.03, 3000, 2, 0.08 * v, { wet: 0 }); },
    order(v) { const t = T(); nz(t, 0.12, 900, 1, 0.12 * v, { type: 'lowpass' }); osc('square', 220, t, 0.06, 0.02 * v, { lp: 900 }); },
    select(v) { const t = T(); nz(t, 0.06, 3500, 3, 0.06 * v); osc('sine', 1320, t, 0.08, 0.03 * v); },
    error(v) { const t = T(); osc('square', 160, t, 0.12, 0.05 * v, { lp: 800 }); osc('square', 120, t + 0.1, 0.16, 0.05 * v, { lp: 700 }); },
    demolish(v) { const t = T(); nz(t, 0.5, 300, 0.7, 0.4 * v, { type: 'lowpass', f2: 80 }); for (let k = 0; k < 5; k++) nz(t + 0.05 + k * 0.07, 0.08, 800 + Math.random() * 1500, 3, 0.15 * v); },
    horn(v) {
      const t = T();
      for (const [f, dl, d] of [[196, 0, 0.7], [294, 0.55, 1.2]]) {
        const s = A.createOscillator(), g = A.createGain(), lp = A.createBiquadFilter(), vib = A.createOscillator(), vg = A.createGain();
        s.type = 'sawtooth'; s.frequency.setValueAtTime(f * 0.94, t + dl); s.frequency.exponentialRampToValueAtTime(f, t + dl + 0.08);
        vib.frequency.value = 5; vg.gain.value = 2.5; vib.connect(vg).connect(s.frequency);
        lp.type = 'lowpass'; lp.frequency.setValueAtTime(400, t + dl); lp.frequency.exponentialRampToValueAtTime(1600, t + dl + 0.15);
        env(g, t + dl, 0.06, 0.12 * v, 0.3, d);
        out(s.connect(lp).connect(g), sfxBus, 0.5);
        s.start(t + dl); vib.start(t + dl); s.stop(t + dl + d + 0.5); vib.stop(t + dl + d + 0.5);
      }
    },
    alarm(v) { const t = T(); for (let k = 0; k < 4; k++) { const tt = t + k * 0.32; for (const [f, a] of [[1180, 1], [2950, 0.5], [4320, 0.3]]) osc('sine', f, tt, 0.6, 0.05 * v * a, { wet: 0.4 }); nz(tt, 0.02, 4000, 1, 0.1 * v); } },
    built(v) { const t = T(); [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => { pluck(f, t + i * 0.08, 0.35 * v, { bus: sfxBus, wet: 0.4 }); }); },
    win(v) { const t = T(); [392, 523.25, 659.25, 783.99, 1046.5].forEach((f, i) => { pluck(f, t + i * 0.11, 0.45 * v, { bus: sfxBus, wet: 0.5 }); osc('triangle', f, t + i * 0.11, 0.4, 0.04 * v, { a: 0.02 }); }); },
    unlock(v) { const t = T(); [659.25, 783.99, 987.77, 1318.5].forEach((f, i) => { osc('sine', f, t + i * 0.09, 1.2, 0.05 * v, { wet: 0.6 }); osc('sine', f * 2.76, t + i * 0.09, 0.4, 0.012 * v, { wet: 0.6 }); }); },
    chop(v, pan) { const t = T(); nz(t, 0.07, 1100, 2.5, 0.5 * v, { pan }); osc('triangle', 180, t, 0.09, 0.14 * v, { f2: 120, pan }); },
    hammer(v, pan) { const t = T(); for (const [f, a] of [[1870, 1], [2410, 0.6], [4130, 0.35], [5900, 0.2]]) osc('sine', f, t, 0.35 * (1.3 - a), 0.05 * v * a, { pan, wet: 0.25 }); nz(t, 0.02, 3500, 1.5, 0.2 * v, { pan }); },
    pick(v, pan) { const t = T(); nz(t, 0.05, 2600, 3, 0.4 * v, { pan }); osc('square', 1300 + Math.random() * 300, t, 0.04, 0.03 * v, { lp: 3000, pan }); },
    saw(v, pan) { const t = T(); for (let k = 0; k < 3; k++) nz(t + k * 0.16, 0.13, 2200 + k * 200, 5, 0.12 * v, { pan, a: 0.03, f2: 1600 }); },
    hit(v, pan) {
      const t = T(), base = 900 + Math.random() * 500;
      for (const r of [1, 1.47, 2.09, 2.56, 3.9]) osc('sine', base * r, t, 0.25 / r + 0.05, 0.035 * v, { pan, wet: 0.2 });
      nz(t, 0.05, 4500, 1.5, 0.3 * v, { pan });
    },
    arrow(v, pan) { const t = T(); nz(t, 0.22, 2500, 2, 0.12 * v, { pan, f2: 900, a: 0.03 }); osc('triangle', 110, t, 0.06, 0.05 * v, { pan }); },
    collapse(v, pan) { const t = T(); nz(t, 1.3, 220, 0.6, 0.6 * v, { type: 'lowpass', f2: 60, pan, wet: 0.3 }); for (let k = 0; k < 8; k++) nz(t + 0.1 + Math.random() * 0.8, 0.1, 500 + Math.random() * 1800, 2, 0.2 * v, { pan }); },
    bird(v) {
      const t = T(), f = 2400 + Math.random() * 1600, pan = Math.random() * 1.6 - 0.8, n = 2 + Math.floor(Math.random() * 3);
      for (let k = 0; k < n; k++) osc('sine', f * (1 + (k % 2) * 0.15), t + k * 0.11, 0.07, 0.03 * v, { f2: f * (k % 2 ? 0.8 : 1.35), pan, wet: 0.35, bus: ambBus });
    },
    footstep(v, pan) { nz(T(), 0.05, 300, 1, 0.08 * v, { type: 'lowpass', pan, wet: 0 }); },
    coins(v) { const t = T(); for (let k = 0; k < 4; k++) osc('sine', 2800 + Math.random() * 1500, t + k * 0.05, 0.12, 0.02 * v, { wet: 0.3 }); },
  };
  KM.sfx = function (name, vol, pan) {
    if (!KM.audioOn) return;
    try { ctx(); const f = SFX[name]; if (f) f(vol == null ? 1 : vol, pan); } catch (e) { if (KM.audioDebug) throw e; }
  };
  // som posicional: volume pela distância do foco da câmera e panorâmica pela posição na tela
  KM.sfxAt = function (name, x, y) {
    if (!KM.audioOn || !KM.R || !KM.R.focus) return;
    const f = KM.R.focus, dx = x + 0.5 - f.x, dy = y + 0.5 - f.y, d = Math.hypot(dx, dy);
    if (d > 22) return;
    const yaw = KM.R.yaw || 0, side = dx * Math.cos(yaw) - dy * Math.sin(yaw);
    KM.sfx(name, Math.max(0.1, 1 - d / 22) * KM.clamp(24 / (KM.R.dist || 20), 0.4, 1.2), KM.clamp(side / 14, -0.8, 0.8));
  };

  // ---------------- vozes (síntese de fala do navegador) ----------------
  const LINES = {
    select: ['Sim, senhor?', 'Às ordens!', 'Pronto!', 'Senhor?'],
    order: ['Em marcha!', 'Como quiser!', 'Imediatamente!', 'Vamos!'],
    attack: ['Ao ataque!', 'Pelo reino!', 'Avançar!'],
  };
  let lastVoice = 0;
  KM.voice = function (kind) {
    if (!cfg.voices || !KM.audioOn || !window.speechSynthesis) return;
    const now = performance.now();
    if (now - lastVoice < 1500) return;
    lastVoice = now;
    const L = LINES[kind] || LINES.select;
    const u = new SpeechSynthesisUtterance(L[Math.floor(Math.random() * L.length)]);
    const v = speechSynthesis.getVoices().find((x) => /pt(-|_)BR/i.test(x.lang)) || speechSynthesis.getVoices().find((x) => /^pt/i.test(x.lang));
    if (v) u.voice = v;
    u.lang = 'pt-BR'; u.rate = 1.05; u.pitch = 0.7 + Math.random() * 0.3; u.volume = cfg.sfx * cfg.master;
    speechSynthesis.cancel(); speechSynthesis.speak(u);
  };

  // ---------------- ambiente: vento, pássaros e sons de trabalho ----------------
  let wind = null;
  function windBed(on) {
    if (on && !wind) {
      const s = A.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
      const f = A.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 380; f.Q.value = 0.5;
      const g = A.createGain(); g.gain.value = 0.0;
      const lfo = A.createOscillator(), lg = A.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 160; lfo.connect(lg).connect(f.frequency);
      s.connect(f).connect(g).connect(ambBus); s.start(); lfo.start();
      wind = { s, g, lfo };
      g.gain.linearRampToValueAtTime(0.05, A.currentTime + 3);
    } else if (!on && wind) { wind.g.gain.linearRampToValueAtTime(0, A.currentTime + 0.5); const w = wind; setTimeout(() => { try { w.s.stop(); w.lfo.stop(); } catch (e) { /* ok */ } }, 700); wind = null; }
  }
  KM.ambientStop = function () { if (A && wind) windBed(false); };
  KM.ambient = function (S) {
    if (!KM.audioOn || !KM.R.vis || !A) return;
    windBed(!S.paused);
    if (wind) wind.g.gain.value = 0.035 + KM.clamp((KM.R.dist - 12) / 40, 0, 0.05);
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
      const s = { sawmill: 'saw', weaponsmithy: 'hammer', armorsmithy: 'hammer', ironsmithy: 'hammer', goldsmelter: 'hammer', weaponworkshop: 'saw', armorworkshop: 'hammer' }[h.type];
      if (s) KM.sfxAt(s, h.ex, h.ey);
      break;
    }
    if (Math.random() < 0.05) KM.sfx('bird', KM.clamp(24 / KM.R.dist, 0.3, 1));
  };

  // ---------------- música ----------------
  // modos (semitons a partir da tônica)
  const MODES = { dorian: [0, 2, 3, 5, 7, 9, 10], mixo: [0, 2, 4, 5, 7, 9, 10], aeolian: [0, 2, 3, 5, 7, 8, 10], ionian: [0, 2, 4, 5, 7, 9, 11] };
  // peças: tônica, modo, compasso, andamento, progressão (graus por compasso), instrumentação
  const PIECES = [
    { n: 'Campos de Aldor', root: 146.83, mode: 'dorian', meter: 3, bpm: 132, prog: [0, 0, 6, 6, 2, 2, 3, 4], lead: 'flute', drone: true },
    { n: 'A Taverna', root: 164.81, mode: 'mixo', meter: 3, bpm: 150, prog: [0, 6, 0, 4, 0, 6, 3, 4], lead: 'lute', drum: true },
    { n: 'Névoa no Vale', root: 130.81, mode: 'aeolian', meter: 4, bpm: 84, prog: [0, 5, 2, 6, 0, 5, 3, 4], lead: 'flute' },
    { n: 'Feira de Mercadores', root: 146.83, mode: 'ionian', meter: 4, bpm: 112, prog: [0, 3, 4, 0, 5, 3, 4, 0], lead: 'lute', drum: true },
    { n: 'Canção do Moinho', root: 174.61, mode: 'dorian', meter: 3, bpm: 120, prog: [0, 3, 0, 6, 0, 3, 4, 0], lead: 'flute', drone: true },
  ];
  const BATTLE = { n: 'Tambores de Guerra', root: 110, mode: 'aeolian', meter: 4, bpm: 138, prog: [0, 0, 5, 6, 0, 0, 3, 4], lead: 'flute', drum: true, battle: true };
  const freq = (P, deg, oct) => {
    const md = MODES[P.mode], o = Math.floor(deg / 7), d = ((deg % 7) + 7) % 7;
    return P.root * Math.pow(2, (md[d] + 12 * (o + (oct || 0))) / 12);
  };
  // melodia por motivos: um motivo de 2 compassos, repetido com variação, cadência na tônica (AABA')
  function compose(P, seed) {
    let s = seed >>> 0;
    const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    const rhythms = P.meter === 3 ? [[1, 1, 1], [2, 1], [1, 0.5, 0.5, 1], [3], [1.5, 0.5, 1]] : [[1, 1, 1, 1], [2, 1, 1], [1, 0.5, 0.5, 2], [1.5, 0.5, 1, 1], [4], [2, 2]];
    const motif = (startDeg) => {
      const bars = [];
      let cur = startDeg;
      for (let b = 0; b < 2; b++) {
        const r = rhythms[Math.floor(rnd() * rhythms.length)], bar = [];
        for (const dur of r) {
          const step = rnd() < 0.7 ? (rnd() < 0.5 ? 1 : -1) : (rnd() < 0.5 ? 2 : -2);
          cur = KM.clamp(cur + (bar.length ? step : 0), 0, 11);
          bar.push([cur, dur]);
        }
        bars.push(bar);
      }
      return bars;
    };
    const A1 = motif(4 + Math.floor(rnd() * 3)), B1 = motif(7 + Math.floor(rnd() * 3));
    const vary = (m) => m.map((bar) => bar.map(([d, l], i) => [i === bar.length - 1 ? d : KM.clamp(d + (rnd() < 0.3 ? (rnd() < 0.5 ? 1 : -1) : 0), 0, 11), l]));
    const cad = [[[4, P.meter === 3 ? 2 : 2], [3, 1]].concat(P.meter === 4 ? [[1, 1]] : []), [[0, P.meter]]];
    // 8 compassos por seção; peça = A A B A' (32 compassos, casando com a progressão de 8)
    const sec = (m, end) => m.concat(vary(m), m, end ? cad : vary(m));
    return [sec(A1), sec(A1), sec(B1), sec(vary(A1), true)].flat();
  }

  KM.music = {
    playing: false, timer: null, piece: null, bar: 0, beat: 0, mel: null, mi: 0,
    start() {
      if (this.playing || !KM.musicOn) return;
      try { ctx(); } catch (e) { return; }
      if (A.state === 'suspended') A.resume();
      this.playing = true;
      this.nextT = A.currentTime + 0.3;
      this.newPiece(false);
      this.timer = setInterval(() => this.schedule(), 150);
    },
    stop() { this.playing = false; clearInterval(this.timer); },
    newPiece(battle) {
      const pool = PIECES.filter((p) => p !== this.piece);
      this.piece = battle ? BATTLE : pool[Math.floor(Math.random() * pool.length)];
      this.mel = compose(this.piece, Math.floor(Math.random() * 1e9));
      this.bar = 0; this.bi = 0; this.bt = 0; this.rest = 0;
      this.loops = 0;
    },
    schedule() {
      if (!this.playing || !A) return;
      const S = KM.S;
      const battle = !!(S && S.lastWarn && S.time - S.lastWarn < 40);
      while (this.nextT < A.currentTime + 0.5) {
        // pausa entre peças
        if (this.rest > 0) { this.nextT += this.rest; this.rest = 0; this.newPiece(battle); continue; }
        if (battle !== !!this.piece.battle && this.bt === 0 && this.bar % 4 === 0) { this.rest = 0.6; this.bar = 0; continue; }
        const P = this.piece, spb = 60 / P.bpm, barLen = spb * P.meter, t = this.nextT;
        const chord = P.prog[this.bar % P.prog.length];
        // acompanhamento: baixo no tempo forte + arpejo do alaúde
        pluck(freq(P, chord, -1), t, 0.55, { dur: 2.2, bright: 0.4, wet: 0.3 });
        const arp = [chord, chord + 2, chord + 4, chord + 2, chord + 7, chord + 4];
        const steps = P.meter * 2;
        for (let k = 1; k < steps; k++) if (P.lead === 'flute' || k % 2 === 0) pluck(freq(P, arp[k % arp.length], 0), t + k * spb / 2, 0.22, { dur: 1.2, bright: 0.6, pan: -0.25 });
        if (P.drone && this.bar % 4 === 0) drone(freq(P, 0, -2), t, barLen * 4, 0.035);
        if (P.drum || P.battle) for (let k = 0; k < P.meter; k++) drum(t + k * spb, k === 0 ? 0.35 : 0.18, k === 0, musicBus);
        if (P.battle) for (let k = 0; k < P.meter * 2; k++) if (k % 2) nz(t + k * spb / 2, 0.05, 5000, 1, 0.04, { bus: musicBus, wet: 0.1 });
        // melodia
        const bar = this.mel[this.bar % this.mel.length];
        let bt = 0;
        for (let [deg, len] of bar) {
          // tempo forte: aproxima a nota da tríade do acorde para soar consonante
          if (bt === 0) { let best = deg, bd = 99; for (const c of [chord, chord + 2, chord + 4, chord + 7, chord + 9, chord - 3]) { const dd = Math.abs(c - deg); if (dd < bd) { bd = dd; best = c; } } deg = KM.clamp(best, -2, 12); }
          const f = freq(P, deg, 1);
          if (P.lead === 'flute') flute(f, t + bt * spb, len * spb * 0.95, 0.07, { pan: 0.2 });
          else pluck(f * 1, t + bt * spb, 0.42, { dur: Math.max(0.8, len * spb * 1.5), bright: 0.75, pan: 0.2 });
          bt += len;
        }
        this.nextT += barLen;
        this.bar++;
        if (this.bar >= this.mel.length) {
          this.loops++;
          this.bar = 0;
          if (this.loops >= (P.battle ? 3 : 1)) this.rest = P.battle ? 0.5 : 4 + Math.random() * 6;
        }
      }
    },
  };
})(window.KM);
