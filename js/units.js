'use strict';
/* Movimento e comportamento dos cidadãos */
(function (KM) {
  const W = () => KM.MAP_W;

  KM.updateMove = function (S, u, dt) {
    if (!u.path) return 'arrived';
    if (u.pi >= u.path.length) { u.path = null; return 'arrived'; }
    const n = u.path[u.pi], nx = n[0], ny = n[1];
    if (!KM.walkable(S, nx, ny)) { u.path = null; return 'blocked'; }
    const m = S.map;
    const onRoad = m.road[u.ty * m.W + u.tx] === 2;
    const sd = KM.SOLDIERS[u.type];
    let sp = (sd ? sd.spd : 1.6) * (onRoad ? 1.35 : 1) * (u.hunger <= 0 ? 0.6 : 1);
    if (u.carry) sp *= 0.9;
    const step = sp * dt, dx = nx - u.x, dy = ny - u.y, dd = Math.hypot(dx, dy);
    if (sd && dd > 0.01) u.heading = KM.dirFrom(dx, dy);
    if (Math.abs(dx) > 0.01) u.face = dx > 0 ? 1 : -1;
    u.anim += dt * sp * 7;
    if (dd <= step) {
      u.x = nx; u.y = ny; u.tx = nx; u.ty = ny; u.pi++;
      if (u.pi >= u.path.length) { u.path = null; return 'arrived'; }
      return 'moving';
    }
    u.x += (dx / dd) * step; u.y += (dy / dd) * step;
    return 'moving';
  };

  // 1 = chegou, 0 = andando, -1 = impossível
  KM.goTo = function (S, u, dt, tx, ty, opt) {
    opt = opt || {};
    const adj = opt.adj || !KM.walkable(S, tx, ty);
    const at = () => (adj ? Math.max(Math.abs(u.tx - tx), Math.abs(u.ty - ty)) <= 1 : u.tx === tx && u.ty === ty);
    const key = tx + ',' + ty;
    if (!u.path && at()) { u.x = u.tx; u.y = u.ty; return 1; }
    if (!u.path || u.pk !== key) {
      if (u.pfT > 0) { u.pfT -= dt; return 0; }
      const p = KM.findPath(S, u.tx, u.ty, tx, ty, { adj, roadPref: opt.roadPref });
      if (!p) {
        u.pfT = 0.8; u.pfail = (u.pfail || 0) + 1;
        if (u.pfail >= 3) { u.pfail = 0; return -1; }
        return 0;
      }
      u.pfail = 0;
      if (!p.length) { u.x = u.tx; u.y = u.ty; return 1; }
      u.path = p; u.pi = 0; u.pk = key;
    }
    const r = KM.updateMove(S, u, dt);
    if (r === 'arrived') { u.pk = null; return at() ? 1 : 0; }
    if (r === 'blocked') u.pk = null;
    return 0;
  };

  function findInn(S, u) {
    let best = null, bd = 1e9;
    for (const id in S.houses) {
      const h = S.houses[id];
      if (h.owner !== u.owner || h.type !== 'inn' || h.state !== 'built') continue;
      let food = 0;
      for (const f in KM.FOOD) food += h.inv[f] || 0;
      if (!food) continue;
      const d = Math.abs(h.ex - u.tx) + Math.abs(h.ey - u.ty);
      if (d < bd) { bd = d; best = h; }
    }
    return best;
  }

  function wantsFood(S, u) {
    if (u.hunger >= 30 || u.noFood > 0) return false;
    const inn = findInn(S, u);
    if (!inn) { u.noFood = 20; return false; }
    if (u.inside) { u.inside = 0; }
    u.task = { type: 'eat', inn: inn.id, st: 0 };
    return true;
  }

  KM.updateUnit = function (S, u, dt) {
    if (KM.isSoldier(u.type)) return KM.updateSoldier(S, u, dt);
    u.hunger = Math.max(0, u.hunger - dt * 0.16);
    if (u.noFood > 0) u.noFood -= dt;
    u.work = false;
    if (u.wt > 0 && !(u.task && u.task.type === 'eat')) {
      // tempo de trabalho/descanso
      if (u.task) u.work = true;
      u.wt -= dt * (u.hunger <= 0 ? 0.5 : 1);
      if (u.wt > 0) return;
      u.wt = 0;
      if (u.task && u.task.onDone) { const f = u.task.onDone; u.task.onDone = null; TASKS_DONE[f](S, u, u.task); }
      return;
    }
    if (u.task) return TASKS[u.task.type](S, u, u.task, dt);
    // sem tarefa
    if (u.type === 'recruit' && !u.home) return recruitIdle(S, u, dt);
    if (wantsFood(S, u)) return;
    if (u.type === 'serf' || u.type === 'laborer') return idleWander(S, u, dt);
    if (!u.home) return idleWander(S, u, dt);
    const h = S.houses[u.home];
    if (!h || h.worker !== u.id) { u.home = 0; u.inside = 0; return; }
    if (u.inside !== h.id) {
      const g = KM.goTo(S, u, dt, h.ex, h.ey);
      if (g === 1) { u.inside = h.id; u.x = u.tx = h.ex; u.y = u.ty = h.ey; }
      else if (g < 0) { u.wt = 2; }
      return;
    }
    const d = KM.def(h);
    if (d.gather) gatherDecide(S, u, h, d);
  };

  function idleWander(S, u, dt) {
    if (u.path) { KM.updateMove(S, u, dt); return; }
    u.idleT = (u.idleT || 0) - dt;
    if (u.idleT > 0) return;
    u.idleT = 6 + KM.rand() * 8;
    const m = S.map;
    // carregadores ficam perto das estradas
    if (u.type === 'serf' && m.road[u.ty * m.W + u.tx] !== 2) {
      for (let r = 1; r < 8; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const x = u.tx + dx, y = u.ty + dy;
        if (KM.inb(x, y) && m.road[y * m.W + x] === 2 && KM.walkable(S, x, y)) {
          const p = KM.findPath(S, u.tx, u.ty, x, y, { max: 600 });
          if (p) { u.path = p; u.pi = 0; u.pk = null; }
          return;
        }
      }
    }
    // passeio curto em volta do ponto onde ficou livre (a vila parece viva, sem fileiras paradas)
    if (!u.anchor || Math.hypot(u.anchor.x - u.tx, u.anchor.y - u.ty) > 6) u.anchor = { x: u.tx, y: u.ty };
    if (KM.rand() < 0.55) {
      for (let k = 0; k < 6; k++) {
        const x = u.anchor.x + Math.round((KM.rand() - 0.5) * 6), y = u.anchor.y + Math.round((KM.rand() - 0.5) * 6);
        if (!KM.inb(x, y) || !KM.walkable(S, x, y) || (x === u.tx && y === u.ty)) continue;
        if (u.type === 'serf' && m.road[y * m.W + x] !== 2) continue;
        if (m.house[y * m.W + x]) continue;
        const p = KM.findPath(S, u.tx, u.ty, x, y, { max: 200 });
        if (p) { u.path = p; u.pi = 0; u.pk = null; }
        break;
      }
    }
  }

  function recruitIdle(S, u, dt) {
    let best = null, bd = 1e9;
    for (const id in S.houses) {
      const h = S.houses[id];
      if (h.owner !== u.owner || h.type !== 'barracks' || h.state !== 'built') continue;
      const d = Math.abs(h.ex - u.tx) + Math.abs(h.ey - u.ty);
      if (d < bd) { bd = d; best = h; }
    }
    if (!best) return idleWander(S, u, dt);
    const g = KM.goTo(S, u, dt, best.ex, best.ey);
    if (g === 1) { best.recruits++; delete S.units[u.id]; KM.ui && KM.ui.onRemoved && KM.ui.onRemoved('u', u.id); }
  }

  // ---------- Coleta (lenhador, pedreiro, agricultor, pescador) ----------
  function gatherDecide(S, u, h, d) {
    let tot = 0;
    for (const k in h.out) tot += h.out[k];
    if (tot >= KM.OUT_CAP) { u.wt = 2; return; }
    const tg = findGather(S, h, d, u);
    if (!tg) { u.wt = 4; return; }
    S.resv[tg.i] = u.id;
    u.inside = 0; u.x = u.tx = h.ex; u.y = u.ty = h.ey;
    u.task = { type: 'gather', kind: tg.kind, tile: tg.i, x: tg.x, y: tg.y, st: 0, adj: tg.adj };
  }

  function findGather(S, h, d, u) {
    const m = S.map, Wd = m.W, R = d.radius;
    const cx = h.ex, cy = h.ey;
    let best = null, bd = 1e9, empties = [], trees = 0;
    for (let y = cy - R; y <= cy + R; y++) for (let x = cx - R; x <= cx + R; x++) {
      if (!KM.inb(x, y)) continue;
      const dist = Math.hypot(x - cx, y - cy);
      if (dist > R) continue;
      const i = y * Wd + x;
      if (S.resv[i]) continue;
      let kind = null, pr = 0;
      if (d.gather === 'tree') {
        if (m.tree[i]) trees++;
        if (m.tree[i] === 4) kind = 'chop';
        else if (!m.tree[i] && m.terrain[i] === KM.T.GRASS && !m.house[i] && !m.road[i] && !m.field[i] && !m.stone[i] && dist > 2.5 && KM.hash(x, y, 5) < 0.6) empties.push(i);
      } else if (d.gather === 'stone') {
        if (m.stone[i] > 0) kind = 'mine';
      } else if (d.gather === 'corn' || d.gather === 'wine') {
        const ft = d.gather === 'corn' ? 2 : 4;
        if (m.field[i] === ft && m.fown[i] === h.owner) {
          if (m.fstage[i] === 4) { kind = 'harvest'; pr = -20; } else if (m.fstage[i] === 0) kind = 'sow';
        }
      } else if (d.gather === 'fish') {
        if (m.terrain[i] === KM.T.WATER && m.fish[i] > 0) {
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (KM.walkable(S, x + dx, y + dy)) { kind = 'fish'; break; }
        }
      }
      if (kind && dist + pr < bd) { bd = dist + pr; best = { kind, i, x, y, adj: kind === 'mine' || kind === 'fish' }; }
    }
    if (!best && d.gather === 'tree' && trees < 16 && empties.length) {
      const i = empties[Math.floor(KM.rand() * empties.length)];
      best = { kind: 'plant', i, x: i % Wd, y: (i / Wd) | 0 };
    }
    return best;
  }

  const WORK_T = { chop: 5, plant: 3, mine: 6, harvest: 4, sow: 3, fish: 7 };

  const TASKS_DONE = {
    gatherDone(S, u, t) {
      const m = S.map, i = t.tile;
      if (S.resv[i] === u.id) delete S.resv[i];
      const h = S.houses[u.home];
      const res = h ? KM.def(h).out : null;
      if (t.kind === 'chop' && m.tree[i] === 4) { m.tree[i] = 0; u.carry = res; }
      else if (t.kind === 'plant' && !m.tree[i]) { m.tree[i] = 1; m.treeT[i] = 0; }
      else if (t.kind === 'mine' && m.stone[i] > 0) { m.stone[i]--; u.carry = res; }
      else if (t.kind === 'harvest' && m.fstage[i] === 4) { m.fstage[i] = m.field[i] === 4 ? 1 : 0; m.ftimer[i] = 0; u.carry = res; }
      else if (t.kind === 'sow' && m.fstage[i] === 0) { m.fstage[i] = 1; m.ftimer[i] = 0; }
      else if (t.kind === 'fish' && m.fish[i] > 0) { m.fish[i]--; u.carry = res; }
      t.st = 2;
    },
    roadDone(S, u, t) {
      const m = S.map, i = t.tile;
      if (S.resv[i] === u.id) delete S.resv[i];
      if (m.road[i] === 1) { m.road[i] = 2; m.tree[i] = 0; KM.rt.roadsDirty = true; KM.tileChanged(S, t.x, t.y); }
      u.task = null;
    },
    fieldDone(S, u, t) {
      const m = S.map, i = t.tile;
      if (S.resv[i] === u.id) delete S.resv[i];
      if (m.field[i] === 1 || m.field[i] === 3) { m.field[i]++; m.fstage[i] = 0; m.ftimer[i] = 0; m.tree[i] = 0; KM.tileChanged(S, t.x, t.y); }
      u.task = null;
    },
    levelDone(S, u, t) {
      const h = S.houses[t.h];
      if (h && h.state === 'plan') {
        h.state = 'site'; h.hp = 30; h.leveler = 0;
        const m = S.map;
        for (let y = h.y; y < h.y + h.h; y++) for (let x = h.x; x < h.x + h.w; x++) m.tree[y * m.W + x] = 0;
        const f = KM.footprint(h.type, h.x, h.y, h.rot);
        KM.flatten(S, f.x0, f.y0, f.x1, f.y1);
      }
      u.task = null;
    },
    buildStep(S, u, t) { t.st = 1; },
    eatDone(S, u, t) { t.st = 1; },
  };

  const TASKS = {
    carry(S, u, t, dt) {
      if (t.st === 0) {
        const f = S.houses[t.from];
        if (!f || f.state !== 'built') { KM.undoInc(S, t); u.task = null; return; }
        const g = KM.goTo(S, u, dt, f.ex, f.ey, { roadPref: 3 });
        if (g < 0) { if (f.rsv[t.r]) f.rsv[t.r]--; KM.undoInc(S, t); u.task = null; return; }
        if (g === 0) return;
        if (f.rsv[t.r]) f.rsv[t.r]--;
        const src = KM.def(f).accepts === 'all' ? f.inv : f.out;
        if ((src[t.r] || 0) <= 0) { KM.undoInc(S, t); u.task = null; return; }
        src[t.r]--; u.carry = t.r; t.st = 1; u.wt = 0.5;
        return;
      }
      if (t.toT != null) {
        const m = S.map, i = t.toT;
        if (m.road[i] !== 1 || m.rmat[i] !== 1) { KM.undoInc(S, t); t.toT = null; t.to = 0; return; }
        const g = KM.goTo(S, u, dt, i % m.W, (i / m.W) | 0, { roadPref: 3 });
        if (g < 0) { KM.undoInc(S, t); t.toT = null; t.to = 0; return; }
        if (g === 1) { m.rmat[i] = 2; t.ic = false; u.carry = null; u.task = null; u.wt = 0.3; }
        return;
      }
      if (t.toU) {
        const v = S.units[t.toU];
        if (!v || v.fedInc !== u.id) { KM.undoInc(S, t); t.toU = 0; t.to = 0; return; }
        const g = KM.goTo(S, u, dt, v.tx, v.ty, { adj: true });
        if (g < 0) { KM.undoInc(S, t); t.toU = 0; t.to = 0; return; }
        if (g === 1) {
          v.hunger = Math.min(100, v.hunger + (KM.FOOD[t.r] || 40) * 1.5);
          v.fedInc = 0; v.wantFood = v.hunger < 80;
          t.ic = false; u.carry = null; u.task = null; u.wt = 0.4;
        }
        return;
      }
      let d = S.houses[t.to];
      if (!d || !(d.state === 'built' || d.state === 'site') || d.owner !== u.owner) {
        KM.undoInc(S, t);
        d = KM.nearestStore(S, u.owner, u.tx, u.ty);
        if (!d) { u.carry = null; u.task = null; return; }
        t.to = d.id;
      }
      const g = KM.goTo(S, u, dt, d.ex, d.ey, { roadPref: 3 });
      if (g < 0) {
        KM.undoInc(S, t);
        const s = KM.nearestStore(S, u.owner, u.tx, u.ty, d.id);
        if (s) t.to = s.id; else { u.carry = null; u.task = null; }
        return;
      }
      if (g === 0) return;
      if (t.ic) {
        t.ic = false;
        if (d.state === 'site' && d.mat[t.r]) d.mat[t.r].inc = Math.max(0, d.mat[t.r].inc - 1);
        else if (d.inc[t.r] > 0) d.inc[t.r]--;
      }
      if (d.state === 'site' && !d.mat[t.r]) { d = KM.nearestStore(S, u.owner, u.tx, u.ty); if (!d) { u.carry = null; u.task = null; return; } t.to = d.id; return; }
      KM.deliver(S, d, t.r);
      u.carry = null; u.task = null; u.wt = 0.3;
    },
    road(S, u, t, dt) {
      const m = S.map;
      if (m.road[t.tile] !== 1) { KM.releaseTask(S, u); return; }
      const g = KM.goTo(S, u, dt, t.x, t.y);
      if (g < 0 || !KM.walkable(S, t.x, t.y)) { KM.releaseTask(S, u); return; }
      if (g === 1) { u.wt = 2.5; t.onDone = 'roadDone'; }
    },
    field(S, u, t, dt) {
      const m = S.map;
      if (m.field[t.tile] !== 1 && m.field[t.tile] !== 3) { KM.releaseTask(S, u); return; }
      const g = KM.goTo(S, u, dt, t.x, t.y);
      if (g < 0) { KM.releaseTask(S, u); return; }
      if (g === 1) { u.wt = 3.5; t.onDone = 'fieldDone'; }
    },
    level(S, u, t, dt) {
      const h = S.houses[t.h];
      if (!h || h.state !== 'plan') { u.task = null; return; }
      const g = KM.goTo(S, u, dt, h.ex, h.ey);
      if (g < 0) { KM.releaseTask(S, u); u.wt = 3; return; }
      if (g === 1) { u.wt = 7; t.onDone = 'levelDone'; }
    },
    build(S, u, t, dt) {
      const h = S.houses[t.h];
      if (!h || h.state !== 'site') { u.task = null; return; }
      const g = KM.goTo(S, u, dt, h.ex, h.ey);
      if (g < 0) { KM.releaseTask(S, u); u.wt = 3; return; }
      if (g === 0) return;
      if (h.used >= h.total) { KM.finishHouse(S, h); u.task = null; return; }
      for (const r in h.mat) {
        if (h.mat[r].have > 0) {
          h.mat[r].have--; h.used++;
          h.hp = Math.max(30, Math.round(h.maxHp * h.used / h.total));
          u.wt = 3.6; t.onDone = 'buildStep';
          return;
        }
      }
      h.builder = 0; u.task = null;
    },
    repair(S, u, t, dt) {
      const h = S.houses[t.h];
      if (!h || h.state !== 'built' || h.hp >= h.maxHp || !h.repair || KM.enemyNear(S, u.owner, h.ex, h.ey, 9)) { KM.releaseTask(S, u); return; }
      const g = KM.goTo(S, u, dt, h.ex, h.ey);
      if (g < 0) { KM.releaseTask(S, u); u.wt = 3; return; }
      if (g === 1) { h.hp = Math.min(h.maxHp, h.hp + h.maxHp * 0.05); u.wt = 2; t.onDone = 'buildStep'; }
    },
    gather(S, u, t, dt) {
      const h = S.houses[u.home];
      if (!h) { KM.releaseTask(S, u); u.carry = null; return; }
      if (t.st === 0) {
        const g = KM.goTo(S, u, dt, t.x, t.y, { adj: t.adj });
        if (g < 0) { if (S.resv[t.tile] === u.id) delete S.resv[t.tile]; t.st = 2; return; }
        if (g === 1) { t.st = 1; u.wt = WORK_T[t.kind] || 4; t.onDone = 'gatherDone'; if (t.x !== u.tx) u.face = t.x > u.tx ? 1 : -1; }
        return;
      }
      if (t.st === 2) {
        const g = KM.goTo(S, u, dt, h.ex, h.ey);
        if (g === 0) return;
        u.inside = h.id; u.x = u.tx = h.ex; u.y = u.ty = h.ey;
        if (u.carry && h.state === 'built') KM.add(h.out, u.carry, 1);
        u.carry = null; u.task = null; u.wt = 1.5;
      }
    },
    eat(S, u, t, dt) {
      const inn = S.houses[t.inn];
      if (!inn || inn.state !== 'built') { u.inside = 0; u.task = null; return; }
      if (t.st === 0) {
        const g = KM.goTo(S, u, dt, inn.ex, inn.ey);
        if (g < 0) { u.task = null; u.noFood = 20; return; }
        if (g === 0) return;
        u.inside = inn.id; u.x = u.tx = inn.ex; u.y = u.ty = inn.ey; t.st = 1; u.wt = 0;
        return;
      }
      if (u.wt > 0) { u.wt -= dt; return; }
      if (u.hunger >= 90) { u.inside = 0; u.task = null; return; }
      let bf = null;
      for (const f in KM.FOOD) if ((inn.inv[f] || 0) > 0) { bf = f; break; }
      if (!bf) { u.inside = 0; u.task = null; if (u.hunger < 30) u.noFood = 25; return; }
      inn.inv[bf]--;
      u.hunger = Math.min(100, u.hunger + KM.FOOD[bf]);
      u.wt = 4;
    },
  };

  KM.taskText = function (S, u) {
    const t = u.task;
    if (u.inside) {
      const h = S.houses[u.inside];
      if (t && t.type === 'eat') return 'Comendo na taverna';
      if (h) return 'Trabalhando em ' + KM.def(h).n;
    }
    if (!t) {
      if (u.type === 'recruit') return 'Indo para o quartel';
      if (u.home) return 'Voltando para o trabalho';
      if (KM.PROF[u.type] && u.type !== 'serf' && u.type !== 'laborer') return 'Sem local de trabalho';
      return 'Ocioso';
    }
    switch (t.type) {
      case 'carry': return `Transportando ${KM.RES[t.r].i} ${KM.RES[t.r].n}`;
      case 'road': return 'Construindo estrada';
      case 'field': return 'Preparando campo';
      case 'level': return 'Nivelando terreno';
      case 'build': return 'Construindo casa';
      case 'repair': return 'Reparando casa';
      case 'eat': return 'Indo comer';
      case 'gather': return ({ chop: 'Cortando árvore', plant: 'Plantando muda', mine: 'Quebrando pedra', harvest: 'Colhendo', sow: 'Semeando', fish: 'Pescando' })[t.kind];
    }
    return '';
  };
})(window.KM);
