'use strict';
/* Editor de mapas: terreno, relevo, árvores, rochas, minérios, bases iniciais e casas prontas */
(function (KM) {
  const $ = (s) => document.querySelector(s);
  const T = KM.T;
  const TOOLS = [
    ['Terreno', [['grass', '<i class=ui-icon data-icon=leaf aria-hidden=true></i>', 'Grama'], ['sand', '<i class=ui-icon data-icon=terrain aria-hidden=true></i>', 'Areia'], ['water', '<i class=ui-icon data-icon=globe aria-hidden=true></i>', 'Água'], ['mountain', '<i class=ui-icon data-icon=terrain aria-hidden=true></i>', 'Montanha']]],
    ['Relevo', [['raise', '<i class=ui-icon data-icon=up aria-hidden=true></i>', 'Elevar'], ['lower', '<i class=ui-icon data-icon=down aria-hidden=true></i>', 'Rebaixar'], ['flatten', '<i class=ui-icon data-icon=level aria-hidden=true></i>', 'Nivelar'], ['smooth', '<i class=ui-icon data-icon=smooth aria-hidden=true></i>', 'Suavizar']]],
    ['Objetos', [['tree', '<i class=ui-icon data-icon=tree aria-hidden=true></i>', 'Árvores'], ['stone', '<i class=ui-icon data-icon=stone aria-hidden=true></i>', 'Rochas'], ['coal', '<i class=ui-icon data-icon=coal aria-hidden=true></i>', 'Carvão'], ['iron', '<i class=ui-icon data-icon=ironore aria-hidden=true></i>', 'Ferro'], ['gold', '<i class=ui-icon data-icon=goldore aria-hidden=true></i>', 'Ouro'], ['erase', '<i class=ui-icon data-icon=erase aria-hidden=true></i>', 'Apagar']]],
  ];

  const ed = KM.editor = {
    tool: 'grass', brush: 2, owner: 0, house: null, dirty: null, painted: null,

    blankState(W, H, fromGen) {
      KM.setMapSize(W, H);
      let m, starts;
      if (fromGen) ({ m, starts } = KM.genMap(fromGen, { W, H, players: 2 }));
      else {
        m = KM.emptyMap(W, H);
        const sN = KM.makeNoise(7);
        for (let i = 0; i < W * H; i++) m.shade[i] = Math.floor(sN((i % W) / 5, Math.floor(i / W) / 5, 3) * 255);
        starts = KM.startPositions(W, H, 2);
      }
      m.explored.fill(15);
      const S = {
        v: KM.SAVE_V, editor: true, seed: 1, rs: 1, time: 0, tick: 0, speed: 1, paused: true, map: m, houses: {}, units: {}, army: {}, nid: 1, starts,
        proj: [], fx: [], resv: {}, goals: [], cmdq: [], hotkeys: {}, edStarts: starts.map((s) => ({ x: s.x, y: s.y })),
        players: [0, 1, 2, 3].map((i) => ({ name: 'Jogador ' + (i + 1), color: KM.COLORS[i], team: i, human: false, eco: false, dist: KM.defaultDist(), out: false })),
        stats: [0, 1, 2, 3].map(() => ({ built: 0, trained: 0, killed: 0, lost: 0 })),
      };
      return S;
    },

    open(mode) {
      let S;
      const size = +($('#edsize') && $('#edsize').value) || 80;
      if (mode === 'new') S = this.blankState(size, size, 0);
      else if (mode === 'gen') S = this.blankState(size, size, Math.floor(Math.random() * 1e9));
      else if (mode === 'load') {
        const name = $('#edmap').value;
        const d = name && this.loadMapData(name);
        if (!d) { KM.ui.toast('Escolha um mapa salvo.', 'warn'); return; }
        S = this.blankState(d.W, d.H, 0);
        const { m } = KM.mapFromData(d, 7);
        m.explored.fill(15);
        S.map = m;
        S.edStarts = d.starts.map((s) => ({ x: s.x, y: s.y }));
        S.name = name;
        for (const h of d.houses || []) if (KM.canPlace(S, h.type, h.x, h.y, -1).ok) KM.addHouse(S, h.type, h.owner, h.x, h.y, true);
      } else if (mode === 'import') { this.importFile(); return; }
      KM.me = 0;
      KM.afterLoad(S);
      KM.ui.toast('Editor de mapas: pinte com o botão esquerdo, arraste a câmera com o direito.', 'info');
    },

    // ---------- painel ----------
    renderPanel(force) {
      const S = KM.S;
      const key = this.tool + '|' + this.brush + '|' + this.owner + '|' + this.house;
      if (!force && this.lastKey === key) return;
      this.lastKey = key;
      let html = '';
      for (const [grp, list] of TOOLS) {
        html += `<h4>${grp}</h4><div class="tools">${list.map(([k, i, n]) => `<button class="tool ${this.tool === k ? 'active' : ''}" data-ed="tool:${k}"><span>${i}</span><small>${n}</small></button>`).join('')}</div>`;
      }
      html += `<h4>Pincel</h4><div class="ratio"><span>Tamanho <kbd>[</kbd> <kbd>]</kbd></span><button data-ed="brush:-1">−</button><b>${this.brush}</b><button data-ed="brush:1">+</button></div>`;
      html += `<h4>Jogadores</h4><div class="tools">${[0, 1, 2, 3].map((i) => `<button class="tool ${this.tool === 'start' && this.owner === i ? 'active' : ''}" data-ed="start:${i}"><span class="dot big" style="background:${KM.COLORS[i]}"></span><small>Base ${i + 1}</small></button>`).join('')}</div>`;
      html += `<div class="muted">Bases no mapa: ${S.edStarts.length}. Clique numa base existente com a ferramenta dela para removê-la.</div>`;
      html += `<h4>Casas prontas do jogador</h4><div class="ratio"><span>Dono</span>${[0, 1, 2, 3].map((i) => `<button data-ed="owner:${i}" style="background:${this.owner === i ? KM.COLORS[i] : ''}">${i + 1}</button>`).join('')}</div>`;
      html += '<div class="grid">';
      for (const k in KM.HOUSES) { const d = KM.HOUSES[k]; html += `<button class="bbtn ${this.tool === 'house' && this.house === k ? 'active' : ''}" data-ed="house:${k}"><span class="ic">${KM.icon(d.i)}</span><span class="nm">${d.n}</span></button>`; }
      html += '</div>';
      $('#tabcontent').innerHTML = html;
    },
    top() {
      const S = KM.S;
      return `<div class="tb-group"><i class=ui-icon data-icon=map aria-hidden=true></i> Editor · ${S.map.W}×${S.map.H} ${S.name ? '· ' + KM.esc(S.name) : ''}</div>
        <div class="tb-group speed"><button data-edtop="save"><i class=ui-icon data-icon=save aria-hidden=true></i> Salvar</button><button data-edtop="export"><i class=ui-icon data-icon=down aria-hidden=true></i> Exportar</button><button data-edtop="test"><i class=ui-icon data-icon=play aria-hidden=true></i> Testar</button><button data-edtop="exit"><i class=ui-icon data-icon=home aria-hidden=true></i> Sair</button></div>`;
    },
    hint() {
      const names = { grass: 'Grama', sand: 'Areia', water: 'Água', mountain: 'Montanha', raise: 'Elevar', lower: 'Rebaixar', flatten: 'Nivelar', smooth: 'Suavizar', tree: 'Árvores', stone: 'Rochas', coal: 'Carvão', iron: 'Ferro', gold: 'Ouro', erase: 'Apagar', start: 'Base ' + (this.owner + 1), house: this.house ? KM.HOUSES[this.house].n : '' };
      return `<div class="hint"><i class=ui-icon data-icon=brush aria-hidden=true></i> Ferramenta: <b>${names[this.tool] || this.tool}</b> · pincel ${this.brush} · <b>esquerdo</b> pinta · <b>direito</b> move a câmera · roda = zoom</div>`;
    },
    onClick(e) {
      const b = e.target.closest('[data-ed]');
      if (!b) return;
      const [k, v] = b.dataset.ed.split(':');
      if (k === 'tool') this.tool = v;
      if (k === 'brush') this.brush = KM.clamp(this.brush + +v, 1, 6);
      if (k === 'start') { this.tool = 'start'; this.owner = +v; }
      if (k === 'owner') this.owner = +v;
      if (k === 'house') { this.tool = 'house'; this.house = v; }
      this.renderPanel(true);
    },
    key(k, e) {
      if (k === '[') this.brush = Math.max(1, this.brush - 1);
      if (k === ']') this.brush = Math.min(6, this.brush + 1);
      if (k === 'g') KM.R.showGrid = !KM.R.showGrid;
      if (k === 'escape') this.tool = 'grass';
      this.renderPanel(true);
    },

    // ---------- pintura ----------
    paint(t, first, e) {
      const S = KM.S, m = S.map;
      if (!KM.inb(t.tx, t.ty)) return;
      if (first) this.painted = new Set();
      const key = t.tx + ',' + t.ty;
      if (this.tool === 'start' || this.tool === 'house') {
        if (!first) return;
        if (this.tool === 'start') {
          const cur = S.edStarts[this.owner];
          if (cur && Math.abs(cur.x - t.tx) <= 1 && Math.abs(cur.y - t.ty) <= 1) {
            if (this.owner === S.edStarts.length - 1 && S.edStarts.length > 2) { S.edStarts.pop(); KM.ui.toast('Base removida.', 'info'); }
            else KM.ui.toast('Só dá para remover a última base (mínimo de 2).', 'warn');
            return;
          }
          if (this.owner > S.edStarts.length) { KM.ui.toast(`Coloque primeiro a base ${S.edStarts.length + 1}.`, 'warn'); return; }
          S.edStarts[this.owner] = { x: t.tx, y: t.ty };
          // área da base fica plana e livre
          for (let y = t.ty - 4; y <= t.ty + 4; y++) for (let x = t.tx - 4; x <= t.tx + 4; x++) if (KM.inb(x, y)) { const i = y * m.W + x; m.terrain[i] = T.GRASS; m.tree[i] = 0; m.stone[i] = 0; m.ore[i] = 0; }
          KM.flatten(S, t.tx - 4, t.ty - 4, t.tx + 4, t.ty + 3);
          this.redraw(t.tx - 5, t.ty - 5, t.tx + 5, t.ty + 5);
          return;
        }
        const d = KM.HOUSES[this.house];
        const x = t.tx - (d.w >> 1), y = t.ty - (d.h >> 1);
        const hid = m.house[t.ty * m.W + t.tx];
        if (hid) { KM.removeHouse(S, S.houses[hid], false); return; }
        const r = KM.canPlace(S, this.house, x, y, -1);
        if (!r.ok) { KM.ui.toast(r.why, 'warn'); return; }
        KM.addHouse(S, this.house, this.owner, x, y, true);
        this.redraw(x - 1, y - 1, x + d.w + 1, y + d.h + 2);
        return;
      }
      if (!first && this.painted.has(key) && !['raise', 'lower', 'smooth'].includes(this.tool)) return;
      this.painted.add(key);
      const r = this.brush - 1;
      const x0 = t.tx - r, y0 = t.ty - r, x1 = t.tx + r, y1 = t.ty + r;
      const tiles = [];
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (KM.inb(x, y) && Math.hypot(x - t.tx, y - t.ty) <= r + 0.5) tiles.push([x, y]);
      const setV = (vx, vy, fn) => { if (vx < 0 || vy < 0 || vx > m.W || vy > m.H) return; const k = vy * (m.W + 1) + vx; m.hv[k] = KM.clamp(fn(m.hv[k]), 0, KM.MAXH); };
      for (const [x, y] of tiles) {
        const i = y * m.W + x;
        if (m.house[i]) continue;
        switch (this.tool) {
          case 'grass': case 'sand': case 'mountain': case 'water': {
            const nt = { grass: T.GRASS, sand: T.SAND, water: T.WATER, mountain: T.MOUNTAIN }[this.tool];
            m.terrain[i] = nt;
            if (nt !== T.MOUNTAIN) { m.ore[i] = 0; m.oreAmt[i] = 0; }
            if (nt === T.WATER || nt === T.MOUNTAIN) { m.tree[i] = 0; m.stone[i] = 0; }
            if (nt === T.WATER) for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) setV(x + dx, y + dy, () => 0);
            if (nt === T.MOUNTAIN) for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) setV(x + dx, y + dy, (h) => Math.max(h, 3.5 + KM.hash(x + dx, y + dy, 1) * 2));
            if (nt === T.GRASS || nt === T.SAND) for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) setV(x + dx, y + dy, (h) => (h > 3 ? 2 : h < 0.4 ? 0.6 : h));
            break;
          }
          case 'raise': case 'lower': {
            const s = this.tool === 'raise' ? 0.25 : -0.25;
            const f = 1 - Math.hypot(x - t.tx, y - t.ty) / (r + 1);
            for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) setV(x + dx, y + dy, (h) => h + (s * f) / 2);
            break;
          }
          case 'flatten': { const hc = KM.tileH(m, t.tx, t.ty); for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) setV(x + dx, y + dy, () => hc); break; }
          case 'smooth': { const hc = KM.tileH(m, x, y); for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) setV(x + dx, y + dy, (h) => h + (hc - h) * 0.4); break; }
          case 'tree': if (m.terrain[i] === T.GRASS && !m.stone[i] && !m.road[i] && KM.hash(x, y, (this.painted.size * 13) | 0) < 0.7) m.tree[i] = 4; break;
          case 'stone': if ((m.terrain[i] === T.GRASS || m.terrain[i] === T.SAND) && !m.road[i]) { m.stone[i] = 5; m.tree[i] = 0; } break;
          case 'coal': case 'iron': case 'gold':
            if (m.terrain[i] === T.MOUNTAIN) { m.ore[i] = { coal: 1, iron: 2, gold: 3 }[this.tool]; m.oreAmt[i] = 30; }
            break;
          case 'erase': m.tree[i] = 0; m.stone[i] = 0; m.ore[i] = 0; m.oreAmt[i] = 0; break;
        }
      }
      this.redraw(x0 - 1, y0 - 1, x1 + 1, y1 + 1);
    },
    redraw(x0, y0, x1, y1) {
      const S = KM.S, m = S.map;
      x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(m.W - 1, x1); y1 = Math.min(m.H - 1, y1);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) KM.R.drawTileFlat(S, x, y);
      KM.R.reproject(S, x0, y0, x1, y1);
      KM.ui.miniDirty = true;
    },
    release() { this.painted = null; },

    // ---------- salvar / carregar ----------
    mapData(S) {
      const m = S.map;
      return {
        v: 1, W: m.W, H: m.H, biome: m.biome || 'pradaria', terrain: m.terrain.slice(), hv: m.hv.map((h) => Math.round(h * 100) / 100), tree: m.tree.slice(), stone: m.stone.slice(), ore: m.ore.slice(), oreAmt: m.oreAmt.slice(),
        starts: S.edStarts.map((s) => ({ x: s.x, y: s.y })),
        houses: Object.values(S.houses).map((h) => ({ type: h.type, owner: h.owner, x: h.x, y: h.y })),
      };
    },
    mapNames() { try { return JSON.parse(localStorage.getItem('rm_maps') || '[]'); } catch (e) { return []; } },
    loadMapData(name) { try { const d = localStorage.getItem('rm_map_' + name); return d ? JSON.parse(d) : null; } catch (e) { return null; } },
    saveMap() {
      const S = KM.S;
      if (S.edStarts.length < 2) { KM.ui.toast('O mapa precisa de pelo menos 2 bases de jogador.', 'warn'); return false; }
      const name = prompt('Nome do mapa:', S.name || 'Meu mapa');
      if (!name) return false;
      try {
        localStorage.setItem('rm_map_' + name, JSON.stringify(this.mapData(S)));
        const list = this.mapNames(); if (!list.includes(name)) list.push(name);
        localStorage.setItem('rm_maps', JSON.stringify(list));
        S.name = name;
        KM.ui.toast(`Mapa "${name}" salvo. Ele aparece na Escaramuça.`, 'ok');
        return true;
      } catch (e) { KM.ui.toast('Não foi possível salvar: ' + e.message, 'danger'); return false; }
    },
    exportMap() {
      const S = KM.S;
      const blob = new Blob([JSON.stringify(this.mapData(S))], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = (S.name || 'mapa') + '.rmmap.json';
      a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    },
    importFile() {
      const inp = document.createElement('input');
      inp.type = 'file'; inp.accept = '.json';
      inp.onchange = () => {
        const f = inp.files[0];
        if (!f) return;
        f.text().then((txt) => {
          try {
            const d = JSON.parse(txt);
            if (!d.W || !d.terrain || !d.starts) throw new Error('arquivo inválido');
            const name = f.name.replace(/\.rmmap\.json$|\.json$/, '');
            localStorage.setItem('rm_map_' + name, JSON.stringify(d));
            const list = this.mapNames(); if (!list.includes(name)) list.push(name);
            localStorage.setItem('rm_maps', JSON.stringify(list));
            this.fillMapLists();
            KM.ui.toast(`Mapa "${name}" importado.`, 'ok');
          } catch (e) { KM.ui.toast('Não foi possível importar: ' + e.message, 'danger'); }
        });
      };
      inp.click();
    },
    fillMapLists() {
      const names = this.mapNames();
      const opts = names.map((n) => `<option value="${KM.esc(n)}">${KM.esc(n)}</option>`).join('');
      if ($('#smap')) $('#smap').innerHTML = '<option value="">Aleatório (procedural)</option>' + opts;
      if ($('#edmap')) $('#edmap').innerHTML = opts || '<option value="">(nenhum mapa salvo)</option>';
    },
    test() {
      const S = KM.S;
      if (S.edStarts.length < 2) { KM.ui.toast('O mapa precisa de pelo menos 2 bases de jogador.', 'warn'); return; }
      const d = this.mapData(S);
      this.lastTest = d;
      KM.startGame({ map: d, diff: 'normal', aiMode: 'economy', opponents: d.starts.length - 1, seed: 12345 });
    },
  };

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-edtop]');
    if (!b || !KM.S || !KM.S.editor) return;
    const a = b.dataset.edtop;
    if (a === 'save') ed.saveMap();
    if (a === 'export') ed.exportMap();
    if (a === 'test') ed.test();
    if (a === 'exit') { if (confirm('Sair do editor? Alterações não salvas serão perdidas.')) KM.quitToMenu(); }
  });
})(window.KM);
