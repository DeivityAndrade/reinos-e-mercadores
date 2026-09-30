'use strict';
/* Geração de mapa (com relevo), caminhabilidade, A*, malha de estradas */
(function (KM) {
  const T = KM.T;
  KM.inb = (x, y) => x >= 0 && y >= 0 && x < KM.MAP_W && y < KM.MAP_H;
  KM.setMapSize = function (W, H) { KM.MAP_W = W; KM.MAP_H = H; KM.pfReset && KM.pfReset(); };

  KM.emptyMap = function (W, H) {
    const N = W * H;
    const arr = (v) => new Array(N).fill(v);
    return {
      W, H,
      terrain: arr(0), shade: arr(0), hv: new Array((W + 1) * (H + 1)).fill(1),
      tree: arr(0), treeT: arr(0), stone: arr(0), ore: arr(0), oreAmt: arr(0), fish: arr(0),
      road: arr(0), rown: arr(-1), rmat: arr(0),
      field: arr(0), fown: arr(-1), fstage: arr(0), ftimer: arr(0),
      house: arr(0), explored: arr(0),
    };
  };

  // posições iniciais: cantos opostos primeiro
  KM.startPositions = function (W, H, n) {
    const all = [{ x: 14, y: H - 15 }, { x: W - 15, y: 14 }, { x: 14, y: 14 }, { x: W - 15, y: H - 15 }];
    return all.slice(0, n);
  };

  KM.genMap = function (seed, opts) {
    opts = opts || {};
    const n = opts.players || 2;
    const W = opts.W || (n > 2 ? 96 : 80), H = opts.H || W;
    KM.setMapSize(W, H);
    const m = KM.emptyMap(W, H), N = W * H;
    const rnd = KM.rng(seed);
    const hN = KM.makeNoise(seed + 1), fN = KM.makeNoise(seed + 2), sN = KM.makeNoise(seed + 3), rN = KM.makeNoise(seed + 4);
    const starts = KM.startPositions(W, H, n);
    const I = (x, y) => y * W + x;
    const th = new Float32Array(N); // altura por ladrilho

    // 1) relevo e terreno
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = I(x, y);
      let h = hN(x / 16, y / 16, 4);
      let d = 1e9;
      for (const s of starts) d = Math.min(d, Math.hypot(x - s.x, y - s.y));
      if (d < 13) h = h + (0.52 - h) * (1 - d / 13);
      let t = T.GRASS;
      if (h < 0.3) t = T.WATER; else if (h < 0.33) t = T.SAND; else if (h > 0.72) t = T.MOUNTAIN;
      m.terrain[i] = t;
      m.shade[i] = Math.floor(sN(x / 5, y / 5, 3) * 255);
      th[i] = t === T.WATER ? 0 : t === T.SAND ? 0.6 : t === T.MOUNTAIN ? 3.5 + (h - 0.72) * 22 + rN(x / 3, y / 3, 2) * 2 : 0.8 + (h - 0.33) * 5 + rN(x / 6, y / 6, 2) * 1.2;
      if (t === T.MOUNTAIN && rnd() < 0.35) { m.ore[i] = 1 + Math.floor(rnd() * 3); m.oreAmt[i] = 5 + Math.floor(rnd() * 8); }
      if (t === T.WATER) m.fish[i] = 4;
    }

    // 2) recursos garantidos, espelhados para cada base (justo para todos)
    const blob = (cx, cy, r, ores) => {
      for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++) for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
        if (!KM.inb(x, y)) continue;
        const d = Math.hypot(x - cx, y - cy) + (KM.hash(x, y, seed) - 0.5) * 1.2;
        if (d > r) continue;
        const i = I(x, y);
        m.terrain[i] = T.MOUNTAIN; m.tree[i] = 0; m.stone[i] = 0; m.fish[i] = 0;
        th[i] = Math.max(th[i], 3 + (r - d) * 1.3);
        const a = (Math.atan2(y - cy, x - cx) + Math.PI) / (2 * Math.PI);
        m.ore[i] = ores[Math.min(ores.length - 1, Math.floor(a * ores.length))];
        m.oreAmt[i] = 8 + Math.floor(rnd() * 8);
      }
    };
    const stones = (cx, cy, r) => {
      for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
        if (!KM.inb(x, y)) continue;
        const i = I(x, y);
        if (m.terrain[i] !== T.GRASS) continue;
        if (Math.hypot(x - cx, y - cy) + KM.hash(x, y, seed + 7) * 1.4 > r + 0.6) continue;
        m.stone[i] = 3 + Math.floor(rnd() * 5); m.tree[i] = 0;
      }
    };
    const forest = (cx, cy, r) => {
      for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
        if (!KM.inb(x, y)) continue;
        const i = I(x, y);
        if (m.terrain[i] !== T.GRASS || m.stone[i]) continue;
        if (Math.hypot(x - cx, y - cy) > r || KM.hash(x, y, seed + 9) < 0.3) continue;
        m.tree[i] = 4;
      }
    };
    const lake = (cx, cy, r) => {
      for (let yy = cy - r - 1; yy <= cy + r + 1; yy++) for (let xx = cx - r - 1; xx <= cx + r + 1; xx++) {
        if (!KM.inb(xx, yy)) continue;
        const d = Math.hypot(xx - cx, yy - cy), i = I(xx, yy);
        if (d <= r) { m.terrain[i] = T.WATER; m.fish[i] = 4; m.tree[i] = 0; m.stone[i] = 0; m.ore[i] = 0; th[i] = 0; }
        else if (d <= r + 1 && m.terrain[i] === T.GRASS) { m.terrain[i] = T.SAND; m.tree[i] = 0; th[i] = 0.6; }
      }
    };
    // coordenadas locais: +x e +y apontam para o centro do mapa
    const TPL = { blobs: [[-10, 10, 4, [1, 2, 1, 2]], [14, -10, 3.6, [3, 1, 3]]], stones: [[8, 8, 2], [-7, -7, 2]], forest: [[10, -3, 4], [-9, 2, 3]], lakes: [[20, 3, 3]] };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = I(x, y);
      if (m.terrain[i] === T.GRASS && fN(x / 9, y / 9, 3) > 0.58) m.tree[i] = 1 + Math.min(3, Math.floor(rnd() * 5));
    }
    for (const s of starts) {
      const fx = s.x < W / 2 ? 1 : -1, fy = s.y < H / 2 ? 1 : -1;
      const w = (lx, ly) => ({ x: Math.round(KM.clamp(s.x + lx * fx, 3, W - 4)), y: Math.round(KM.clamp(s.y + ly * fy, 3, H - 4)) });
      for (const [x, y, r] of TPL.lakes) { const c = w(x, y); lake(c.x, c.y, r); }
      for (const [x, y, r, o] of TPL.blobs) { const c = w(x, y); blob(c.x, c.y, r, o); }
      for (const [x, y, r] of TPL.forest) { const c = w(x, y); forest(c.x, c.y, r); }
      for (const [x, y, r] of TPL.stones) { const c = w(x, y); stones(c.x, c.y, r); }
    }
    for (let k = 0; k < 10 + n * 3; k++) stones(Math.floor(rnd() * W), Math.floor(rnd() * H), 1);

    // 3) corredores entre as bases e o centro
    const carve = (a, b) => {
      const steps = 240;
      for (let k = 0; k <= steps; k++) {
        const t = k / steps;
        const cx = a.x + (b.x - a.x) * t + Math.sin(t * Math.PI * 3) * 5, cy = a.y + (b.y - a.y) * t;
        for (let y = Math.floor(cy - 2); y <= cy + 2; y++) for (let x = Math.floor(cx - 2); x <= cx + 2; x++) {
          if (!KM.inb(x, y) || Math.hypot(x - cx, y - cy) > 1.8) continue;
          const i = I(x, y);
          if (m.terrain[i] === T.WATER || m.terrain[i] === T.MOUNTAIN) { m.terrain[i] = T.GRASS; m.ore[i] = 0; m.fish[i] = 0; th[i] = 1; }
          m.stone[i] = 0; m.tree[i] = 0;
        }
      }
    };
    const center = { x: W / 2, y: H / 2 };
    for (const s of starts) carve(s, center);
    // 4) área inicial plana e limpa
    for (const s of starts) {
      for (let y = s.y - 9; y <= s.y + 9; y++) for (let x = s.x - 9; x <= s.x + 9; x++) {
        if (!KM.inb(x, y)) continue;
        const d = Math.hypot(x - s.x, y - s.y), i = I(x, y);
        if (d > 7.5) { if (d < 9.5 && m.terrain[i] === T.GRASS) th[i] = th[i] + (1 - th[i]) * (9.5 - d) / 2; continue; }
        m.terrain[i] = T.GRASS; m.tree[i] = 0; m.stone[i] = 0; m.ore[i] = 0; m.fish[i] = 0; th[i] = 1;
      }
    }
    // areia ao redor da água
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = I(x, y);
      if (m.terrain[i] !== T.GRASS) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (KM.inb(nx, ny) && m.terrain[I(nx, ny)] === T.WATER && KM.hash(x, y, seed + 3) < 0.55) { m.terrain[i] = T.SAND; m.tree[i] = 0; th[i] = 0.6; break; }
      }
    }
    KM.vertsFromTiles(m, th);
    return { m, starts };
  };

  // alturas dos vértices = média dos ladrilhos vizinhos (suaviza)
  KM.vertsFromTiles = function (m, th) {
    const W = m.W, H = m.H;
    for (let vy = 0; vy <= H; vy++) for (let vx = 0; vx <= W; vx++) {
      let s = 0, c = 0, water = false;
      for (const [dx, dy] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) {
        const x = vx + dx, y = vy + dy;
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const i = y * W + x;
        s += th[i]; c++;
        if (m.terrain[i] === T.WATER) water = true;
      }
      m.hv[vy * (W + 1) + vx] = water ? 0 : KM.clamp(c ? s / c : 1, 0, KM.MAXH);
    }
  };

  KM.vh = (m, vx, vy) => m.hv[KM.clamp(vy, 0, m.H) * (m.W + 1) + KM.clamp(vx, 0, m.W)];
  // altura interpolada num ponto (em unidades de ladrilho; o canto do ladrilho x,y é o vértice x,y)
  KM.hAt = function (m, fx, fy) {
    const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
    const a = KM.vh(m, x0, y0), b = KM.vh(m, x0 + 1, y0), c = KM.vh(m, x0, y0 + 1), d = KM.vh(m, x0 + 1, y0 + 1);
    return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
  };
  KM.tileH = (m, x, y) => KM.hAt(m, x + 0.5, y + 0.5);
  // nivela os vértices de um retângulo (usado pelo construtor)
  KM.flatten = function (S, x0, y0, x1, y1) {
    const m = S.map;
    let s = 0, c = 0;
    for (let vy = y0; vy <= y1 + 1; vy++) for (let vx = x0; vx <= x1 + 1; vx++) { s += KM.vh(m, vx, vy); c++; }
    const avg = s / c;
    for (let vy = y0; vy <= y1 + 1; vy++) for (let vx = x0; vx <= x1 + 1; vx++) {
      if (vx < 0 || vy < 0 || vx > m.W || vy > m.H) continue;
      m.hv[vy * (m.W + 1) + vx] = avg;
    }
    for (let y = y0 - 1; y <= y1 + 1; y++) for (let x = x0 - 1; x <= x1 + 1; x++) if (KM.inb(x, y)) KM.tileChanged(S, x, y);
  };
  KM.roughness = function (m, x0, y0, x1, y1) {
    let lo = 99, hi = -99;
    for (let vy = y0; vy <= y1 + 1; vy++) for (let vx = x0; vx <= x1 + 1; vx++) { const h = KM.vh(m, vx, vy); lo = Math.min(lo, h); hi = Math.max(hi, h); }
    return hi - lo;
  };

  KM.walkable = function (S, x, y) {
    if (x < 0 || y < 0 || x >= KM.MAP_W || y >= KM.MAP_H) return false;
    const m = S.map, i = y * m.W + x, t = m.terrain[i];
    return (t === 0 || t === 3) && m.house[i] === 0 && m.stone[i] === 0;
  };

  // ---------- A* ----------
  const PF = { g: null, from: null, stamp: null, closed: null, gen: 0, N: 0 };
  KM.pfReset = () => { PF.g = null; };
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  KM.findPath = function (S, sx, sy, tx, ty, opt) {
    opt = opt || {};
    const m = S.map, W = m.W, N = W * m.H;
    if (!PF.g || PF.N !== N) { PF.g = new Float32Array(N); PF.from = new Int32Array(N); PF.stamp = new Uint32Array(N); PF.closed = new Uint32Array(N); PF.N = N; PF.gen = 0; }
    const gen = ++PF.gen;
    const tWalk = KM.walkable(S, tx, ty);
    const adj = opt.adj || !tWalk;
    const isGoal = (x, y) => adj ? Math.max(Math.abs(x - tx), Math.abs(y - ty)) <= 1 : (x === tx && y === ty);
    if (isGoal(sx, sy)) return [];
    const off = opt.roadPref || 1.4;
    const hf = (x, y) => { const dx = Math.abs(x - tx), dy = Math.abs(y - ty); return (dx + dy) + (1.414 - 2) * Math.min(dx, dy); };
    const heap = new KM.Heap();
    const s = sy * W + sx;
    PF.g[s] = 0; PF.stamp[s] = gen; PF.from[s] = -1;
    heap.push(hf(sx, sy), s);
    const max = opt.max || 7000;
    let nodes = 0;
    const walk = (x, y) => KM.walkable(S, x, y);
    while (heap.size) {
      const cur = heap.pop();
      if (PF.closed[cur] === gen) continue;
      PF.closed[cur] = gen;
      const cx = cur % W, cy = (cur / W) | 0;
      if (isGoal(cx, cy)) {
        const path = [];
        let c = cur;
        while (c !== s) { path.push([c % W, (c / W) | 0]); c = PF.from[c]; }
        path.reverse();
        return path;
      }
      if (++nodes > max) break;
      for (let d = 0; d < 8; d++) {
        const dx = DIRS[d][0], dy = DIRS[d][1], nx = cx + dx, ny = cy + dy;
        if (!walk(nx, ny)) continue;
        const ni = ny * W + nx;
        if (PF.closed[ni] === gen) continue;
        const diag = d >= 4;
        if (diag && (!walk(cx + dx, cy) || !walk(cx, cy + dy))) continue;
        const c = PF.g[cur] + (m.road[ni] === 2 ? 1 : off) * (diag ? 1.414 : 1);
        if (PF.stamp[ni] !== gen || c < PF.g[ni]) {
          PF.stamp[ni] = gen; PF.g[ni] = c; PF.from[ni] = cur;
          heap.push(c + hf(nx, ny), ni);
        }
      }
    }
    return null;
  };

  KM.computeRoadComps = function (S) {
    const m = S.map, W = m.W, N = W * m.H;
    const comp = new Int32Array(N).fill(-1);
    let c = 0;
    const q = [];
    for (let i = 0; i < N; i++) {
      if (m.road[i] !== 2 || comp[i] >= 0) continue;
      comp[i] = c; q.length = 0; q.push(i);
      while (q.length) {
        const k = q.pop(), x = k % W, y = (k / W) | 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (!KM.inb(nx, ny)) continue;
          const ni = ny * W + nx;
          if (m.road[ni] === 2 && comp[ni] < 0) { comp[ni] = c; q.push(ni); }
        }
      }
      c++;
    }
    KM.rt.comp = comp;
    KM.rt.roadsDirty = false;
  };

  KM.nearestWalkable = function (S, x, y, maxR) {
    for (let r = 0; r <= (maxR || 6); r++) {
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (KM.walkable(S, x + dx, y + dy)) return [x + dx, y + dy];
      }
    }
    return null;
  };
})(window.KM);
