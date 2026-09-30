'use strict';
/* Entrada: mouse, teclado, câmera, ferramentas e ordens (todas viram comandos) */
(function (KM) {
  const TS = KM.TILE;
  const ui = () => KM.ui;
  const keys = {};
  const mouse = { x: -1, y: -1, down: false, btn: -1, sx: 0, sy: 0, moved: false, inside: false };
  KM.mouse = mouse;

  const tileAt = (sx, sy) => KM.R.pickTile(sx, sy);

  function lineTiles(a, b) {
    const sx = Math.sign(b.tx - a.tx), sy = Math.sign(b.ty - a.ty);
    let x = a.tx, y = a.ty;
    const out = [[x, y]];
    while (x !== b.tx && out.length < 120) { x += sx; out.push([x, y]); }
    while (y !== b.ty && out.length < 120) { y += sy; out.push([x, y]); }
    return out;
  }
  function rectTiles(a, b) {
    const out = [];
    for (let y = Math.min(a.ty, b.ty); y <= Math.max(a.ty, b.ty); y++) for (let x = Math.min(a.tx, b.tx); x <= Math.max(a.tx, b.tx); x++) out.push([x, y]);
    return out.slice(0, 64);
  }
  function canRoad(S, x, y) {
    if (!KM.inb(x, y)) return false;
    const m = S.map, i = y * m.W + x;
    return KM.isExp(S, i) && KM.walkable(S, x, y) && !m.road[i] && !m.field[i];
  }
  function canField(S, x, y) {
    if (!KM.inb(x, y)) return false;
    const m = S.map, i = y * m.W + x;
    return KM.isExp(S, i) && m.terrain[i] === KM.T.GRASS && KM.walkable(S, x, y) && !m.road[i] && !m.field[i];
  }
  function updateDragTiles(S) {
    const d = ui().drag;
    if (!d) return;
    const tool = ui().tool;
    const list = tool === 'road' ? lineTiles(d.a, d.b) : rectTiles(d.a, d.b);
    d.tiles = list.map(([x, y]) => [x, y, tool === 'road' ? canRoad(S, x, y) : canField(S, x, y)]);
  }
  function commitDrag(S) {
    const d = ui().drag, tool = ui().tool;
    if (!d || !d.tiles) return;
    const tiles = d.tiles.filter((t) => t[2]).map((t) => [t[0], t[1]]);
    if (tiles.length) {
      KM.issue(tool === 'road' ? { c: 'roads', tiles } : { c: 'fields', kind: tool === 'field' ? 1 : 3, tiles });
      KM.sfx && KM.sfx('place');
    }
    ui().drag = null;
  }

  KM.demolishHouse = function (S, h) { KM.issue({ c: 'demolish', id: h.id }); KM.sfx && KM.sfx('demolish'); };

  function pick(S, sx, sy) {
    let best = null, bd = 22;
    for (const id in S.units) {
      const u = S.units[id];
      if (u.inside) continue;
      if (u.owner !== KM.me && !KM.isExp(S, u.ty * S.map.W + u.tx)) continue;
      const p = KM.R.unitScreen(u);
      if (p.behind) continue;
      const d = Math.hypot(p.x - sx, p.y - sy);
      if (d < bd) { bd = d; best = u; }
    }
    if (best) return { k: 'u', u: best };
    const hid = KM.R.pickHouse(sx, sy);
    if (hid && S.houses[hid]) return { k: 'h', h: S.houses[hid] };
    const t = tileAt(sx, sy);
    if (KM.inb(t.tx, t.ty)) {
      const h2 = S.map.house[t.ty * S.map.W + t.tx];
      if (h2 && S.houses[h2] && KM.isExp(S, t.ty * S.map.W + t.tx)) return { k: 'h', h: S.houses[h2] };
    }
    return null;
  }

  function command(S, sx, sy, forceAM) {
    const gs = ui().myGroups();
    if (!gs.length) return false;
    const g = gs.map((x) => x.id);
    const p = pick(S, sx, sy);
    if (p && p.k === 'u' && KM.hostile(S, KM.me, p.u.owner)) KM.issue({ c: 'attack', g, k: 'u', id: p.u.id });
    else if (p && p.k === 'h' && KM.hostile(S, KM.me, p.h.owner)) KM.issue({ c: 'attack', g, k: 'h', id: p.h.id });
    else {
      const t = tileAt(sx, sy);
      KM.issue({ c: 'move', g, x: KM.clamp(t.tx, 0, KM.MAP_W - 1), y: KM.clamp(t.ty, 0, KM.MAP_H - 1), am: !!forceAM });
      S.fx.push({ k: 'order', x: t.tx, y: t.ty, t: 0, T: 0.6 });
    }
    KM.sfx && KM.sfx('order');
    return true;
  }

  KM.input = {
    init(cv) {
      cv.addEventListener('contextmenu', (e) => e.preventDefault());
      cv.addEventListener('mousedown', (e) => this.down(e));
      window.addEventListener('mousemove', (e) => this.move(e));
      window.addEventListener('mouseup', (e) => this.up(e));
      cv.addEventListener('wheel', (e) => this.wheel(e), { passive: false });
      window.addEventListener('keydown', (e) => this.key(e, true));
      window.addEventListener('keyup', (e) => this.key(e, false));
      window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
      cv.addEventListener('mouseleave', () => { mouse.inside = false; });
      cv.addEventListener('mouseenter', () => { mouse.inside = true; });
      cv.addEventListener('mousemove', () => { mouse.inside = true; });
    },
    down(e) {
      const S = KM.S;
      if (!S) return;
      mouse.down = true; mouse.btn = e.button; mouse.sx = e.clientX; mouse.sy = e.clientY; mouse.moved = false;
      // botão do meio: girar a câmera
      if (e.button === 1) { mouse.rot = { x: e.clientX, y: e.clientY }; e.preventDefault(); return; }
      if (S.editor) {
        if (e.button === 2) { mouse.pan = { x: e.clientX, y: e.clientY }; return; }
        KM.editor.paint(tileAt(e.clientX, e.clientY), true, e); return;
      }
      const t = tileAt(e.clientX, e.clientY);
      if (e.button === 2) {
        if (ui().tool) { ui().setTool(null); return; }
        const am = ui().attackMove; ui().attackMove = false;
        if (!command(S, e.clientX, e.clientY, am)) mouse.pan = { x: e.clientX, y: e.clientY };
        return;
      }
      const tool = ui().tool;
      if (tool && tool.build) {
        const d = KM.HOUSES[tool.build];
        const x = t.tx - (d.w >> 1), y = t.ty - (d.h >> 1);
        const r = KM.canPlace(S, tool.build, x, y, KM.me);
        if (r.ok) { KM.issue({ c: 'build', t: tool.build, x, y }); KM.sfx && KM.sfx('place'); if (!e.shiftKey) ui().setTool(null); }
        else { ui().toast(r.why, 'warn'); KM.sfx && KM.sfx('error'); }
        return;
      }
      if (tool === 'road' || tool === 'field' || tool === 'vine') { ui().drag = { a: t, b: t }; updateDragTiles(S); return; }
      if (tool === 'demolish') { KM.issue({ c: 'demolishAt', x: t.tx, y: t.ty }); KM.sfx && KM.sfx('demolish'); return; }
      ui().box = { x0: e.clientX, y0: e.clientY, x1: e.clientX, y1: e.clientY };
    },
    move(e) {
      mouse.x = e.clientX; mouse.y = e.clientY;
      const S = KM.S;
      if (!S) return;
      if (Math.hypot(e.clientX - mouse.sx, e.clientY - mouse.sy) > 5) mouse.moved = true;
      const t = tileAt(e.clientX, e.clientY);
      ui().hover = t;
      if (mouse.pan && mouse.down) {
        KM.R.panScreen(e.clientX - mouse.pan.x, e.clientY - mouse.pan.y);
        mouse.pan.x = e.clientX; mouse.pan.y = e.clientY;
        return;
      }
      if (mouse.rot && mouse.down) {
        KM.R.rotate((e.clientX - mouse.rot.x) * -0.006);
        KM.R.pitch = KM.clamp(KM.R.pitch + (e.clientY - mouse.rot.y) * 0.004, 0.55, 1.35);
        mouse.rot.x = e.clientX; mouse.rot.y = e.clientY;
        return;
      }
      if (S.editor) { if (mouse.down && mouse.btn === 0) KM.editor.paint(t, false, e); return; }
      if (ui().drag && mouse.down) { ui().drag.b = t; updateDragTiles(S); }
      if (ui().box && mouse.down) { ui().box.x1 = e.clientX; ui().box.y1 = e.clientY; }
    },
    up(e) {
      const S = KM.S;
      mouse.down = false;
      if (mouse.rot) { mouse.rot = null; return; }
      if (mouse.pan) { mouse.pan = null; return; }
      if (!S || S.editor) { if (S && S.editor) KM.editor.release(); return; }
      if (ui().drag) { commitDrag(S); return; }
      const b = ui().box;
      if (!b) return;
      ui().box = null;
      if (Math.abs(b.x1 - b.x0) < 6 && Math.abs(b.y1 - b.y0) < 6) {
        const p = pick(S, e.clientX, e.clientY);
        if (!p) ui().clearSel();
        else if (p.k === 'h') ui().selectHouse(p.h.id);
        else if (p.u.g && S.army[p.u.g]) {
          const now = performance.now();
          if (p.u.owner === KM.me && this.lastClick && now - this.lastClick.t < 350 && this.lastClick.id === p.u.id) {
            ui().selectGroups(Object.values(S.units).filter((u) => u.owner === KM.me && u.g && u.type === p.u.type && onScreen(u)).map((u) => u.g));
          } else if (e.shiftKey && p.u.owner === KM.me) ui().selectGroups([...ui().selGroups, p.u.g]);
          else ui().selectGroups([p.u.g]);
          this.lastClick = { t: now, id: p.u.id };
        } else ui().selectUnits([p.u]);
        return;
      }
      const ax = Math.min(b.x0, b.x1), ay = Math.min(b.y0, b.y1), zx = Math.max(b.x0, b.x1), zy = Math.max(b.y0, b.y1);
      const list = Object.values(S.units).filter((u) => {
        if (u.owner !== KM.me || !u.g || u.inside) return false;
        const p = KM.R.unitScreen(u);
        return !p.behind && p.x >= ax && p.x <= zx && p.y >= ay && p.y <= zy;
      });
      if (list.length) ui().selectGroups((e.shiftKey ? ui().selGroups : []).concat(list.map((u) => u.g))); else ui().clearSel();
    },
    wheel(e) {
      e.preventDefault();
      KM.R.zoom(Math.pow(1.0015, e.deltaY));
    },
    key(e, down) {
      const S = KM.S;
      const k = e.key.toLowerCase();
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA')) return;
      keys[k] = down;
      if (!down || !S) return;
      if (S.editor) { KM.editor.key(k, e); return; }
      if (k === 'enter' && S.mp) { KM.net.chatPrompt(); return; }
      if (k === 'f5') { e.preventDefault(); if (!S.mp) { KM.save(0); ui().toast('💾 Salvamento rápido', 'ok'); } return; }
      if (k === 'f9') { e.preventDefault(); if (!S.mp) KM.load(0); return; }
      if (k === 'f1') { e.preventDefault(); ui().showHelp(true); return; }
      if (k === 'escape') { ui().setTool(null); ui().clearSel(); ui().showHelp(false); ui().attackMove = false; return; }
      if (k === 'p' || k === 'pause') { ui().setSpeed(0); return; }
      if (k === '+' || k === '=') { const sp = [1, 2, 3, 5]; ui().setSpeed(sp[Math.min(3, sp.indexOf(S.speed) + 1)]); return; }
      if (k === '-') { const sp = [1, 2, 3, 5]; ui().setSpeed(sp[Math.max(0, sp.indexOf(S.speed) - 1)]); return; }
      if (k === 'g') { KM.R.showGrid = !KM.R.showGrid; return; }
      if (k === 'm') { ui().toggleMusic(); return; }
      if (k === 'r') { ui().setTab('build'); ui().setTool(ui().tool === 'road' ? null : 'road'); return; }
      if (k === 'f' && !e.ctrlKey) { ui().setTab('build'); ui().setTool(ui().tool === 'field' ? null : 'field'); return; }
      if (k === 'v') { ui().setTab('build'); ui().setTool(ui().tool === 'vine' ? null : 'vine'); return; }
      if (k === 'x' || k === 'delete') {
        if (k === 'delete' && ui().selHouse && S.houses[ui().selHouse] && S.houses[ui().selHouse].owner === KM.me) { KM.demolishHouse(S, S.houses[ui().selHouse]); ui().clearSel(); return; }
        ui().setTab('build'); ui().setTool(ui().tool === 'demolish' ? null : 'demolish'); return;
      }
      if (k === ' ') {
        e.preventDefault();
        const st = Object.values(S.houses).find((h) => h.owner === KM.me && h.type === 'storehouse');
        if (st) KM.R.centerOn(st.ex, st.ey);
        return;
      }
      const sel = ui().myGroups(), g = sel.map((x) => x.id);
      if (sel.length) {
        if (k === 's') { KM.issue({ c: 'stop', g }); return; }
        if (k === 'a') { ui().attackMove = true; ui().toast('Ataque-mover: clique com o botão direito no destino.', 'info'); return; }
        if (k === 'q' || k === 'e') { KM.issue({ c: 'turn', g, d: k === 'q' ? -1 : 1 }); return; }
        if (k === '[' || k === ']') { KM.issue({ c: 'cols', g, d: k === '[' ? -1 : 1 }); return; }
        if (k === 't') { KM.issue({ c: 'split', g }); return; }
        if (k === 'l') { KM.issue({ c: 'link', g }); return; }
        if (k === 'h') { KM.issue({ c: 'feed', g }); ui().toast('🍖 Carregadores levarão comida às tropas.', 'info'); return; }
      }
      if (/^Digit[1-9]$/.test(e.code)) {
        const n = e.code.slice(5);
        if (e.ctrlKey) { e.preventDefault(); S.hotkeys[n] = g; ui().toast(`Atalho ${n} criado (${g.length} grupo${g.length > 1 ? 's' : ''})`, 'ok'); }
        else {
          const list = (S.hotkeys[n] || []).filter((id) => S.army[id]);
          if (list.length) {
            const now = performance.now();
            if (this.lastGroup && this.lastGroup.n === n && now - this.lastGroup.t < 400) { const c = KM.groupCenter(S, S.army[list[0]]); KM.R.centerOn(c.x, c.y); }
            this.lastGroup = { n, t: now };
            ui().selectGroups(list);
          }
        }
      }
    },
    update(dt) {
      if (!KM.S) return;
      const sp = KM.R.dist * 1.1 * dt;
      if (keys[','] || keys['<']) KM.R.rotate(dt * 1.6);
      if (keys['.'] || keys['>']) KM.R.rotate(-dt * 1.6);
      let dx = 0, dy = 0;
      const sel = ui().selGroups.length && !KM.S.editor;
      if (keys.arrowleft || (keys.a && !sel)) dx -= sp;
      if (keys.arrowright || keys.d) dx += sp;
      if (keys.arrowup || keys.w) dy -= sp;
      if (keys.arrowdown || (keys.s && !sel)) dy += sp;
      if (mouse.inside && document.hasFocus() && !mouse.down) {
        const e = 4;
        if (mouse.x >= innerWidth - e) dx += sp; if (mouse.y <= e) dy -= sp; if (mouse.y >= innerHeight - e) dy += sp;
      }
      if (dx || dy) KM.R.panWorld(dx, dy);
    },
  };

  function onScreen(u) {
    const p = KM.R.unitScreen(u);
    return !p.behind && p.x >= 0 && p.y >= 0 && p.x <= innerWidth && p.y <= innerHeight;
  }
})(window.KM);
