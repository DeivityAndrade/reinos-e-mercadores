'use strict';
/* Estado do mundo: jogadores, casas, unidades, colocação, cidades iniciais */
(function (KM) {
  KM.rt = { comp: null, roadsDirty: true };
  KM.SAVE_V = 3;

  KM.def = (h) => KM.HOUSES[h.type];
  KM.isSoldier = (t) => !!KM.SOLDIERS[t];
  KM.hcx = (h) => h.x + h.w / 2 - 0.5;
  KM.hcy = (h) => h.y + h.h / 2 - 0.5;
  KM.eco = (S, o) => !!(S.players[o] && S.players[o].eco);
  KM.human = (S, o) => !!(S.players[o] && S.players[o].human);
  KM.hostile = (S, a, b) => a !== b && S.players[a] && S.players[b] && S.players[a].team !== S.players[b].team;
  KM.isExp = (S, i, o) => (S.map.explored[i] >> (o == null ? KM.me : o)) & 1;
  KM.pcolor = (S, o) => (S && S.players[o] && S.players[o].color) || KM.COLORS[o] || '#999';
  // quadrante do reino durante a paz (null = sem limite)
  KM.zone = (S, o) => (S.zones && S.time < S.peaceEnd && S.zones[o]) || null;
  KM.inZone = (S, o, x, y) => { const z = KM.zone(S, o); return !z || (x >= z.x0 && x <= z.x1 && y >= z.y0 && y <= z.y1); };
  KM.ZONE_MSG = 'Durante a paz seu reino fica no próprio quadrante. A fronteira abre quando a paz acabar.';

  // Pegada da casa girada: rot 0 = porta ao sul, 1 = leste, 2 = norte, 3 = oeste (90° por passo).
  // Devolve largura/altura no mapa, a entrada e o retângulo casa+entrada (usado para aplainar o terreno).
  KM.footprint = function (type, x, y, rot) {
    const d = KM.HOUSES[type], r = (rot | 0) & 3;
    const w = r & 1 ? d.h : d.w, h = r & 1 ? d.w : d.h;
    let ex, ey, x0 = x, y0 = y, x1 = x + w - 1, y1 = y + h - 1;
    if (r === 0) { ex = x + (w >> 1); ey = y + h; y1++; }
    else if (r === 1) { ex = x + w; ey = y + h - 1 - (h >> 1); x1++; }
    else if (r === 2) { ex = x + w - 1 - (w >> 1); ey = y - 1; y0--; }
    else { ex = x - 1; ey = y + (h >> 1); x0--; }
    return { w, h, ex, ey, x0, y0, x1, y1, rot: r };
  };

  KM.DOOR_DIR = ['Sul', 'Leste', 'Norte', 'Oeste'];
  // coleta a partir da entrada; mineração e tiro a partir do centro da casa
  KM.houseRange = function (h) {
    const d = KM.def(h);
    if (d.mine) return { r: KM.MINE_RADIUS, x: KM.hcx(h), y: KM.hcy(h), n: 'Área de mineração' };
    if (d.radius) return { r: d.radius, x: h.ex, y: h.ey, n: 'Área de trabalho' };
    if (d.shoot) return { r: d.shoot, x: KM.hcx(h), y: KM.hcy(h), n: 'Alcance de tiro' };
    return null;
  };

  KM.houseAccepts = function (h) {
    const d = KM.def(h);
    if (d.market) return h.trade && h.trade.n > 0 ? [h.trade.sell] : [];
    if (d.accepts === 'all') return [];
    if (d.accepts) return d.accepts;
    if (!d.recipes) return [];
    const s = new Set();
    for (const r of d.recipes) for (const k in r.in) s.add(k);
    return [...s];
  };
  KM.houseCap = function (S, h, r) {
    const d = KM.def(h);
    let cap = d.cap || KM.IN_CAP;
    const pl = S.players[h.owner];
    if (pl && pl.dist && pl.dist[r] && pl.dist[r][h.type] != null) cap = Math.min(cap, pl.dist[r][h.type]);
    return cap;
  };

  function initStorage(h) {
    const d = KM.def(h);
    h.inv = {}; h.out = {}; h.inc = {}; h.rsv = {};
    if (d.accepts === 'all') { for (const r of KM.RES_ORDER) h.inv[r] = 0; h.block = {}; }
    for (const r of KM.houseAccepts(h)) h.inv[r] = 0;
    if (d.recipes) for (const rc of d.recipes) for (const k in rc.out) h.out[k] = 0;
    if (d.gather) h.out[d.out] = 0;
    h.cnt = d.recipes ? d.recipes.map(() => 0) : [0];
    h.orders = d.recipes && d.recipes.length > 1 ? d.recipes.map(() => 0) : null;
    h.rr = 0;
  }

  KM.addHouse = function (S, type, owner, x, y, built, rot) {
    const d = KM.HOUSES[type], m = S.map, f = KM.footprint(type, x, y, rot);
    const id = S.nid++;
    const h = {
      id, type, owner, x, y, w: f.w, h: f.h, ex: f.ex, ey: f.ey, rot: f.rot,
      state: 'plan', hp: 1, maxHp: d.hp,
      mat: {}, used: 0, total: 0, builder: 0, leveler: 0, repairer: 0,
      inv: {}, out: {}, inc: {}, rsv: {},
      worker: 0, work: null, orders: null, cnt: [0], rr: 0, queue: [], trainT: 0, trainMax: 0,
      recruits: 0, shots: 0, cd: 0, depleted: false, paused: false, noDeliv: false, repair: true, born: S.time,
    };
    for (const r in d.cost) { h.mat[r] = { need: d.cost[r], got: 0, have: 0, inc: 0 }; h.total += d.cost[r]; }
    for (let yy = y; yy < y + f.h; yy++) for (let xx = x; xx < x + f.w; xx++) {
      const i = yy * m.W + xx;
      m.house[i] = id;
      if (built) m.tree[i] = 0;
      if (m.road[i]) { m.road[i] = 0; m.rown[i] = -1; m.rmat[i] = 0; KM.rt.roadsDirty = true; KM.tileChanged(S, xx, yy); }
    }
    const ei = h.ey * m.W + h.ex;
    if (m.road[ei] !== 2) {
      m.road[ei] = built ? 2 : 1; m.rown[ei] = owner; m.rmat[ei] = 2;
      KM.rt.roadsDirty = true; KM.tileChanged(S, h.ex, h.ey);
    }
    S.houses[id] = h;
    if (built) { KM.flatten(S, f.x0, f.y0, f.x1, f.y1); KM.finishHouse(S, h, true); }
    return h;
  };

  // ---------- progressão ----------
  const reqsMet = (S, o, reqs) => !reqs || reqs.every((r) => S.players[o].built && S.players[o].built[r]);
  KM.houseUnlocked = function (S, o, type) {
    const p = S.players[o];
    if (!p || p.all || !p.eco) return true;
    return reqsMet(S, o, KM.TECH[type]);
  };
  KM.soldierUnlocked = function (S, o, type) {
    const p = S.players[o];
    if (!p || p.all || !p.eco) return true;
    return reqsMet(S, o, KM.SOLDIER_REQ[type]);
  };
  KM.profUnlocked = function (S, o, prof) {
    const p = S.players[o];
    if (!p || p.all || !p.eco || prof === 'serf' || prof === 'laborer') return true;
    if (prof === 'recruit') return KM.houseUnlocked(S, o, 'barracks') && !!p.built.barracks || KM.houseUnlocked(S, o, 'tower') && !!p.built.tower;
    for (const t in KM.HOUSES) if (KM.HOUSES[t].worker === prof && KM.houseUnlocked(S, o, t)) return true;
    return false;
  };
  KM.reqNames = (reqs) => (reqs || []).map((r) => `${KM.HOUSES[r].n}`).join(' + ');
  // o que construir cada tipo ainda não erguido liberaria
  KM.nextUnlocks = function (S, o) {
    const p = S.players[o], out = [];
    if (!p || p.all) return out;
    for (const t in KM.HOUSES) {
      if (!KM.houseUnlocked(S, o, t) || p.built[t]) continue;
      const gives = Object.keys(KM.TECH).filter((k) => !KM.houseUnlocked(S, o, k) && KM.TECH[k].includes(t) && KM.TECH[k].every((r) => r === t || p.built[r]));
      if (gives.length) out.push({ t, gives });
    }
    return out;
  };

  KM.finishHouse = function (S, h, silent) {
    h.state = 'built'; h.hp = h.maxHp; h.builder = 0; h.leveler = 0;
    initStorage(h);
    if (h.orders && !KM.human(S, h.owner)) h.orders = h.orders.map(() => KM.INF);
    // registra a construção para a árvore de progressão
    const P = S.players[h.owner];
    if (P) {
      P.built = P.built || {};
      if (!P.built[h.type]) {
        const before = Object.keys(KM.HOUSES).filter((t) => KM.houseUnlocked(S, h.owner, t));
        const beforeS = KM.SOLDIER_ORDER.filter((t) => KM.soldierUnlocked(S, h.owner, t));
        P.built[h.type] = 1;
        if (!silent && h.owner === KM.me && P.human && !P.all) {
          const nh = Object.keys(KM.HOUSES).filter((t) => KM.houseUnlocked(S, h.owner, t) && !before.includes(t));
          const ns = KM.SOLDIER_ORDER.filter((t) => KM.soldierUnlocked(S, h.owner, t) && !beforeS.includes(t));
          if (nh.length) KM.notify(S, `Novas construções liberadas: ${nh.map((t) => KM.HOUSES[t].n).join(', ')}`, 'unlock');
          if (ns.length) KM.notify(S, `Novos soldados no Quartel: ${ns.map((t) => KM.SOLDIERS[t].n).join(', ')}`, 'unlock');
          if (nh.length || ns.length) { S.newUnlock = (S.newUnlock || 0) + 1; KM.sfx && KM.sfx('unlock'); }
        }
      }
    }
    if (!silent) {
      S.stats[h.owner].built++;
      // comemoração: estandarte sobe, faíscas douradas e o nome da casa flutuando por cima (render3d)
      S.fx.push({ k: 'built', id: h.id, x: h.x, y: h.y, w: h.w, h: h.h, o: h.owner, t: 0, T: 3.2 });
      if (h.owner === KM.me) {
        KM.notify(S, `${KM.def(h).n} concluído!`, 'ok', { x: h.ex, y: h.ey });
        if (h.orders) KM.notify(S, `${KM.def(h).n}: faça encomendas no painel da casa para começar a produzir.`, 'info', { x: h.ex, y: h.ey });
        KM.sfx && KM.sfx('built');
      }
    }
  };

  KM.removeHouse = function (S, h, destroyed) {
    const m = S.map;
    for (let yy = h.y; yy < h.y + h.h; yy++) for (let xx = h.x; xx < h.x + h.w; xx++) m.house[yy * m.W + xx] = 0;
    for (const id in S.units) {
      const u = S.units[id];
      if (u.inside === h.id) { u.inside = 0; u.x = u.tx = h.ex; u.y = u.ty = h.ey; if (u.task && u.task.type === 'eat') u.task = null; }
      if (u.home === h.id) { u.home = 0; if (u.task && u.task.type === 'gather') KM.releaseTask(S, u); u.task = null; }
    }
    if (h.type === 'barracks' && h.recruits > 0) for (let k = 0; k < h.recruits; k++) KM.addUnit(S, 'recruit', h.owner, h.ex, h.ey);
    delete S.houses[h.id];
    if (destroyed) {
      S.fx.push({ k: 'smoke', x: KM.hcx(h), y: KM.hcy(h), t: 0, T: 2.5 });
      S.fx.push({ k: 'rubble', x: h.x, y: h.y, w: h.w, h: h.h, t: 0, T: 40 });
      if (h.owner === KM.me) KM.notify(S, `${KM.def(h).n} foi destruído!`, 'danger', { x: h.ex, y: h.ey });
      else if (KM.hostile(S, KM.me, h.owner) && KM.isExp(S, h.ey * m.W + h.ex)) KM.notify(S, `${KM.def(h).n} inimigo destruído!`, 'ok', { x: h.ex, y: h.ey });
      KM.sfxAt && KM.sfxAt('collapse', h.ex, h.ey);
    }
    KM.ui && KM.ui.onRemoved && KM.ui.onRemoved('h', h.id);
  };

  KM.canPlace = function (S, type, x, y, owner, rot) {
    const d = KM.HOUSES[type], m = S.map, f = KM.footprint(type, x, y, rot);
    const ex = f.ex, ey = f.ey;
    const hum = KM.human(S, owner);
    for (let yy = y; yy < y + f.h; yy++) for (let xx = x; xx < x + f.w; xx++) {
      if (!KM.inb(xx, yy)) return { ok: false, why: 'Fora do mapa' };
      const i = yy * m.W + xx, t = m.terrain[i];
      if (hum && !KM.isExp(S, i, owner)) return { ok: false, why: 'Área inexplorada' };
      if (!KM.inZone(S, owner, xx, yy)) return { ok: false, why: 'Fora do seu território até o fim da paz' };
      if (t !== KM.T.GRASS && t !== KM.T.SAND) return { ok: false, why: 'Terreno inadequado' };
      if (m.house[i]) return { ok: false, why: 'Espaço ocupado' };
      if (m.stone[i]) return { ok: false, why: 'Há rochas aqui' };
      if (m.road[i] === 2) return { ok: false, why: 'Há estrada aqui' };
      if (m.field[i]) return { ok: false, why: 'Há um campo aqui' };
    }
    if (!KM.walkable(S, ex, ey) || m.field[ey * m.W + ex]) return { ok: false, why: 'A entrada está bloqueada' };
    if (KM.roughness(m, f.x0, f.y0, f.x1, f.y1) > 2.6) return { ok: false, why: 'Terreno íngreme demais' };
    for (const id in S.houses) {
      const o = S.houses[id];
      if (o.ex >= x && o.ex < x + f.w && o.ey >= y && o.ey < y + f.h) return { ok: false, why: 'Bloqueia a entrada de outra casa' };
      if (o.ex === ex && o.ey === ey) return { ok: false, why: 'A entrada já é usada por outra casa' };
    }
    if (d.mine && !KM.findOre(S, x + f.w / 2 - 0.5, y + f.h / 2 - 0.5, d.mine, false)) return { ok: false, why: 'Precisa de minério próximo (montanha)' };
    if (d.gather === 'fish') {
      let ok = false;
      for (let yy = y - 6; yy <= y + 6 && !ok; yy++) for (let xx = x - 6; xx <= x + 6; xx++) if (KM.inb(xx, yy) && m.terrain[yy * m.W + xx] === KM.T.WATER) { ok = true; break; }
      if (!ok) return { ok: false, why: 'Precisa de água por perto' };
    }
    return { ok: true };
  };

  KM.findSpot = function (S, type, owner, cx, cy, R, scoreFn) {
    const d = KM.HOUSES[type], m = S.map;
    let best = null, bs = 1e9;
    for (let y = Math.round(cy - R); y <= cy + R; y++) for (let x = Math.round(cx - R); x <= cx + R; x++) {
      const dist = Math.hypot(x + d.w / 2 - cx, y + d.h / 2 - cy);
      if (dist > R) continue;
      let ok = true;
      for (let yy = y - 1; yy <= y + d.h && ok; yy++) for (let xx = x - 1; xx <= x + d.w; xx++) {
        if (!KM.inb(xx, yy)) { ok = false; break; }
        const i = yy * m.W + xx;
        if (m.house[i] || m.field[i]) { ok = false; break; }
      }
      if (!ok) continue;
      const ey = y + d.h + 1, ex = x + (d.w >> 1);
      if (KM.inb(ex, ey) && m.house[ey * m.W + ex]) continue;
      if (!KM.canPlace(S, type, x, y, owner).ok) continue;
      let s = dist + KM.roughness(m, x, y, x + d.w - 1, y + d.h) * 1.5;
      if (scoreFn) { const e = scoreFn(x, y); if (e == null) continue; s += e; }
      if (s < bs) { bs = s; best = { x, y }; }
    }
    return best;
  };

  KM.connectRoad = function (S, h, built) {
    const st = KM.nearestStore(S, h.owner, h.ex, h.ey, h.id);
    if (!st || st === h) return;
    const p = KM.findPath(S, h.ex, h.ey, st.ex, st.ey, { roadPref: 2.5 });
    if (!p) return;
    const m = S.map;
    for (const [x, y] of p) {
      const i = y * m.W + x;
      if (m.road[i]) continue;
      m.road[i] = built ? 2 : 1; m.rown[i] = h.owner; m.rmat[i] = built ? 2 : 0;
      if (built) m.tree[i] = 0;
      KM.tileChanged(S, x, y);
    }
    KM.rt.roadsDirty = true;
  };

  KM.findOre = function (S, cx, cy, type, consume) {
    const m = S.map, R = KM.MINE_RADIUS - 0.5;
    let best = -1, bd = 1e9;
    for (let y = Math.floor(cy - R); y <= cy + R; y++) for (let x = Math.floor(cx - R); x <= cx + R; x++) {
      if (!KM.inb(x, y)) continue;
      const i = y * m.W + x;
      if (m.ore[i] !== type || m.oreAmt[i] <= 0) continue;
      const d = Math.hypot(x - cx, y - cy);
      if (d <= KM.MINE_RADIUS && d < bd) { bd = d; best = i; }
    }
    if (best < 0) return false;
    if (consume) {
      m.oreAmt[best]--;
      if (m.oreAmt[best] <= 0) { m.ore[best] = 0; KM.tileChanged(S, best % m.W, (best / m.W) | 0); }
    }
    return true;
  };

  KM.addUnit = function (S, type, owner, x, y) {
    const sd = KM.SOLDIERS[type];
    const hp = sd ? sd.hp : 40;
    const u = {
      id: S.nid++, type, owner, x, y, tx: x, ty: y, path: null, pi: 0, pk: null,
      task: null, carry: null, hp, maxHp: hp, hunger: 80 + KM.rand() * 20,
      home: 0, inside: 0, cd: 0, order: null, target: null, forced: false, guard: { x, y },
      anim: KM.rand() * 6, face: 1, wt: 0, scanT: KM.rand(), rp: 0, pfT: 0, noFood: 0, work: false, ai: null,
      g: 0, heading: 0, wantFood: false, fedInc: 0,
    };
    S.units[u.id] = u;
    return u;
  };

  KM.killUnit = function (S, u, byEnemy, killer) {
    KM.releaseTask(S, u);
    if (u.home && S.houses[u.home] && S.houses[u.home].worker === u.id) S.houses[u.home].worker = 0;
    if (u.g && S.army[u.g]) { const g = S.army[u.g]; g.m = g.m.filter((id) => id !== u.id); if (!g.m.length) delete S.army[u.g]; }
    delete S.units[u.id];
    S.fx.push({ k: 'death', x: u.x, y: u.y, t: 0, T: 1.4, c: u.owner, type: u.type, face: u.face });
    if (byEnemy) { S.stats[u.owner].lost++; if (killer != null && S.stats[killer]) S.stats[killer].killed++; }
    KM.ui && KM.ui.onRemoved && KM.ui.onRemoved('u', u.id);
  };

  KM.releaseTask = function (S, u) {
    const t = u.task;
    if (!t) return;
    if (t.type === 'carry') {
      if (t.st === 0) { const f = S.houses[t.from]; if (f && f.rsv[t.r]) f.rsv[t.r]--; }
      KM.undoInc(S, t);
    }
    if (t.tile != null && S.resv[t.tile] === u.id) delete S.resv[t.tile];
    const h = t.h && S.houses[t.h];
    if (h) {
      if (t.type === 'build' && h.builder === u.id) h.builder = 0;
      if (t.type === 'level' && h.leveler === u.id) h.leveler = 0;
      if (t.type === 'repair' && h.repairer === u.id) h.repairer = 0;
    }
    u.task = null;
  };

  KM.undoInc = function (S, t) {
    if (!t.ic) return;
    t.ic = false;
    if (t.toT != null) { if (S.map.rmat[t.toT] === 1) S.map.rmat[t.toT] = 0; return; }
    if (t.toU) { const v = S.units[t.toU]; if (v) v.fedInc = 0; return; }
    const d = S.houses[t.to];
    if (!d) return;
    if (d.state === 'site' && d.mat[t.r]) { if (d.mat[t.r].inc > 0) d.mat[t.r].inc--; }
    else if (d.inc[t.r] > 0) d.inc[t.r]--;
  };

  KM.notify = function (S, msg, kind, pos) {
    if (KM.ui && KM.ui.toast && KM.S === S && !S.editor) KM.ui.toast(msg, kind || 'info', pos);
  };

  // a entrada da casa está ligada a um Armazém do mesmo dono por estradas (prontas ou planejadas)?
  KM.roadLinked = function (S, h) {
    if (h.type === 'storehouse') return true;
    const m = S.map, W = m.W, o = h.owner;
    const goal = new Set();
    for (const id in S.houses) { const s = S.houses[id]; if (s.owner === o && s.type === 'storehouse') goal.add(s.ey * W + s.ex); }
    const start = h.ey * W + h.ex;
    if (!m.road[start]) return false;
    const seen = new Uint8Array(W * m.H), q = [start];
    seen[start] = 1;
    while (q.length) {
      const k = q.pop();
      if (goal.has(k)) return true;
      const x = k % W, y = (k / W) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (!KM.inb(nx, ny)) continue;
        const ni = ny * W + nx;
        if (!seen[ni] && m.road[ni] && m.rown[ni] === o) { seen[ni] = 1; q.push(ni); }
      }
    }
    return false;
  };

  // ---------- cidades ----------
  const SPOT_SCORE = {
    woodcutter: (S, x, y) => { let n = 0; const m = S.map; for (let yy = y - 5; yy <= y + 7; yy++) for (let xx = x - 5; xx <= x + 7; xx++) if (KM.inb(xx, yy) && m.tree[yy * m.W + xx]) n++; return n < 4 ? null : -n * 0.8; },
    quarry: (S, x, y) => { const m = S.map; let bd = 99; for (let yy = y - 8; yy <= y + 9; yy++) for (let xx = x - 8; xx <= x + 9; xx++) if (KM.inb(xx, yy) && m.stone[yy * m.W + xx]) bd = Math.min(bd, Math.hypot(xx - x, yy - y)); return bd > 8 ? null : bd * 2; },
    farm: (S, x, y) => { const m = S.map; let n = 0; for (let yy = y + 3; yy <= y + 6; yy++) for (let xx = x - 2; xx <= x + 4; xx++) if (KM.walkable(S, xx, yy) && m.terrain[yy * m.W + xx] === 0 && !m.road[yy * m.W + xx]) n++; return n < 8 ? null : -n * 0.4; },
    vineyard: (S, x, y) => SPOT_SCORE.farm(S, x, y),
  };
  KM.spotScore = (S, type) => (SPOT_SCORE[type] ? (x, y) => SPOT_SCORE[type](S, x, y) : null);

  KM.placeTownHouse = function (S, type, owner, cx, cy, built, R) {
    const p = KM.findSpot(S, type, owner, cx, cy, R || 13, KM.spotScore(S, type));
    if (!p) return null;
    const h = KM.addHouse(S, type, owner, p.x, p.y, built);
    KM.connectRoad(S, h, built);
    return h;
  };

  KM.fieldsAround = function (S, h, kind, n, built) {
    const m = S.map, ft = kind === 'wine' ? 3 : 1;
    let c = 0;
    for (let r = 2; r <= 5 && c < n; r++) for (let y = h.ey - r; y <= h.ey + r && c < n; y++) for (let x = h.ex - r; x <= h.ex + r && c < n; x++) {
      if (!KM.inb(x, y) || Math.max(Math.abs(x - h.ex), Math.abs(y - h.ey)) !== r) continue;
      const i = y * m.W + x;
      if (m.terrain[i] !== 0 || !KM.walkable(S, x, y) || m.road[i] || m.field[i] || m.tree[i]) continue;
      let bad = false;
      for (const id in S.houses) { const o = S.houses[id]; if (Math.abs(o.ex - x) <= 1 && Math.abs(o.ey - y) <= 1) { bad = true; break; } }
      if (bad) continue;
      m.field[i] = built ? ft + 1 : ft; m.fown[i] = h.owner; m.fstage[i] = built ? 1 + Math.floor(KM.rand() * 3) : 0;
      KM.tileChanged(S, x, y); c++;
    }
    return c;
  };

  function spawnAround(S, type, owner, cx, cy, k) {
    const p = KM.nearestWalkable(S, cx + (k % 5) - 2, cy + Math.floor(k / 5), 6) || [cx, cy];
    return KM.addUnit(S, type, owner, p[0], p[1]);
  }

  KM.setupTown = function (S, owner, start, cfg, preHouses) {
    const m = S.map;
    const fx = start.x < m.W / 2 ? 1 : -1, fy = start.y < m.H / 2 ? 1 : -1;
    let sh = null;
    const houses = [];
    // casas do editor, se houver
    for (const ph of preHouses || []) {
      if (!KM.canPlace(S, ph.type, ph.x, ph.y, -1).ok) continue;
      const h = KM.addHouse(S, ph.type, owner, ph.x, ph.y, true);
      houses.push(h);
      if (ph.type === 'storehouse' && !sh) sh = h;
    }
    if (!sh) {
      sh = KM.addHouse(S, 'storehouse', owner, start.x - 2, start.y - 2, true);
      for (let x = sh.ex - 3; x <= sh.ex + 5; x++) { const i = sh.ey * m.W + x; if (KM.walkable(S, x, sh.ey)) { m.road[i] = 2; m.rown[i] = owner; m.rmat[i] = 2; m.tree[i] = 0; } }
      houses.unshift(sh);
    }
    for (const h of houses) if (h !== sh) KM.connectRoad(S, h, true);
    KM.rt.roadsDirty = true;
    Object.assign(sh.inv, cfg.stock || {});
    const preStore = (preHouses || []).some((p) => p.type === 'storehouse');
    if (!preStore) for (const t of cfg.houses || []) {
      if (t === 'storehouse') continue;
      const h = KM.placeTownHouse(S, t, owner, start.x + fx, start.y + fy, true, 14);
      if (h) houses.push(h);
    }
    for (const h of houses) {
      if (h.type === 'farm') KM.fieldsAround(S, h, 'corn', 8, true);
      if (h.type === 'vineyard') KM.fieldsAround(S, h, 'wine', 6, true);
      if (h.type === 'school') KM.add(h.inv, 'gold', 5);
      if (h.type === 'tower') KM.add(h.inv, 'stone', 5);
      const d = KM.def(h);
      if (d.worker && cfg.workers !== false) {
        const u = KM.addUnit(S, d.worker, owner, h.ex, h.ey);
        u.home = h.id; h.worker = u.id; u.inside = h.id;
      }
    }
    let k = 0;
    for (const [t, n] of cfg.units || []) for (let j = 0; j < n; j++) spawnAround(S, t, owner, sh.ex, sh.ey + 1, k++);
    const bar = houses.find((h) => h.type === 'barracks');
    const ax = start.x + fx * 3, ay = start.y + fy * 4;
    const dir = KM.dirFrom(fx, fy);
    let gi = 0;
    for (const [t, n] of cfg.soldiers || []) {
      if (!n) continue;
      const us = [];
      for (let j = 0; j < n; j++) us.push(spawnAround(S, t, owner, ax, ay, j));
      const g = KM.newGroup(S, owner, t, us);
      const off = gi++ * 4 - 4;
      KM.formGroup(S, g, ax + off * -fy, ay + off * fx * 0, dir, false, true);
      if (!KM.human(S, owner)) for (const u of us) u.ai = 'def';
    }
    if (bar && cfg.recruits) bar.recruits = cfg.recruits;
    return houses;
  };

  // ---------- configurações prontas ----------
  KM.TOWNS = {
    human: () => ({
      houses: ['storehouse', 'school'],
      // povo mínimo: o resto sai da Escola (1 ouro cada), então o ouro inicial cobre os primeiros ofícios
      stock: { wood: 45, stone: 50, trunk: 6, gold: 55, bread: 20, sausages: 15, wine: 15, fish: 10, corn: 8, axe: 6, shield: 4, armor: 4, bow: 3 },
      units: [['serf', 2], ['laborer', 2]],
      soldiers: [['axeman', 3], ['militia', 2], ['bowman', 3]],
    }),
    economy: (D) => Object.assign(KM.TOWNS.human(), {
      mode: 'economy', peace: D.peace, mult: D.mult, def: D.def,
    }),
    waves: (D) => ({
      mode: 'waves', peace: D.peace, interval: D.interval, mult: D.mult, def: D.def,
      houses: ['school', 'barracks', 'inn', 'sawmill', 'weaponsmithy', 'armorsmithy', 'farm', 'bakery', 'tower', 'tower', 'tower'],
      soldiers: [['axeman', 3], ['bowman', Math.ceil(D.def / 3)], ['lancer', 2], ['swordsman', Math.max(0, D.def - 8)]],
    }),
  };

  // opts: { diff, seed, opponents, ally, aiMode, humans, teams:'versus'|'coop'|'2x2', map }
  // Multijogador (2 a 4 humanos): 'versus' = todos contra todos (cada reino no seu time),
  // 'coop' = humanos juntos contra as IAs, '2x2' = reinos 0 e 1 contra 2 e 3 (IA completa as vagas).
  KM.skirmishConfig = function (opts) {
    const D = KM.DIFF[opts.diff || 'normal'];
    const humans = opts.humans || 1;
    const maxP = opts.map ? Math.min(4, opts.map.starts.length) : 4;
    const aiTown = () => (opts.aiMode === 'waves' ? KM.TOWNS.waves(D) : KM.TOWNS.economy(D));
    const players = [];
    const mode = humans > 1 ? opts.teams : null;
    const teamOf = (i) => (mode === '2x2' ? (i < 2 ? 0 : 1) : mode === 'versus' ? i : 0);
    for (let h = 0; h < humans; h++) players.push({ human: true, team: teamOf(h), name: humans > 1 ? 'Jogador ' + (h + 1) : KM.NAMES[0], town: KM.TOWNS.human() });
    if (opts.ally && !mode && players.length < maxP - 1) players.push({ team: 0, name: 'Aliado', ai: KM.TOWNS.economy(D) });
    const want = opts.opponents == null ? 1 : opts.opponents;
    const free = Math.max(0, maxP - players.length);
    const nOpp = mode === '2x2' ? free : mode === 'versus' ? Math.min(free, want) : Math.min(free, Math.max(1, want));
    for (let k = 0; k < nOpp; k++) {
      const i = players.length;
      players.push({ team: mode === '2x2' ? teamOf(i) : mode === 'versus' ? 10 + k : 9, name: KM.NAMES[1 + (k % 3)], ai: aiTown() });
    }
    return { diff: opts.diff || 'normal', seed: opts.seed, goals: [{ k: 'destroy' }], players, map: opts.map || null };
  };

  // Formato dos mapas exportados pelo editor. Valide antes de tocar em MAP_W/MAP_H:
  // esses dados chegam do localStorage e de arquivos escolhidos pelo usuário.
  KM.MAP_DATA_V = 1;
  KM.MAP_MIN_SIZE = 32;
  KM.MAP_MAX_SIZE = 256;
  KM.validateMapData = function (d) {
    const fail = (error) => ({ ok: false, error });
    const finite = (v) => typeof v === 'number' && Number.isFinite(v);
    if (!d || typeof d !== 'object' || Array.isArray(d)) return fail('o arquivo precisa conter um objeto JSON de mapa.');
    if (d.v !== KM.MAP_DATA_V) return fail(`versão de mapa não suportada (esperada v${KM.MAP_DATA_V}).`);
    const W = d.W, H = d.H;
    if (!Number.isInteger(W) || !Number.isInteger(H) || W < KM.MAP_MIN_SIZE || H < KM.MAP_MIN_SIZE || W > KM.MAP_MAX_SIZE || H > KM.MAP_MAX_SIZE) {
      return fail(`as dimensões W/H devem ser inteiros entre ${KM.MAP_MIN_SIZE} e ${KM.MAP_MAX_SIZE}.`);
    }
    const N = W * H, VN = (W + 1) * (H + 1);
    const arrays = [
      ['terrain', N, (v) => Number.isInteger(v) && v >= 0 && v <= 3, 'inteiros de 0 a 3'],
      ['hv', VN, (v) => finite(v) && v >= 0 && v <= KM.MAXH, `números entre 0 e ${KM.MAXH}`],
      ['tree', N, (v) => Number.isInteger(v) && v >= 0 && v <= 4, 'inteiros de 0 a 4'],
      ['stone', N, (v) => Number.isInteger(v) && v >= 0 && v <= 7, 'inteiros de 0 a 7'],
      ['ore', N, (v) => Number.isInteger(v) && v >= 0 && v <= 3, 'inteiros de 0 a 3'],
      ['oreAmt', N, (v) => Number.isInteger(v) && v >= 0 && v <= 35, 'inteiros de 0 a 35'],
    ];
    for (const [key, length, valid, expected] of arrays) {
      if (!Array.isArray(d[key])) return fail(`o array "${key}" é obrigatório.`);
      if (d[key].length !== length) return fail(`o array "${key}" deve ter exatamente ${length} valores.`);
      for (let i = 0; i < length; i++) if (!valid(d[key][i])) return fail(`o array "${key}" tem valor inválido na posição ${i} (esperado: ${expected}).`);
    }
    if (!Array.isArray(d.starts) || d.starts.length < 2 || d.starts.length > 4) return fail('o mapa precisa ter entre 2 e 4 bases.');
    const startKeys = new Set();
    for (let i = 0; i < d.starts.length; i++) {
      const s = d.starts[i];
      if (!s || typeof s !== 'object' || !Number.isInteger(s.x) || !Number.isInteger(s.y) || s.x < 2 || s.y < 2 || s.x >= W || s.y >= H) {
        return fail(`a base ${i + 1} deve ter coordenadas inteiras válidas, a pelo menos 2 casas da borda superior/esquerda.`);
      }
      const key = s.x + ',' + s.y;
      if (startKeys.has(key)) return fail(`as bases não podem ocupar a mesma posição (${key}).`);
      startKeys.add(key);
      const tile = d.terrain[s.y * W + s.x];
      if (tile !== KM.T.GRASS && tile !== KM.T.SAND) return fail(`a base ${i + 1} deve ficar em grama ou areia.`);
    }
    if (d.biome != null && (typeof d.biome !== 'string' || !Object.prototype.hasOwnProperty.call(KM.BIOMES, d.biome))) return fail('o bioma informado não é reconhecido.');

    const houses = d.houses == null ? [] : d.houses;
    if (!Array.isArray(houses)) return fail('o campo houses deve ser uma lista de casas.');
    if (houses.length > Math.min(N, 4096)) return fail(`o mapa não pode conter mais de ${Math.min(N, 4096)} casas.`);
    const occupied = new Set(), doors = new Set();
    for (let i = 0; i < houses.length; i++) {
      const h = houses[i];
      if (!h || typeof h !== 'object' || typeof h.type !== 'string' || !Object.prototype.hasOwnProperty.call(KM.HOUSES, h.type)) return fail(`a casa ${i + 1} tem um tipo desconhecido.`);
      if (!Number.isInteger(h.owner) || h.owner < 0 || h.owner >= d.starts.length) return fail(`a casa ${i + 1} tem um dono inválido.`);
      if (!Number.isInteger(h.x) || !Number.isInteger(h.y)) return fail(`a casa ${i + 1} deve ter posição inteira.`);
      const f = KM.footprint(h.type, h.x, h.y, 0);
      if (f.x0 < 0 || f.y0 < 0 || f.x1 >= W || f.y1 >= H) return fail(`a casa ${i + 1} fica fora dos limites do mapa.`);
      for (let y = h.y; y < h.y + f.h; y++) for (let x = h.x; x < h.x + f.w; x++) {
        const k = y * W + x;
        if (occupied.has(k) || doors.has(k)) return fail(`a casa ${i + 1} se sobrepõe a outra casa ou entrada.`);
        if ((d.terrain[k] !== KM.T.GRASS && d.terrain[k] !== KM.T.SAND) || d.stone[k] !== 0) return fail(`a casa ${i + 1} está em terreno ou rocha inválidos.`);
        occupied.add(k);
      }
      const door = f.ey * W + f.ex;
      if (occupied.has(door) || doors.has(door) || (d.terrain[door] !== KM.T.GRASS && d.terrain[door] !== KM.T.SAND) || d.stone[door] !== 0) return fail(`a entrada da casa ${i + 1} está bloqueada ou fora do terreno válido.`);
      doors.add(door);
    }
    return { ok: true, data: d };
  };
  KM.assertMapData = function (d) {
    const result = KM.validateMapData(d);
    if (!result.ok) throw new Error('Mapa inválido: ' + result.error);
    return result.data;
  };

  KM.newState = function (opts) {
    opts = opts || {};
    const hasRawMap = opts.map != null;
    const rawMap = opts.map;
    if (hasRawMap) KM.assertMapData(rawMap);
    const mis = opts.mission ? KM.findMission(opts.mission, opts.diff) : null;
    const cfg = mis || KM.skirmishConfig(opts);
    const seed = cfg.seed || opts.seed || Math.floor(Math.random() * 1e9);
    const pl = cfg.players || [
      { human: true, team: 0, name: KM.NAMES[0], town: cfg.player },
      ...(cfg.ai && cfg.ai.mode !== 'none' ? [{ team: 1, name: KM.NAMES[1], ai: cfg.ai }] : []),
    ];
    const mapData = hasRawMap ? rawMap : cfg.map;
    if (!hasRawMap && mapData) KM.assertMapData(mapData);
    let m, starts;
    if (mapData) { ({ m, starts } = KM.mapFromData(mapData, seed)); }
    else ({ m, starts } = KM.genMap(seed, { players: Math.max(2, pl.length), W: cfg.W, H: cfg.W, type: opts.mapType || cfg.mapType, biome: opts.biome || cfg.biome }));
    const diff = opts.diff || cfg.diff || 'normal';
    const S = {
      v: KM.SAVE_V, seed, rs: seed | 0, time: 0, tick: 0, speed: 1, paused: false, map: m, houses: {}, units: {}, army: {}, nid: 1, starts,
      diff, proj: [], fx: [], resv: {}, over: null, mission: mis ? mis.id : null, mp: !!opts.mp,
      goals: JSON.parse(JSON.stringify(cfg.goals || [])), hotkeys: {}, cmdq: [],
      resourceFlow: { since: 0, events: [] },
      players: pl.map((p, i) => ({
        name: p.name || KM.NAMES[i], color: KM.COLORS[i], team: p.team != null ? p.team : i, human: !!p.human,
        eco: !!p.human || !!(p.ai && p.ai.mode === 'economy'), dist: KM.defaultDist(), autoTrain: true, out: false,
        built: {}, all: !!(p.human && opts.allUnlocked),
      })),
      stats: pl.map(() => ({ built: 0, trained: 0, killed: 0, lost: 0 })),
    };
    KM.simS = S;
    KM.rt = { comp: null, roadsDirty: true };
    pl.forEach((p, i) => {
      const st = starts[i] || starts[0];
      KM.reveal(S, st.x, st.y, 14, i);
      const pre = mapData && mapData.houses ? mapData.houses.filter((h) => h.owner === i) : null;
      KM.setupTown(S, i, st, p.human ? p.town || KM.TOWNS.human() : Object.assign({ ai: true }, p.ai), pre);
      const base = Object.values(S.houses).find((h) => h.owner === i && h.type === 'storehouse' && h.state === 'built');
      S.players[i].homeStore = base ? base.id : 0;
      if (!p.human) KM.setupAI(S, i, p.ai, diff);
    });
    S.sites = (cfg.sites || []).map((site) => {
      const p = KM.nearestWalkable(S, Math.round(site.x * m.W), Math.round(site.y * m.H), 16);
      return Object.assign({}, site, { x: p ? p[0] : starts[0].x, y: p ? p[1] : starts[0].y, r: 6, owner: -1, contested: false, held: pl.map(() => 0) });
    });
    for (const site of S.sites) {
      const o = Math.min(pl.length - 1, site.rival || 1);
      KM.reveal(S, site.x, site.y, site.r + 2, 0);
      for (const [type, n, off] of [['lancer', Math.ceil(site.garrison / 2), -2], ['bowman', Math.floor(site.garrison / 2), 2]]) {
        const us = [];
        for (let k = 0; k < n; k++) us.push(KM.addUnit(S, type, o, site.x, site.y));
        const g = KM.newGroup(S, o, type, us);
        KM.formGroup(S, g, site.x + off, site.y, 0, false, true);
      }
    }
    // Paz territorial (escaramuça e multijogador): o mapa é dividido em 4 quadrantes e,
    // até o fim da paz, cada reino só constrói, anda e ataca dentro do próprio.
    S.peaceEnd = 0; S.zones = null;
    if (!mis) {
      const ais = S.players.map((p) => p.ai).filter((a) => a && (a.mode === 'economy' || a.mode === 'waves'));
      S.peaceEnd = ais.length ? Math.min(...ais.map((a) => a.next)) : pl.length > 1 ? KM.DIFF[diff].peace : 0;
      if (S.peaceEnd > 0) {
        const hw = m.W >> 1, hh = m.H >> 1;
        const zs = pl.map((p, i) => { const s = starts[i] || starts[0]; return s.x < hw ? (s.y < hh ? 0 : 2) : (s.y < hh ? 1 : 3); });
        // dois reinos no mesmo quadrante (mapas do editor): nenhum dos dois fica preso
        S.zones = zs.map((q) => (zs.filter((k) => k === q).length > 1 ? null : { x0: q & 1 ? hw : 0, x1: q & 1 ? m.W - 1 : hw - 1, y0: q & 2 ? hh : 0, y1: q & 2 ? m.H - 1 : hh - 1 }));
      }
    }
    S.protected = [];
    if (cfg.scenario === 'restore') {
      for (const h of Object.values(S.houses).filter((h) => h.owner === 0)) { h.hp = Math.round(h.maxHp * 0.35); S.protected.push(h.id); }
    } else if (cfg.scenario === 'frontier') {
      const core = Object.values(S.houses).find((h) => h.owner === 0 && h.type === 'storehouse');
      if (core) S.protected.push(core.id);
    }
    for (const id in S.units) { const u = S.units[id]; if (!KM.human(S, u.owner) && KM.isSoldier(u.type)) u.ai = 'def'; }
    KM.updateFog(S);
    return S;
  };

  KM.updateSites = function (S) {
    if (!S.sites || !S.sites.length) return;
    const dt = Math.max(0, Math.min(2, S.time - (S.siteUpdated || 0)));
    S.siteUpdated = S.time;
    for (const site of S.sites) {
      const counts = S.players.map(() => 0);
      for (const u of Object.values(S.units)) if (!u.inside && KM.isSoldier(u.type) && !S.players[u.owner].out && Math.hypot(u.x - site.x, u.y - site.y) <= site.r) counts[u.owner]++;
      const present = counts.map((n, o) => n > 0 ? o : -1).filter((o) => o >= 0);
      site.contested = present.some((a) => present.some((b) => KM.hostile(S, a, b)));
      let owner = -1;
      if (!site.contested) {
        for (const o of present) {
          if (counts[o] < 3) continue;
          if (site.outpost) {
            const stores = Object.values(S.houses).filter((h) => h.owner === o && h.type === 'storehouse' && h.state === 'built');
            const base = S.houses[S.players[o].homeStore] || (!S.players[o].homeStore && stores[0]);
            const connected = base && stores.some((h) => h.id !== base.id && Math.hypot(KM.hcx(h) - site.x, KM.hcy(h) - site.y) <= site.r && KM.rt.comp && KM.rt.comp[h.ey * S.map.W + h.ex] >= 0 && KM.rt.comp[h.ey * S.map.W + h.ex] === KM.rt.comp[base.ey * S.map.W + base.ex]);
            if (!connected) continue;
          }
          if (owner < 0 || counts[o] > counts[owner]) owner = o;
        }
      }
      site.owner = owner;
      site.held = site.held || S.players.map(() => 0);
      for (let o = 0; o < S.players.length; o++) site.held[o] = o === owner ? (site.held[o] || 0) + dt : 0;
    }
  };

  // mapa vindo do editor
  KM.mapFromData = function (d, seed) {
    const data = KM.assertMapData(d);
    KM.setMapSize(data.W, data.H);
    const m = KM.emptyMap(data.W, data.H);
    m.biome = KM.BIOMES[data.biome] ? data.biome : 'pradaria';
    for (const k of ['terrain', 'tree', 'stone', 'ore', 'oreAmt', 'hv']) m[k] = data[k].slice();
    const sN = KM.makeNoise(seed + 3);
    for (let i = 0; i < data.W * data.H; i++) {
      m.shade[i] = Math.floor(sN((i % data.W) / 5, Math.floor(i / data.W) / 5, 3) * 255);
      if (m.terrain[i] === KM.T.WATER) m.fish[i] = 4;
    }
    return { m, starts: data.starts.map((s) => ({ x: s.x, y: s.y })) };
  };

  KM.reveal = function (S, cx, cy, r, o) {
    const m = S.map, bit = 1 << (o == null ? KM.me : o);
    const mine = (o == null ? KM.me : o) === KM.me;
    for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      if (!KM.inb(x, y)) continue;
      const i = y * m.W + x;
      if (m.explored[i] & bit) continue;
      if ((x - cx) * (x - cx) + (y - cy) * (y - cy) > r * r) continue;
      m.explored[i] |= bit;
      if (mine && KM.R && KM.R.fogSet) KM.R.fogSet(x, y);
    }
  };

  KM.updateFog = function (S) {
    for (const id in S.units) {
      const u = S.units[id];
      if (u.inside || !KM.human(S, u.owner)) continue;
      KM.reveal(S, u.x, u.y, KM.isSoldier(u.type) ? 7 : 5, u.owner);
    }
    for (const id in S.houses) {
      const h = S.houses[id];
      if (h.state !== 'plan' && KM.human(S, h.owner)) KM.reveal(S, KM.hcx(h), KM.hcy(h), h.type === 'tower' ? 9 : 6, h.owner);
    }
  };

  KM.tileChanged = function (S, x, y) {
    if (KM.R && KM.R.base && KM.R.S === S) KM.R.redrawTile(S, x, y);
  };
})(window.KM);
