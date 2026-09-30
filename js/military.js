'use strict';
/* Combate, grupos militares (formações), fome dos soldados, projéteis */
(function (KM) {
  // direções de formação (para onde o grupo "olha"): 0=sul, 2=leste, 4=norte, 6=oeste
  KM.DIRS8 = [[0, 1], [1, 1], [1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [-1, 1]];
  KM.dirFrom = (dx, dy) => { const a = Math.atan2(dx, dy); return ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8; };

  KM.resolveTarget = function (S, t) {
    if (!t) return null;
    if (t.k === 'u') { const u = S.units[t.id]; return u && !u.inside ? u : null; }
    const h = S.houses[t.id];
    return h && h.state !== 'plan' ? h : null;
  };
  KM.distToTarget = function (u, t, k) {
    if (k === 'u') return Math.hypot(u.x - t.x, u.y - t.y);
    const dx = Math.max(t.x - u.x, 0, u.x - (t.x + t.w - 1));
    const dy = Math.max(t.y - u.y, 0, u.y - (t.y + t.h - 1));
    return Math.hypot(dx, dy);
  };

  // ---------- grupos ----------
  KM.newGroup = function (S, owner, type, units) {
    const g = { id: S.nid++, owner, type, m: units.map((u) => u.id), cols: Math.min(6, Math.max(2, Math.ceil(Math.sqrt(units.length * 1.6)))), dir: 0, ax: 0, ay: 0 };
    for (const u of units) u.g = g.id;
    S.army[g.id] = g;
    if (units.length) { g.ax = units[0].tx; g.ay = units[0].ty; }
    return g;
  };
  KM.groupUnits = (S, g) => g.m.map((id) => S.units[id]).filter(Boolean);
  KM.cleanGroups = function (S) {
    for (const id in S.army) {
      const g = S.army[id];
      g.m = g.m.filter((uid) => S.units[uid] && S.units[uid].g === g.id);
      if (!g.m.length) { delete S.army[id]; KM.ui && KM.ui.onRemoved && KM.ui.onRemoved('g', +id); }
    }
  };
  KM.groupCenter = function (S, g) {
    const us = KM.groupUnits(S, g);
    if (!us.length) return { x: g.ax, y: g.ay };
    let x = 0, y = 0;
    for (const u of us) { x += u.x; y += u.y; }
    return { x: x / us.length, y: y / us.length };
  };

  // posiciona os membros em fileiras perpendiculares à direção
  KM.formGroup = function (S, g, x, y, dir, am, instant) {
    const us = KM.groupUnits(S, g);
    if (!us.length) return;
    g.ax = x; g.ay = y; g.dir = dir;
    const f = KM.DIRS8[dir], fl = Math.hypot(f[0], f[1]);
    const fx = f[0] / fl, fy = f[1] / fl, px = -fy, py = fx;
    const cols = Math.min(g.cols, us.length);
    const used = new Set();
    // mantém a ordem: os com mais vida na frente
    us.sort((a, b) => b.hp - a.hp || a.id - b.id);
    us.forEach((u, k) => {
      const c = (k % cols) - (cols - 1) / 2, r = Math.floor(k / cols);
      let sx = Math.round(x + px * c - fx * r), sy = Math.round(y + py * c - fy * r);
      let p = null;
      for (let rr = 0; rr <= 5 && !p; rr++) {
        for (let dy = -rr; dy <= rr && !p; dy++) for (let dx = -rr; dx <= rr; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== rr) continue;
          const tx = sx + dx, ty = sy + dy;
          if (KM.walkable(S, tx, ty) && !used.has(tx + ',' + ty)) { p = [tx, ty]; break; }
        }
      }
      if (!p) p = [x, y];
      used.add(p[0] + ',' + p[1]);
      u.target = null; u.forced = false; u.pk = null;
      if (instant) { u.x = u.tx = p[0]; u.y = u.ty = p[1]; u.guard = { x: p[0], y: p[1] }; u.order = null; u.path = null; }
      else u.order = { type: 'move', x: p[0], y: p[1], am: !!am };
      u.face = fx > 0.1 ? 1 : fx < -0.1 ? -1 : u.face;
    });
  };

  KM.orderGroups = function (S, groups, x, y, am) {
    if (!groups.length) return;
    // direção pela posição média até o destino
    let cx = 0, cy = 0;
    const cs = groups.map((g) => KM.groupCenter(S, g));
    for (const c of cs) { cx += c.x; cy += c.y; }
    cx /= cs.length; cy /= cs.length;
    const dir = Math.hypot(x - cx, y - cy) > 1.5 ? KM.dirFrom(x - cx, y - cy) : groups[0].dir;
    const f = KM.DIRS8[dir], fl = Math.hypot(f[0], f[1]), px = -f[1] / fl, py = f[0] / fl;
    const widths = groups.map((g) => Math.min(g.cols, g.m.length) + 1);
    const total = widths.reduce((a, b) => a + b, 0);
    let off = -total / 2;
    groups.forEach((g, k) => {
      const mid = off + widths[k] / 2;
      KM.formGroup(S, g, Math.round(x + px * mid), Math.round(y + py * mid), dir, am);
      off += widths[k];
    });
  };
  KM.orderAttack = function (S, groups, tgt) {
    for (const g of groups) for (const u of KM.groupUnits(S, g)) { u.target = { k: tgt.k, id: tgt.id }; u.forced = true; u.order = null; u.path = null; u.rp = 0; }
  };
  KM.orderStop = function (S, groups) {
    for (const g of groups) {
      for (const u of KM.groupUnits(S, g)) { u.order = null; u.target = null; u.forced = false; u.guard = { x: u.tx, y: u.ty }; }
      const c = KM.groupCenter(S, g); g.ax = Math.round(c.x); g.ay = Math.round(c.y);
    }
  };
  KM.turnGroup = function (S, g, d) { const c = KM.groupCenter(S, g); KM.formGroup(S, g, Math.round(c.x), Math.round(c.y), (g.dir + d + 8) % 8); };
  KM.colsGroup = function (S, g, d) { g.cols = KM.clamp(g.cols + d, 1, 20); const c = KM.groupCenter(S, g); KM.formGroup(S, g, Math.round(c.x), Math.round(c.y), g.dir); };
  KM.splitGroup = function (S, g) {
    const us = KM.groupUnits(S, g);
    if (us.length < 2) return null;
    const half = us.slice(Math.ceil(us.length / 2));
    g.m = us.slice(0, Math.ceil(us.length / 2)).map((u) => u.id);
    const ng = KM.newGroup(S, g.owner, g.type, half);
    ng.cols = g.cols; ng.dir = g.dir;
    const c = KM.groupCenter(S, g), f = KM.DIRS8[g.dir];
    KM.formGroup(S, g, Math.round(c.x), Math.round(c.y), g.dir);
    KM.formGroup(S, ng, Math.round(c.x - f[1] * (g.cols + 1)), Math.round(c.y + f[0] * (g.cols + 1)), g.dir);
    return ng;
  };
  KM.linkGroups = function (S, groups) {
    if (groups.length < 2) return null;
    const base = groups[0];
    for (const g of groups.slice(1)) {
      if (g.type !== base.type || g.owner !== base.owner) continue;
      for (const u of KM.groupUnits(S, g)) { u.g = base.id; base.m.push(u.id); }
      delete S.army[g.id];
    }
    base.cols = Math.min(8, Math.max(base.cols, Math.ceil(Math.sqrt(base.m.length * 1.6))));
    const c = KM.groupCenter(S, base);
    KM.formGroup(S, base, Math.round(c.x), Math.round(c.y), base.dir);
    return base;
  };
  KM.feedGroup = function (S, g) { for (const u of KM.groupUnits(S, g)) if (u.hunger < 90) u.wantFood = true; };

  // ---------- IA de cada soldado ----------
  function findEnemy(S, u, range, houses) {
    let best = null, bd = range;
    for (const id in S.units) {
      const e = S.units[id];
      if (!KM.hostile(S, e.owner, u.owner) || e.inside) continue;
      let d = Math.hypot(e.x - u.x, e.y - u.y);
      if (!KM.isSoldier(e.type)) d += 1.5;
      if (d < bd) { bd = d; best = { k: 'u', id: e.id }; }
    }
    if (best || !houses) return best;
    bd = range + 2;
    for (const id in S.houses) {
      const h = S.houses[id];
      if (!KM.hostile(S, h.owner, u.owner) || h.state === 'plan') continue;
      const d = KM.distToTarget(u, h, 'h');
      if (d < bd) { bd = d; best = { k: 'h', id: h.id }; }
    }
    return best;
  }

  KM.updateSoldier = function (S, u, dt) {
    const sd = KM.SOLDIERS[u.type];
    u.cd -= dt; u.scanT -= dt;
    if (u.atkA > 0) u.atkA -= dt;
    // fome (como no original, soldados precisam ser alimentados)
    if (KM.human(S, u.owner)) {
      u.hunger = Math.max(0, u.hunger - dt * 0.055);
      if (u.hunger < 35 && !u.wantFood) u.wantFood = true;
      if (u.hunger <= 0) {
        u.hp -= dt * 0.35;
        if (u.owner === KM.me && S.time - (S.hungerWarn || -99) > 60) { S.hungerWarn = S.time; KM.notify(S, '🍖 Seus soldados estão morrendo de fome! Tenha comida no Armazém.', 'danger', { x: u.tx, y: u.ty }); }
        if (u.hp <= 0) { KM.killUnit(S, u, false); return; }
      }
    }
    // recuperação: sem lutar há 8 s e bem alimentado, o soldado recupera vida devagar
    if (u.hp < u.maxHp && S.time - (u.hitAt || -99) > 8 && (!KM.human(S, u.owner) || u.hunger > 40)) u.hp = Math.min(u.maxHp, u.hp + dt * 0.5);
    let tg = KM.resolveTarget(S, u.target);
    if (!tg && u.target) {
      u.target = null;
      if (u.forced) { u.forced = false; u.guard = { x: u.tx, y: u.ty }; }
    }
    if (!u.target && u.scanT <= 0) {
      u.scanT = 0.4 + KM.rand() * 0.3;
      if (!u.order || u.order.am) {
        const e = findEnemy(S, u, sd.range ? sd.range + 1.5 : u.order ? 7 : 9,u.ai === 'atk' || !!(u.order && u.order.am));
        if (e) u.target = e;
      }
    }
    tg = KM.resolveTarget(S, u.target);
    if (tg) {
      const k = u.target.k;
      const d = KM.distToTarget(u, tg, k);
      const range = sd.range || 1.5;
      if (d <= range) {
        if (u.path) {
          if (u.x === u.tx && u.y === u.ty) u.path = null;
          else { KM.updateMove(S, u, dt); return; }
        }
        const tx = k === 'u' ? tg.x : KM.hcx(tg);
        if (Math.abs(tx - u.x) > 0.1) u.face = tx > u.x ? 1 : -1;
        if (u.cd <= 0) attack(S, u, tg, k, sd);
        return;
      }
      if (!u.forced && !u.order && u.ai !== 'atk' && Math.hypot(u.x - u.guard.x, u.y - u.guard.y) > 12) { u.target = null; return; }
      u.rp -= dt;
      if (!u.path || u.rp <= 0) {
        u.rp = 0.7 + KM.rand() * 0.3;
        let gx, gy;
        if (k === 'u') { gx = tg.tx; gy = tg.ty; }
        else { gx = KM.clamp(u.tx, tg.x, tg.x + tg.w - 1); gy = KM.clamp(u.ty, tg.y, tg.y + tg.h - 1); }
        const p = KM.findPath(S, u.tx, u.ty, gx, gy, { adj: true, max: 2500 });
        if (p && p.length) { u.path = p; u.pi = 0; u.pk = null; }
        else if (!p) { u.target = null; u.rp = 1.5; return; }
      }
      if (u.path && KM.updateMove(S, u, dt) === 'blocked') u.path = null;
      return;
    }
    if (u.order) {
      const g = KM.goTo(S, u, dt, u.order.x, u.order.y);
      if (g !== 0) { u.guard = { x: u.tx, y: u.ty }; u.order = null; }
      return;
    }
    if (u.tx !== u.guard.x || u.ty !== u.guard.y) {
      const g = KM.goTo(S, u, dt, u.guard.x, u.guard.y);
      if (g < 0) u.guard = { x: u.tx, y: u.ty };
    } else if (u.path) KM.updateMove(S, u, dt);
  };

  function damageFor(u, tg, k, sd) {
    if (k === 'h') return sd.atk * (sd.range ? 0.35 : 0.8);
    const td = KM.SOLDIERS[tg.type];
    const mult = sd.antiCav && td && td.cav ? sd.antiCav : 1;
    const def = td ? td.def : 0;
    // atacar pelas costas/lado causa mais dano (como no original)
    const flank = td && tg.target && tg.target.id !== u.id ? 1.15 : 1;
    return Math.max(3, sd.atk * mult * flank * (0.85 + KM.rand() * 0.3) - def);
  }

  function attack(S, u, tg, k, sd) {
    u.cd = sd.range ? 2.2 : 1.1;
    u.atkA = 0.3;
    const dmg = damageFor(u, tg, k, sd);
    if (sd.range) {
      const tx = k === 'u' ? tg.x : KM.hcx(tg), ty = k === 'u' ? tg.y : KM.hcy(tg);
      KM.shoot(S, u.x, u.y - 0.3, { k, id: tg.id }, tx, ty, dmg, u.owner, u.type === 'crossbowman' ? 'bolt' : 'arrow', u.id);
    } else KM.applyDamage(S, { k, id: tg.id }, dmg, u);
    KM.sfx && k === 'u' && !sd.range && KM.rand() < 0.3 && KM.sfxAt && KM.sfxAt('hit', u.x, u.y);
  }

  KM.shoot = function (S, x, y, tgt, tx, ty, dmg, owner, kind, src) {
    const d = Math.hypot(tx - x, ty - y);
    S.proj.push({ x, y, sx: x, sy: y, tx, ty, t: 0, T: Math.max(0.2, d / (kind === 'stone' ? 7 : 11)), tgt, dmg, owner, kind, src: src || 0 });
  };

  KM.updateProjectiles = function (S, dt) {
    for (let i = S.proj.length - 1; i >= 0; i--) {
      const p = S.proj[i];
      p.t += dt;
      const f = Math.min(1, p.t / p.T);
      p.x = p.sx + (p.tx - p.sx) * f; p.y = p.sy + (p.ty - p.sy) * f;
      if (f >= 1) {
        const tg = KM.resolveTarget(S, p.tgt);
        if (tg) {
          const near = p.tgt.k === 'h' || Math.hypot(tg.x - p.tx, tg.y - p.ty) < 1.2;
          if (near) KM.applyDamage(S, p.tgt, p.dmg, p.src ? S.units[p.src] : null, p.owner);
        }
        S.proj.splice(i, 1);
      }
    }
  };

  KM.applyDamage = function (S, t, dmg, src, srcOwner) {
    const owner = src ? src.owner : srcOwner;
    if (t.k === 'u') {
      const v = S.units[t.id];
      if (!v) return;
      v.hp -= dmg; v.hitT = 0.25; v.hitAt = S.time;
      if (src && KM.isSoldier(v.type) && !v.target) v.target = { k: 'u', id: src.id };
      if (v.owner === KM.me) warnAttack(S, v.tx, v.ty);
      if (v.hp <= 0) KM.killUnit(S, v, true, owner);
    } else {
      const h = S.houses[t.id];
      if (!h) return;
      h.hp -= dmg; h.hitT = 0.25;
      if (h.owner === KM.me) warnAttack(S, h.ex, h.ey);
      if (h.hp <= 0) { KM.removeHouse(S, h, true); if (owner != null && S.stats[owner]) S.stats[owner].razed = (S.stats[owner].razed || 0) + 1; }
    }
  };

  function warnAttack(S, x, y) {
    if (S.time - (S.lastWarn || -99) < 25) return;
    S.lastWarn = S.time;
    KM.notify(S, '⚔️ Você está sob ataque!', 'danger', { x, y });
    KM.sfx && KM.sfx('alarm');
  }

  // novo soldado entra no grupo do mesmo tipo que espera perto do quartel
  KM.joinRally = function (S, u, bar) {
    const f = bar.ex < S.map.W / 2 ? 1 : -1;
    const tIdx = KM.SOLDIER_ORDER.indexOf(u.type);
    const rx = bar.ex + f * (-4 + (tIdx % 3) * 4), ry = bar.ey + 3 + Math.floor(tIdx / 3) * 3;
    let g = null;
    for (const id in S.army) {
      const o = S.army[id];
      if (o.owner === u.owner && o.type === u.type && o.rally === bar.id && o.m.length < 12 && Math.hypot(o.ax - rx, o.ay - ry) < 5) { g = o; break; }
    }
    if (g) { g.m.push(u.id); u.g = g.id; g.cols = Math.min(6, Math.max(g.cols, Math.ceil(Math.sqrt(g.m.length * 1.6)))); }
    else { g = KM.newGroup(S, u.owner, u.type, [u]); g.rally = bar.id; }
    KM.formGroup(S, g, g.m.length > 1 ? g.ax : rx, g.m.length > 1 ? g.ay : ry, bar.ey < S.map.H / 2 ? 0 : 4);
    return g;
  };

  KM.equip = function (S, h, type) {
    const sd = KM.SOLDIERS[type];
    if (h.recruits < 1) return false;
    for (const r in sd.cost) if ((h.inv[r] || 0) < sd.cost[r]) return false;
    for (const r in sd.cost) h.inv[r] -= sd.cost[r];
    h.recruits--;
    const u = KM.addUnit(S, type, h.owner, h.ex, h.ey);
    if (!KM.human(S, h.owner)) u.ai = 'def';
    KM.joinRally(S, u, h);
    return true;
  };
})(window.KM);
