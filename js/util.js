'use strict';
(function (KM) {
  KM.rng = function (seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  // RNG determinístico da simulação (estado guardado no próprio jogo => multiplayer e saves consistentes)
  KM.simS = null;
  KM.rand = function () {
    const S = KM.simS;
    if (!S) return Math.random();
    let a = (S.rs = (S.rs + 0x6D2B79F5) | 0);
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  KM.hash = function (x, y, s) {
    let h = (x * 374761393 + y * 668265263 + (s || 0) * 982451653) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };

  KM.makeNoise = function (seed) {
    const r = KM.rng(seed), N = 64, g = new Float32Array(N * N);
    for (let i = 0; i < g.length; i++) g[i] = r();
    const v = (x, y) => g[(((y % N) + N) % N) * N + (((x % N) + N) % N)];
    const n = (x, y) => {
      const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
      const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
      const a = v(x0, y0), b = v(x0 + 1, y0), c = v(x0, y0 + 1), d = v(x0 + 1, y0 + 1);
      return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
    };
    return function (x, y, oct) {
      let s = 0, amp = 1, f = 1, tot = 0;
      for (let o = 0; o < (oct || 4); o++) { s += n(x * f + o * 17.3, y * f + o * 9.1) * amp; tot += amp; amp *= 0.5; f *= 2; }
      return s / tot;
    };
  };

  KM.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  KM.dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
  KM.fmtTime = function (s) {
    s = Math.max(0, Math.floor(s));
    const m = Math.floor(s / 60), ss = s % 60;
    return (m < 10 ? '0' : '') + m + ':' + (ss < 10 ? '0' : '') + ss;
  };
  KM.add = function (o, k, n) { o[k] = (o[k] || 0) + n; };

  // Heap binária mínima (chaves numéricas, valores inteiros)
  KM.Heap = class {
    constructor() { this.k = []; this.v = []; }
    get size() { return this.k.length; }
    push(key, val) {
      const k = this.k, v = this.v;
      let i = k.length; k.push(key); v.push(val);
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (k[p] <= key) break;
        k[i] = k[p]; v[i] = v[p]; i = p;
      }
      k[i] = key; v[i] = val;
    }
    pop() {
      const k = this.k, v = this.v, top = v[0];
      const lk = k.pop(), lv = v.pop();
      const n = k.length;
      if (n > 0) {
        let i = 0;
        for (;;) {
          let c = 2 * i + 1;
          if (c >= n) break;
          if (c + 1 < n && k[c + 1] < k[c]) c++;
          if (k[c] >= lk) break;
          k[i] = k[c]; v[i] = v[c]; i = c;
        }
        k[i] = lk; v[i] = lv;
      }
      return top;
    }
  };
})(window.KM);
