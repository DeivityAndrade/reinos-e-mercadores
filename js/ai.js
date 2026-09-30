'use strict';
/* IA dos jogadores controlados pelo computador: economia real, ondas ou posto avançado */
(function (KM) {
  KM.setupAI = function (S, o, ai, diff) {
    const D = KM.DIFF[diff] || KM.DIFF.normal;
    ai = ai || { mode: 'none' };
    S.players[o].ai = {
      mode: ai.mode || 'none',
      next: ai.peace != null ? ai.peace : D.peace,
      interval: ai.interval || D.interval,
      mult: ai.mult || D.mult,
      def: ai.def != null ? ai.def : D.def,
      waveSize: ai.waveSize || 1,
      wave: 0, defT: 30, warned: false,
      buildT: 3 + o, cheatT: 45, fieldT: 5 + o, equipT: 4,
      attackN: ai.attackN || Math.round(12 * D.mult), fail: {},
    };
  };

  function find(S, o, type) {
    for (const id in S.houses) { const h = S.houses[id]; if (h.owner === o && h.type === type && h.state === 'built') return h; }
    return null;
  }
  function count(S, o, type) {
    let n = 0;
    for (const id in S.houses) { const h = S.houses[id]; if (h.owner === o && h.type === type) n++; }
    return n;
  }
  function nearestHostileHouse(S, o, x, y) {
    let best = null, bd = 1e9;
    for (const id in S.houses) {
      const h = S.houses[id];
      if (!KM.hostile(S, o, h.owner) || h.state === 'plan' || S.players[h.owner].out) continue;
      const d = Math.hypot(h.ex - x, h.ey - y);
      if (d < bd) { bd = d; best = h; }
    }
    return best;
  }
  const warnMe = (S, o, msg, pos) => { if (KM.hostile(S, o, KM.me)) KM.notify(S, msg, 'danger', pos); };

  KM.updateAI = function (S, dt) {
    S.players.forEach((p, o) => {
      const ai = p.ai;
      if (!ai || ai.mode === 'none' || p.human || p.out) return;
      const bar = find(S, o, 'barracks');
      if (ai.mode === 'waves' && bar) wavesAI(S, o, ai, bar, dt);
      if (ai.mode === 'economy') economyAI(S, o, ai, bar, dt);
      defend(S, o, ai);
      updateAssault(S, o, ai);
      retarget(S, o);
    });
  };


  // ---------- táticas: defesa da cidade e ataque reunido ----------
  // soldados inimigos perto das casas da IA fazem os defensores reagirem; depois eles voltam ao posto
  function defend(S, o, ai) {
    const core = [];
    for (const id in S.houses) { const h = S.houses[id]; if (h.owner === o && h.state !== 'plan') core.push(h); }
    let tx = 0, ty = 0, n = 0;
    for (const id in S.units) {
      const u = S.units[id];
      if (u.inside || !KM.isSoldier(u.type) || !KM.hostile(S, o, u.owner)) continue;
      for (const h of core) if (Math.abs(h.ex - u.x) < 10 && Math.abs(h.ey - u.y) < 10) { tx += u.x; ty += u.y; n++; break; }
    }
    const defs = Object.values(S.army).filter((g) => g.owner === o && !g.stage && KM.groupUnits(S, g).every((u) => u.ai !== 'atk'));
    if (n) {
      ai.threat = { x: Math.round(tx / n), y: Math.round(ty / n) };
      for (const g of defs) {
        if (!g.home) g.home = { x: g.ax, y: g.ay, dir: g.dir };
        if (S.time - (g.defT || -99) < 6 || KM.groupUnits(S, g).some((u) => u.target)) continue;
        g.defT = S.time;
        KM.orderGroups(S, [g], ai.threat.x, ai.threat.y, true);
      }
    } else if (ai.threat) {
      ai.threat = null;
      for (const g of defs) if (g.home) { KM.formGroup(S, g, g.home.x, g.home.y, g.home.dir); g.home = null; }
    }
  }
  // reúne as tropas num ponto antes do alvo e só então ataca todas juntas
  function launchAssault(S, o, ai, groups, from, target) {
    if (ai.assault) { ai.assault.t = -1e9; updateAssault(S, o, ai); }
    const dx = target.ex - from.x, dy = target.ey - from.y, dl = Math.hypot(dx, dy) || 1;
    const k = KM.clamp((dl - 11) / dl, 0, 0.7);
    const p = KM.nearestWalkable(S, Math.round(from.x + dx * k), Math.round(from.y + dy * k), 6) || [target.ex, target.ey + 1];
    for (const g of groups) g.stage = 1;
    KM.orderGroups(S, groups, p[0], p[1], true);
    ai.assault = { g: groups.map((g) => g.id), x: p[0], y: p[1], t: S.time, target: target.id };
  }
  function updateAssault(S, o, ai) {
    const a = ai.assault;
    if (!a) return;
    const gs = a.g.map((id) => S.army[id]).filter(Boolean);
    if (!gs.length) { ai.assault = null; return; }
    const ready = gs.filter((g) => { const c = KM.groupCenter(S, g); return Math.hypot(c.x - a.x, c.y - a.y) < 5; }).length;
    if (ready < gs.length * 0.8 && S.time - a.t < 55) return;
    let tg = S.houses[a.target];
    if (!tg || !KM.hostile(S, o, tg.owner) || S.players[tg.owner].out) tg = nearestHostileHouse(S, o, a.x, a.y);
    for (const g of gs) g.stage = 0;
    if (tg) KM.orderGroups(S, gs, tg.ex, tg.ey + 1, true);
    ai.assault = null;
  }

  // ---------- ondas ----------
  function wavesAI(S, o, ai, bar, dt) {
    if (!ai.warned && S.time >= ai.next - 60) { ai.warned = true; if (KM.hostile(S, o, KM.me)) KM.notify(S, `👁️ Batedores relatam movimentação no acampamento de ${S.players[o].name}...`, 'warn'); }
    if (S.time >= ai.next) launchWave(S, o, ai, bar);
    ai.defT -= dt;
    if (ai.defT <= 0) {
      ai.defT = 50 / ai.mult;
      let n = 0;
      for (const id in S.units) { const u = S.units[id]; if (u.owner === o && u.ai === 'def') n++; }
      if (n < ai.def) {
        const types = ai.wave > 3 ? ['swordsman', 'crossbowman', 'pikeman'] : ['axeman', 'bowman', 'lancer'];
        const u = KM.addUnit(S, types[Math.floor(KM.rand() * types.length)], o, bar.ex, bar.ey);
        u.ai = 'def';
        KM.joinRally(S, u, bar);
      }
    }
  }

  function launchWave(S, o, ai, bar) {
    ai.wave++;
    ai.warned = false;
    const w = ai.wave;
    const n = Math.max(2, Math.round((2 + w * 1.7) * ai.mult * ai.waveSize));
    let pool = ['militia', 'axeman', 'bowman'];
    if (w >= 3) pool = ['axeman', 'bowman', 'lancer', 'swordsman'];
    if (w >= 5) pool = ['swordsman', 'crossbowman', 'pikeman', 'knight', 'scout', 'axeman'];
    if (w >= 8) pool = ['swordsman', 'crossbowman', 'pikeman', 'knight', 'knight'];
    const byType = {};
    for (let k = 0; k < n; k++) {
      const t = pool[Math.floor(KM.rand() * pool.length)];
      const u = KM.addUnit(S, t, o, bar.ex, bar.ey);
      u.ai = 'atk';
      (byType[t] = byType[t] || []).push(u);
    }
    const groups = Object.keys(byType).map((t) => KM.newGroup(S, o, t, byType[t]));
    const target = nearestHostileHouse(S, o, bar.ex, bar.ey);
    if (target) launchAssault(S, o, ai, groups, { x: bar.ex, y: bar.ey }, target);
    ai.next = S.time + ai.interval * Math.max(0.55, 1 - 0.04 * w);
    if (target) {
      warnMe(S, o, `🚩 ${S.players[o].name} enviou ${n} soldados! (onda ${w})`, target.owner === KM.me ? { x: target.ex, y: target.ey } : null);
      if (target.owner === KM.me) KM.sfx && KM.sfx('horn');
    }
  }

  // ---------- economia real ----------
  const WANT = [
    ['school', 1], ['inn', 1], ['woodcutter', 2], ['sawmill', 1], ['quarry', 1], ['farm', 2], ['mill', 1], ['bakery', 1],
    ['barracks', 1], ['weaponworkshop', 1], ['armorworkshop', 1], ['swine', 1], ['butcher', 1], ['tannery', 1],
    ['coalmine', 1], ['ironmine', 1], ['ironsmithy', 1], ['weaponsmithy', 1], ['armorsmithy', 1],
    ['goldmine', 1], ['goldsmelter', 1], ['coalmine', 2], ['farm', 3], ['stables', 1], ['woodcutter', 3],
    ['fisher', 1], ['tower', 3], ['inn', 2], ['swine', 2], ['farm', 4], ['tower', 5],
  ];

  function economyAI(S, o, ai, bar, dt) {
    const st = find(S, o, 'storehouse');
    if (!st) return;
    ai.cheatT -= dt;
    if (ai.cheatT <= 0) {
      ai.cheatT = 60;
      const k = ai.mult;
      KM.add(st.inv, 'wood', Math.round(2 * k)); KM.add(st.inv, 'stone', Math.round(2 * k)); KM.add(st.inv, 'gold', Math.round(1.5 * k));
      KM.add(st.inv, 'bread', Math.round(2 * k));
      if (k >= 1.3) { KM.add(st.inv, 'coal', 1); KM.add(st.inv, 'iron', 1); }
    }
    ai.buildT -= dt;
    if (ai.buildT <= 0) { ai.buildT = 4; planBuild(S, o, ai, st); }
    ai.fieldT -= dt;
    if (ai.fieldT <= 0) {
      ai.fieldT = 20;
      for (const id in S.houses) {
        const h = S.houses[id];
        if (h.owner !== o || h.state !== 'built' || (h.type !== 'farm' && h.type !== 'vineyard')) continue;
        let n = 0; const m = S.map;
        for (let y = h.ey - 5; y <= h.ey + 5; y++) for (let x = h.ex - 5; x <= h.ex + 5; x++) if (KM.inb(x, y) && m.field[y * m.W + x] && m.fown[y * m.W + x] === o) n++;
        if (n < 8) KM.fieldsAround(S, h, h.type === 'farm' ? 'corn' : 'wine', 8 - n, false);
      }
    }
    ai.equipT -= dt;
    let army = 0;
    for (const id in S.units) { const u = S.units[id]; if (u.owner === o && KM.isSoldier(u.type)) army++; }
    if (ai.equipT <= 0 && bar && army < 18 + 14 * ai.mult + ai.wave * 4) {
      ai.equipT = 8 / ai.mult;
      const ORDER = ['knight', 'swordsman', 'crossbowman', 'pikeman', 'scout', 'axeman', 'bowman', 'lancer', 'militia'];
      for (const t of ORDER) while (KM.equip(S, bar, t));
      // estoque de armas (quartel + armazém)
      const have = {};
      for (const r of KM.WEAPONS) have[r] = (bar.inv[r] || 0) + (st.inv[r] || 0);
      // encomendas das oficinas: produz o que está em falta, para o que sobra
      for (const id in S.houses) {
        const h = S.houses[id];
        if (h.owner !== o || !h.orders) continue;
        const rs = KM.def(h).recipes;
        h.orders = rs.map((rc) => { const r = Object.keys(rc.out)[0]; return (have[r] || 0) < (r === 'shield' ? 6 : 10) ? KM.INF : 0; });
      }
      // recrutas: só quantos o estoque consegue equipar (+2 de folga)
      let feasible = 0;
      const inv = Object.assign({}, have);
      for (const t of ORDER) {
        const c = KM.SOLDIERS[t].cost;
        while (Object.keys(c).every((r) => (inv[r] || 0) >= c[r])) { for (const r in c) inv[r] -= c[r]; feasible++; if (feasible > 40) break; }
      }
      const school = find(S, o, 'school');
      if (school && school.queue.length < 5) {
        let rec = bar.recruits;
        for (const id in S.units) { const u = S.units[id]; if (u.owner === o && u.type === 'recruit' && !u.home) rec++; }
        for (const q of school.queue) if (q === 'recruit') rec++;
        if (rec < feasible + 2) school.queue.push('recruit');
      }
    }
    if (S.time >= ai.next) {
      const groups = Object.values(S.army).filter((g) => g.owner === o);
      let n = 0;
      for (const g of groups) n += g.m.length;
      if (!ai.warned && n >= ai.attackN - 3) { ai.warned = true; if (KM.hostile(S, o, KM.me)) KM.notify(S, `👁️ Batedores relatam o exército de ${S.players[o].name} se reunindo...`, 'warn'); }
      if (n >= ai.attackN) {
        const def = groups.filter((g) => KM.groupUnits(S, g).every((u) => u.ai !== 'atk'));
        def.sort((a, b) => b.m.length - a.m.length || a.id - b.id);
        // envia os maiores grupos até somar o tamanho do ataque; o resto fica defendendo
        const send = []; let cnt = 0;
        for (const g of def) { if (cnt >= ai.attackN * 1.15) break; send.push(g); cnt += g.m.length; }
        let sent = 0;
        for (const g of send) for (const u of KM.groupUnits(S, g)) { u.ai = 'atk'; sent++; }
        const target = nearestHostileHouse(S, o, st.ex, st.ey);
        if (target && sent) {
          launchAssault(S, o, ai, send, { x: st.ex, y: st.ey }, target);
          ai.wave++;
          warnMe(S, o, `🚩 ${S.players[o].name} enviou ${sent} soldados para a batalha!`, target.owner === KM.me ? { x: target.ex, y: target.ey } : null);
          if (target.owner === KM.me) KM.sfx && KM.sfx('horn');
        }
        ai.attackN += 4; ai.warned = false;
        ai.next = S.time + 90;
      }
    }
  }

  function planBuild(S, o, ai, st) {
    let sites = 0;
    for (const id in S.houses) { const h = S.houses[id]; if (h.owner === o && h.state !== 'built') sites++; }
    if (sites >= (ai.mult >= 1.4 ? 3 : 2)) return;
    const foe = nearestHostileHouse(S, o, st.ex, st.ey);
    const cx = KM.hcx(st), cy = KM.hcy(st);
    for (const [t, n] of WANT) {
      if (count(S, o, t) >= n) continue;
      if ((ai.fail[t + n] || 0) > S.time) continue;
      let score = KM.spotScore(S, t);
      let R = 16;
      if (KM.HOUSES[t].mine) R = 24;
      if (t === 'tower' && foe) {
        const dl = Math.hypot(foe.ex - cx, foe.ey - cy) || 1;
        const tx = cx + ((foe.ex - cx) / dl) * 8, ty = cy + ((foe.ey - cy) / dl) * 8;
        score = (x, y) => Math.hypot(x - tx, y - ty) * 1.5 - Math.hypot(x - cx, y - cy);
      }
      const p = KM.findSpot(S, t, o, cx, cy, R, score);
      if (!p) { ai.fail[t + n] = S.time + 120; continue; }
      const h = KM.addHouse(S, t, o, p.x, p.y, false);
      KM.connectRoad(S, h, false);
      return;
    }
  }

  function retarget(S, o) {
    for (const id in S.army) {
      const g = S.army[id];
      if (g.owner !== o) continue;
      const us = KM.groupUnits(S, g);
      if (!us.length || us[0].ai !== 'atk' || g.stage) continue;
      if (us.some((u) => u.order || u.target || u.path)) continue;
      const c = KM.groupCenter(S, g);
      const h = nearestHostileHouse(S, o, c.x, c.y);
      if (h) { KM.orderGroups(S, [g], h.ex, h.ey + 1, true); continue; }
      let best = null, bd = 1e9;
      for (const vid in S.units) { const v = S.units[vid]; if (!KM.hostile(S, o, v.owner) || v.inside) continue; const d = Math.hypot(v.x - c.x, v.y - c.y); if (d < bd) { bd = d; best = v; } }
      if (best) KM.orderGroups(S, [g], best.tx, best.ty, true);
    }
  }
})(window.KM);
