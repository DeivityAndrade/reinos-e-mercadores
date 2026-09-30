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

  KM.exec = function (S, c) {
    const o = c.o, m = S.map;
    if (!S.players[o] || S.players[o].out) return;
    switch (c.c) {
      case 'build': {
        if (!KM.HOUSES[c.t] || !KM.houseUnlocked(S, o, c.t) || !KM.canPlace(S, c.t, c.x, c.y, o).ok) return;
        KM.addHouse(S, c.t, o, c.x, c.y, false);
        return;
      }
      case 'roads':
        for (const [x, y] of c.tiles) {
          if (!KM.inb(x, y)) continue;
          const i = y * m.W + x;
          if (!KM.isExp(S, i, o) || !KM.walkable(S, x, y) || m.road[i] || m.field[i]) continue;
          m.road[i] = 1; m.rown[i] = o; m.rmat[i] = 0;
        }
        return;
      case 'fields':
        for (const [x, y] of c.tiles) {
          if (!KM.inb(x, y)) continue;
          const i = y * m.W + x;
          if (!KM.isExp(S, i, o) || m.terrain[i] !== KM.T.GRASS || !KM.walkable(S, x, y) || m.road[i] || m.field[i]) continue;
          m.field[i] = c.kind === 3 ? 3 : 1; m.fown[i] = o;
        }
        return;
      case 'demolishAt': {
        if (!KM.inb(c.x, c.y)) return;
        const i = c.y * m.W + c.x, hid = m.house[i];
        if (hid && S.houses[hid] && S.houses[hid].owner === o) { KM.removeHouse(S, S.houses[hid], false); return; }
        if (m.road[i] && m.rown[i] === o) {
          for (const id in S.houses) { const h = S.houses[id]; if (h.ex === c.x && h.ey === c.y) return; }
          m.road[i] = 0; m.rown[i] = -1; m.rmat[i] = 0; if (S.resv[i]) delete S.resv[i];
          KM.rt.roadsDirty = true; KM.tileChanged(S, c.x, c.y); return;
        }
        if (m.field[i] && m.fown[i] === o) { m.field[i] = 0; m.fown[i] = -1; m.fstage[i] = 0; KM.tileChanged(S, c.x, c.y); }
        return;
      }
      case 'demolish': { const h = myHouse(S, o, c.id); if (h) KM.removeHouse(S, h, false); return; }
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
      case 'auto': S.players[o].autoTrain = !!c.v; return;
      case 'dist': { const d = S.players[o].dist[c.r]; if (d && d[c.t] != null) d[c.t] = KM.clamp(c.v | 0, 0, 5); return; }
      case 'move': { const gs = myGroups(S, o, c.g); if (gs.length) KM.orderGroups(S, gs, KM.clamp(c.x, 0, m.W - 1), KM.clamp(c.y, 0, m.H - 1), c.am); return; }
      case 'attack': { const gs = myGroups(S, o, c.g); if (gs.length) KM.orderAttack(S, gs, { k: c.k, id: c.id }); return; }
      case 'stop': KM.orderStop(S, myGroups(S, o, c.g)); return;
      case 'turn': for (const g of myGroups(S, o, c.g)) KM.turnGroup(S, g, c.d); return;
      case 'cols': for (const g of myGroups(S, o, c.g)) KM.colsGroup(S, g, c.d); return;
      case 'split': { const gs = myGroups(S, o, c.g); if (gs.length === 1) KM.splitGroup(S, gs[0]); return; }
      case 'link': KM.linkGroups(S, myGroups(S, o, c.g)); return;
      case 'feed': for (const g of myGroups(S, o, c.g)) KM.feedGroup(S, g); return;
      case 'speed': if (o === 0) S.speed = KM.clamp(c.v, 1, 5); return;
      case 'pause': if (o === 0) S.paused = !!c.v; return;
    }
  };
})(window.KM);
