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
      gap: ai.gap || D.gap || 330,
      mult: ai.mult || D.mult,
      def: ai.def != null ? ai.def : D.def,
      waveSize: ai.waveSize || 1,
      wave: 0, defT: 30, warned: false,
      buildT: 3 + o, fieldT: 5 + o, equipT: 4,
      attackN: ai.attackN || Math.round(12 * D.mult), fail: {},
      baseAttackN: ai.attackN || Math.round(12 * D.mult),
      strat: ai.strat || ['assalto', 'pinca', 'cerco', 'saque', 'equilibrado'][Math.floor(KM.hash(o, (S.seed | 0) % 9973, 17) * 5)], // estilo de ataque
      fair: !!ai.fair, // fair: sem recursos extras e seguindo a árvore de progressão (usado para testar o equilíbrio)
    };
  };

  function find(S, o, type) {
    for (const id in S.houses) { const h = S.houses[id]; if (h.owner === o && h.type === type && h.state === 'built') return h; }
    return null;
  }
  function count(S, o, type) {
    let n = 0;
    for (const id in S.houses) { const h = S.houses[id]; if (h.owner === o && h.type === type && (h.state !== 'built' || !exhausted(S, h))) n++; }
    return n;
  }
  function exhausted(S, h) {
    const d = KM.def(h), m = S.map;
    if (d.mine) return !KM.findOre(S, KM.hcx(h), KM.hcy(h), d.mine, false);
    if (d.gather !== 'stone') return false;
    for (let y = h.ey - d.radius; y <= h.ey + d.radius; y++) for (let x = h.ex - d.radius; x <= h.ex + d.radius; x++) {
      if (KM.inb(x, y) && Math.hypot(x - h.ex, y - h.ey) <= d.radius && m.stone[y * m.W + x] > 0) return false;
    }
    return true;
  }
  function useMarket(S, o, st) {
    const h = find(S, o, 'market');
    if (!h || h.tradeT > 0 || (h.trade && h.trade.n > 0)) return;
    const wood = (st.inv.wood || 0) + (h.inv.wood || 0);
    if ((st.inv.stone || 0) < 12 && wood > 24) h.trade = { sell: 'wood', buy: 'stone', n: 4 };
    else if ((st.inv.gold || 0) < 8 && wood > 36) h.trade = { sell: 'wood', buy: 'gold', n: 2 };
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
  // alvo de ataque: pesa distância, defesa ao redor (soldados e torres) e valor (Armazém, Escola e Quartel derrubam o reino)
  const CORE = { storehouse: 10, school: 8, barracks: 9, tower: -2 };
  // mode: 'raid' (saque: casas de produção longe da defesa) ou 'siege' (cerco: torres primeiro)
  const ECON = { farm: 1, vineyard: 1, woodcutter: 1, quarry: 1, sawmill: 1, mill: 1, bakery: 1, swine: 1, butcher: 1, fisher: 1, coalmine: 1, ironmine: 1, goldmine: 1, tannery: 1, market: 1 };
  function bestTarget(S, o, x, y, mode) {
    const cand = [];
    for (const id in S.houses) {
      const h = S.houses[id];
      if (!KM.hostile(S, o, h.owner) || h.state === 'plan' || S.players[h.owner].out) continue;
      cand.push(h);
    }
    if (!cand.length) return null;
    // só avalia os mais próximos (custo baixo)
    cand.sort((a, b) => Math.hypot(a.ex - x, a.ey - y) - Math.hypot(b.ex - x, b.ey - y));
    let best = null, bs = 1e9;
    for (const h of cand.slice(0, 12)) {
      let def = 0;
      for (const id in S.units) { const u = S.units[id]; if (u.owner === h.owner && KM.isSoldier(u.type) && Math.abs(u.x - h.ex) < 7 && Math.abs(u.y - h.ey) < 7) def++; }
      for (const id in S.houses) { const t = S.houses[id]; if (t.owner === h.owner && t.type === 'tower' && t.state === 'built' && Math.abs(t.ex - h.ex) < 7 && Math.abs(t.ey - h.ey) < 7) def += 3; }
      const val = mode === 'raid' ? (ECON[h.type] ? 10 : -25) : mode === 'siege' ? (h.type === 'tower' ? 14 : CORE[h.type] || 0) : CORE[h.type] || 0;
      const s = Math.hypot(h.ex - x, h.ey - y) + def * (mode === 'raid' ? 4 : 1.2) - val;
      if (s < bs) { bs = s; best = h; }
    }
    return best;
  }
  const warnMe = (S, o, msg, pos) => { if (KM.hostile(S, o, KM.me)) KM.notify(S, msg, 'danger', pos); };
  function strategicTarget(S, o) {
    const site = (S.sites || []).find((s) => s.owner >= 0 && KM.hostile(S, o, s.owner));
    return site ? { id: 0, ex: site.x, ey: site.y, site: site.id } : null;
  }

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
  // side: deslocamento lateral do ponto de encontro (pinça); cada ataque é acompanhado separadamente
  function launchAssault(S, o, ai, groups, from, target, side) {
    ai.assaults = ai.assaults || [];
    if (ai.assault) { ai.assaults.push(ai.assault); ai.assault = null; }
    const dx = target.ex - from.x, dy = target.ey - from.y, dl = Math.hypot(dx, dy) || 1;
    const k = KM.clamp((dl - 11) / dl, 0, 0.7);
    const px = -dy / dl, py = dx / dl, off = (side || 0) * 9;
    const p = KM.nearestWalkable(S, Math.round(from.x + dx * k + px * off), Math.round(from.y + dy * k + py * off), 7) || [target.ex, target.ey + 1];
    for (const g of groups) { g.stage = 1; g.size0 = g.m.length; g.objective = target.site || null; }
    KM.orderGroups(S, groups, p[0], p[1], true);
    ai.assaults.push({ g: groups.map((g) => g.id), x: p[0], y: p[1], t: S.time, target: target.id, site: target.site, pair: side ? ai.wave + 1 : 0 });
  }
  function updateAssault(S, o, ai) {
    if (ai.assault) { (ai.assaults = ai.assaults || []).push(ai.assault); ai.assault = null; }
    const list = ai.assaults || [];
    for (let i = list.length - 1; i >= 0; i--) {
      const a = list[i];
      const gs = a.g.map((id) => S.army[id]).filter(Boolean);
      if (!gs.length) { list.splice(i, 1); continue; }
      const ready = gs.filter((g) => { const c = KM.groupCenter(S, g); return Math.hypot(c.x - a.x, c.y - a.y) < 5; }).length;
      a.ready = ready >= gs.length * 0.8 || S.time - a.t > 55;
      // pinça: as duas metades esperam uma pela outra para atacar juntas
      const partner = a.pair ? list.find((b) => b !== a && b.pair === a.pair) : null;
      if (!a.ready || (partner && !partner.ready && S.time - a.t < 70)) continue;
      let tg = S.houses[a.target];
      const site = (S.sites || []).find((s) => s.id === a.site);
      if (site) tg = { ex: site.x, ey: site.y, owner: site.owner };
      if (!site && (!tg || !KM.hostile(S, o, tg.owner) || S.players[tg.owner].out)) tg = nearestHostileHouse(S, o, a.x, a.y);
      for (const g of gs) g.stage = 0;
      if (tg) KM.orderGroups(S, gs, tg.ex, tg.ey + 1, true);
      list.splice(i, 1);
    }
  }
  // saque: grupo pequeno e rápido contra casas de produção mal defendidas (recua quando apanha)
  function raid(S, o, ai, st) {
    if (S.time < ai.next - 60 || S.time < (S.peaceEnd || 0) || S.time - (ai.raidT || 0) < (ai.gap || 330)) return;
    const idle = Object.values(S.army).filter((g) => g.owner === o && !g.stage && KM.groupUnits(S, g).every((u) => u.ai !== 'atk'));
    idle.sort((a, b) => (KM.SOLDIERS[b.type].spd - KM.SOLDIERS[a.type].spd) || a.id - b.id);
    const pick = [];
    let n = 0;
    for (const g of idle) { if (n >= 6) break; pick.push(g); n += g.m.length; }
    if (n < 3) return;
    const tg = bestTarget(S, o, st.ex, st.ey, 'raid');
    if (!tg) return;
    ai.raidT = S.time;
    for (const g of pick) { g.size0 = g.m.length; for (const u of KM.groupUnits(S, g)) u.ai = 'atk'; }
    KM.orderGroups(S, pick, tg.ex, tg.ey + 1, true);
    warnMe(S, o, `Saqueadores de ${S.players[o].name} atacam sua produção!`, tg.owner === KM.me ? { x: tg.ex, y: tg.ey } : null);
  }

  // ---------- ondas ----------
  function wavesAI(S, o, ai, bar, dt) {
    if (!ai.warned && S.time >= ai.next - 60) { ai.warned = true; if (KM.hostile(S, o, KM.me)) KM.notify(S, `Batedores relatam movimentação no acampamento de ${S.players[o].name}...`, 'warn'); }
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
    const target = bestTarget(S, o, bar.ex, bar.ey);
    if (target) launchAssault(S, o, ai, groups, { x: bar.ex, y: bar.ey }, target);
    ai.next = S.time + ai.interval * Math.max(0.55, 1 - 0.04 * w);
    if (target) {
      warnMe(S, o, `${S.players[o].name} enviou ${n} soldados! (onda ${w})`, target.owner === KM.me ? { x: target.ex, y: target.ey } : null);
      if (target.owner === KM.me) KM.sfx && KM.sfx('horn');
    }
  }

  // ---------- economia real ----------

  function economyAI(S, o, ai, bar, dt) {
    const st = find(S, o, 'storehouse');
    if (!st) return;
    // Protege o ouro da Escola quando o tesouro está baixo; depois restaura a distribuição.
    const scarceGold = (st.inv.gold || 0) < 12;
    const dist = S.players[o].dist.coal;
    dist.goldsmelter = 5; dist.ironsmithy = scarceGold ? 2 : 5;
    dist.weaponsmithy = dist.armorsmithy = scarceGold ? 1 : 5;
    ai.buildT -= dt;
    if (ai.buildT <= 0) {
      ai.buildT = 5 / ai.mult; useMarket(S, o, st); planBuild(S, o, ai, st);
      const scarceFood = Object.keys(KM.FOOD).reduce((n, r) => n + (st.inv[r] || 0), 0) < 25;
      S.players[o].dist.corn.mill = 5;
      S.players[o].dist.corn.swine = scarceFood ? 2 : 5;
      S.players[o].dist.corn.stables = scarceFood ? 0 : 5;
    }
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
    if (ai.equipT <= 0 && bar && army < 6 + 24 * ai.mult + ai.wave * 4 * ai.mult) {
      ai.equipT = 8 / ai.mult;
      const ORDER = ['knight', 'swordsman', 'crossbowman', 'pikeman', 'scout', 'axeman', 'bowman', 'lancer', 'militia'];
      for (const t of ORDER) { if (!KM.soldierUnlocked(S, o, t)) continue; while (KM.equip(S, bar, t)); }
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
        if (!KM.soldierUnlocked(S, o, t)) continue;
        const c = KM.SOLDIERS[t].cost;
        while (Object.keys(c).every((r) => (inv[r] || 0) >= c[r])) { for (const r in c) inv[r] -= c[r]; feasible++; if (feasible > 40) break; }
      }
      const school = find(S, o, 'school');
      if (school && school.queue.length < 3 && (st.inv.gold || 0) + (school.inv.gold || 0) > 3) {
        let rec = bar.recruits;
        for (const id in S.units) { const u = S.units[id]; if (u.owner === o && u.type === 'recruit' && !u.home) rec++; }
        for (const q of school.queue) if (q === 'recruit') rec++;
        if (rec < feasible + 2) school.queue.push('recruit');
      }
    }
    if (ai.strat === 'saque') raid(S, o, ai, st);
    if (S.time >= ai.next) {
      // Só conta tropas disponíveis, bem alimentadas e que não estão em outro ataque.
      const groups = Object.values(S.army).filter((g) => g.owner === o && !g.stage && KM.groupUnits(S, g).every((u) => u.ai !== 'atk' && u.hunger > 40));
      let n = 0;
      for (const g of groups) n += g.m.length;
      const wanted = Math.min(ai.attackN, Math.round(24 * ai.mult));
      const reserve = Math.min(Math.max(0, n - 4), Math.round(2 + ai.mult * 2));
      const available = n - reserve;
      const threshold = S.time - ai.next > 180 ? Math.max(4, Math.ceil(wanted * 0.65)) : wanted;
      if (!ai.warned && available >= threshold - 3) { ai.warned = true; if (KM.hostile(S, o, KM.me)) KM.notify(S, `Batedores relatam o exército de ${S.players[o].name} se reunindo...`, 'warn'); }
      if (available >= threshold) {
        const def = groups;
        def.sort((a, b) => b.m.length - a.m.length || a.id - b.id);
        // envia os maiores grupos até somar o tamanho do ataque; o resto fica defendendo
        const send = []; let cnt = 0;
        for (const g of def) { if (cnt >= wanted || cnt + g.m.length > available) continue; send.push(g); cnt += g.m.length; }
        // Um único grupo grande pode atacar; a reserva não deve impedir todas as ordens.
        if (!send.length && def.length === 1) send.push(def[0]);
        let sent = 0;
        for (const g of send) for (const u of KM.groupUnits(S, g)) { u.ai = 'atk'; sent++; }
        // estratégia do reino: assalto, pinça (dois lados), cerco (torres primeiro) ou saque (com assalto principal)
        const strat = ai.strat === 'equilibrado' ? (ai.wave % 2 ? 'pinca' : 'assalto') : ai.strat || 'assalto';
        const target = strategicTarget(S, o) || bestTarget(S, o, st.ex, st.ey, strat === 'cerco' ? 'siege' : null);
        if (target && sent) {
          if (strat === 'pinca' && send.length >= 2) {
            launchAssault(S, o, ai, send.filter((g, i) => i % 2 === 0), { x: st.ex, y: st.ey }, target, 1);
            launchAssault(S, o, ai, send.filter((g, i) => i % 2 === 1), { x: st.ex, y: st.ey }, target, -1);
            warnMe(S, o, `${S.players[o].name} está atacando pelos dois lados!`, target.owner === KM.me ? { x: target.ex, y: target.ey } : null);
          } else launchAssault(S, o, ai, send, { x: st.ex, y: st.ey }, target);
          ai.wave++;
          warnMe(S, o, `${S.players[o].name} enviou ${sent} soldados para a batalha!`, target.owner === KM.me ? { x: target.ex, y: target.ey } : null);
          if (target.owner === KM.me) KM.sfx && KM.sfx('horn');
        }
        if (target && sent) {
          ai.attackN = Math.min((ai.baseAttackN || 12) + ai.wave * 2, Math.round(24 * ai.mult));
          ai.warned = false;
          // pausa entre ataques: dá tempo de reconstruir e reagir (menor nas dificuldades altas)
          ai.next = S.time + Math.round((ai.gap || 330) / Math.sqrt(ai.mult));
        }
      }
    }
  }

  // ordem de um jogador humano competente, respeitando a árvore de progressão
  const WANT_FAIR = [
    ['woodcutter', 1], ['quarry', 1], ['sawmill', 1], ['woodcutter', 2], ['quarry', 2], ['inn', 1], ['farm', 1], ['farm', 2], ['mill', 1], ['bakery', 1],
    ['market', 1], ['weaponworkshop', 1], ['barracks', 1], ['coalmine', 1], ['goldmine', 1], ['goldsmelter', 1], ['quarry', 3], ['swine', 1], ['butcher', 1], ['tannery', 1], ['armorworkshop', 1],
    ['farm', 3], ['woodcutter', 3], ['tower', 2], ['fisher', 1], ['ironmine', 1], ['ironsmithy', 1], ['weaponsmithy', 1], ['armorsmithy', 1], ['coalmine', 2],
    ['farm', 4], ['inn', 2], ['stables', 1], ['tower', 4], ['swine', 2], ['farm', 5],
  ];

  function planBuild(S, o, ai, st) {
    let sites = 0;
    for (const id in S.houses) { const h = S.houses[id]; if (h.owner === o && h.state !== 'built') sites++; }
    const limit = ai.mult >= 1.4 ? 3 : 2;
    if (sites > limit) return;
    const foe = nearestHostileHouse(S, o, st.ex, st.ey);
    const cx = KM.hcx(st), cy = KM.hcy(st);
    // Comida e reposição de ouro vêm antes da expansão militar, sem recursos gratuitos.
    const priorities = [];
    const food = Object.keys(KM.FOOD).reduce((n, r) => n + (st.inv[r] || 0), 0);
    const citizens = Object.values(S.units).filter((u) => u.owner === o && !KM.isSoldier(u.type)).length;
    if ((st.inv.stone || 0) < 18 || (st.inv.gold || 0) < 12) priorities.push(['market', 1]);
    if ((st.inv.wood || 0) < 10) priorities.push(['woodcutter', Math.max(2, Math.ceil(citizens / 24))], ['sawmill', citizens > 40 ? 2 : 1]);
    if ((st.inv.stone || 0) < 18) priorities.push(['quarry', Math.max(2, Math.ceil(citizens / 20))]);
    const emergency = priorities.length;
    if (food < 25) {
      const farms = Math.max(2, Math.ceil(citizens / 14)), mills = Math.ceil(farms / 2);
      priorities.push(['inn', Math.max(1, Math.ceil(citizens / 35))], ['farm', farms], ['mill', mills], ['bakery', mills], ['fisher', 1], ['vineyard', 1]);
    }
    if ((st.inv.gold || 0) < 16) priorities.push(['coalmine', 1], ['goldmine', 1], ['goldsmelter', 1]);
    const plans = priorities.concat(WANT_FAIR);
    for (let i = 0; i < plans.length; i++) {
      if (sites >= limit && i >= emergency) break;
      const [t, n] = plans[i];
      if (count(S, o, t) >= n) continue;
      if ((ai.fail[t + n] || 0) > S.time) continue;
      if (!KM.houseUnlocked(S, o, t)) continue;
      let score = KM.spotScore(S, t);
      let R = 16;
      if (KM.HOUSES[t].mine) R = 24;
      if (t === 'quarry') R = 28;
      if (t === 'tower' && foe) {
        const dl = Math.hypot(foe.ex - cx, foe.ey - cy) || 1;
        const tx = cx + ((foe.ex - cx) / dl) * 8, ty = cy + ((foe.ey - cy) / dl) * 8;
        score = (x, y) => Math.hypot(x - tx, y - ty) * 1.5 - Math.hypot(x - cx, y - cy);
      }
      const p = KM.findSpot(S, t, o, cx, cy, R, score);
      if (!p) { ai.fail[t + n] = S.time + 120; continue; }
      const h = KM.addHouse(S, t, o, p.x, p.y, false);
      if (i < emergency) h.prio = true;
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
      // recuo: o ataque fracassou (sobrou menos de 30%), volta para casa e vira defesa
      if (g.size0 && us.length <= Math.max(1, g.size0 * 0.3)) {
        g.size0 = 0;
        for (const u of us) { u.ai = 'def'; u.target = null; u.forced = false; }
        const home = Object.values(S.houses).find((h) => h.owner === o && h.type === 'barracks' && h.state === 'built') || Object.values(S.houses).find((h) => h.owner === o && h.type === 'storehouse');
        if (home) KM.orderGroups(S, [g], home.ex + 2, home.ey + 3, false);
        continue;
      }
      if (us.some((u) => u.order || u.target || u.path)) continue;
      const c = KM.groupCenter(S, g);
      const site = (S.sites || []).find((s) => s.id === g.objective);
      if (site && site.owner !== o && Math.hypot(c.x - site.x, c.y - site.y) > 2) { KM.orderGroups(S, [g], site.x, site.y, true); continue; }
      if (site && site.owner === o) { for (const u of us) u.ai = 'def'; g.objective = null; continue; }
      const h = nearestHostileHouse(S, o, c.x, c.y);
      if (h) { KM.orderGroups(S, [g], h.ex, h.ey + 1, true); continue; }
      let best = null, bd = 1e9;
      for (const vid in S.units) { const v = S.units[vid]; if (!KM.hostile(S, o, v.owner) || v.inside) continue; const d = Math.hypot(v.x - c.x, v.y - c.y); if (d < bd) { bd = d; best = v; } }
      if (best) KM.orderGroups(S, [g], best.tx, best.ty, true);
    }
  }
})(window.KM);
