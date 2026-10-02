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

  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const has = (o, k) => o && own(o, k);
  const record = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const int = (v, min, max) => Number.isSafeInteger(v) && v >= min && v <= max;
  const tile = (v, axis, S) => {
    if (!int(v, 0, 4095)) return false;
    const n = S && S.map ? S.map[axis] : KM['MAP_' + axis];
    return !Number.isSafeInteger(n) || v < n;
  };
  const groupList = (v) => Array.isArray(v) && v.length > 0 && v.length <= 512 && v.every((id) => int(id, 1, 0x7fffffff));
  const fields = (c, required, optional, requireOwner) => {
    if (!record(c)) return false;
    const allowed = ['c', ...required, ...optional];
    if (requireOwner || own(c, 'o')) allowed.push('o');
    if (!own(c, 'c') || (requireOwner && !own(c, 'o')) || Object.keys(c).some((k) => !allowed.includes(k))) return false;
    if (own(c, 'o') && !int(c.o, 0, 3)) return false;
    return required.every((k) => own(c, k));
  };
  const xy = (c, S) => tile(c.x, 'W', S) && tile(c.y, 'H', S);

  // Comandos também são a fronteira de confiança de KM.exec: UI e rede compartilham o mesmo esquema.
  KM.validCommand = function (c, requireOwner, S) {
    if (!record(c) || typeof c.c !== 'string') return false;
    const req = {
      build: ['t', 'x', 'y'], roads: ['tiles'], fields: ['kind', 'tiles'], demolishAt: ['x', 'y'],
      demolish: ['id'], hset: ['id', 'k', 'v'], block: ['id', 'r'], order: ['id', 'i', 'v'],
      train: ['id', 'p'], unq: ['id', 'i'], equip: ['id', 't'], trade: ['id', 'sell', 'buy', 'n'],
      rally: ['id', 'x', 'y'], auto: ['v'], dist: ['r', 't', 'v'], move: ['g', 'x', 'y'],
      attack: ['g', 'k', 'id'], stop: ['g'], turn: ['g', 'd'], cols: ['g', 'd'], split: ['g'],
      link: ['g'], feed: ['g'], speed: ['v'], leave: [], pause: ['v'],
    }[c.c];
    if (!req) return false;
    const optional = {
      build: ['r'], move: ['am'], equip: ['n'],
    }[c.c] || [];
    if (!fields(c, req, optional, !!requireOwner)) return false;
    const id = (v) => int(v, 1, 0x7fffffff);
    switch (c.c) {
      case 'build': return typeof c.t === 'string' && has(KM.HOUSES, c.t) && xy(c, S) && (!own(c, 'r') || int(c.r, 0, 3));
      case 'roads':
        return Array.isArray(c.tiles) && c.tiles.length > 0 && c.tiles.length <= 256 && c.tiles.every((p) => Array.isArray(p) && p.length === 2 && tile(p[0], 'W', S) && tile(p[1], 'H', S));
      case 'fields':
        return (c.kind === 1 || c.kind === 3) && Array.isArray(c.tiles) && c.tiles.length > 0 && c.tiles.length <= 256 && c.tiles.every((p) => Array.isArray(p) && p.length === 2 && tile(p[0], 'W', S) && tile(p[1], 'H', S));
      case 'demolishAt': case 'rally': return (!own(c, 'id') || id(c.id)) && xy(c, S);
      case 'demolish': return id(c.id);
      case 'hset': return id(c.id) && ['paused', 'noDeliv', 'repair', 'prio'].includes(c.k) && typeof c.v === 'boolean';
      case 'block': return id(c.id) && typeof c.r === 'string' && has(KM.RES, c.r);
      case 'order': return id(c.id) && int(c.i, 0, 32) && int(c.v, 0, KM.INF);
      case 'train': return id(c.id) && typeof c.p === 'string' && has(KM.PROF, c.p);
      case 'unq': return id(c.id) && int(c.i, 0, 9);
      case 'equip': return id(c.id) && typeof c.t === 'string' && has(KM.SOLDIERS, c.t) && (!own(c, 'n') || int(c.n, 1, 5));
      case 'trade': return id(c.id) && typeof c.sell === 'string' && typeof c.buy === 'string' && has(KM.RES, c.sell) && has(KM.RES, c.buy) && c.sell !== c.buy && int(c.n, 0, KM.INF);
      case 'auto': return typeof c.v === 'boolean';
      case 'dist': return typeof c.r === 'string' && typeof c.t === 'string' && has(KM.DIST, c.r) && KM.DIST[c.r].includes(c.t) && int(c.v, 0, 5);
      case 'move': return groupList(c.g) && xy(c, S) && (!own(c, 'am') || typeof c.am === 'boolean');
      case 'attack': return groupList(c.g) && (c.k === 'u' || c.k === 'h') && id(c.id);
      case 'stop': case 'split': case 'link': case 'feed': return groupList(c.g);
      case 'turn': case 'cols': return groupList(c.g) && (c.d === -1 || c.d === 1);
      case 'speed': return int(c.v, 1, 5);
      case 'leave': return true;
      case 'pause': return typeof c.v === 'boolean';
      default: return false;
    }
  };

  const myGroups = (S, o, ids) => (ids || []).map((id) => S.army[id]).filter((g) => g && g.owner === o);
  const myHouse = (S, o, id) => { const h = S.houses[id]; return h && h.owner === o ? h : null; };
  // a Escola é o único jeito de ganhar gente: a última Escola pronta não pode ser demolida
  const lastSchool = (S, h) => h.type === 'school' && h.state === 'built' && !Object.values(S.houses).some((x) => x !== h && x.owner === h.owner && x.type === 'school' && x.state === 'built');
  function demolish(S, o, h) {
    if (lastSchool(S, h)) { if (o === KM.me) { KM.notify(S, '🎓 A Escola não pode ser demolida: é dela que vem todo o seu povo.', 'warn', { x: h.ex, y: h.ey }); KM.sfx && KM.sfx('error'); } return; }
    KM.removeHouse(S, h, false);
  }
  const zoneWarn = (S, o) => { if (o === KM.me && S.time - (S.zoneWarnT || -99) > 4) { S.zoneWarnT = S.time; KM.notify(S, KM.ZONE_MSG, 'warn'); } };

  KM.exec = function (S, c) {
    if (!S || !S.map || !Array.isArray(S.players) || !KM.validCommand(c, true, S)) return;
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
        if (o !== KM.me) KM.notify(S, `🔌 ${P.name} saiu da partida. A IA assumiu o reino.`, 'warn');
        return;
      }
      case 'pause': if (o === 0) S.paused = !!c.v; return;
    }
  };
})(window.KM);
