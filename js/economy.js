'use strict';
/* Economia: logística de carregadores, construtores, produção, escola, torres */
(function (KM) {
  const man = (ax, ay, bx, by) => Math.abs(ax - bx) + Math.abs(ay - by);

  function idleUnits(S, owner, type) {
    const r = [];
    for (const id in S.units) {
      const u = S.units[id];
      if (u.owner === owner && u.type === type && !u.task && !u.inside && u.wt <= 0 && !(u.hunger < 30 && u.noFood <= 0)) r.push(u);
    }
    return r;
  }
  function nearestIdx(list, x, y) {
    let bi = -1, bd = 1e9;
    for (let k = 0; k < list.length; k++) { const d = man(list[k].tx, list[k].ty, x, y); if (d < bd) { bd = d; bi = k; } }
    return bi;
  }

  // ---------- Carregadores ----------
  // Demandas: canteiros, entradas das casas, estradas (1 pedra cada) e soldados com fome.
  KM.logistics = function (S, owner) {
    const serfs = idleUnits(S, owner, 'serf');
    if (!serfs.length) return;
    const comp = KM.rt.comp, m = S.map, W = m.W;
    const offers = {}, demands = [], stores = [], prodOffers = [];
    for (const id in S.houses) {
      const h = S.houses[id];
      if (h.owner !== owner) continue;
      const ec = comp[h.ey * W + h.ex];
      if (ec < 0) continue;
      if (h.state === 'site') {
        if (h.noDeliv) continue;
        for (const r in h.mat) {
          const mt = h.mat[r], q = mt.need - mt.got - mt.inc;
          if (q > 0) demands.push({ k: 'h', h, r, q, p: 0, ec, x: h.ex, y: h.ey });
        }
      } else if (h.state === 'built') {
        const d = KM.def(h);
        if (d.accepts === 'all') {
          stores.push({ h, ec });
          for (const r in h.inv) { const a = h.inv[r] - (h.rsv[r] || 0); if (a > 0) (offers[r] = offers[r] || []).push({ h, r, a, store: true, ec }); }
        } else {
          if (!h.noDeliv) for (const r of KM.houseAccepts(h)) {
            const q = KM.houseCap(S, h, r) - (h.inv[r] || 0) - (h.inc[r] || 0);
            if (q > 0) demands.push({ k: 'h', h, r, q, p: h.type === 'barracks' ? 2 : h.type === 'inn' || h.type === 'school' ? 0.8 : 1, ec, x: h.ex, y: h.ey });
          }
          for (const r in h.out) {
            const a = h.out[r] - (h.rsv[r] || 0);
            if (a > 0) { const o = { h, r, a, store: false, ec }; (offers[r] = offers[r] || []).push(o); prodOffers.push(o); }
          }
        }
      }
    }
    // estradas planejadas precisam de 1 pedra
    for (let i = 0; i < m.road.length; i++) {
      if (m.road[i] === 1 && m.rown[i] === owner && m.rmat[i] === 0 && KM.walkable(S, i % W, (i / W) | 0))
        demands.push({ k: 't', i, r: 'stone', q: 1, p: 0.5, ec: -1, x: i % W, y: (i / W) | 0 });
    }
    // soldiers famintos recebem comida levada até eles
    for (const id in S.units) {
      const u = S.units[id];
      if (u.owner === owner && u.wantFood && !u.fedInc && KM.isSoldier(u.type)) demands.push({ k: 'u', u, r: 'food', q: 1, p: 0.3, ec: -1, x: u.tx, y: u.ty });
    }
    demands.sort((a, b) => a.p - b.p || a.x - b.x);
    for (const d of demands) {
      const keys = d.r === 'food' ? Object.keys(KM.FOOD) : [d.r];
      while (d.q > 0 && serfs.length) {
        let best = null, bd = 1e9;
        for (const r of keys) for (const o of offers[r] || []) {
          if (o.a <= 0 || o.h === d.h) continue;
          if (d.ec >= 0 ? o.ec !== d.ec : !o.store) continue;
          const dist = man(o.h.ex, o.h.ey, d.x, d.y) + (o.store ? 4 : 0);
          if (dist < bd) { bd = dist; best = o; }
        }
        if (!best) break;
        const si = nearestIdx(serfs, best.h.ex, best.h.ey);
        assign(S, serfs[si], best, d, best.r);
        serfs.splice(si, 1); best.a--; d.q--;
      }
      if (!serfs.length) return;
    }
    // produção sem destino direto vai para o armazém mais próximo que aceite
    for (const o of prodOffers) {
      while (o.a > 0 && serfs.length) {
        let best = null, bd = 1e9;
        for (const s of stores) {
          if (s.ec !== o.ec || (s.h.block && s.h.block[o.r])) continue;
          const dd = man(s.h.ex, s.h.ey, o.h.ex, o.h.ey);
          if (dd < bd) { bd = dd; best = s.h; }
        }
        if (!best) break;
        const si = nearestIdx(serfs, o.h.ex, o.h.ey);
        assign(S, serfs[si], o, { k: 'h', h: best }, o.r);
        serfs.splice(si, 1); o.a--;
      }
    }
  };

  function assign(S, u, offer, d, r) {
    KM.add(offer.h.rsv, r, 1);
    const t = { type: 'carry', from: offer.h.id, r, st: 0, ic: true };
    if (d.k === 't') { S.map.rmat[d.i] = 1; t.toT = d.i; }
    else if (d.k === 'u') { d.u.fedInc = u.id; t.toU = d.u.id; }
    else {
      const to = d.h;
      t.to = to.id;
      if (to.state === 'site') to.mat[r].inc++;
      else if (KM.def(to).accepts !== 'all') KM.add(to.inc, r, 1);
      else t.ic = false;
    }
    u.task = t;
  }

  KM.nearestStore = function (S, owner, x, y, exclude) {
    let best = null, bd = 1e9;
    for (const id in S.houses) {
      const h = S.houses[id];
      if (h.owner !== owner || h.type !== 'storehouse' || h.state !== 'built' || h.id === exclude) continue;
      const d = man(h.ex, h.ey, x, y);
      if (d < bd) { bd = d; best = h; }
    }
    return best;
  };

  KM.deliver = function (S, h, r) {
    if (h.state === 'site' && h.mat[r]) { h.mat[r].got++; h.mat[r].have++; return; }
    KM.add(h.inv, r, 1);
  };

  function enemyNear(S, owner, x, y, R) {
    for (const id in S.units) {
      const u = S.units[id];
      if (KM.hostile(S, u.owner, owner) && KM.isSoldier(u.type) && Math.abs(u.x - x) < R && Math.abs(u.y - y) < R) return true;
    }
    return false;
  }
  KM.enemyNear = enemyNear;

  // ---------- Construtores ----------
  KM.assignLaborers = function (S, owner) {
    const labs = idleUnits(S, owner, 'laborer');
    if (!labs.length) return;
    const m = S.map, W = m.W, jobs = [];
    const entr = new Set();
    for (const id in S.houses) {
      const h = S.houses[id];
      if (h.owner !== owner) continue;
      if (h.state !== 'built') entr.add(h.ey * W + h.ex);
      if (h.state === 'plan' && !h.leveler) jobs.push({ k: 'level', h, x: h.ex, y: h.ey, b: -4 });
      else if (h.state === 'site' && !h.builder) {
        let have = 0;
        for (const r in h.mat) have += h.mat[r].have;
        if (have > 0) jobs.push({ k: 'build', h, x: h.ex, y: h.ey, b: -6 });
      } else if (h.state === 'built' && h.repair && !h.repairer && h.hp < h.maxHp * 0.95 && !enemyNear(S, owner, h.ex, h.ey, 9)) {
        jobs.push({ k: 'repair', h, x: h.ex, y: h.ey, b: -2 });
      }
    }
    for (let i = 0; i < m.road.length; i++) {
      if (S.resv[i]) continue;
      if (m.road[i] === 1 && m.rown[i] === owner && m.rmat[i] === 2) jobs.push({ k: 'road', i, x: i % W, y: (i / W) | 0, b: entr.has(i) ? -8 : 0 });
      else if ((m.field[i] === 1 || m.field[i] === 3) && m.fown[i] === owner) jobs.push({ k: 'field', i, x: i % W, y: (i / W) | 0, b: 2 });
    }
    if (!jobs.length) return;
    for (const u of labs) {
      let bj = -1, bd = 1e9;
      for (let k = 0; k < jobs.length; k++) {
        const j = jobs[k];
        if (!j) continue;
        const d = man(u.tx, u.ty, j.x, j.y) + j.b;
        if (d < bd) { bd = d; bj = k; }
      }
      if (bj < 0) break;
      const j = jobs[bj]; jobs[bj] = null;
      if (j.k === 'level') { j.h.leveler = u.id; u.task = { type: 'level', h: j.h.id, st: 0 }; }
      else if (j.k === 'build') { j.h.builder = u.id; u.task = { type: 'build', h: j.h.id, st: 0 }; }
      else if (j.k === 'repair') { j.h.repairer = u.id; u.task = { type: 'repair', h: j.h.id, st: 0 }; }
      else { S.resv[j.i] = u.id; u.task = { type: j.k, tile: j.i, x: j.x, y: j.y, st: 0 }; }
    }
  };

  // ---------- Trabalhadores nas casas ----------
  KM.assignWorkers = function (S, owner) {
    for (const id in S.houses) {
      const h = S.houses[id];
      if (h.owner !== owner || h.state !== 'built') continue;
      const d = KM.def(h);
      if (!d.worker) continue;
      if (h.worker && !S.units[h.worker]) h.worker = 0;
      if (h.worker) continue;
      let best = null, bd = 1e9;
      for (const uid in S.units) {
        const u = S.units[uid];
        if (u.owner !== owner || u.type !== d.worker || u.home) continue;
        const dd = man(u.tx, u.ty, h.ex, h.ey);
        if (dd < bd) { bd = dd; best = u; }
      }
      if (best) { KM.releaseTask(S, best); best.home = h.id; h.worker = best.id; best.inside = 0; }
    }
  };

  KM.autoTrain = function (S, owner) {
    if (!S.players[owner].autoTrain) return;
    let school = null;
    for (const id in S.houses) { const h = S.houses[id]; if (h.owner === owner && h.type === 'school' && h.state === 'built') { school = h; break; } }
    if (!school || school.queue.length >= 5) return;
    const need = {}, have = {}, queued = {};
    let nHouses = 0, serfs = 0, labs = 0;
    for (const id in S.houses) {
      const h = S.houses[id];
      if (h.owner !== owner) continue;
      nHouses++;
      const d = KM.def(h);
      if (d.worker && !(h.worker && S.units[h.worker])) KM.add(need, d.worker, 1);
    }
    for (const id in S.units) { const u = S.units[id]; if (u.owner !== owner) continue; if (u.type === 'serf') serfs++; if (u.type === 'laborer') labs++; if (!u.home) KM.add(have, u.type, 1); }
    for (const id in S.houses) { const h = S.houses[id]; if (h.type === 'school' && h.owner === owner) for (const q of h.queue) KM.add(queued, q, 1); }
    for (const p in need) {
      if (need[p] - (have[p] || 0) - (queued[p] || 0) > 0) { school.queue.push(p); return; }
    }
    if (serfs + (queued.serf || 0) < 4 + Math.ceil(nHouses * 0.75)) { school.queue.push('serf'); return; }
    if (!KM.human(S, owner) && labs + (queued.laborer || 0) < 4 + Math.floor(nHouses / 6)) school.queue.push('laborer');
  };

  // ---------- Atualização de casas ----------
  KM.updateHouse = function (S, h, dt) {
    if (h.state !== 'built') return;
    const d = KM.def(h);
    if (h.type === 'school') return updateSchool(S, h, dt);
    if (h.type === 'tower') return updateTower(S, h, dt);
    if (!d.recipes || !KM.eco(S, h.owner) || h.paused) return;
    const w = h.worker && S.units[h.worker];
    if (!w || w.inside !== h.id) return;
    if (h.work) {
      h.work.t -= dt * (w.hunger <= 0 ? 0.5 : 1);
      if (h.work.t <= 0) {
        const rc = d.recipes[h.work.r];
        for (const k in rc.out) KM.add(h.out, k, rc.out[k]);
        h.work = null;
      }
      return;
    }
    const n = d.recipes.length;
    let best = -1;
    for (let k = 0; k < n; k++) {
      const i = (h.rr + k) % n;
      if (h.orders && h.orders[i] <= 0) continue;
      const rc = d.recipes[i];
      let ok = true;
      for (const x in rc.in) if ((h.inv[x] || 0) < rc.in[x]) { ok = false; break; }
      for (const x in rc.out) if ((h.out[x] || 0) + rc.out[x] > KM.OUT_CAP + 1) { ok = false; break; }
      if (ok) { best = i; break; }
    }
    if (best < 0) return;
    if (d.mine) {
      if (!KM.findOre(S, KM.hcx(h), KM.hcy(h), d.mine, true)) {
        if (!h.depleted) { h.depleted = true; if (h.owner === KM.me) KM.notify(S, `⛏️ ${d.n}: o minério acabou.`, 'warn', { x: h.ex, y: h.ey }); }
        return;
      }
    }
    const rc = d.recipes[best];
    for (const k in rc.in) h.inv[k] -= rc.in[k];
    h.cnt[best] = (h.cnt[best] || 0) + 1;
    if (h.orders && h.orders[best] < KM.INF) h.orders[best]--;
    h.rr = (best + 1) % n;
    h.work = { r: best, t: rc.t, T: rc.t };
  };

  function updateSchool(S, h, dt) {
    if (!KM.eco(S, h.owner) || !h.queue.length) return;
    if (!h.trainT) {
      if ((h.inv.gold || 0) < 1) return;
      h.inv.gold--;
      h.trainT = h.trainMax = KM.PROF[h.queue[0]].t;
    }
    h.trainT -= dt;
    if (h.trainT <= 0) {
      h.trainT = 0;
      const p = h.queue.shift();
      KM.addUnit(S, p, h.owner, h.ex, h.ey);
      S.stats[h.owner].trained++;
    }
  }

  function updateTower(S, h, dt) {
    h.cd -= dt;
    if (h.cd > 0) return;
    const eco = KM.eco(S, h.owner);
    if (eco) { const w = h.worker && S.units[h.worker]; if (!w || w.inside !== h.id) { h.cd = 1; return; } }
    const cx = KM.hcx(h), cy = KM.hcy(h);
    let best = null, bd = 7.5;
    for (const id in S.units) {
      const u = S.units[id];
      if (!KM.hostile(S, u.owner, h.owner) || u.inside) continue;
      const d = KM.dist(u.x, u.y, cx, cy);
      if (d < bd) { bd = d; best = u; }
    }
    if (!best) { h.cd = 0.5; return; }
    if (eco) {
      if (h.shots <= 0) { if ((h.inv.stone || 0) > 0) { h.inv.stone--; h.shots = 3; } else { h.cd = 1; return; } }
      h.shots--;
    }
    KM.shoot(S, cx, cy - 1, { k: 'u', id: best.id }, best.x, best.y, 22, h.owner, 'stone');
    h.cd = 2.4;
  }

  // ---------- Crescimento do mapa ----------
  KM.growMap = function (S, dt) {
    const m = S.map;
    for (let i = 0; i < m.tree.length; i++) {
      const t = m.tree[i];
      if (t > 0 && t < 4) { m.treeT[i] += dt; if (m.treeT[i] >= 45) { m.tree[i]++; m.treeT[i] = 0; } }
      const f = m.field[i];
      if ((f === 2 || f === 4) && m.fstage[i] > 0 && m.fstage[i] < 4) {
        m.ftimer[i] += dt;
        if (m.ftimer[i] >= 30) { m.fstage[i]++; m.ftimer[i] = 0; }
      }
      if (m.terrain[i] === KM.T.WATER && m.fish[i] < 4 && KM.rand() < 0.004 * dt) m.fish[i]++;
    }
  };
})(window.KM);
