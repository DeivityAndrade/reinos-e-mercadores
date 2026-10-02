'use strict';
/* Comandos: toda ação do jogador passa por aqui (single-player e multiplayer lockstep) */
(function (KM) {
  KM.issue = function (c) {
    const S = KM.S;
    if (!S || S.editor) return;
    c.o = KM.me;
    if (KM.net && KM.net.active) KM.net.queue(c);
    else S.cmdq.push(c);
  };

  const myGroups = (S, o, ids) => (ids || []).map((id) => S.army[id]).filter((g) => g && g.owner === o);
  const myHouse = (S, o, id) => { const h = S.houses[id]; return h && h.owner === o ? h : null; };
  // a Escola é o único jeito de ganhar gente: a última Escola pronta não pode ser demolida
  const lastSchool = (S, h) => h.type === 'school' && h.state === 'built' && !Object.values(S.houses).some((x) => x !== h && x.owner === h.owner && x.type === 'school' && x.state === 'built');
  function demolish(S, o, h) {
    if (lastSchool(S, h)) { if (o === KM.me) { KM.notify(S, 'A Escola não pode ser demolida: é dela que vem todo o seu povo.', 'warn', { x: h.ex, y: h.ey }); KM.sfx && KM.sfx('error'); } return; }
    KM.removeHouse(S, h, false);
  }
  const zoneWarn = (S, o) => { if (o === KM.me && S.time - (S.zoneWarnT || -99) > 4) { S.zoneWarnT = S.time; KM.notify(S, KM.ZONE_MSG, 'warn'); } };

  KM.exec = function (S, c) {
    const o = c.o, m = S.map;
    if (!S.players[o] || S.players[o].out) return;
    switch (c.c) {
      case 'build': {
        const r = (c.r | 0) & 3;
        if (!KM.HOUSES[c.t] || !KM.houseUnlocked(S, o, c.t) || !KM.canPlace(S, c.t, c.x, c.y, o, r).ok) return;
        KM.addHouse(S, c.t, o, c.x, c.y, false, r);
        return;
      }
      case 'roads':
        for (const [x, y] of c.tiles) {
          if (!KM.inb(x, y)) continue;
          const i = y * m.W + x;
          if (!KM.isExp(S, i, o) || !KM.inZone(S, o, x, y) || !KM.walkable(S, x, y) || m.road[i] || m.field[i]) continue;
          m.road[i] = 1; m.rown[i] = o; m.rmat[i] = 0;
        }
        return;
      case 'fields':
        for (const [x, y] of c.tiles) {
          if (!KM.inb(x, y)) continue;
          const i = y * m.W + x;
          if (!KM.isExp(S, i, o) || !KM.inZone(S, o, x, y) || m.terrain[i] !== KM.T.GRASS || !KM.walkable(S, x, y) || m.road[i] || m.field[i]) continue;
          m.field[i] = c.kind === 3 ? 3 : 1; m.fown[i] = o;
        }
        return;
      case 'demolishAt': {
        if (!KM.inb(c.x, c.y)) return;
        const i = c.y * m.W + c.x, hid = m.house[i];
        if (hid && S.houses[hid] && S.houses[hid].owner === o) { demolish(S, o, S.houses[hid]); return; }
        if (m.road[i] && m.rown[i] === o) {
          for (const id in S.houses) { const h = S.houses[id]; if (h.ex === c.x && h.ey === c.y) return; }
          m.road[i] = 0; m.rown[i] = -1; m.rmat[i] = 0; if (S.resv[i]) delete S.resv[i];
          KM.rt.roadsDirty = true; KM.tileChanged(S, c.x, c.y); return;
        }
        if (m.field[i] && m.fown[i] === o) { m.field[i] = 0; m.fown[i] = -1; m.fstage[i] = 0; KM.tileChanged(S, c.x, c.y); }
        return;
      }
      case 'demolish': { const h = myHouse(S, o, c.id); if (h) demolish(S, o, h); return; }
      case 'hset': { const h = myHouse(S, o, c.id); if (h && ['paused', 'noDeliv', 'repair', 'prio'].includes(c.k)) h[c.k] = !!c.v; return; }
      case 'block': { const h = myHouse(S, o, c.id); if (h && h.block) h.block[c.r] = !h.block[c.r]; return; }
      case 'order': { const h = myHouse(S, o, c.id); if (h && h.orders && h.orders[c.i] != null) h.orders[c.i] = KM.clamp(c.v | 0, 0, KM.INF); return; }
      case 'train': { const h = myHouse(S, o, c.id); if (h && h.type === 'school' && KM.PROF[c.p] && KM.profUnlocked(S, o, c.p) && h.queue.length < 10) h.queue.push(c.p); return; }
      case 'unq': {
        const h = myHouse(S, o, c.id);
        if (!h || h.type !== 'school' || c.i >= h.queue.length) return;
        if (c.i === 0 && h.trainT) { h.trainT = 0; KM.add(h.inv, 'gold', 1); }
        h.queue.splice(c.i, 1); return;
      }
      case 'equip': { const h = myHouse(S, o, c.id); if (h && h.type === 'barracks' && h.state === 'built' && KM.soldierUnlocked(S, o, c.t)) for (let k = 0; k < (c.n || 1); k++) if (!KM.equip(S, h, c.t)) break; return; }
      case 'trade': {
        const h = myHouse(S, o, c.id);
        if (!h || !KM.def(h).market || !KM.RES[c.sell] || !KM.RES[c.buy] || c.sell === c.buy) return;
        // mudar a mercadoria devolve ao estoque o que ainda não foi trocado (vai para a saída)
        if (h.trade && h.trade.sell !== c.sell && h.inv[h.trade.sell]) { KM.add(h.out, h.trade.sell, h.inv[h.trade.sell]); h.inv[h.trade.sell] = 0; }
        h.trade = { sell: c.sell, buy: c.buy, n: KM.clamp(c.n | 0, 0, KM.INF) };
        return;
      }
      case 'rally': {
        const h = myHouse(S, o, c.id), z = KM.zone(S, o) || { x0: 0, x1: m.W - 1, y0: 0, y1: m.H - 1 };
        if (h && h.type === 'barracks') h.rally = { x: KM.clamp(c.x | 0, z.x0, z.x1), y: KM.clamp(c.y | 0, z.y0, z.y1) };
        return;
      }
      case 'auto': S.players[o].autoTrain = !!c.v; return;
      case 'dist': { const d = S.players[o].dist[c.r]; if (d && d[c.t] != null) d[c.t] = KM.clamp(c.v | 0, 0, 5); return; }
      case 'move': {
        const gs = myGroups(S, o, c.g);
        if (!gs.length) return;
        // durante a paz, o destino fica preso ao quadrante do reino (formGroup prende também cada fileira)
        const z = KM.zone(S, o) || { x0: 0, x1: m.W - 1, y0: 0, y1: m.H - 1 };
        const x = KM.clamp(c.x, z.x0, z.x1), y = KM.clamp(c.y, z.y0, z.y1);
        if (x !== c.x || y !== c.y) zoneWarn(S, o);
        KM.orderGroups(S, gs, x, y, c.am);
        return;
      }
      case 'attack': {
        const gs = myGroups(S, o, c.g), tg = KM.resolveTarget(S, { k: c.k, id: c.id });
        if (!gs.length || !tg) return;
        if (!KM.inZone(S, o, c.k === 'u' ? Math.round(tg.x) : tg.ex, c.k === 'u' ? Math.round(tg.y) : tg.ey)) { zoneWarn(S, o); return; }
        KM.orderAttack(S, gs, { k: c.k, id: c.id });
        return;
      }
      case 'stop': KM.orderStop(S, myGroups(S, o, c.g)); return;
      case 'turn': for (const g of myGroups(S, o, c.g)) KM.turnGroup(S, g, c.d); return;
      case 'cols': for (const g of myGroups(S, o, c.g)) KM.colsGroup(S, g, c.d); return;
      case 'split': { const gs = myGroups(S, o, c.g); if (gs.length === 1) KM.splitGroup(S, gs[0]); return; }
      case 'link': KM.linkGroups(S, myGroups(S, o, c.g)); return;
      case 'feed': for (const g of myGroups(S, o, c.g)) KM.feedGroup(S, g); return;
      case 'speed': if (o === 0) S.speed = KM.clamp(c.v, 1, 5); return;
      // multijogador: um jogador saiu da partida e a IA assume o reino (aplicado no mesmo turno em todos)
      case 'leave': {
        const P = S.players[o];
        if (!P.human) return;
        P.human = false;
        KM.setupAI(S, o, { mode: 'economy', peace: Math.max(S.peaceEnd || 0, S.time + 180) }, S.diff);
        if (o !== KM.me) KM.notify(S, `${P.name} saiu da partida. A IA assumiu o reino.`, 'warn');
        return;
      }
      case 'pause': if (o === 0) S.paused = !!c.v; return;
    }
  };
})(window.KM);
