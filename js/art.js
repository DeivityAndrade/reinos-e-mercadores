'use strict';
/* Arte própria do Reinos & Mercadores — tudo gerado por código, sem modelos prontos.
   Direção de arte: "vila medieval ilustrada": enxaimel com reboco caiado, telhados de palha,
   telha e ardósia, pedra de cantaria, madeira escura; sombreamento pintado em faixas (toon)
   e contorno a tinta aplicado no pós-processamento (render3d.js).
   Cada construção tem silhueta própria; a cor do reino aparece em portas, venezianas e estandartes. */
(function (KM) {
  let THREE = null;
  const A = KM.ART = { ready: false };
  const H = (a, b, c) => KM.hash(a, b, c);
  const PI = Math.PI;

  // ================= texturas pintadas =================
  function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function mkTex(c) {
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
    return t;
  }
  const rgb = (r, g, b) => `rgb(${r | 0},${g | 0},${b | 0})`;
  function speckle(g, w, h, n, seed, base, amp, size) {
    for (let k = 0; k < n; k++) {
      const x = H(k, seed, 1) * w, y = H(k, seed, 2) * h, t = (H(k, seed, 3) - 0.5) * amp, s = size * (0.4 + H(k, seed, 4));
      g.fillStyle = rgb(base[0] + t, base[1] + t, base[2] + t * 0.8);
      g.globalAlpha = 0.25 + H(k, seed, 5) * 0.35;
      g.beginPath(); g.ellipse(x, y, s, s * (0.5 + H(k, seed, 6) * 0.6), H(k, seed, 7) * 3, 0, 7); g.fill();
    }
    g.globalAlpha = 1;
  }
  const TEX = {
    plaster() {
      const c = cv(256, 256), g = c.getContext('2d');
      g.fillStyle = '#ebe0c8'; g.fillRect(0, 0, 256, 256);
      speckle(g, 256, 256, 900, 11, [225, 212, 186], 36, 7);
      speckle(g, 256, 256, 300, 12, [245, 238, 220], 20, 3);
      g.strokeStyle = 'rgba(120,100,70,0.12)'; g.lineWidth = 1;
      for (let k = 0; k < 10; k++) { let x = H(k, 13, 1) * 256, y = H(k, 13, 2) * 256; g.beginPath(); g.moveTo(x, y); for (let s = 0; s < 5; s++) { x += (H(k, s, 14) - 0.5) * 18; y += H(k, s, 15) * 14; g.lineTo(x, y); } g.stroke(); }
      return c;
    },
    timber() {
      const c = cv(128, 128), g = c.getContext('2d');
      g.fillStyle = '#5b3a22'; g.fillRect(0, 0, 128, 128);
      for (let k = 0; k < 60; k++) { const y = H(k, 21, 1) * 128, t = (H(k, 21, 2) - 0.5) * 40; g.strokeStyle = rgb(91 + t, 58 + t, 34 + t * 0.6); g.lineWidth = 1 + H(k, 21, 3) * 2; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(40, y + 3, 90, y - 3, 128, y); g.stroke(); }
      return c;
    },
    stone() {
      const c = cv(256, 256), g = c.getContext('2d');
      g.fillStyle = '#7d7466'; g.fillRect(0, 0, 256, 256);
      let row = 0;
      for (let y = 0; y < 256; y += 32) {
        let x = row % 2 ? -22 : 0;
        while (x < 256) {
          const w = 34 + H(x, y, 31) * 30, t = (H(x, y, 32) - 0.5) * 40;
          const base = [168 + t, 160 + t, 146 + t * 0.9];
          g.fillStyle = rgb(...base);
          g.beginPath(); g.roundRect(x + 2, y + 2, w - 4, 28, 7); g.fill();
          g.fillStyle = 'rgba(255,250,235,0.22)'; g.beginPath(); g.roundRect(x + 4, y + 3, w - 8, 7, 4); g.fill();
          g.fillStyle = 'rgba(40,30,20,0.18)'; g.beginPath(); g.roundRect(x + 4, y + 22, w - 8, 6, 4); g.fill();
          x += w;
        }
        row++;
      }
      speckle(g, 256, 256, 400, 33, [150, 142, 128], 50, 3);
      return c;
    },
    thatch() {
      const c = cv(256, 256), g = c.getContext('2d');
      g.fillStyle = '#a57c36'; g.fillRect(0, 0, 256, 256);
      for (let k = 0; k < 2600; k++) {
        const x = H(k, 41, 1) * 256, y = H(k, 41, 2) * 256, l = 10 + H(k, 41, 3) * 16, t = (H(k, 41, 4) - 0.5) * 70;
        g.strokeStyle = rgb(196 + t, 160 + t, 84 + t * 0.6); g.lineWidth = 1.2;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + (H(k, 41, 5) - 0.5) * 4, y + l); g.stroke();
      }
      for (let y = 0; y < 256; y += 32) { g.fillStyle = 'rgba(70,45,15,0.25)'; g.fillRect(0, y + 26, 256, 6); }
      return c;
    },
    tiles() {
      const c = cv(256, 256), g = c.getContext('2d');
      g.fillStyle = '#7e3524'; g.fillRect(0, 0, 256, 256);
      for (let y = 0, r = 0; y < 256; y += 24, r++) for (let x = (r % 2) * 16 - 16; x < 256; x += 32) {
        const t = (H(x, y, 51) - 0.5) * 40;
        const gr = g.createLinearGradient(0, y, 0, y + 24);
        gr.addColorStop(0, rgb(190 + t, 92 + t * 0.6, 60 + t * 0.4)); gr.addColorStop(1, rgb(140 + t, 60 + t * 0.5, 40));
        g.fillStyle = gr;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + 30, y); g.lineTo(x + 30, y + 16); g.quadraticCurveTo(x + 15, y + 30, x, y + 16); g.closePath(); g.fill();
      }
      return c;
    },
    slate() {
      const c = cv(256, 256), g = c.getContext('2d');
      g.fillStyle = '#3c434d'; g.fillRect(0, 0, 256, 256);
      for (let y = 0, r = 0; y < 256; y += 20, r++) for (let x = (r % 2) * 14 - 14; x < 256; x += 28) {
        const t = (H(x, y, 61) - 0.5) * 30;
        g.fillStyle = rgb(92 + t, 100 + t, 112 + t); g.beginPath(); g.roundRect(x + 1, y + 1, 26, 18, [0, 0, 6, 6]); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(x + 2, y + 2, 24, 3);
      }
      return c;
    },
    planks() {
      const c = cv(128, 128), g = c.getContext('2d');
      g.fillStyle = '#4a3020'; g.fillRect(0, 0, 128, 128);
      for (let x = 0; x < 128; x += 16) {
        const t = (H(x, 0, 71) - 0.5) * 36;
        g.fillStyle = rgb(146 + t, 104 + t, 64 + t * 0.7); g.fillRect(x + 1, 0, 14, 128);
        for (let k = 0; k < 6; k++) { g.strokeStyle = 'rgba(70,45,25,0.35)'; g.lineWidth = 1; const xx = x + 3 + H(x, k, 72) * 10; g.beginPath(); g.moveTo(xx, 0); g.lineTo(xx + (H(x, k, 73) - 0.5) * 4, 128); g.stroke(); }
        g.fillStyle = 'rgba(40,25,10,0.6)'; g.beginPath(); g.arc(x + 8, 10 + H(x, 1, 74) * 100, 1.6, 0, 7); g.fill();
      }
      return c;
    },
    logs() {
      const c = cv(128, 128), g = c.getContext('2d');
      g.fillStyle = '#3d2716'; g.fillRect(0, 0, 128, 128);
      for (let y = 0; y < 128; y += 16) {
        const t = (H(0, y, 81) - 0.5) * 30, gr = g.createLinearGradient(0, y, 0, y + 16);
        gr.addColorStop(0, rgb(150 + t, 108 + t, 66 + t)); gr.addColorStop(0.5, rgb(122 + t, 84 + t, 50 + t)); gr.addColorStop(1, rgb(78 + t, 52 + t, 30));
        g.fillStyle = gr; g.beginPath(); g.roundRect(0, y + 1, 128, 14, 7); g.fill();
      }
      return c;
    },
    dirt() {
      const c = cv(128, 128), g = c.getContext('2d');
      g.fillStyle = '#7a5a3a'; g.fillRect(0, 0, 128, 128);
      speckle(g, 128, 128, 500, 91, [110, 82, 54], 40, 3);
      speckle(g, 128, 128, 80, 92, [160, 150, 135], 30, 2);
      return c;
    },
    cloth() {
      const c = cv(64, 64), g = c.getContext('2d');
      g.fillStyle = '#f2f0ea'; g.fillRect(0, 0, 64, 64);
      g.fillStyle = 'rgba(0,0,0,0.06)'; for (let i = 0; i < 64; i += 3) { g.fillRect(i, 0, 1, 64); g.fillRect(0, i, 64, 1); }
      return c;
    },
    hay() {
      const c = cv(128, 128), g = c.getContext('2d');
      g.fillStyle = '#c9a24a'; g.fillRect(0, 0, 128, 128);
      for (let k = 0; k < 900; k++) { const x = H(k, 95, 1) * 128, y = H(k, 95, 2) * 128, t = (H(k, 95, 3) - 0.5) * 60; g.strokeStyle = rgb(220 + t, 186 + t, 96 + t); g.beginPath(); g.moveTo(x, y); g.lineTo(x + 8, y + (H(k, 95, 4) - 0.5) * 6); g.stroke(); }
      return c;
    },
    paper() {
      // grão de papel (usado no pós-processamento)
      const c = cv(256, 256), g = c.getContext('2d'), img = g.createImageData(256, 256), N = KM.makeNoise(777);
      for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
        const f = (xx, yy) => N(xx / 22, yy / 22, 3) * 0.6 + N(xx / 5, yy / 5, 2) * 0.4;
        const v = 200 + f(x, y) * 40 + (H(x, y, 99) - 0.5) * 22;
        const o = (y * 256 + x) * 4; img.data[o] = img.data[o + 1] = img.data[o + 2] = v; img.data[o + 3] = 255;
      }
      g.putImageData(img, 0, 0);
      const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping;
      return t;
    },
  };

  // ================= materiais =================
  const MAT = {};
  A.mat = (k) => MAT[k];
  function toon(o) {
    const m = new THREE.MeshToonMaterial(Object.assign({ gradientMap: A.gradient }, o));
    return m;
  }
  A.toonify = function (src) {
    if (!src || src.isMeshToonMaterial || src.isMeshBasicMaterial || src.isSpriteMaterial || src.isShaderMaterial) return src;
    const m = toon({ map: src.map || null, color: src.color ? src.color.clone() : new THREE.Color('#fff'), vertexColors: !!src.vertexColors, transparent: !!src.transparent, opacity: src.opacity, alphaTest: src.alphaTest || 0, side: src.side });
    if (src.emissive && src.emissive.getHex() && src.emissiveIntensity) { m.emissive = src.emissive.clone(); m.emissiveIntensity = src.emissiveIntensity; }
    m.name = src.name;
    return m;
  };

  A.init = function (three) {
    THREE = three;
    // gradiente do sombreamento pintado: 4 faixas suaves
    const steps = new Uint8Array([118, 160, 205, 238, 255]);
    const gt = new THREE.DataTexture(steps, steps.length, 1, THREE.RedFormat);
    gt.minFilter = gt.magFilter = THREE.NearestFilter; gt.generateMipmaps = false; gt.needsUpdate = true;
    A.gradient = gt;
    A.windU = A.windU || { value: 0 };
    const T = {};
    for (const k of ['plaster', 'timber', 'stone', 'thatch', 'tiles', 'slate', 'planks', 'logs', 'dirt', 'cloth', 'hay']) T[k] = mkTex(TEX[k]());
    A.paperTex = TEX.paper();
    A.tex = T;
    Object.assign(MAT, {
      plaster: toon({ map: T.plaster }), timber: toon({ map: T.timber }), stone: toon({ map: T.stone }),
      thatch: toon({ map: T.thatch }), tiles: toon({ map: T.tiles }), slate: toon({ map: T.slate }),
      planks: toon({ map: T.planks }), logs: toon({ map: T.logs }), dirt: toon({ map: T.dirt }), hay: toon({ map: T.hay }),
      cloth: toon({ map: T.cloth, color: '#e9e2cf' }), sack: toon({ map: T.cloth, color: '#c8ad7f' }),
      dark: toon({ color: '#2a1c12' }), window: toon({ color: '#3b2c20', emissive: new THREE.Color('#5a3a12'), emissiveIntensity: 0.35 }),
      metal: toon({ color: '#7c838c' }), iron: toon({ color: '#44464c' }), gold: toon({ color: '#f0c040', emissive: new THREE.Color('#6a4a00'), emissiveIntensity: 0.6 }),
      glow: new THREE.MeshBasicMaterial({ color: '#ffb040' }), water: toon({ color: '#3f86ad' }), leather: toon({ color: '#8a5a34' }),
      meat: toon({ color: '#a8463c' }), wine: toon({ color: '#5a1f3a' }), coal: toon({ color: '#26242a' }), ore2: toon({ color: '#a2512c' }), ore3: toon({ color: '#e8b830', emissive: new THREE.Color('#5a3c00'), emissiveIntensity: 0.5 }),
      leaf: toon({ vertexColors: true }), rock: toon({ vertexColors: true }),
      green: toon({ color: '#4f8a34' }), mud: toon({ color: '#6e563e' }),
    });
    // ruído detalhado na pedra/reboco à distância não é necessário: texturas repetem por metro
    for (let o = 0; o < 4; o++) {
      const col = new THREE.Color(KM.COLORS[o]);
      MAT['team' + o] = toon({ color: col.clone().multiplyScalar(0.9) });
      MAT['flag' + o] = flagMat(col);
    }
    A.ready = true;
  };
  // estandarte que tremula (onda depende da distância ao mastro)
  function flagMat(col) {
    const m = toon({ map: A.tex ? A.tex.cloth : null, color: col, side: THREE.DoubleSide });
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uWind = A.windU;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uWind;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
  float fx = max(0.0, position.x);
  transformed.z += sin(uWind * 5.0 + fx * 14.0 + position.y * 3.0) * 0.06 * fx * 2.5;
  transformed.y -= fx * fx * 0.25;`);
    };
    m.customProgramCacheKey = () => 'flag';
    return m;
  }

  // ================= geometria com UV proporcional ao tamanho =================
  const TS = 0.9; // metros por repetição de textura
  function scaleUV(g, fn) { const uv = g.attributes.uv; if (!uv) return g; for (let i = 0; i < uv.count; i++) { const [u, v] = fn(i, uv.getX(i), uv.getY(i)); uv.setXY(i, u, v); } return g; }
  function boxG(w, h, d) {
    const g = new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0);
    // faces: +x,-x,+y,-y,+z,-z (4 vértices cada)
    const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    return scaleUV(g, (i, u, v) => { const f = dims[Math.floor(i / 4)]; return [u * f[0] / TS, v * f[1] / TS]; });
  }
  function cylG(rt, rb, h, seg, open) {
    const g = new THREE.CylinderGeometry(rt, rb, h, seg || 10, 1, !!open).translate(0, h / 2, 0);
    const c = 2 * PI * Math.max(rt, rb);
    return scaleUV(g, (i, u, v) => [u * c / TS, v * h / TS]);
  }
  function coneG(r, h, seg) {
    const g = new THREE.ConeGeometry(r, h, seg || 10, 1).translate(0, h / 2, 0);
    const c = 2 * PI * r, sl = Math.hypot(r, h);
    return scaleUV(g, (i, u, v) => [u * c / TS * 0.6, v * sl / TS]);
  }
  // triângulo (empena) com espessura mínima, indexado
  function gableG(w, rise, t) {
    const g = new THREE.BufferGeometry();
    const hw = w / 2, z0 = t / 2, z1 = -t / 2;
    const p = [-hw, 0, z0, hw, 0, z0, 0, rise, z0, -hw, 0, z1, hw, 0, z1, 0, rise, z1];
    const uv = [0, 0, w / TS, 0, w / 2 / TS, rise / TS, 0, 0, w / TS, 0, w / 2 / TS, rise / TS];
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex([0, 1, 2, 4, 3, 5]);
    g.computeVertexNormals();
    return g;
  }

  // ================= "bolsa" de peças: agrupa por material e funde =================
  class Bag {
    constructor() { this.p = {}; this.stack = [new THREE.Matrix4()]; this.anim = []; }
    push(x, y, z, ry) { const m = new THREE.Matrix4().makeRotationY(ry || 0).setPosition(x || 0, y || 0, z || 0); this.stack.push(this.top().clone().multiply(m)); return this; }
    pop() { this.stack.pop(); return this; }
    top() { return this.stack[this.stack.length - 1]; }
    put(mk, g, x, y, z, ry, rx, rz) {
      const m = new THREE.Matrix4().compose(new THREE.Vector3(x || 0, y || 0, z || 0), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0, 'YXZ')), new THREE.Vector3(1, 1, 1));
      g.applyMatrix4(this.top().clone().multiply(m));
      (this.p[mk] = this.p[mk] || []).push(g);
      return g;
    }
    build() {
      const G = new THREE.Group();
      for (const k in this.p) {
        const list = this.p[k].map((g) => (g.index ? g.toNonIndexed() : g));
        const merged = THREE.BufferGeometryUtils.mergeGeometries(list, false);
        if (!merged) continue;
        const mesh = new THREE.Mesh(merged, MAT[k]);
        mesh.castShadow = true; mesh.receiveShadow = true;
        mesh.userData.art = k;
        G.add(mesh);
      }
      for (const a of this.anim) G.add(a);
      return G;
    }
  }
  A.Bag = Bag;

  // ================= kit de peças =================
  const K = {
    box: (b, m, w, h, d, x, y, z, ry, rx, rz) => b.put(m, boxG(w, h, d), x, y, z, ry, rx, rz),
    cyl: (b, m, rt, rb, h, x, y, z, seg, rx, rz, ry) => b.put(m, cylG(rt, rb, h, seg), x, y, z, ry, rx, rz),
    cone: (b, m, r, h, x, y, z, seg, ry) => b.put(m, coneG(r, h, seg), x, y, z, ry),
    // viga entre dois pontos (no plano local)
    beam(b, m, x1, y1, x2, y2, z, t) {
      const L = Math.hypot(x2 - x1, y2 - y1), a = Math.atan2(y2 - y1, x2 - x1);
      const g = new THREE.BoxGeometry(L + (t || 0.045) * 0.6, t || 0.045, 0.03);
      scaleUV(g, (i, u, v) => [u * L / TS, v * 0.1]);
      b.put(m, g, (x1 + x2) / 2, (y1 + y2) / 2, z, 0, 0, a);
    },
    // paredes com base de pedra, reboco/madeira e enxaimel
    walls(b, o) {
      const { w, d, h } = o, base = o.base == null ? 0.1 : o.base, wall = o.wall || 'plaster';
      if (base) K.box(b, 'stone', w + 0.05, base, d + 0.05, o.x || 0, o.y || 0, o.z || 0, o.ry);
      K.box(b, wall, w, h, d, o.x || 0, (o.y || 0) + base, o.z || 0, o.ry);
      if (o.frame !== false && wall === 'plaster') {
        b.push(o.x || 0, (o.y || 0) + base, o.z || 0, o.ry || 0);
        for (const [fx, fz, fr, L] of [[0, d / 2, 0, w], [w / 2, 0, PI / 2, d], [0, -d / 2, PI, w], [-w / 2, 0, -PI / 2, d]]) {
          b.push(fx, 0, fz, fr);
          K.frameFace(b, L, h, o.floors || 1, o.seed || 0);
          b.pop();
        }
        b.pop();
      }
    },
    frameFace(b, L, h, floors, seed) {
      const z = 0.016, t = 0.05;
      K.beam(b, 'timber', -L / 2, 0.02, L / 2, 0.02, z, t);
      K.beam(b, 'timber', -L / 2, h - 0.025, L / 2, h - 0.025, z, t);
      for (let f = 1; f < floors; f++) K.beam(b, 'timber', -L / 2, (h * f) / floors, L / 2, (h * f) / floors, z, t * 1.2);
      const n = Math.max(2, Math.round(L / 0.34));
      for (let i = 0; i <= n; i++) { const x = -L / 2 + (L * i) / n; K.beam(b, 'timber', x, 0, x, h, z, i === 0 || i === n ? t * 1.2 : t * 0.85); }
      const fh = h / floors;
      for (let f = 0; f < floors; f++) {
        const y0 = f * fh, x0 = -L / 2, x1 = -L / 2 + L / n, x2 = L / 2 - L / n;
        K.beam(b, 'timber', x0, y0 + 0.03, x1, y0 + fh - 0.03, z, t * 0.8);
        K.beam(b, 'timber', L / 2, y0 + 0.03, x2, y0 + fh - 0.03, z, t * 0.8);
        if (n >= 5 && (seed + f) % 2 === 0) { const xm = 0, xa = -L / n / 2, xb = L / n / 2; K.beam(b, 'timber', xa, y0 + 0.03, xb, y0 + fh - 0.03, z, t * 0.7); K.beam(b, 'timber', xb, y0 + 0.03, xa, y0 + fh - 0.03, z, t * 0.7); void xm; }
      }
    },
    // telhado de duas águas (cumeeira ao longo de x)
    roof(b, o) {
      const { w, d, rise } = o, over = o.over == null ? 0.1 : o.over, y = o.y, m = o.mat || 'thatch', thick = m === 'thatch' ? 0.09 : 0.05;
      b.push(o.x || 0, y, o.z || 0, o.ry || 0);
      const half = d / 2 + over, ang = Math.atan2(rise, d / 2), sl = half / Math.cos(ang);
      for (const s of [1, -1]) {
        const g = boxG(w + over * 2, thick, sl);
        g.translate(0, 0, -sl / 2);
        b.put(m, g, 0, rise + thick * 0.5, 0, s > 0 ? 0 : PI, -ang);
      }
      const gm = o.gable || 'plaster';
      for (const s of [1, -1]) b.put(gm, gableG(d, rise, 0.04), s * (w / 2 - 0.01), 0, 0, PI / 2);
      if (gm === 'plaster') for (const s of [1, -1]) { b.push(s * (w / 2 + 0.006), 0, 0, s > 0 ? PI / 2 : -PI / 2); K.beam(b, 'timber', -d / 2, 0.02, 0, rise, 0.012, 0.045); K.beam(b, 'timber', d / 2, 0.02, 0, rise, 0.012, 0.045); K.beam(b, 'timber', 0, 0, 0, rise, 0.012, 0.04); b.pop(); }
      K.box(b, m === 'thatch' ? 'thatch' : 'timber', w + over * 2 + 0.04, 0.07, 0.1, 0, rise + thick * 0.6, 0);
      b.pop();
    },
    // telhado de quatro águas (pirâmide) para torres e blocos quadrados
    hip(b, m, w, d, rise, x, y, z) {
      const g = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1).rotateY(PI / 4).translate(0, 0.5, 0);
      g.scale(w + 0.18, rise, d + 0.18);
      scaleUV(g, (i, u, v) => [u * 2.2 * (w + d) / TS, v * rise * 1.5 / TS]);
      b.put(m, g, x || 0, y, z || 0);
    },
    door(b, x, y, z, ry, w, h, team) {
      b.push(x, y, z, ry || 0);
      K.box(b, 'timber', w + 0.08, h + 0.05, 0.03, 0, 0, 0.012);
      K.box(b, team, w, h, 0.035, 0, 0, 0.02);
      K.box(b, 'iron', w * 0.7, 0.025, 0.012, 0, h * 0.3, 0.04); K.box(b, 'iron', w * 0.7, 0.025, 0.012, 0, h * 0.72, 0.04);
      b.pop();
    },
    window(b, x, y, z, ry, w, h, team) {
      b.push(x, y, z, ry || 0);
      K.box(b, 'window', w, h, 0.03, 0, 0, 0.01);
      K.box(b, 'timber', w + 0.06, 0.035, 0.05, 0, -0.03, 0.02);
      K.box(b, 'timber', 0.025, h, 0.035, 0, 0, 0.022);
      if (team) { K.box(b, team, w * 0.5, h, 0.02, -w * 0.78, 0, 0.02, 0.35); K.box(b, team, w * 0.5, h, 0.02, w * 0.78, 0, 0.02, -0.35); }
      b.pop();
    },
    chimney(b, x, y, z, h) { K.box(b, 'stone', 0.16, h, 0.16, x, y, z); K.box(b, 'stone', 0.2, 0.05, 0.2, x, y + h, z); return [x, y + h + 0.05, z]; },
    barrel(b, x, z, s, ry) { s = s || 1; K.cyl(b, 'planks', 0.075 * s, 0.085 * s, 0.2 * s, x, 0, z, 9); K.cyl(b, 'iron', 0.087 * s, 0.087 * s, 0.018 * s, x, 0.04 * s, z, 9); K.cyl(b, 'iron', 0.08 * s, 0.08 * s, 0.018 * s, x, 0.15 * s, z, 9); void ry; },
    crate(b, x, z, s, ry, y) { s = s || 1; y = y || 0; K.box(b, 'planks', 0.17 * s, 0.15 * s, 0.17 * s, x, y, z, ry || 0); K.box(b, 'timber', 0.18 * s, 0.02 * s, 0.18 * s, x, y + 0.14 * s, z, ry || 0); },
    sack(b, x, z, s) { s = s || 1; const g = new THREE.SphereGeometry(0.08 * s, 8, 6).scale(1, 1.15, 0.8).translate(0, 0.08 * s, 0); b.put('sack', g, x, 0, z); },
    logs(b, x, z, n, ry, len) {
      len = len || 0.5;
      let k = 0;
      for (let row = 0; k < n; row++) for (let i = 0; i < 4 - row && k < n; i++, k++) b.put('logs', cylG(0.045, 0.045, len, 7).rotateZ(PI / 2).translate(0, 0.045, 0), x, row * 0.075, z + (i - (3 - row) / 2) * 0.095, ry || 0);
    },
    stones(b, x, z, n, s) { for (let i = 0; i < n; i++) { const g = new THREE.DodecahedronGeometry(0.06 * (s || 1) * (0.8 + H(i, n, 3) * 0.5), 0).translate(0, 0.045, 0); b.put('stone', g, x + (H(i, 1, 4) - 0.5) * 0.25, 0, z + (H(i, 2, 4) - 0.5) * 0.2, H(i, 3, 4) * 3); } },
    blocks(b, x, z, n) { for (let i = 0; i < n; i++) K.box(b, 'stone', 0.14, 0.1, 0.1, x + (i % 3) * 0.15 - 0.15, Math.floor(i / 3) * 0.1, z, (H(i, 7, 7) - 0.5) * 0.3); },
    hay(b, x, z, ry, y) { b.put('hay', cylG(0.11, 0.11, 0.2, 10).rotateZ(PI / 2).translate(0, 0.11, 0), x, y || 0, z, ry || 0); },
    fence(b, x1, z1, x2, z2) {
      const L = Math.hypot(x2 - x1, z2 - z1), a = Math.atan2(-(z2 - z1), x2 - x1), n = Math.max(1, Math.round(L / 0.3));
      b.push(x1, 0, z1, a);
      for (let i = 0; i <= n; i++) K.box(b, 'timber', 0.035, 0.2, 0.035, (L * i) / n, 0, 0);
      K.box(b, 'planks', L, 0.03, 0.02, L / 2, 0.08, 0); K.box(b, 'planks', L, 0.03, 0.02, L / 2, 0.16, 0);
      b.pop();
    },
    cart(b, x, z, ry, load) {
      b.push(x, 0, z, ry || 0);
      K.box(b, 'planks', 0.34, 0.06, 0.2, 0, 0.09, 0);
      for (const s of [1, -1]) b.put('timber', cylG(0.075, 0.075, 0.025, 10).rotateX(PI / 2), 0, 0.075, s * 0.115);
      K.box(b, 'timber', 0.3, 0.02, 0.02, 0.3, 0.1, 0.05, 0, 0, -0.2); K.box(b, 'timber', 0.3, 0.02, 0.02, 0.3, 0.1, -0.05, 0, 0, -0.2);
      if (load === 'sacks') { K.sack(b, -0.07, 0, 0.8); K.sack(b, 0.07, 0.02, 0.8); }
      b.pop();
    },
    anvil(b, x, z) { K.box(b, 'timber', 0.12, 0.1, 0.12, x, 0, z); K.box(b, 'iron', 0.16, 0.06, 0.08, x, 0.1, z); K.cone(b, 'iron', 0.035, 0.08, x + 0.1, 0.13, z, 6); },
    rack(b, x, z, ry, kind) {
      b.push(x, 0, z, ry || 0);
      K.box(b, 'timber', 0.03, 0.34, 0.03, -0.2, 0, 0); K.box(b, 'timber', 0.03, 0.34, 0.03, 0.2, 0, 0); K.box(b, 'timber', 0.44, 0.03, 0.03, 0, 0.3, 0);
      for (let i = 0; i < 5; i++) {
        const xx = -0.16 + i * 0.08;
        if (kind === 'spear') { K.cyl(b, 'timber', 0.01, 0.01, 0.42, xx, 0, 0.03, 5); K.cone(b, 'metal', 0.02, 0.06, xx, 0.42, 0.03, 5); }
        else { K.box(b, 'metal', 0.018, 0.22, 0.008, xx, 0.05, 0.03); K.box(b, 'timber', 0.05, 0.015, 0.02, xx, 0.26, 0.03); }
      }
      b.pop();
    },
    shieldDisc(b, team, x, y, z, ry, r) { b.put(team, cylG(r || 0.08, r || 0.08, 0.02, 12).rotateX(PI / 2), x, y, z, ry || 0); b.put('metal', cylG(0.022, 0.022, 0.03, 8).rotateX(PI / 2), x, y, z, ry || 0); },
    battlements(b, w, d, y, m) {
      const step = 0.16;
      for (const [len, fx, fz, ry] of [[w, 0, d / 2, 0], [w, 0, -d / 2, 0], [d, w / 2, 0, PI / 2], [d, -w / 2, 0, PI / 2]]) {
        const n = Math.floor(len / step);
        for (let i = 0; i < n; i += 2) {
          const t = -len / 2 + (i + 0.5) * step + (len - n * step) / 2;
          const x = ry ? fx : t, z = ry ? t : fz;
          K.box(b, m || 'stone', step, 0.11, 0.08, x, y, z, ry);
        }
      }
    },
    // estandarte num mastro (parte animada separada)
    banner(b, owner, x, y, z, hgt, big) {
      K.cyl(b, 'timber', 0.015, 0.018, hgt, x, y, z, 6);
      K.cyl(b, 'gold', 0.025, 0.025, 0.03, x, y + hgt, z, 6);
      const fw = big ? 0.42 : 0.3, fh = big ? 0.26 : 0.18;
      const g = new THREE.PlaneGeometry(fw, fh, 8, 1).translate(fw / 2, -fh / 2, 0);
      const fl = new THREE.Mesh(g, MAT['flag' + owner]);
      fl.position.set(x + 0.015, y + hgt - 0.02, z);
      fl.applyMatrix4(b.top());
      fl.castShadow = true;
      b.anim.push(fl);
    },
    // placa pendurada com o ícone do ofício
    sign(b, icon, x, y, z, ry) {
      b.push(x, y, z, ry || 0);
      K.box(b, 'timber', 0.025, 0.025, 0.2, 0, 0.18, 0.1);
      K.box(b, 'timber', 0.02, 0.2, 0.02, 0, 0, 0);
      b.pop();
      if (!icon) return;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.17), iconMat(icon));
      m.position.set(x, y + 0.08, z + 0.19);
      m.applyMatrix4(b.top());
      b.anim.push(m);
    },
  };
  A.K = K;
  const iconCache = {};
  function iconMat(ch) {
    if (iconCache[ch]) return iconCache[ch];
    const c = cv(64, 64), g = c.getContext('2d');
    g.fillStyle = '#6b4526'; g.beginPath(); g.roundRect(2, 2, 60, 60, 8); g.fill();
    g.strokeStyle = '#e3b95c'; g.lineWidth = 3; g.stroke();
    g.font = '38px "Segoe UI Emoji","Noto Color Emoji",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ch, 32, 35);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    return (iconCache[ch] = new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide }));
  }

  // ================= construções =================
  // cada projeto recebe a bolsa, o tamanho (W×D ladrilhos), o dono e a posição da porta (dx)
  // e devolve informações extras (chaminé para fumaça, pás do moinho)
  const R = (a, b) => a + (b - a) * 0.5;
  void R;
  const HOUSES = {
    storehouse(b, W, D, o, dx, T) {
      const w = W * 0.9, d = D * 0.78;
      K.walls(b, { w, d, h: 0.72, wall: 'planks', frame: false, base: 0.14 });
      K.box(b, 'timber', w + 0.02, 0.05, d + 0.02, 0, 0.14, 0);
      for (const x of [-w / 2, -w / 6, w / 6, w / 2]) { K.box(b, 'timber', 0.07, 0.72, 0.07, x, 0.14, d / 2 + 0.01); K.box(b, 'timber', 0.07, 0.72, 0.07, x, 0.14, -d / 2 - 0.01); }
      K.roof(b, { w, d, rise: 0.62, y: 0.86, mat: 'tiles', gable: 'planks', over: 0.14 });
      K.box(b, 'dark', 0.5, 0.5, 0.03, dx, 0.14, d / 2 + 0.01);
      b.push(dx, 0.14, d / 2, 0); K.box(b, T, 0.24, 0.5, 0.035, -0.15, 0, 0.03, -0.5); K.box(b, T, 0.24, 0.5, 0.035, 0.15, 0, 0.03, 0.5); b.pop();
      K.window(b, -w / 3, 0.5, d / 2, 0, 0.14, 0.14, T); K.window(b, w / 3, 0.5, d / 2, 0, 0.14, 0.14, T);
      // pátio com mercadorias
      K.barrel(b, -w / 2 + 0.12, d / 2 + 0.18); K.barrel(b, -w / 2 + 0.3, d / 2 + 0.2); K.crate(b, w / 2 - 0.15, d / 2 + 0.17, 1, 0.3); K.crate(b, w / 2 - 0.15, d / 2 + 0.17, 0.8, 0.1, 0.15);
      K.sack(b, w / 2 - 0.36, d / 2 + 0.2); K.sack(b, w / 2 - 0.45, d / 2 + 0.12, 0.9);
      K.banner(b, o, -w / 2 - 0.05, 0, d / 2 + 0.05, 1.35, true);
      return {};
    },
    school(b, W, D, o, dx, T) {
      const w = W * 0.72, d = D * 0.62;
      K.walls(b, { w, d, h: 1.05, floors: 2, seed: 1 });
      K.roof(b, { w, d, rise: 0.7, y: 1.15, mat: 'slate' });
      // torre do sino na frente
      const tx = w / 2 - 0.12;
      K.box(b, 'stone', 0.34, 1.5, 0.34, tx, 0, d / 2 - 0.05);
      K.box(b, 'dark', 0.14, 0.2, 0.03, tx, 1.18, d / 2 + 0.125);
      K.cyl(b, 'gold', 0.035, 0.06, 0.1, tx, 1.2, d / 2 - 0.05, 8);
      K.hip(b, 'slate', 0.34, 0.34, 0.5, tx, 1.5, d / 2 - 0.05);
      K.cone(b, 'gold', 0.02, 0.1, tx, 2.0, d / 2 - 0.05, 5);
      K.door(b, -0.1, 0.1, d / 2, 0, 0.2, 0.34, T);
      K.window(b, -w / 3, 0.72, d / 2, 0, 0.13, 0.17, T); K.window(b, 0.05, 0.72, d / 2, 0, 0.13, 0.17, T);
      K.window(b, -w / 2, 0.72, 0, -PI / 2, 0.13, 0.17, T);
      K.banner(b, o, -w / 2 - 0.08, 0, d / 2 + 0.1, 1.15);
      return {};
    },
    inn(b, W, D, o, dx, T) {
      const w = W * 0.74, d = D * 0.6;
      K.walls(b, { w, d, h: 0.55, seed: 2 });
      // andar de cima avançado (jettied), típico das tavernas
      K.walls(b, { w: w + 0.1, d: d + 0.1, h: 0.5, base: 0, y: 0.65, seed: 3 });
      K.roof(b, { w: w + 0.1, d: d + 0.1, rise: 0.7, y: 1.15, mat: 'thatch' });
      const c = K.chimney(b, w / 3, 1.3, -0.05, 0.55);
      K.door(b, dx, 0.1, d / 2, 0, 0.2, 0.34, T);
      K.window(b, -w / 3, 0.3, d / 2, 0, 0.14, 0.14, T); K.window(b, w / 3, 0.3, d / 2, 0, 0.14, 0.14, T);
      K.window(b, -0.18, 0.85, d / 2 + 0.05, 0, 0.13, 0.14, T); K.window(b, 0.2, 0.85, d / 2 + 0.05, 0, 0.13, 0.14, T);
      K.sign(b, '🍺', w / 2 + 0.02, 0.62, d / 2 - 0.12, PI / 2);
      K.barrel(b, -w / 2 - 0.02, d / 2 + 0.16); K.barrel(b, -w / 2 + 0.16, d / 2 + 0.18, 0.9);
      K.box(b, 'planks', 0.3, 0.02, 0.12, w / 2 - 0.1, 0.13, d / 2 + 0.24); K.box(b, 'timber', 0.03, 0.13, 0.03, w / 2 - 0.22, 0, d / 2 + 0.24); K.box(b, 'timber', 0.03, 0.13, 0.03, w / 2 + 0.02, 0, d / 2 + 0.24);
      return { smoke: c };
    },
    woodcutter(b, W, D, o, dx, T) {
      const w = W * 0.56, d = D * 0.5;
      K.walls(b, { w, d, h: 0.5, wall: 'logs', frame: false, base: 0.06, x: -0.15, z: -0.12 });
      K.roof(b, { w, d, rise: 0.42, y: 0.56, mat: 'thatch', gable: 'planks', x: -0.15, z: -0.12 });
      K.door(b, -0.15, 0.06, d / 2 - 0.12, 0, 0.17, 0.3, T);
      K.logs(b, 0.52, 0.28, 9, 0.2, 0.55);
      K.cyl(b, 'logs', 0.09, 0.1, 0.12, 0.3, 0, 0.62, 9); K.box(b, 'metal', 0.08, 0.05, 0.01, 0.3, 0.14, 0.62, 0.5, 0, 0.6); K.cyl(b, 'timber', 0.01, 0.01, 0.18, 0.33, 0.12, 0.62, 5, 0, -0.7);
      K.chimney(b, -0.45, 0.4, -0.3, 0.35);
      K.banner(b, o, -0.7, 0, 0.45, 0.85);
      return {};
    },
    quarry(b, W, D, o, dx, T) {
      const w = W * 0.5, d = D * 0.46;
      K.walls(b, { w, d, h: 0.5, wall: 'stone', frame: false, base: 0, x: -0.25, z: -0.2 });
      K.roof(b, { w, d, rise: 0.35, y: 0.5, mat: 'slate', gable: 'stone', x: -0.25, z: -0.2 });
      K.door(b, -0.25, 0, d / 2 - 0.2, 0, 0.17, 0.3, T);
      K.blocks(b, 0.35, 0.45, 7); K.stones(b, -0.5, 0.55, 5, 1.3);
      // guindaste de madeira
      K.box(b, 'timber', 0.05, 0.9, 0.05, 0.55, 0, -0.3); K.beam(b, 'timber', 0.55, 0.88, 0.1, 0.62, -0.3, 0.05);
      b.push(0.55, 0.85, -0.3, 0); K.box(b, 'timber', 0.6, 0.05, 0.05, -0.2, 0, 0, 0, 0, 0); b.pop();
      K.cyl(b, 'dark', 0.004, 0.004, 0.35, 0.1, 0.5, -0.3, 4);
      K.box(b, 'stone', 0.14, 0.1, 0.12, 0.1, 0.4, -0.3);
      K.banner(b, o, -0.7, 0, 0.5, 0.85);
      return {};
    },
    sawmill(b, W, D, o, dx, T) {
      const w = W * 0.78, d = D * 0.62;
      // galpão aberto sobre pilares
      K.box(b, 'stone', w, 0.08, d, 0, 0, 0);
      for (const x of [-w / 2 + 0.05, 0, w / 2 - 0.05]) for (const z of [-d / 2 + 0.05, d / 2 - 0.05]) K.box(b, 'timber', 0.07, 0.62, 0.07, x, 0.08, z);
      K.walls(b, { w: w * 0.4, d: d - 0.1, h: 0.62, base: 0, y: 0.08, x: -w * 0.3, seed: 4 });
      K.roof(b, { w, d, rise: 0.45, y: 0.7, mat: 'planks', gable: 'planks', over: 0.1 });
      K.box(b, 'planks', 0.6, 0.12, 0.16, 0.18, 0.08, 0.02); K.cyl(b, 'logs', 0.06, 0.06, 0.55, 0.2, 0.26, 0.02, 8, 0, PI / 2);
      K.cyl(b, 'metal', 0.13, 0.13, 0.01, 0.2, 0.2, 0.12, 14, PI / 2);
      for (let i = 0; i < 4; i++) K.box(b, 'planks', 0.55, 0.025, 0.14, w / 2 - 0.3, i * 0.03, d / 2 + 0.2);
      K.logs(b, -w / 2 + 0.25, d / 2 + 0.18, 6, 0, 0.45);
      K.banner(b, o, w / 2 + 0.05, 0, -d / 2, 1.05);
      return {};
    },
    farm(b, W, D, o, dx, T) {
      const w = W * 0.45, d = D * 0.55;
      K.walls(b, { w, d, h: 0.55, seed: 5, x: dx - 0.1, z: -0.1 });
      K.roof(b, { w, d, rise: 0.55, y: 0.65, mat: 'thatch', x: dx - 0.1, z: -0.1 });
      K.door(b, dx - 0.1, 0.1, d / 2 - 0.1, 0, 0.18, 0.3, T);
      K.window(b, dx - 0.1 + w / 3, 0.35, d / 2 - 0.1, 0, 0.12, 0.12, T);
      // celeiro de tábuas ao lado
      const bx = dx + (dx > 0 ? -0.95 : 0.95);
      K.walls(b, { w: 0.7, d: 0.75, h: 0.55, wall: 'planks', frame: false, base: 0.05, x: bx, z: -0.15 });
      K.roof(b, { w: 0.7, d: 0.75, rise: 0.45, y: 0.6, mat: 'thatch', gable: 'planks', x: bx, z: -0.15, ry: 0 });
      K.box(b, 'dark', 0.3, 0.36, 0.03, bx, 0.05, 0.23);
      K.hay(b, bx - 0.25, 0.48); K.hay(b, bx + 0.05, 0.5, 0.3); K.hay(b, bx - 0.1, 0.48, 0, 0.2);
      K.cart(b, dx + 0.45, 0.5, 0.4, 'sacks');
      K.banner(b, o, dx - 0.5, 0, 0.45, 0.9);
      return {};
    },
    vineyard(b, W, D, o, dx, T) {
      const w = W * 0.56, d = D * 0.5;
      K.walls(b, { w, d, h: 0.55, seed: 6, z: -0.1 });
      K.roof(b, { w, d, rise: 0.45, y: 0.65, mat: 'tiles', z: -0.1 });
      K.door(b, dx, 0.1, d / 2 - 0.1, 0, 0.18, 0.3, T);
      K.window(b, -w / 3, 0.35, d / 2 - 0.1, 0, 0.12, 0.12, T);
      K.barrel(b, 0.55, 0.45, 1.2); K.barrel(b, 0.75, 0.3, 1.1); K.barrel(b, 0.62, 0.62, 1);
      b.put('wine', cylG(0.18, 0.2, 0.14, 12), -0.55, 0, 0.55); K.cyl(b, 'planks', 0.2, 0.21, 0.12, -0.55, 0, 0.55, 12);
      // parreira
      for (const x of [-0.7, -0.35]) K.box(b, 'timber', 0.03, 0.4, 0.03, x, 0, -0.7);
      K.box(b, 'timber', 0.4, 0.03, 0.03, -0.52, 0.38, -0.7); K.box(b, 'green', 0.4, 0.14, 0.12, -0.52, 0.26, -0.7);
      K.banner(b, o, w / 2 + 0.1, 0, 0.45, 0.9);
      return {};
    },
    fisher(b, W, D, o, dx, T) {
      const w = W * 0.5, d = D * 0.46;
      K.walls(b, { w, d, h: 0.48, wall: 'planks', frame: false, base: 0.12, z: -0.15 });
      for (const x of [-w / 2, w / 2]) for (const z of [-d / 2 - 0.15, d / 2 - 0.15]) K.box(b, 'timber', 0.05, 0.14, 0.05, x, 0, z);
      K.roof(b, { w, d, rise: 0.38, y: 0.6, mat: 'thatch', gable: 'planks', z: -0.15 });
      K.door(b, dx, 0.12, d / 2 - 0.15, 0, 0.17, 0.28, T);
      // redes secando e barco virado
      K.box(b, 'timber', 0.03, 0.42, 0.03, 0.45, 0, 0.35); K.box(b, 'timber', 0.03, 0.42, 0.03, 0.85, 0, 0.35); K.box(b, 'timber', 0.44, 0.03, 0.03, 0.65, 0.4, 0.35);
      K.box(b, 'sack', 0.38, 0.28, 0.01, 0.65, 0.1, 0.35);
      const hull = new THREE.CylinderGeometry(0.13, 0.13, 0.6, 10, 1, false, 0, PI).rotateZ(PI / 2).rotateX(PI / 2);
      b.put('planks', scaleUV(hull, (i, u, v) => [u, v]), -0.45, 0.02, 0.5, 0.3);
      K.barrel(b, 0.3, 0.65); K.box(b, 'water', 0.14, 0.03, 0.1, 0.3, 0.2, 0.65);
      K.banner(b, o, -0.75, 0, -0.2, 0.9);
      return {};
    },
    mill(b, W, D, o, dx, T) {
      // moinho de vento: torre cônica caiada, capuz de palha e pás girando
      K.cyl(b, 'stone', 0.4, 0.44, 0.12, 0, 0, 0, 12);
      K.cyl(b, 'plaster', 0.28, 0.38, 1.35, 0, 0.12, 0, 12);
      for (let i = 0; i < 3; i++) K.cyl(b, 'timber', 0.29 + i * 0.03, 0.3 + i * 0.03, 0.04, 0, 0.4 + i * 0.35, 0, 12);
      K.cone(b, 'thatch', 0.36, 0.55, 0, 1.47, 0, 12);
      K.door(b, 0, 0.12, 0.4, 0, 0.18, 0.3, T);
      K.window(b, 0, 0.9, 0.34, 0, 0.1, 0.14, T);
      K.sack(b, 0.35, 0.45); K.sack(b, 0.45, 0.35, 0.9); K.sack(b, -0.4, 0.4);
      const s = new Bag();
      s.put('timber', cylG(0.06, 0.06, 0.12, 8).rotateX(PI / 2), 0, 0, 0);
      for (let k = 0; k < 4; k++) {
        const a = (k * PI) / 2;
        const g = boxG(0.035, 0.95, 0.03).rotateZ(a);
        s.put('timber', g, 0, 0, 0.06);
        const sail = boxG(0.2, 0.7, 0.01).translate(0.12, 0.22, 0).rotateZ(a);
        s.put('cloth', sail, 0, 0, 0.05);
      }
      const fan = s.build();
      fan.name = 'fan';
      fan.position.set(0, 1.45, 0.42);
      b.anim.push(fan);
      K.banner(b, o, -0.55, 0, 0.3, 0.8);
      return {};
    },
    bakery(b, W, D, o, dx, T) {
      const w = W * 0.58, d = D * 0.52;
      K.walls(b, { w, d, h: 0.58, seed: 7, x: -0.12, z: -0.08 });
      K.roof(b, { w, d, rise: 0.5, y: 0.68, mat: 'tiles', x: -0.12, z: -0.08 });
      K.door(b, dx - 0.1, 0.1, d / 2 - 0.08, 0, 0.18, 0.3, T);
      K.window(b, -0.4, 0.38, d / 2 - 0.08, 0, 0.12, 0.12, T);
      // forno redondo de tijolos
      const dome = new THREE.SphereGeometry(0.26, 12, 8, 0, PI * 2, 0, PI / 2);
      b.put('stone', scaleUV(dome, (i, u, v) => [u * 2, v]), 0.62, 0, 0.1);
      K.box(b, 'glow', 0.12, 0.1, 0.02, 0.62, 0.02, 0.35);
      const c = K.chimney(b, 0.62, 0.18, -0.08, 0.3);
      K.sack(b, 0.45, 0.5); K.box(b, 'planks', 0.26, 0.02, 0.12, -0.5, 0.14, 0.5); K.box(b, 'timber', 0.03, 0.14, 0.03, -0.6, 0, 0.5); K.box(b, 'timber', 0.03, 0.14, 0.03, -0.4, 0, 0.5);
      K.sign(b, '🍞', -0.12 - w / 2 - 0.02, 0.55, d / 2 - 0.2, -PI / 2);
      K.banner(b, o, 0.85, 0, -0.5, 0.85);
      return { smoke: c };
    },
    swine(b, W, D, o, dx, T) {
      const w = W * 0.36, d = D * 0.5;
      const hx = -W * 0.28;
      K.walls(b, { w, d, h: 0.5, wall: 'planks', frame: false, base: 0.05, x: hx, z: -0.1 });
      K.roof(b, { w, d, rise: 0.42, y: 0.55, mat: 'thatch', gable: 'planks', x: hx, z: -0.1 });
      K.door(b, hx, 0.05, d / 2 - 0.1, 0, 0.18, 0.3, T);
      // chiqueiro cercado
      const x0 = 0.05, x1 = W / 2 - 0.08, z0 = -D / 2 + 0.15, z1 = D / 2 - 0.1;
      K.fence(b, x0, z0, x1, z0); K.fence(b, x1, z0, x1, z1); K.fence(b, x1, z1, x0 + 0.3, z1); K.fence(b, x0, z1, x0, z0);
      K.box(b, 'dirt', x1 - x0, 0.01, z1 - z0, (x0 + x1) / 2, 0, (z0 + z1) / 2);
      K.box(b, 'planks', 0.3, 0.06, 0.08, x1 - 0.25, 0, z0 + 0.12); K.box(b, 'water', 0.26, 0.02, 0.05, x1 - 0.25, 0.05, z0 + 0.12);
      // poça de lama num canto do chiqueiro
      b.put('mud', cylG(0.17, 0.17, 0.006, 16).scale(1.3, 1, 1), x0 + 0.42, 0.006, z1 - 0.36);
      K.hay(b, hx + 0.3, 0.55);
      K.banner(b, o, hx - 0.4, 0, 0.4, 0.85);
      return { pen: [(x0 + x1) / 2, (z0 + z1) / 2], penBox: [x0, z0, x1, z1] };
    },
    butcher(b, W, D, o, dx, T) {
      const w = W * 0.58, d = D * 0.52;
      K.walls(b, { w, d, h: 0.62, seed: 8, z: -0.1 });
      K.roof(b, { w, d, rise: 0.5, y: 0.72, mat: 'tiles', z: -0.1 });
      const c = K.chimney(b, -w / 3, 0.9, -0.25, 0.4);
      K.door(b, dx, 0.1, d / 2 - 0.1, 0, 0.18, 0.32, T);
      // toldo e ganchos com carnes
      b.push(0, 0, d / 2 - 0.1, 0);
      K.box(b, T, w * 0.9, 0.02, 0.22, 0, 0.5, 0.12, 0, 0.35); K.box(b, 'timber', w * 0.9, 0.02, 0.02, 0, 0.45, 0.22);
      for (let i = 0; i < 4; i++) { const x = -w / 3 + i * 0.12; if (Math.abs(x - dx) < 0.12) continue; b.put('meat', new THREE.SphereGeometry(0.04, 6, 5).scale(1, 1.6, 1), x, 0.36, 0.2); }
      b.pop();
      K.box(b, 'planks', 0.3, 0.04, 0.14, 0.55, 0.14, 0.55); K.box(b, 'timber', 0.03, 0.14, 0.03, 0.43, 0, 0.55); K.box(b, 'timber', 0.03, 0.14, 0.03, 0.67, 0, 0.55);
      K.sign(b, '🔪', w / 2 + 0.02, 0.6, d / 2 - 0.25, PI / 2);
      K.banner(b, o, -0.8, 0, 0.45, 0.85);
      return { smoke: c };
    },
    tannery(b, W, D, o, dx, T) {
      const w = W * 0.5, d = D * 0.5;
      K.walls(b, { w, d, h: 0.55, seed: 9, x: -0.3, z: -0.15 });
      K.roof(b, { w, d, rise: 0.45, y: 0.65, mat: 'thatch', x: -0.3, z: -0.15 });
      K.door(b, -0.3, 0.1, d / 2 - 0.15, 0, 0.17, 0.3, T);
      // varais com couros e tinas
      for (const x of [0.25, 0.85]) K.box(b, 'timber', 0.03, 0.45, 0.03, x, 0, -0.35);
      K.box(b, 'timber', 0.64, 0.03, 0.03, 0.55, 0.43, -0.35);
      for (let i = 0; i < 3; i++) K.box(b, 'leather', 0.16, 0.22, 0.01, 0.35 + i * 0.2, 0.2, -0.35, 0, 0, (H(i, 1, 2) - 0.5) * 0.2);
      for (const [x, z, m] of [[0.35, 0.45, 'wine'], [0.7, 0.5, 'leather']]) { K.cyl(b, 'planks', 0.14, 0.15, 0.14, x, 0, z, 10); b.put(m, cylG(0.125, 0.125, 0.01, 10), x, 0.12, z); }
      K.banner(b, o, -0.75, 0, 0.5, 0.85);
      return {};
    },
    mine(b, W, D, o, dx, T, ore) {
      // encosta rochosa com a boca da mina escorada em madeira
      const rock = new THREE.IcosahedronGeometry(0.62, 1);
      const p = rock.attributes.position;
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = 0.85 + H(Math.round(x * 50), Math.round(y * 50), Math.round(z * 50)) * 0.3; p.setXYZ(i, x * k * 1.25, Math.max(-0.05, y * k * 0.9), z * k); }
      rock.computeVertexNormals();
      const rc = lin('#8f8a80'), rd = lin('#6a655d'), rm = lin('#6d8a45');
      b.put('rock', colorize(rock, (x, y, z, f) => (y > 0.35 && H(f, 7, 5) < 0.3 ? jit(rm, 0.3, f) : jit(H(f, 7, 6) < 0.5 ? rc : rd, 0.2, f))), 0, 0, -0.3);
      K.box(b, 'dark', 0.34, 0.4, 0.2, 0, 0, 0.2);
      K.box(b, 'timber', 0.06, 0.46, 0.06, -0.2, 0, 0.3); K.box(b, 'timber', 0.06, 0.46, 0.06, 0.2, 0, 0.3); K.box(b, 'timber', 0.5, 0.07, 0.08, 0, 0.44, 0.3);
      // trilhos e vagonete
      for (const x of [-0.07, 0.07]) K.box(b, 'iron', 0.02, 0.015, 0.6, x, 0, 0.6);
      for (let i = 0; i < 4; i++) K.box(b, 'timber', 0.22, 0.015, 0.035, 0, 0, 0.35 + i * 0.15);
      K.box(b, 'iron', 0.2, 0.12, 0.16, 0, 0.04, 0.65);
      const oreM = ['coal', 'coal', 'ore2', 'ore3'][ore];
      K.stones(b, 0, 0.65, 3, 0.9); for (const g of b.p.stone.slice(-3)) g.translate(0, 0.1, 0);
      for (let i = 0; i < 5; i++) b.put(oreM, new THREE.DodecahedronGeometry(0.06, 0).translate(0, 0.05, 0), 0.55 + (i % 3) * 0.1, (i > 2 ? 0.06 : 0), 0.45 + Math.floor(i / 3) * 0.08);
      // cabana do mineiro
      K.walls(b, { w: 0.45, d: 0.4, h: 0.4, wall: 'planks', frame: false, base: 0.04, x: -0.62, z: 0.45 });
      K.roof(b, { w: 0.45, d: 0.4, rise: 0.25, y: 0.44, mat: 'planks', gable: 'planks', x: -0.62, z: 0.45 });
      K.banner(b, o, 0.8, 0, 0.1, 0.85);
      return {};
    },
    smelter(b, W, D, o, dx, T, gold) {
      const w = W * 0.5, d = D * 0.5;
      K.walls(b, { w, d, h: 0.55, wall: 'stone', frame: false, base: 0, x: -0.3, z: -0.1 });
      K.roof(b, { w, d, rise: 0.4, y: 0.55, mat: 'slate', gable: 'stone', x: -0.3, z: -0.1 });
      K.door(b, -0.3, 0, d / 2 - 0.1, 0, 0.17, 0.3, T);
      // fornalha alta de pedra com boca incandescente
      K.cyl(b, 'stone', 0.18, 0.3, 1.25, 0.5, 0, -0.1, 10);
      K.box(b, 'glow', 0.14, 0.14, 0.04, 0.5, 0.1, 0.18);
      K.cyl(b, 'iron', 0.19, 0.19, 0.05, 0.5, 1.2, -0.1, 10);
      K.anvil(b, 0.45, 0.55);
      for (let i = 0; i < 4; i++) K.box(b, gold ? 'gold' : 'iron', 0.1, 0.035, 0.05, 0.05 + (i % 2) * 0.11, Math.floor(i / 2) * 0.036, 0.6);
      K.banner(b, o, -0.8, 0, 0.45, 0.85);
      return { smoke: [0.5, 1.3, -0.1] };
    },
    weaponworkshop(b, W, D, o, dx, T) {
      const w = W * 0.62, d = D * 0.5;
      K.walls(b, { w, d, h: 0.6, seed: 10, z: -0.15 });
      K.roof(b, { w, d, rise: 0.5, y: 0.7, mat: 'thatch', z: -0.15 });
      K.door(b, dx, 0.1, d / 2 - 0.15, 0, 0.2, 0.32, T);
      K.window(b, -w / 3, 0.38, d / 2 - 0.15, 0, 0.13, 0.13, T);
      K.rack(b, 0.45, 0.45, 0.2, 'spear'); K.rack(b, -0.45, 0.5, -0.2, 'sword');
      // alvo de palha
      b.put('hay', cylG(0.14, 0.14, 0.05, 12).rotateX(PI / 2), 0.78, 0.2, -0.35, -0.4); K.box(b, 'timber', 0.03, 0.3, 0.03, 0.78, 0, -0.3);
      K.logs(b, -0.75, -0.3, 3, PI / 2, 0.3);
      K.banner(b, o, w / 2 + 0.08, 0, 0.35, 0.95);
      return {};
    },
    armorworkshop(b, W, D, o, dx, T) {
      const w = W * 0.62, d = D * 0.5;
      K.walls(b, { w, d, h: 0.6, seed: 11, z: -0.15 });
      K.roof(b, { w, d, rise: 0.5, y: 0.7, mat: 'tiles', z: -0.15 });
      K.door(b, dx, 0.1, d / 2 - 0.15, 0, 0.2, 0.32, T);
      // escudos pendurados na fachada
      for (const x of [-w / 3, w / 3]) K.shieldDisc(b, T, x, 0.42, d / 2 - 0.12, 0, 0.09);
      K.box(b, 'timber', 0.2, 0.3, 0.03, 0.55, 0, 0.5); K.box(b, 'leather', 0.18, 0.2, 0.08, 0.55, 0.12, 0.5);
      K.cyl(b, 'timber', 0.015, 0.015, 0.32, 0.55, 0, 0.5, 5);
      K.crate(b, -0.6, 0.5); K.shieldDisc(b, T, -0.6, 0.22, 0.6, 0.3, 0.07);
      K.banner(b, o, -w / 2 - 0.08, 0, 0.35, 0.95);
      return {};
    },
    forge(b, W, D, o, dx, T, armor) {
      const w = W * 0.66, d = D * 0.55;
      K.walls(b, { w, d, h: 0.62, wall: 'stone', frame: false, base: 0, z: -0.12 });
      K.roof(b, { w, d, rise: 0.45, y: 0.62, mat: 'slate', gable: 'stone', z: -0.12 });
      const c = K.chimney(b, w / 3, 0.8, -0.3, 0.55);
      K.door(b, dx - 0.05, 0, d / 2 - 0.12, 0, 0.22, 0.34, T);
      K.box(b, 'glow', 0.14, 0.1, 0.02, -w / 3, 0.15, d / 2 - 0.1);
      // telheiro com bigorna na frente
      K.box(b, 'timber', 0.04, 0.45, 0.04, 0.72, 0, 0.62); K.box(b, 'timber', 0.04, 0.45, 0.04, 0.3, 0, 0.62);
      K.box(b, 'planks', 0.55, 0.03, 0.4, 0.5, 0.45, 0.45, 0, -0.25);
      K.anvil(b, 0.5, 0.45);
      if (armor) { K.cyl(b, 'timber', 0.015, 0.015, 0.34, -0.62, 0, 0.5, 5); K.box(b, 'metal', 0.17, 0.18, 0.08, -0.62, 0.12, 0.5); K.box(b, 'iron', 0.1, 0.07, 0.08, -0.62, 0.32, 0.5); K.shieldDisc(b, T, -0.4, 0.2, 0.62, 0, 0.08); }
      else K.rack(b, -0.55, 0.52, 0, 'sword');
      K.banner(b, o, -w / 2 - 0.08, 0, -0.35, 1.05);
      return { smoke: c };
    },
    stables(b, W, D, o, dx, T) {
      const w = W * 0.82, d = D * 0.5;
      K.walls(b, { w, d, h: 0.55, wall: 'planks', frame: false, base: 0.06, z: -0.2 });
      K.roof(b, { w, d, rise: 0.4, y: 0.61, mat: 'thatch', gable: 'planks', z: -0.2 });
      for (let i = 0; i < 4; i++) { const x = -w / 2 + (i + 0.5) * (w / 4); K.box(b, 'dark', 0.28, 0.34, 0.02, x, 0.06, d / 2 - 0.19); K.box(b, T, 0.28, 0.16, 0.03, x, 0.06, d / 2 - 0.17); }
      K.hay(b, -w / 2 + 0.15, 0.55); K.hay(b, -w / 2 + 0.2, 0.5, 0, 0.2);
      K.fence(b, 0.2, 0.3, w / 2, 0.3); K.fence(b, w / 2, 0.3, w / 2, 0.85);
      K.box(b, 'planks', 0.3, 0.06, 0.08, 0.45, 0, 0.72); K.box(b, 'water', 0.26, 0.02, 0.05, 0.45, 0.05, 0.72);
      K.banner(b, o, -w / 2 - 0.05, 0, 0.3, 1.0);
      return { pen: [0.75, 0.55] };
    },
    barracks(b, W, D, o, dx, T) {
      const w = W * 0.84, d = D * 0.62;
      K.walls(b, { w, d, h: 0.85, wall: 'stone', frame: false, base: 0, z: -0.1 });
      K.battlements(b, w + 0.04, d + 0.04, 0.85, 'stone');
      K.box(b, 'stone', w * 0.55, 0.3, d * 0.6, 0, 0.85, -0.12);
      K.roof(b, { w: w * 0.55, d: d * 0.6, rise: 0.45, y: 1.15, mat: 'slate', gable: 'stone', z: -0.12 });
      // portão em arco
      K.box(b, 'dark', 0.36, 0.48, 0.04, dx, 0, d / 2 - 0.09);
      b.put('dark', new THREE.CylinderGeometry(0.18, 0.18, 0.04, 12, 1, false, -PI / 2, PI).rotateX(PI / 2).translate(0, 0.48, 0), dx, 0, d / 2 - 0.09);
      K.box(b, T, 0.34, 0.44, 0.02, dx, 0, d / 2 - 0.06);
      for (const x of [-w / 3, w / 3]) { K.box(b, 'dark', 0.05, 0.16, 0.03, x, 0.5, d / 2 - 0.09); K.box(b, T, 0.16, 0.42, 0.01, x + (x > 0 ? -0.18 : 0.18), 0.38, d / 2 - 0.085); }
      // bonecos de treino
      for (const x of [-0.95, -0.6]) { K.cyl(b, 'timber', 0.02, 0.02, 0.4, x, 0, 0.75, 5); b.put('hay', new THREE.SphereGeometry(0.06, 8, 6).translate(0, 0.44, 0), x, 0, 0.75); K.box(b, 'timber', 0.26, 0.03, 0.03, x, 0.3, 0.75); }
      K.rack(b, 0.85, 0.72, 0, 'spear');
      K.banner(b, o, -w / 2 + 0.05, 0.85, d / 2 - 0.12, 0.8, true);
      K.banner(b, o, w / 2 - 0.05, 0.85, d / 2 - 0.12, 0.8, true);
      return {};
    },
    market(b, W, D, o, dx, T) {
      // salão de feira aberto: pilares, telhado de telha e bancas com toldos listrados
      const w = W * 0.86, d = D * 0.66;
      K.box(b, 'stone', w + 0.06, 0.06, d + 0.06, 0, 0, -0.05);
      for (const x of [-w / 2, -w / 6, w / 6, w / 2]) for (const z of [-d / 2, d / 2]) K.box(b, 'timber', 0.07, 0.62, 0.07, x, 0.06, z - 0.05);
      K.box(b, 'timber', w + 0.05, 0.06, 0.07, 0, 0.66, d / 2 - 0.05); K.box(b, 'timber', w + 0.05, 0.06, 0.07, 0, 0.66, -d / 2 - 0.05);
      K.roof(b, { w, d, rise: 0.5, y: 0.7, mat: 'tiles', gable: 'planks', z: -0.05, over: 0.14 });
      // bancas
      const goods = ['meat', 'hay', 'wine', 'ore3'];
      for (let i = 0; i < 3; i++) {
        const x = -w / 3 + i * (w / 3);
        K.box(b, 'planks', 0.46, 0.18, 0.24, x, 0.06, 0.02);
        b.put(i % 2 ? 'cloth' : T, boxG(0.52, 0.02, 0.3), x, 0.46, 0.2, 0, 0.35);
        for (let k = 0; k < 4; k++) b.put(goods[(i + k) % goods.length], new THREE.SphereGeometry(0.035, 6, 5).translate(0, 0.035, 0), x - 0.15 + k * 0.1, 0.24, 0.02);
      }
      // mercadorias na frente e balança
      K.crate(b, -w / 2 + 0.1, d / 2 + 0.2); K.barrel(b, -w / 2 + 0.32, d / 2 + 0.22); K.sack(b, w / 2 - 0.12, d / 2 + 0.2); K.sack(b, w / 2 - 0.25, d / 2 + 0.25, 0.9);
      K.cyl(b, 'timber', 0.015, 0.015, 0.3, w / 2 - 0.45, 0, d / 2 + 0.22, 5);
      K.box(b, 'iron', 0.22, 0.012, 0.012, w / 2 - 0.45, 0.3, d / 2 + 0.22);
      for (const s of [-1, 1]) K.cyl(b, 'gold', 0.045, 0.03, 0.012, w / 2 - 0.45 + s * 0.1, 0.22, d / 2 + 0.22, 8);
      K.sign(b, '⚖️', -w / 2 - 0.03, 0.55, d / 2 - 0.2, -PI / 2);
      K.banner(b, o, w / 2 + 0.06, 0, -d / 2, 1.25, true);
      return {};
    },
    tower(b, W, D, o, dx, T) {
      // torre de vigia de pedra com plataforma e telhado
      K.cyl(b, 'stone', 0.34, 0.42, 1.35, 0, 0, 0, 10);
      K.cyl(b, 'stone', 0.44, 0.44, 0.1, 0, 1.35, 0, 10);
      for (let k = 0; k < 10; k += 2) { const a = (k / 10) * PI * 2; K.box(b, 'stone', 0.16, 0.14, 0.08, Math.sin(a) * 0.4, 1.45, Math.cos(a) * 0.4, a); }
      for (let k = 0; k < 4; k++) { const a = PI / 4 + (k * PI) / 2; K.box(b, 'timber', 0.04, 0.45, 0.04, Math.sin(a) * 0.3, 1.45, Math.cos(a) * 0.3); }
      K.cone(b, 'slate', 0.5, 0.45, 0, 1.9, 0, 8);
      K.door(b, 0, 0, 0.4, 0, 0.18, 0.32, T);
      K.box(b, 'dark', 0.06, 0.18, 0.03, 0, 0.8, 0.37);
      K.blocks(b, 0.55, 0.55, 4);
      K.banner(b, o, 0, 2.3, 0, 0.35);
      return {};
    },
  };
  const MAP = {
    storehouse: 'storehouse', school: 'school', inn: 'inn', woodcutter: 'woodcutter', quarry: 'quarry', sawmill: 'sawmill', farm: 'farm',
    vineyard: 'vineyard', fisher: 'fisher', mill: 'mill', bakery: 'bakery', swine: 'swine', butcher: 'butcher', tannery: 'tannery',
    coalmine: ['mine', 1], ironmine: ['mine', 2], goldmine: ['mine', 3], ironsmithy: ['smelter', false], goldsmelter: ['smelter', true],
    weaponworkshop: 'weaponworkshop', armorworkshop: 'armorworkshop', weaponsmithy: ['forge', false], armorsmithy: ['forge', true],
    stables: 'stables', barracks: 'barracks', tower: 'tower', market: 'market',
  };
  const cache = {};
  // modelo pronto (em cache por tipo/dono/porta); devolve um clone leve que compartilha geometria e materiais
  A.house = function (type, W, D, owner, dx) {
    const key = type + ':' + W + 'x' + D + ':' + owner + ':' + dx.toFixed(2);
    if (!cache[key]) {
      const b = new Bag();
      const m = MAP[type] || 'woodcutter';
      const fn = Array.isArray(m) ? HOUSES[m[0]] : HOUSES[m];
      const info = fn(b, W, D, owner, dx, 'team' + owner, Array.isArray(m) ? m[1] : undefined) || {};
      const g = b.build();
      g.userData.info = info;
      cache[key] = g;
    }
    const src = cache[key], out = src.clone(true);
    out.userData.info = src.userData.info;
    return out;
  };

  // ---------- obra em andamento (genérica para qualquer casa) ----------
  const siteCache = {};
  A.site = function (W, D, stage) {
    const key = W + 'x' + D + ':' + stage;
    if (!siteCache[key]) {
      const b = new Bag(), w = W * 0.72, d = D * 0.58;
      K.box(b, 'stone', w + 0.06, 0.08, d + 0.06, 0, 0, -0.05);
      if (stage >= 1) {
        const hgt = stage === 1 ? 0.35 : 0.62;
        for (const x of [-w / 2, 0, w / 2]) for (const z of [-d / 2, d / 2]) K.box(b, 'timber', 0.05, hgt, 0.05, x, 0.08, z - 0.05);
        if (stage >= 2) { K.box(b, 'timber', w, 0.05, 0.05, 0, 0.08 + hgt, d / 2 - 0.05); K.box(b, 'timber', w, 0.05, 0.05, 0, 0.08 + hgt, -d / 2 - 0.05); K.box(b, 'plaster', w - 0.05, 0.3, d - 0.05, 0, 0.08, -0.05); }
        if (stage >= 3) {
          K.box(b, 'plaster', w - 0.05, 0.6, d - 0.05, 0, 0.08, -0.05);
          // cavaletes do telhado
          b.push(0, 0, 0, PI / 2); for (const zz of [-w / 2, 0, w / 2]) { K.beam(b, 'timber', -d / 2 - 0.05, 0.7, -0.05, 1.05, zz, 0.04); K.beam(b, 'timber', d / 2 - 0.05, 0.7, -0.05, 1.05, zz, 0.04); } b.pop();
        }
        // andaime na frente
        for (const x of [-w / 2 - 0.05, w / 2 + 0.05]) { K.box(b, 'timber', 0.03, 0.8, 0.03, x, 0, d / 2 + 0.12); K.box(b, 'timber', 0.03, 0.8, 0.03, x, 0, d / 2 + 0.3); }
        K.box(b, 'planks', w + 0.2, 0.025, 0.2, 0, 0.42, d / 2 + 0.21);
        K.beam(b, 'timber', -w / 2, 0.1, w / 2, 0.7, d / 2 + 0.3, 0.025);
      }
      siteCache[key] = b.build();
    }
    return siteCache[key].clone(true);
  };
  // terreno marcado (planejado): estacas com cordão
  const planCache = {};
  A.plan = function (W, D) {
    const key = W + 'x' + D;
    if (!planCache[key]) {
      const b = new Bag(), w = W - 0.2, d = D - 0.2;
      for (const x of [-w / 2, w / 2]) for (const z of [-d / 2, d / 2]) K.box(b, 'timber', 0.035, 0.18, 0.035, x, 0, z);
      for (const [x1, z1, x2, z2] of [[-w / 2, -d / 2, w / 2, -d / 2], [w / 2, -d / 2, w / 2, d / 2], [w / 2, d / 2, -w / 2, d / 2], [-w / 2, d / 2, -w / 2, -d / 2]]) {
        const L = Math.hypot(x2 - x1, z2 - z1), a = Math.atan2(-(z2 - z1), x2 - x1);
        b.put('cloth', boxG(L, 0.012, 0.012).translate(L / 2, 0, 0), x1, 0.15, z1, a);
      }
      planCache[key] = b.build();
    }
    return planCache[key].clone(true);
  };
  // ruínas
  const ruinCache = {};
  A.ruin = function (W, D) {
    const key = W + 'x' + D;
    if (!ruinCache[key]) {
      const b = new Bag(), w = W * 0.7, d = D * 0.55;
      K.box(b, 'stone', w, 0.08, d, 0, 0, 0);
      K.box(b, 'stone', 0.1, 0.35, d * 0.8, -w / 2, 0.08, 0); K.box(b, 'stone', w * 0.5, 0.22, 0.1, -w / 4, 0.08, -d / 2);
      for (let i = 0; i < 5; i++) K.beam(b, 'logs', -w / 2 + i * 0.25, 0.1, -w / 2 + i * 0.25 + 0.3, 0.1 + H(i, 3, 3) * 0.3, (H(i, 4, 4) - 0.5) * d, 0.05);
      K.stones(b, 0.2, 0.1, 8, 1.4);
      ruinCache[key] = b.build();
      ruinCache[key].traverse((o) => { if (o.isMesh && o.material && o.material.color) { o.material = o.material.clone(); o.material.color.multiplyScalar(0.55); } });
    }
    return ruinCache[key].clone(true);
  };

  // ================= personagens próprios =================
  // Corpo facetado gerado por peças rígidas presas aos ossos do esqueleto (reaproveita todas as animações).
  // Tudo (corpo, roupa, chapéu, armas, escudo) vira UMA malha com cor por vértice: 1 desenho por unidade.
  const SKIN = ['#e8b894', '#c98e66', '#a46a45', '#f0c8a8', '#d9a47c', '#8a5636'];
  const HAIR = ['#3a2a1a', '#6a4424', '#1e1610', '#a8743a', '#c9a060', '#7a2e18', '#8a8278'];
  // variações por unidade (pele, cabelo, barba, porte): o povo não parece um exército de clones
  A.CHAR_VARIANTS = 4;
  const CH = {
    serf: { tunic: '#8a6a44', pants: '#5a4632', hat: 'hood', hatC: '#b89a6a', belt: 1 },
    laborer: { tunic: '#5f7289', pants: '#4a3c2c', hat: 'cap', hatC: '#7a5a3a', apron: '#8a5a34', beard: '#5a3a22' },
    woodcutter: { tunic: '#4f7a3a', pants: '#4a3c2c', hat: 'hood', hatC: '#6a4a2a', weapon: 'axe2', beard: '#7a4a22' },
    stonemason: { tunic: '#8c8a84', pants: '#4a4640', hat: 'band', hatC: '#c0a878', weapon: 'hammer' },
    farmer: { tunic: '#c9b27a', pants: '#6a5638', hat: 'straw', hatC: '#e0c060', weapon: 'sickle' },
    carpenter: { tunic: '#a0703a', pants: '#4a3c2c', hat: 'cap', hatC: '#5a4028', apron: '#6a4a2a', weapon: 'hammer' },
    miner: { tunic: '#4a4a5a', pants: '#3a3430', hat: 'minerhelm', hatC: '#6a6a6a', weapon: 'pick', beard: '#3a2a1a' },
    breeder: { tunic: '#b87a5a', pants: '#5a4632', hat: 'straw', hatC: '#c8a860' },
    fisher: { tunic: '#3f7aa0', pants: '#4a4a3a', hat: 'cap', hatC: '#2f4f6a', beard: '#8a8a80' },
    metallurgist: { tunic: '#9a4a2a', pants: '#3a3028', hat: 'none', hair: '#3a2a1a', apron: '#4a3020', weapon: 'hammer' },
    smith: { tunic: '#4a4a4a', pants: '#2e2a26', hat: 'none', hair: '#1a1410', apron: '#2a2220', weapon: 'hammer', beard: '#2a1a10' },
    baker: { tunic: '#efe6d2', pants: '#8a7a60', hat: 'chef', hatC: '#fbf8f0', apron: '#fbf8f0' },
    butcher: { tunic: '#b04a3a', pants: '#4a3c2c', hat: 'none', hair: '#6a3a1a', apron: '#e8e0d0', weapon: 'cleaver' },
    recruit: { tunic: 'team', pants: '#4a4032', hat: 'none', hair: '#5a3a1a' },
    levy: { tunic: 'team', pants: '#5a4a36', hat: 'straw', hatC: '#c8a860', weapon: 'hammer' },
    militia: { tunic: 'team', pants: '#4a4032', hat: 'cap', hatC: '#6a4a2a', weapon: 'axe1' },
    axeman: { tunic: '#7a5a3a', tabard: 1, pants: '#4a4032', hat: 'nasal', weapon: 'axe1', shield: 'round' },
    swordsman: { tunic: '#9aa0a8', mail: 1, tabard: 1, pants: '#5a5a60', hat: 'greathelm', weapon: 'sword', shield: 'kite' },
    bowman: { tunic: '#5a6a3a', pants: '#4a4032', hat: 'hood', hatC: 'team', weapon: 'bow', belt: 1 },
    crossbowman: { tunic: '#9aa0a8', mail: 1, tabard: 1, pants: '#5a5a60', hat: 'kettle', weapon: 'crossbow' },
    lancer: { tunic: '#7a5a3a', tabard: 1, pants: '#4a4032', hat: 'nasal', weapon: 'spear', shield: 'round' },
    pikeman: { tunic: '#9aa0a8', mail: 1, tabard: 1, pants: '#5a5a60', hat: 'kettle', weapon: 'pike' },
    scout: { tunic: '#6a5a3a', pants: '#4a4032', hat: 'hood', hatC: 'team', weapon: 'axe1', cape: 1 },
    knight: { tunic: '#b8bec6', mail: 1, tabard: 1, pants: '#8a9098', hat: 'greathelm', plume: 1, weapon: 'sword', shield: 'kite', cape: 1 },
  };
  A.CHAR_TYPES = Object.keys(CH);
  const charCache = {};
  A.character = function (type, owner, rig, variant) {
    const vr = (variant || 0) % A.CHAR_VARIANTS;
    const key = type + ':' + owner + ':' + vr;
    if (charCache[key]) return charCache[key];
    const sp = CH[type] || CH.serf;
    const team = lin(KM.COLORS[owner] || '#888888');
    const C = (hex) => (hex === 'team' ? team : lin(hex));
    const vh = (k) => KM.hash(type.length * 7 + vr, owner + 3, k);
    const skin = lin(SKIN[(vh(3) * SKIN.length) | 0] || SKIN[0]);
    const hairHex = sp.hair && vr === 0 ? sp.hair : HAIR[(vh(5) * HAIR.length) | 0];
    const beardHex = sp.beard || (vh(6) < 0.4 ? hairHex : null);
    const bw = 0.95 + vh(8) * 0.12; // porte: mais magro ou mais largo
    const P = rig.P, parts = [];
    // cabeça um pouco maior que o esqueleto (lê melhor de longe, estilo "chibi"); chapéus acompanham
    const HS = 1.2, HC = new THREE.Vector3(0, 1.36, 0.01);
    // peça rígida: geometria em espaço de ligação, presa a um osso, com cor facetada
    const put = (g, col, bone, jitter) => {
      g = g.index ? g.toNonIndexed() : g;
      if (bone === 'head') g.translate(-HC.x, -HC.y, -HC.z).scale(HS, HS, HS).translate(HC.x, HC.y, HC.z);
      if (g.attributes.uv) g.deleteAttribute('uv');
      const n = g.attributes.position.count, c = new Float32Array(n * 3), si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
      const bi = rig.idx[bone] != null ? rig.idx[bone] : 0;
      for (let i = 0; i < n; i += 3) {
        const k = 1 + (H(i, bi, 71) - 0.5) * (jitter == null ? 0.14 : jitter);
        for (let j = 0; j < 3; j++) { c[(i + j) * 3] = col[0] * k; c[(i + j) * 3 + 1] = col[1] * k; c[(i + j) * 3 + 2] = col[2] * k; }
      }
      for (let i = 0; i < n; i++) { si[i * 4] = bi; sw[i * 4] = 1; }
      g.setAttribute('color', new THREE.BufferAttribute(c, 3));
      g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
      g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
      g.computeVertexNormals();
      parts.push(g);
    };
    const at = (g, p) => g.translate(p.x, p.y, p.z);
    // segmento (cilindro) entre dois pontos
    const seg = (a, b, r0, r1, sides) => {
      const d = new THREE.Vector3().subVectors(b, a), L = d.length();
      const g = new THREE.CylinderGeometry(r1, r0, L, sides || 6).translate(0, L / 2, 0);
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
      return at(g, a);
    };
    const v = (x, y, z) => new THREE.Vector3(x, y, z);
    const tunic = C(sp.tunic), pants = C(sp.pants), boot = lin(vr % 2 ? '#3a2a1e' : '#4a3424'), dark = lin('#1a1410');
    const shade = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
    const hair = lin(hairHex);
    // pernas e botas (arredondadas, com cano dobrado)
    for (const s of ['l', 'r']) {
      put(seg(P['upperleg' + s], P['lowerleg' + s], 0.09, 0.074, 8), pants, 'upperleg' + s);
      put(seg(P['lowerleg' + s], P['foot' + s], 0.074, 0.062, 8), pants, 'lowerleg' + s);
      put(at(new THREE.SphereGeometry(1, 10, 6).scale(0.075, 0.07, 0.135), v(P['foot' + s].x, 0.065, P['foot' + s].z + 0.045)), boot, 'foot' + s, 0.06);
      put(seg(v(P['lowerleg' + s].x, P['lowerleg' + s].y - 0.02, 0), v(P['foot' + s].x, 0.1, 0), 0.08, 0.072, 8), boot, 'lowerleg' + s, 0.06);
      put(seg(v(P['lowerleg' + s].x, P['lowerleg' + s].y - 0.05, 0), v(P['lowerleg' + s].x, P['lowerleg' + s].y + 0.0, 0), 0.092, 0.088, 8), shade(boot, 1.25), 'lowerleg' + s, 0.04);
    }
    // quadril e tronco (túnica ou cota de malha), mais encorpado
    const body = sp.mail ? lin('#8a9098') : tunic;
    put(at(new THREE.BoxGeometry(0.36 * bw, 0.16, 0.22), v(0, 0.46, 0)), pants, 'hips');
    put(seg(v(0, 0.44, 0), v(0, 0.82, 0), 0.21 * bw, 0.215 * bw, 12), body, 'spine');
    put(seg(v(0, 0.8, 0), v(0, 1.16, 0), 0.225 * bw, 0.2 * bw, 12), body, 'chest');
    put(at(new THREE.SphereGeometry(0.2 * bw, 12, 5, 0, PI * 2, 0, PI / 2).scale(1, 0.45, 0.95), v(0, 1.15, 0)), body, 'chest');
    // saia da túnica com barra mais escura
    const skirt = sp.mail ? lin('#7a8088') : tunic;
    put(seg(v(0, 0.3, 0), v(0, 0.56, 0), 0.26 * bw, 0.21 * bw, 12), skirt, 'hips');
    put(seg(v(0, 0.28, 0), v(0, 0.33, 0), 0.265 * bw, 0.26 * bw, 12), shade(skirt, 0.7), 'hips', 0.04);
    // gola
    if (!sp.mail) put(at(new THREE.TorusGeometry(0.1, 0.035, 5, 12).rotateX(PI / 2), v(0, 1.19, 0)), shade(tunic, 0.72), 'chest', 0.04);
    if (sp.tabard) { put(at(new THREE.BoxGeometry(0.3, 0.7, 0.03), v(0, 0.72, 0.215 * bw)), team, 'chest'); put(at(new THREE.BoxGeometry(0.3, 0.7, 0.03), v(0, 0.72, -0.215 * bw)), team, 'chest'); put(at(new THREE.BoxGeometry(0.12, 0.12, 0.035), v(0, 0.95, 0.225 * bw)), lin('#f0d060'), 'chest', 0); }
    if (sp.apron) put(at(new THREE.BoxGeometry(0.3, 0.5, 0.03), v(0, 0.6, 0.225 * bw)), C(sp.apron), 'spine');
    if (sp.belt || sp.tabard || sp.apron || !sp.mail) {
      put(seg(v(0, 0.55, 0), v(0, 0.61, 0), 0.225 * bw, 0.225 * bw, 12), lin('#4a3020'), 'spine', 0.05);
      put(at(new THREE.BoxGeometry(0.06, 0.06, 0.02), v(0, 0.58, 0.228 * bw)), lin('#d8b050'), 'spine', 0);
    }
    // bolsa de couro no quadril do povo
    if (!KM.SOLDIERS[type]) put(at(new THREE.BoxGeometry(0.1, 0.12, 0.06), v(0.2 * bw, 0.5, 0.06)), lin('#6a4a2a'), 'hips');
    if (sp.cape) put(at(new THREE.BoxGeometry(0.42, 0.78, 0.03), v(0, 0.78, -0.235 * bw)), team, 'chest');
    // braços e mãos (ombros arredondados, punho da manga, mão redonda)
    for (const s of ['l', 'r']) {
      const sl = sp.mail ? lin('#8a9098') : tunic;
      put(at(new THREE.IcosahedronGeometry(0.1, 1), P['upperarm' + s]), sl, 'upperarm' + s);
      put(seg(P['upperarm' + s], P['lowerarm' + s], 0.074, 0.064, 8), sl, 'upperarm' + s);
      put(seg(P['lowerarm' + s], P['wrist' + s], 0.062, 0.052, 8), sp.mail ? lin('#6a6a70') : skin, 'lowerarm' + s);
      if (!sp.mail) put(at(new THREE.TorusGeometry(0.06, 0.022, 4, 10).rotateX(PI / 2), P['lowerarm' + s]), shade(tunic, 0.75), 'lowerarm' + s, 0.04);
      put(at(new THREE.IcosahedronGeometry(0.062, 1).scale(1, 1.05, 0.9), P['hand' + s]), sp.mail && sp.hat === 'greathelm' ? lin('#7a8088') : skin, 'hand' + s, 0.04);
    }
    // pescoço e cabeça com rosto: olhos, sobrancelhas, nariz, boca, orelhas e bochechas
    put(seg(v(0, 1.16, 0), v(0, 1.28, 0), 0.075, 0.072, 8), skin, 'head');
    const hc = v(0, 1.43, 0.01);
    put(at(lumpy(new THREE.IcosahedronGeometry(0.17, 2), 0.035, 5).scale(1, 1.06, 0.98), hc), skin, 'head', 0.05);
    put(at(new THREE.IcosahedronGeometry(0.034, 1).scale(1, 1.1, 1.2), v(0, 1.415, 0.18)), shade(skin, 0.92), 'head', 0);
    for (const s of [-1, 1]) {
      put(at(new THREE.SphereGeometry(0.03, 8, 6).scale(1, 1.15, 0.6), v(s * 0.062, 1.462, 0.155)), lin('#f4efe6'), 'head', 0);
      put(at(new THREE.SphereGeometry(0.018, 6, 5).scale(1, 1.2, 0.6), v(s * 0.06, 1.458, 0.172)), dark, 'head', 0);
      put(at(new THREE.BoxGeometry(0.06, 0.016, 0.02).rotateZ(-s * 0.18), v(s * 0.064, 1.512, 0.158)), shade(hair, 0.8), 'head', 0);
      put(at(new THREE.SphereGeometry(0.036, 6, 5).scale(0.55, 1, 0.8), v(s * 0.168, 1.43, 0.0)), skin, 'head', 0.04);
      put(at(new THREE.SphereGeometry(0.026, 6, 4).scale(1, 0.7, 0.4), v(s * 0.1, 1.395, 0.148)), [skin[0] * 1.15, skin[1] * 0.85, skin[2] * 0.85], 'head', 0);
    }
    put(at(new THREE.BoxGeometry(0.06, 0.012, 0.012), v(0, 1.36, 0.163)), lin('#5a2a20'), 'head', 0);
    if (beardHex) {
      const bd = lin(beardHex);
      if (vr % 2 || sp.beard) put(at(new THREE.ConeGeometry(0.1, 0.16, 7).rotateX(PI), v(0, 1.3, 0.1)), bd, 'head');
      else put(at(new THREE.SphereGeometry(0.165, 10, 5, PI * 0.1, PI * 0.8, PI * 0.55, PI * 0.33), v(0, 1.43, 0.015)), bd, 'head', 0.06);
      put(at(new THREE.BoxGeometry(0.09, 0.022, 0.02), v(0, 1.383, 0.168)), bd, 'head', 0);
    }
    // cabelo e chapéus
    const hat = sp.hat || 'none', hcol = sp.hatC ? C(sp.hatC) : lin('#5a3a1a');
    // mechas aparecendo por baixo de gorros, capacetes e chapéus
    const back = (r, z) => new THREE.SphereGeometry(r, 10, 5, PI * 1.05, PI * 0.9, PI * 0.3, PI * 0.38).translate(0, 0, z);
    if (['cap', 'straw', 'band', 'kettle', 'nasal', 'minerhelm', 'chef'].includes(hat)) put(at(back(0.18, -0.01), v(0, 1.45, 0)), hair, 'head', 0.06);
    if (hat === 'none') {
      put(at(new THREE.SphereGeometry(0.182, 10, 5, 0, PI * 2, 0, PI / 2), v(0, 1.455, -0.01)), hair, 'head', 0.06);
      put(at(back(0.182, -0.02), v(0, 1.45, 0)), hair, 'head', 0.06);
      put(at(new THREE.BoxGeometry(0.2, 0.05, 0.05).rotateX(0.3), v(0, 1.555, 0.13)), hair, 'head', 0.06); // franja
    }
    if (hat === 'hood') { put(at(new THREE.SphereGeometry(0.2, 8, 5, 0, PI * 2, 0, PI * 0.62), v(0, 1.44, -0.03)), hcol, 'head'); put(at(new THREE.ConeGeometry(0.1, 0.18, 6).rotateX(-0.9), v(0, 1.55, -0.16)), hcol, 'head'); put(seg(v(0, 1.2, 0), v(0, 1.3, 0), 0.23, 0.17, 8), hcol, 'chest'); }
    if (hat === 'cap') { put(at(new THREE.SphereGeometry(0.185, 8, 4, 0, PI * 2, 0, PI / 2), v(0, 1.48, 0)), hcol, 'head'); put(at(new THREE.BoxGeometry(0.2, 0.02, 0.1), v(0, 1.5, 0.17)), hcol, 'head'); }
    if (hat === 'band') { put(at(new THREE.SphereGeometry(0.175, 8, 4, 0, PI * 2, 0, PI / 2), v(0, 1.46, -0.01)), lin('#6a4a2a'), 'head'); put(seg(v(0, 1.47, 0.01), v(0, 1.52, 0.01), 0.18, 0.18, 8), hcol, 'head'); }
    if (hat === 'straw') { put(seg(v(0, 1.53, 0), v(0, 1.56, 0), 0.34, 0.3, 10), hcol, 'head'); put(at(new THREE.ConeGeometry(0.17, 0.16, 10).translate(0, 0.08, 0), v(0, 1.55, 0)), hcol, 'head'); }
    if (hat === 'chef') { put(seg(v(0, 1.52, 0), v(0, 1.78, 0), 0.16, 0.19, 8), hcol, 'head'); }
    if (hat === 'minerhelm') { put(at(new THREE.SphereGeometry(0.19, 8, 4, 0, PI * 2, 0, PI / 2), v(0, 1.47, 0)), hcol, 'head'); put(at(new THREE.BoxGeometry(0.06, 0.05, 0.03), v(0, 1.56, 0.17)), lin('#ffd24a'), 'head', 0); }
    if (hat === 'nasal') { put(at(new THREE.ConeGeometry(0.19, 0.22, 8).translate(0, 0.11, 0), v(0, 1.46, 0)), lin('#8a9098'), 'head'); put(at(new THREE.BoxGeometry(0.025, 0.12, 0.03), v(0, 1.44, 0.18)), lin('#8a9098'), 'head', 0); }
    if (hat === 'kettle') { put(at(new THREE.SphereGeometry(0.19, 8, 4, 0, PI * 2, 0, PI / 2), v(0, 1.47, 0)), lin('#8a9098'), 'head'); put(seg(v(0, 1.47, 0), v(0, 1.49, 0), 0.3, 0.27, 10), lin('#7a8088'), 'head'); }
    if (hat === 'greathelm') {
      put(seg(v(0, 1.26, 0.01), v(0, 1.62, 0.01), 0.2, 0.2, 8), lin('#9aa0a8'), 'head');
      put(at(new THREE.BoxGeometry(0.22, 0.025, 0.02), v(0, 1.45, 0.205)), dark, 'head', 0);
      put(at(new THREE.BoxGeometry(0.03, 0.2, 0.02), v(0, 1.4, 0.205)), dark, 'head', 0);
      if (sp.plume) put(at(new THREE.ConeGeometry(0.06, 0.28, 5).rotateX(-0.5), v(0, 1.72, -0.05)), team, 'head');
    }
    // armas (encaixe da mão direita aponta para +z na pose de ligação)
    const R = P.handslotr, Lh = P.handslotl, wood = lin('#6a4a2e'), steel = lin('#c8ced6'), iron = lin('#5a5e66');
    const w = sp.weapon;
    const along = (z0, z1, r, col, dx, dy) => put(seg(v(R.x + (dx || 0), R.y + (dy || 0), R.z + z0), v(R.x + (dx || 0), R.y + (dy || 0), R.z + z1), r, r, 5), col, 'handslotr', 0.05);
    const boxR = (sx, sy, sz, x, y, z, col) => put(at(new THREE.BoxGeometry(sx, sy, sz), v(R.x + x, R.y + y, R.z + z)), col, 'handslotr', 0.05);
    if (w === 'axe1' || w === 'axe2') { const L = w === 'axe2' ? 1.1 : 0.75; along(-0.12, L, 0.025, wood); boxR(0.22, 0.04, 0.2, -0.1, 0, L - 0.1, steel); }
    if (w === 'hammer') { along(-0.1, 0.55, 0.022, wood); boxR(0.1, 0.1, 0.16, 0, 0, 0.55, iron); }
    if (w === 'pick') { along(-0.1, 0.65, 0.022, wood); boxR(0.4, 0.04, 0.05, 0, 0, 0.62, iron); }
    if (w === 'sickle') { along(-0.08, 0.2, 0.02, wood); put(at(new THREE.TorusGeometry(0.14, 0.015, 3, 8, PI), v(R.x - 0.14, R.y, R.z + 0.2)).rotateX(0), steel, 'handslotr', 0); }
    if (w === 'cleaver') { along(-0.08, 0.15, 0.022, wood); boxR(0.14, 0.02, 0.22, -0.05, 0, 0.26, steel); }
    if (w === 'sword') { along(-0.2, 0.05, 0.025, lin('#4a3020')); boxR(0.26, 0.04, 0.04, 0, 0, 0.06, iron); boxR(0.08, 0.02, 0.85, 0, 0, 0.5, steel); }
    if (w === 'spear' || w === 'pike') { const L = w === 'pike' ? 2.2 : 1.5; along(-0.5, L, 0.022, wood); put(at(new THREE.ConeGeometry(0.05, 0.22, 4).rotateX(PI / 2), v(R.x, R.y, R.z + L + 0.1)), steel, 'handslotr', 0); }
    if (w === 'bow') { put(at(new THREE.TorusGeometry(0.5, 0.02, 3, 10, PI * 0.8).rotateZ(PI * 0.1 + PI / 2), v(R.x + 0.3, R.y, R.z)), wood, 'handslotr', 0); put(seg(v(R.x - 0.02, R.y - 0.47, R.z), v(R.x - 0.02, R.y + 0.47, R.z), 0.006, 0.006, 3), lin('#e8e0c8'), 'handslotr', 0); }
    if (w === 'crossbow') { put(at(new THREE.BoxGeometry(0.75, 0.07, 0.07), v(R.x - 0.3, R.y, R.z)), wood, 'handslotr'); put(seg(v(R.x - 0.6, R.y - 0.4, R.z), v(R.x - 0.6, R.y + 0.4, R.z), 0.025, 0.025, 4), iron, 'handslotr', 0); }
    // escudo na mão esquerda (deitado na pose de ligação: normal para +y)
    if (sp.shield) {
      const kite = sp.shield === 'kite';
      const g = kite ? new THREE.CylinderGeometry(0.34, 0.2, 0.04, 6).scale(1, 1, 1.35) : new THREE.CylinderGeometry(0.36, 0.36, 0.04, 10);
      put(at(g, v(Lh.x, Lh.y + 0.14, Lh.z)), team, 'handslotl', 0.05);
      put(at(new THREE.CylinderGeometry(kite ? 0.1 : 0.09, kite ? 0.1 : 0.09, 0.05, 8), v(Lh.x, Lh.y + 0.16, Lh.z)), kite ? lin('#f0d060') : iron, 'handslotl', 0);
    }
    const geo = merge(parts);
    geo.computeBoundingSphere();
    return (charCache[key] = geo);
  };
  // animais (cavalo e porco): peças geradas a partir das posições dos ossos, então as proporções vêm do esqueleto
  const animalCache = {};
  // porco esculpido: corpo numa malha só (anéis ao longo do eixo), normais suaves, peso de ossos misturado
  // e pele com variação suave de cor; variant 0 rosado, 1 claro, 2 malhado
  function pigGeo(rig, variant) {
    const P = rig.P, v = variant % 3;
    const back = P.Hips || P.Back, hd = P.Head;
    const fwd = new THREE.Vector3().subVectors(hd, back).setZ(0).normalize(), up = new THREE.Vector3(0, 0, 1);
    const side = new THREE.Vector3().crossVectors(fwd, up);
    const L = Math.hypot(hd.x - back.x, hd.y - back.y);
    let g0 = Infinity; for (const k in P) if (/Foot/.test(k)) g0 = Math.min(g0, P[k].z); if (!isFinite(g0)) g0 = 0;
    // (d ao longo do corpo, s para o lado, z altura), em unidades de L, chão em z = 0
    const at = (d, s, z) => new THREE.Vector3(back.x, back.y, 0).addScaledVector(fwd, d * L).addScaledVector(side, s * L).addScaledVector(up, g0 + z * L);
    const loc = (p) => { const r = new THREE.Vector3(p.x - back.x, p.y - back.y, 0); return [r.dot(fwd) / L, r.dot(side) / L, (p.z - g0) / L]; };
    const bi = (n) => (rig.idx[n] != null ? rig.idx[n] : 0);
    // ossos da coluna ordenados ao longo do corpo, para misturar os pesos
    const spine = ['Back', 'Hips', 'Torso', 'Shoulders', 'Neck', 'Head'].filter((n) => P[n]).map((n) => [bi(n), loc(P[n])[0]]).sort((a, b) => a[1] - b[1]);
    const spineW = (d) => {
      if (d <= spine[0][1]) return [[spine[0][0], 1]];
      for (let i = 0; i < spine.length - 1; i++) {
        const [b0, d0] = spine[i], [b1, d1] = spine[i + 1];
        if (d <= d1) { let t = (d - d0) / Math.max(1e-6, d1 - d0); t = t * t * (3 - 2 * t); return [[b0, 1 - t], [b1, t]]; }
      }
      return [[spine[spine.length - 1][0], 1]];
    };
    const C = (h) => lin(h);
    const skin = C(['#e9a291', '#f2bcaa', '#eeb09e'][v]), belly = C(['#f3bfae', '#f8d2c4', '#f5c6b6'][v]), snoutC = C('#e0928c');
    const spotC = C('#4a3430'), dark = C('#1c1412'), hoofC = C('#4a3a32'), mudC = C('#8a6a50');
    const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    const nz = (x, y, z) => Math.sin(x * 1.9 + y * 0.7 + 1.3) * Math.sin(y * 2.3 - z * 1.3 + 0.4) * Math.sin(z * 1.7 + x * 1.1 + 2.1);
    const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    // pele: barriga mais clara, leve mancha de tom, sujeira de lama nas patas e manchas no malhado
    const skinAt = (d, s, z, low) => {
      let c = mix(skin, belly, low);
      const k = 1 + 0.06 * nz(d * 5, s * 5, z * 5);
      c = [c[0] * k, c[1] * k, c[2] * k];
      if (v === 2) c = mix(c, spotC, sstep(0.28, 0.5, nz(d * 2.4 + 0.5, Math.abs(s) * 2 + d * 0.5, z * 2.6)) * 0.92);
      return mix(c, mudC, sstep(0.16, 0.02, z) * 0.7);
    };
    const parts = [];
    // monta uma peça indexada (normais suaves): cor e pesos por vértice
    const part = (g, colFn, wFn) => {
      if (g.attributes.uv) g.deleteAttribute('uv');
      const pos = g.attributes.position, n = pos.count, c = new Float32Array(n * 3), si = new Uint16Array(n * 4), sw = new Float32Array(n * 4), p = new THREE.Vector3();
      for (let i = 0; i < n; i++) {
        p.fromBufferAttribute(pos, i);
        const l = loc(p), col = colFn(l, p), w = wFn(l);
        c.set(col, i * 3);
        for (let j = 0; j < w.length && j < 4; j++) { si[i * 4 + j] = w[j][0]; sw[i * 4 + j] = w[j][1]; }
      }
      g.setAttribute('color', new THREE.BufferAttribute(c, 3));
      g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
      g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
      g.computeVertexNormals();
      parts.push(g);
    };
    // perfil do corpo: [d, altura do centro, meia-largura, meia-altura]
    const K0 = [[-0.45, 0.58, 0.05, 0.05], [-0.4, 0.57, 0.2, 0.23], [-0.29, 0.57, 0.31, 0.33], [-0.1, 0.58, 0.36, 0.36], [0.2, 0.585, 0.37, 0.37],
      [0.48, 0.58, 0.35, 0.36], [0.68, 0.585, 0.29, 0.32], [0.86, 0.6, 0.235, 0.27], [1.0, 0.58, 0.185, 0.2], [1.12, 0.54, 0.125, 0.125], [1.22, 0.52, 0.1, 0.098], [1.27, 0.52, 0.112, 0.106]];
    const prof = [];
    for (let i = 0; i < K0.length - 1; i++) {
      const p0 = K0[Math.max(0, i - 1)], p1 = K0[i], p2 = K0[i + 1], p3 = K0[Math.min(K0.length - 1, i + 2)], S = 10;
      for (let k = 0; k < S; k++) {
        const t = k / S, t2 = t * t, t3 = t2 * t;
        prof.push(p1.map((_, j) => 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)));
      }
    }
    prof.push(K0[K0.length - 1]);
    const R = 40;
    // seção levemente achatada nos lados e barriga um pouco caída
    const ring = (q, th) => {
      const c = Math.cos(th), sn = Math.sin(th);
      const cs = Math.sign(c) * Math.pow(Math.abs(c), 0.85), ss = Math.sign(sn) * Math.pow(Math.abs(sn), 0.9);
      // papada sob a cabeça e pescoço
      const jowl = sn < 0 ? 1.06 + 0.12 * Math.exp(-((q[0] - 0.8) * (q[0] - 0.8)) / 0.012) : 1;
      return [q[0], cs * q[2], q[1] + ss * q[3] * jowl];
    };
    const surf = (d, th) => {
      let i = 0; while (i < prof.length - 2 && prof[i + 1][0] < d) i++;
      const a = prof[i], b = prof[i + 1], t = Math.min(1, Math.max(0, (d - a[0]) / Math.max(1e-6, b[0] - a[0])));
      const r = ring(a.map((x, j) => x + (b[j] - x) * t), th);
      return at(r[0], r[1], r[2]);
    };
    {
      const vs = [], idx = [];
      for (const q of prof) for (let j = 0; j < R; j++) { const r = ring(q, (j / R) * PI * 2); const p = at(r[0], r[1], r[2]); vs.push(p.x, p.y, p.z); }
      const nr = prof.length;
      for (let i = 0; i < nr - 1; i++) for (let j = 0; j < R; j++) {
        const a = i * R + j, b = i * R + ((j + 1) % R), c = a + R, e = b + R;
        idx.push(a, c, b, b, c, e);
      }
      // tampas: rabo (ponta arredondada) e disco do focinho
      const last = prof[nr - 1], tailP = at(prof[0][0] - 0.02, 0, prof[0][1]), noseP = at(last[0] + 0.015, 0, last[1]);
      const t0 = vs.length / 3; vs.push(tailP.x, tailP.y, tailP.z);
      const t1 = vs.length / 3; vs.push(noseP.x, noseP.y, noseP.z);
      for (let j = 0; j < R; j++) { const j1 = (j + 1) % R; idx.push(t0, j, j1); idx.push(t1, (nr - 1) * R + j1, (nr - 1) * R + j); }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(vs, 3));
      g.setIndex(idx);
      part(g, ([d, s, z]) => {
        const q = prof.find((x) => x[0] >= d) || last;
        const low = sstep(0.1, -0.7, (z - q[1]) / Math.max(0.05, q[3]));
        if (d > 1.1) return mix(skinAt(d, s, z, low), snoutC, sstep(1.1, 1.25, d));
        return skinAt(d, s, z, low);
      }, ([d]) => spineW(d));
    }
    // narinas, olhos
    const headW = spineW(5);
    for (const s of [-1, 1]) {
      const ns = at(K0[K0.length - 1][0] + 0.008, s * 0.042, K0[K0.length - 1][1] + 0.004);
      part(new THREE.SphereGeometry(0.024 * L, 10, 8).scale(0.6, 0.7, 1.25).translate(ns.x, ns.y, ns.z), () => C('#4a2222'), () => headW);
      const e = surf(0.94, s > 0 ? 0.55 : PI - 0.55), en = e.clone().sub(at(0.94, 0, 0.6)).normalize();
      const eye = e.clone().addScaledVector(en, -0.012 * L);
      part(new THREE.SphereGeometry(0.02 * L, 12, 10).translate(eye.x, eye.y, eye.z), () => C('#2a1812'), () => headW);
      const lid = e.clone().addScaledVector(en, -0.012 * L).addScaledVector(up, 0.012 * L);
      part(new THREE.SphereGeometry(0.026 * L, 12, 8, 0, PI * 2, 0, PI * 0.5).translate(lid.x, lid.y, lid.z), ([d, s2, z]) => skinAt(d, s2, z, 0), () => headW);
    }
    // orelhas: folha curva, levemente caída para a frente
    for (const s of [-1, 1]) {
      const g = new THREE.SphereGeometry(1, 14, 10, 0, PI * 2, 0, PI);
      const pos = g.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        let x = pos.getX(i) * 0.15, y = pos.getY(i), z = pos.getZ(i) * 0.035;
        y = (y + 1) * 0.13; // base em y = 0, ponta em y = 0.26
        x *= 1.15 - 0.8 * (y / 0.26) * (y / 0.26); // afina na ponta
        z -= 1.1 * y * y + 0.12 * x * x; // dobra para a frente e côncava
        pos.setXYZ(i, x * L, y * L, z * L);
      }
      const dir = new THREE.Vector3().addScaledVector(fwd, 0.55).addScaledVector(side, s * 0.6).addScaledVector(up, 0.6).normalize();
      const nrm = new THREE.Vector3().crossVectors(dir, side).multiplyScalar(-1).normalize();
      const xa = new THREE.Vector3().crossVectors(dir, nrm).normalize();
      g.applyMatrix4(new THREE.Matrix4().makeBasis(xa, dir, nrm));
      const base = surf(0.84, s > 0 ? 1.0 : PI - 1.0).addScaledVector(up, -0.02 * L);
      g.translate(base.x, base.y, base.z);
      part(g, () => C('#f7b8aa'), () => headW);
    }
    // rabinho enrolado
    {
      const pts = [];
      for (let i = 0; i <= 10; i++) { const a = i * 0.9, r = 0.05 * (1 - i * 0.04); pts.push(at(-0.44 - 0.012 * i - r * (1 - Math.cos(a)) * 0.6, r * Math.sin(a), 0.62 - r * (1 - Math.cos(a)) + 0.004 * i)); }
      part(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 32, 0.024 * L, 8), () => mix(skin, snoutC, 0.25), () => spineW(-1));
    }
    // tubo varrido por uma curva com raio variável (pernas)
    const sweep = (pts, rad, segs, radial) => {
      const curve = new THREE.CatmullRomCurve3(pts), fr = curve.computeFrenetFrames(segs, false), vs = [], idx = [];
      for (let i = 0; i <= segs; i++) {
        const t = i / segs, c = curve.getPointAt(t), N = fr.normals[i], B = fr.binormals[i], r = rad(t);
        for (let j = 0; j < radial; j++) { const a = (j / radial) * PI * 2, ca = Math.cos(a), sa = Math.sin(a); vs.push(c.x + (ca * N.x + sa * B.x) * r, c.y + (ca * N.y + sa * B.y) * r, c.z + (ca * N.z + sa * B.z) * r); }
      }
      // ordem dos triângulos conforme o sentido do quadro de Frenet, para a face ficar para fora
      const c0 = curve.getPointAt(0), v0 = new THREE.Vector3(vs[0], vs[1], vs[2]), v1 = new THREE.Vector3(vs[3], vs[4], vs[5]), v2 = new THREE.Vector3(vs[radial * 3], vs[radial * 3 + 1], vs[radial * 3 + 2]);
      const out = new THREE.Vector3().subVectors(v1, v0).cross(new THREE.Vector3().subVectors(v2, v0)).dot(v0.clone().sub(c0)) > 0;
      for (let i = 0; i < segs; i++) for (let j = 0; j < radial; j++) {
        const a = i * radial + j, b = i * radial + ((j + 1) % radial);
        if (out) idx.push(a, b, a + radial, b, b + radial, a + radial); else idx.push(a, a + radial, b, b, a + radial, b + radial);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(vs, 3)); g.setIndex(idx);
      return g;
    };
    // pernas com articulações (cotovelo/joelho, jarrete, quartela) e casco fendido de duas unhas
    for (const [a, lo, f] of [['FrontUpLegL', 'FrontLowLegL', 'FrontFootL'], ['FrontUpLegR', 'FrontLowLegR', 'FrontFootR'], ['BackUpLegL', 'BackLowLegL', 'BackFootL'], ['BackUpLegR', 'BackLowLegR', 'BackFootR']]) {
      if (!P[a] || !P[f]) continue;
      const top = loc(P[a]), ft = loc(P[f]), hind = /Back/.test(a);
      const d = (top[0] + ft[0]) / 2, s = ((top[1] + ft[1]) / 2) * 0.72;
      // trajeto (d, z) e raio de cada ponto: dianteira quase reta, traseira com pernil e jarrete para trás
      const path = hind
        ? [[0.04, 0.58, 0.12], [0.0, 0.4, 0.14], [-0.05, 0.27, 0.095], [-0.07, 0.19, 0.06], [-0.03, 0.1, 0.05], [0.0, 0.045, 0.048]]
        : [[0.0, 0.58, 0.1], [0.02, 0.38, 0.1], [0.01, 0.26, 0.07], [0.0, 0.18, 0.055], [0.01, 0.1, 0.048], [0.03, 0.045, 0.047]];
      const pts = path.map(([dd, z]) => at(d + dd, s, z)), rs = path.map((q) => q[2]);
      const g = sweep(pts, (t) => { const x = t * (rs.length - 1), i = Math.min(rs.length - 2, Math.floor(x)), u = x - i; return (rs[i] + (rs[i + 1] - rs[i]) * u * u * (3 - 2 * u)) * L; }, 40, 16);
      const wb = [[bi(a), 1]], wl = [[bi(lo), 1]];
      part(g, ([d2, s2, z]) => skinAt(d2, s2, z, 0.35 + 0.35 * sstep(0.4, 0.2, z)), ([, , z]) => (z > 0.36 ? wb : z > 0.26 ? [[bi(a), (z - 0.26) / 0.1], [bi(lo), 1 - (z - 0.26) / 0.1]] : wl));
      // duas unhas: meias-gotas achatadas embaixo, levemente abertas na ponta
      const hd2 = d + path[path.length - 1][0];
      for (const k of [-1, 1]) {
        const h = new THREE.SphereGeometry(1, 14, 10);
        const hp = h.attributes.position;
        for (let i = 0; i < hp.count; i++) {
          let x = hp.getX(i), y = hp.getY(i), z = hp.getZ(i);
          const tip = Math.max(0, y); // ponta para a frente (y local = frente)
          x = x * 0.024 * (1 - 0.45 * tip) + k * 0.004 * tip; y = y * 0.05; z = Math.max(-0.2, z) * 0.045 * (1 - 0.4 * tip);
          hp.setXYZ(i, x, y, z);
        }
        h.applyMatrix4(new THREE.Matrix4().makeBasis(side, fwd, up)).scale(L, L, L);
        const c = at(hd2 + 0.012, s + k * 0.024, 0.01);
        h.translate(c.x, c.y, c.z);
        part(h, ([, , z]) => mix(hoofC, C('#6a564a'), sstep(0.0, 0.06, z)), () => wl);
      }
    }
    const geo = merge(parts);
    geo.computeBoundingSphere();
    return geo;
  }
  A.animal = function (kind, rig, owner) {
    const key = kind + ':' + (owner == null ? '-' : owner);
    if (animalCache[key]) return animalCache[key];
    if (kind === 'pig') return (animalCache[key] = pigGeo(rig, owner == null ? 0 : owner));
    const P = rig.P, parts = [];
    const put = (g, col, bone, jitter) => {
      g = g.index ? g.toNonIndexed() : g;
      if (g.attributes.uv) g.deleteAttribute('uv');
      const n = g.attributes.position.count, c = new Float32Array(n * 3), si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
      const bi = rig.idx[bone] != null ? rig.idx[bone] : 0;
      for (let i = 0; i < n; i += 3) { const k = 1 + (H(i, bi, 73) - 0.5) * (jitter == null ? 0.12 : jitter); for (let j = 0; j < 3; j++) { c[(i + j) * 3] = col[0] * k; c[(i + j) * 3 + 1] = col[1] * k; c[(i + j) * 3 + 2] = col[2] * k; } }
      for (let i = 0; i < n; i++) { si[i * 4] = bi; sw[i * 4] = 1; }
      g.setAttribute('color', new THREE.BufferAttribute(c, 3));
      g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
      g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
      g.computeVertexNormals();
      parts.push(g);
    };
    const seg = (a, b, r0, r1, sides) => {
      const d = new THREE.Vector3().subVectors(b, a), L = Math.max(1e-6, d.length());
      const g = new THREE.CylinderGeometry(r1, r0, L, sides || 6).translate(0, L / 2, 0);
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
      return g.translate(a.x, a.y, a.z);
    };
    const ball = (p, r, sx, sy, sz) => new THREE.IcosahedronGeometry(r, 1).scale(sx || 1, sy || 1, sz || 1).translate(p.x, p.y, p.z);
    const mid = (a, b, t) => new THREE.Vector3().lerpVectors(a, b, t == null ? 0.5 : t);
    const add = (a, b, s) => new THREE.Vector3().copy(a).addScaledVector(b, s);
    if (kind === 'horse') {
      const coat = lin(['#7a4a2a', '#5a3a22', '#d8d0c0', '#3a2a1e'][(owner == null ? 0 : owner) % 4]), dark = lin('#2a1c14'), hoof = lin('#1e1812');
      const fwd = new THREE.Vector3().subVectors(P.Head, P.Back).setZ(0).normalize(), up = new THREE.Vector3(0, 0, 1);
      const L = P.Head.distanceTo(P.Back);
      const rear = add(P.Back, fwd, -0.12 * L), front = mid(P.Torso3, P.Neck1, 0.3);
      put(ball(mid(rear, P.Torso, 0.5), 0.16 * L, 1, 1.25, 1), coat, 'Back');
      put(seg(rear, P.Torso2, 0.16 * L, 0.17 * L, 8), coat, 'Back');
      put(seg(P.Torso2, front, 0.17 * L, 0.16 * L, 8), coat, 'Torso2');
      put(ball(front, 0.16 * L, 1, 1, 1.05), coat, 'Torso3');
      put(seg(P.Neck1, P.Head, 0.12 * L, 0.08 * L, 7), coat, 'Neck2');
      const nose = add(add(P.Head, fwd, 0.22 * L), up, -0.1 * L);
      put(seg(add(P.Head, up, 0.02 * L), nose, 0.085 * L, 0.06 * L, 7), coat, 'Head');
      put(seg(add(nose, fwd, -0.02 * L), add(nose, fwd, 0.02 * L), 0.065 * L, 0.06 * L, 7), dark, 'Head', 0.05);
      for (const s of ['L', 'R']) if (P['Ear4' + s]) put(seg(P['Ear1' + s], P['Ear4' + s], 0.025 * L, 0.004 * L, 4), coat, 'Head');
      // crina e cauda
      put(seg(add(P.Neck1, up, 0.1 * L), add(P.Head, up, 0.08 * L), 0.035 * L, 0.03 * L, 4), dark, 'Neck2');
      if (P.Tail1 && P.Tail7) put(seg(P.Tail1, P.Tail7, 0.05 * L, 0.02 * L, 5), dark, 'Tail3');
      // pernas
      for (const [up1, lo, foot] of [['FrontUpperLegL', 'FrontLowerLegL', 'IKFrontLegL'], ['FrontUpperLegR', 'FrontLowerLegR', 'IKFrontLegR'], ['BackUpperLegL', 'BackLowerLegL', 'IKBackLegL'], ['BackUpperLegR', 'BackLowerLegR', 'IKBackLegR']]) {
        if (!P[up1] || !P[lo]) continue;
        const f = P[foot] || new THREE.Vector3(P[lo].x, P[lo].y, 0);
        put(seg(add(P[up1], up, 0.06 * L), P[lo], 0.075 * L, 0.05 * L), coat, up1);
        put(seg(P[lo], add(f, up, 0.04 * L), 0.04 * L, 0.035 * L), coat, lo);
        put(seg(f, add(f, up, 0.045 * L), 0.045 * L, 0.04 * L, 6), hoof, lo, 0.05);
      }
      // manta (cavalo de guerra) na cor do reino e sela
      if (owner != null) {
        const team = lin(KM.COLORS[owner] || '#888888');
        put(seg(add(rear, up, -0.03 * L), add(front, up, -0.03 * L), 0.19 * L, 0.19 * L, 8), team, 'Torso2');
        put(ball(add(mid(P.Back, P.Torso2), up, 0.2 * L), 0.09 * L, 1.6, 1.3, 0.6), lin('#5a3a22'), 'Torso2');
      }
    } else {
      // porco (owner = variação de pelagem: 0 rosado, 1 claro, 2 malhado)
      const v = (owner == null ? 0 : owner) % 3;
      const pink = lin(['#eeaa9e', '#f4c4b2', '#f0b8a6'][v]), snout = lin('#d98a88'), dark = lin('#3a2422'), hoof = lin('#4a3430'), spot = lin('#5e4034');
      const hd = P.Head, back = P.Hips || P.Back, sh = P.Shoulders || P.Torso || P.Body;
      const L = hd.distanceTo(back);
      const fwd = new THREE.Vector3().subVectors(hd, back).setZ(0).normalize(), up = new THREE.Vector3(0, 0, 1);
      const side = new THREE.Vector3().crossVectors(fwd, up);
      const toFwd = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), fwd);
      // elipsoide alinhado ao porco: a = meia-largura, l = meio-comprimento, h = meia-altura
      const ell = (p, a, l, h, det) => new THREE.IcosahedronGeometry(1, det == null ? 2 : det).scale(a, l, h).applyQuaternion(toFwd).translate(p.x, p.y, p.z);
      // corpo oval, um pouco mais baixo que o esqueleto para as pernas ficarem curtas
      const mid0 = add(mid(back, sh), up, -0.06 * L);
      put(ell(mid0, 0.32 * L, 0.58 * L, 0.31 * L), pink, 'Torso', 0.05);
      put(ell(add(add(back, fwd, -0.06 * L), up, -0.05 * L), 0.3 * L, 0.26 * L, 0.29 * L), pink, back === P.Hips ? 'Hips' : 'Torso', 0.05);
      // cabeça, focinho com narinas, olhos e orelhas caídas
      const hc = add(add(hd, fwd, 0.04 * L), up, -0.06 * L);
      put(ell(hc, 0.22 * L, 0.22 * L, 0.2 * L), pink, 'Head', 0.04);
      const sn = add(add(hc, fwd, 0.19 * L), up, -0.04 * L);
      put(seg(add(sn, fwd, -0.06 * L), add(sn, fwd, 0.06 * L), 0.09 * L, 0.1 * L, 10), snout, 'Head', 0.03);
      for (const s of [-1, 1]) {
        put(ball(add(add(add(sn, fwd, 0.065 * L), side, s * 0.04 * L), up, 0.005 * L), 0.022 * L), dark, 'Head', 0);
        put(ball(add(add(add(hc, fwd, 0.15 * L), side, s * 0.11 * L), up, 0.07 * L), 0.028 * L), dark, 'Head', 0);
        const ear = new THREE.ConeGeometry(0.075 * L, 0.17 * L, 4).scale(1, 1, 0.45).translate(0, 0.085 * L, 0);
        const dir = new THREE.Vector3().addScaledVector(fwd, 0.75).addScaledVector(side, s * 0.45).addScaledVector(up, 0.2).normalize();
        ear.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir));
        const eb = add(add(add(hc, side, s * 0.12 * L), up, 0.15 * L), fwd, -0.02 * L);
        put(ear.translate(eb.x, eb.y, eb.z), snout, 'Head', 0.04);
      }
      // rabinho enrolado
      const tail = new THREE.TorusGeometry(0.05 * L, 0.014 * L, 4, 8, PI * 1.6).rotateY(PI / 2).applyQuaternion(toFwd);
      const tb = add(add(back, fwd, -0.3 * L), up, 0.04 * L);
      put(tail.translate(tb.x, tb.y, tb.z), snout, back === P.Hips ? 'Hips' : 'Torso', 0.03);
      // manchas do porco malhado
      if (v === 2) for (const [f, s, u, r] of [[0.15, 1, 0.12, 0.13], [-0.25, -1, 0.15, 0.11], [0.35, -1, 0.05, 0.08]]) {
        const c = add(add(add(mid0, fwd, f * L), side, s * 0.2 * L), up, u * L);
        put(ell(c, r * L, r * 1.3 * L, r * 0.9 * L, 1), spot, 'Torso', 0.05);
      }
      // perninhas curtas com casco escuro
      for (const [a, b] of [['FrontUpLegL', 'FrontFootL'], ['FrontUpLegR', 'FrontFootR'], ['BackUpLegL', 'BackFootL'], ['BackUpLegR', 'BackFootR']]) {
        if (!P[a] || !P[b]) continue;
        const f = P[b], bone = a.replace('Up', 'Low');
        put(seg(add(P[a], up, -0.05 * L), add(f, up, 0.06 * L), 0.085 * L, 0.07 * L, 7), pink, bone, 0.05);
        put(seg(f, add(f, up, 0.06 * L), 0.075 * L, 0.07 * L, 7), hoof, bone, 0.03);
      }
    }
    const geo = merge(parts);
    geo.computeBoundingSphere();
    return (animalCache[key] = geo);
  };
  A.charMat = function () {
    if (!A._charMat) A._charMat = toon({ vertexColors: true });
    return A._charMat;
  };
  // porco usa sombreamento contínuo (pele lisa); os outros animais seguem o pintado
  A.animalMat = function (kind) {
    if (kind !== 'pig') return A.charMat();
    if (!A._pigMat) A._pigMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0, emissive: new THREE.Color('#4a2018'), emissiveIntensity: 0.32 });
    return A._pigMat;
  };
  // mastro com estandarte (marca das bases no editor)
  const poleCache = {};
  A.flagPole = function (o) {
    if (!poleCache[o]) { const b = new Bag(); K.box(b, 'stone', 0.34, 0.12, 0.34, 0, 0, 0); K.banner(b, o, 0, 0.12, 0, 1.3, true); poleCache[o] = b.build(); }
    return poleCache[o].clone(true);
  };
  // sela do cavalo realista, em metros (frente = +z, origem no assento): manta na cor do reino com barra dourada,
  // sela de couro com arção e patilha, loros e estribos; sem dono, manta de lã crua
  const saddleCache = {};
  A.saddle = function (owner) {
    const k = owner == null ? '-' : owner;
    if (!saddleCache[k]) {
      const g = new THREE.Group(), std = (c, r, side) => new THREE.MeshStandardMaterial({ color: c, roughness: r, side: side || THREE.FrontSide });
      const cloth = std(owner == null ? '#6b5a44' : KM.COLORS[owner] || '#888888', 0.85, THREE.DoubleSide), trim = std(owner == null ? '#4a3c2c' : '#d8b24a', 0.5, THREE.DoubleSide);
      const leather = std('#5a3820', 0.55), dark = std('#2e2018', 0.6), iron = new THREE.MeshStandardMaterial({ color: '#8a8e94', roughness: 0.35, metalness: 0.8 });
      const add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; };
      // manta: arco sobre o dorso (eixo ao longo do cavalo), com barra na borda de baixo
      const R = 0.3, arc = 3.3, len = 0.72;
      add(new THREE.CylinderGeometry(R, R, len, 24, 1, true, PI - arc / 2, arc).rotateX(PI / 2), cloth, 0, -R + 0.01, -0.02);
      for (const sg of [-1, 1]) {
        const a = PI + sg * arc / 2, x = Math.sin(a) * (R + 0.003), y = -Math.cos(a) * (R + 0.003);
        add(new THREE.BoxGeometry(0.012, 0.05, len), trim, x, -R + 0.01 + y + 0.02, -0.02).rotation.z = -sg * 0.05;
      }
      // sela: assento, arção (frente) e patilha (trás)
      add(new THREE.SphereGeometry(1, 20, 12).scale(0.17, 0.05, 0.26), leather, 0, 0.02, 0);
      add(new THREE.BoxGeometry(0.24, 0.1, 0.05), leather, 0, 0.06, 0.2).rotation.x = -0.25;
      add(new THREE.BoxGeometry(0.28, 0.12, 0.05), leather, 0, 0.07, -0.21).rotation.x = 0.3;
      // loros e estribos
      for (const sg of [-1, 1]) {
        add(new THREE.BoxGeometry(0.012, 0.42, 0.035), dark, sg * 0.24, -0.22, 0.02).rotation.z = sg * 0.12;
        add(new THREE.TorusGeometry(0.04, 0.008, 6, 12), iron, sg * 0.27, -0.45, 0.02).rotation.y = PI / 2;
      }
      saddleCache[k] = g;
    }
    return saddleCache[k].clone(true);
  };
  // itens carregados nas costas/mãos (troncos, pedra, sacos, caixotes)
  const carryCache = {};
  A.carry = function (k) {
    if (!carryCache[k]) {
      const b = new Bag();
      if (k === 'logs') { for (let i = 0; i < 3; i++) b.put('logs', cylG(0.05, 0.05, 0.42, 7).rotateZ(PI / 2).translate(0, 0.05 + (i === 2 ? 0.08 : 0), (i === 2 ? 0 : i - 0.5) * 0.1), 0, 0, 0); }
      else if (k === 'planks') { for (let i = 0; i < 3; i++) K.box(b, 'planks', 0.45, 0.03, 0.12, 0, i * 0.035, 0); }
      else if (k === 'stone') K.box(b, 'stone', 0.2, 0.15, 0.16, 0, 0, 0);
      else if (k === 'sack') K.sack(b, 0, 0, 1.2);
      else K.crate(b, 0, 0, 1);
      carryCache[k] = b.build();
      carryCache[k].traverse((o) => { if (o.isMesh) o.castShadow = false; });
    }
    return carryCache[k].clone(true);
  };

  // ================= natureza (geometrias com cor por vértice, para instanciar) =================
  function colorize(g, fn) {
    g = g.index ? g.toNonIndexed() : g;
    g.deleteAttribute('uv');
    const p = g.attributes.position, n = p.count, col = new Float32Array(n * 3);
    for (let i = 0; i < n; i += 3) {
      const c = fn(p.getX(i), p.getY(i), p.getZ(i), i / 3);
      for (let k = 0; k < 3; k++) { col[(i + k) * 3] = c[0]; col[(i + k) * 3 + 1] = c[1]; col[(i + k) * 3 + 2] = c[2]; }
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    return g;
  }
  const lin = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
  const jit = (c, j, s) => c.map((v) => Math.max(0, v * (1 + (H(s, 1, 9) - 0.5) * j)));
  function lumpy(g, amt, seed) {
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = 1 + (H(Math.round(x * 97) + seed, Math.round(y * 97), Math.round(z * 97)) - 0.5) * amt;
      p.setXYZ(i, x * k, y * k, z * k);
    }
    return g;
  }
  function merge(list) { return THREE.BufferGeometryUtils.mergeGeometries(list, false); }
  A.nature = {};
  A.buildNature = function () {
    const N = A.nature;
    const bark = lin('#5e4028'), leafA = lin('#41772f'), leafB = lin('#33652c'), leafC = lin('#5a8a3a'), pine = lin('#2a5c36'), pine2 = lin('#376c3e');
    const trunk = (h, r) => colorize(new THREE.CylinderGeometry(r * 0.7, r, h, 6).translate(0, h / 2, 0), (x, y, z, f) => jit(bark, 0.3, f));
    // carvalho: copa de bolhas facetadas
    const oak = (seed, blobs, h) => {
      const parts = [trunk(h, 0.07)];
      for (let i = 0; i < blobs.length; i++) {
        const [bx, by, bz, r] = blobs[i];
        const g = lumpy(new THREE.IcosahedronGeometry(r, 1), 0.28, seed + i).translate(bx, by, bz);
        parts.push(colorize(g, (x, y, z, f) => { const base = y > by + r * 0.3 ? leafC : (H(f, seed, i) < 0.5 ? leafA : leafB); return jit(base, 0.25, f * 7 + seed); }));
      }
      return merge(parts);
    };
    N.treeA = oak(1, [[0, 0.72, 0, 0.36], [0.2, 0.62, 0.1, 0.26], [-0.18, 0.66, -0.08, 0.27], [0.02, 0.98, 0.02, 0.24]], 0.55);
    N.treeB = oak(2, [[0, 0.82, 0, 0.3], [0.05, 1.08, -0.03, 0.22], [-0.12, 0.62, 0.08, 0.22]], 0.62);
    // pinheiro: cones empilhados
    const conif = (seed) => {
      const parts = [trunk(0.3, 0.06)];
      [[0.4, 0.5, 0.25], [0.32, 0.42, 0.55], [0.22, 0.36, 0.82]].forEach(([r, h, y], i) => {
        const g = lumpy(new THREE.ConeGeometry(r, h, 7, 1), 0.2, seed + i).translate(0, y + h / 2, 0);
        parts.push(colorize(g, (x, yy, z, f) => jit(i % 2 ? pine : pine2, 0.25, f * 3 + seed)));
      });
      return merge(parts);
    };
    N.treeC = conif(3);
    // toco
    N.stump = merge([trunk(0.12, 0.08)]);
    // rochas
    const rockC = lin('#8f8a80'), rockD = lin('#6f6a62'), moss = lin('#6d8a45');
    const rock = (seed, sx, sy) => colorize(lumpy(new THREE.IcosahedronGeometry(0.13, 1), 0.45, seed).scale(sx, sy, 1).translate(0, 0.13 * sy * 0.55, 0), (x, y, z, f) => (y > 0.1 * sy && H(f, seed, 5) < 0.35 ? jit(moss, 0.3, f) : jit(H(f, seed, 6) < 0.5 ? rockC : rockD, 0.2, f + seed)));
    N.rockA = rock(11, 1.2, 0.8); N.rockB = rock(12, 1, 1); N.rockC = rock(13, 1.4, 0.6); N.rockD = rock(14, 0.9, 1.2); N.rockE = rock(15, 1.1, 0.7);
    // rochas com minério
    const oreRock = (seed, col) => {
      const base = rock(seed, 1.2, 0.9);
      const parts = [base];
      for (let i = 0; i < 4; i++) {
        const a = H(i, seed, 1) * 6.28, r = 0.1;
        const g = new THREE.OctahedronGeometry(0.035 + H(i, seed, 2) * 0.03, 0).scale(1, 1.6, 1).translate(Math.cos(a) * r, 0.1 + H(i, seed, 3) * 0.05, Math.sin(a) * r * 0.8);
        parts.push(colorize(g, (x, y, z, f) => jit(col, 0.2, f + i)));
      }
      return merge(parts);
    };
    N.ore1 = oreRock(21, lin('#1c1a20')); N.ore2 = oreRock(22, lin('#c0582a')); N.ore3 = oreRock(23, lin('#ffcf3a'));
    // picos de montanha
    const peak = (seed) => {
      const g = new THREE.ConeGeometry(0.5, 1.3, 7, 3);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const k = 1 + (H(Math.round(x * 97) + seed, Math.round(y * 97), Math.round(z * 97)) - 0.5) * 0.5; p.setXYZ(i, x * k, y + (H(i, seed, 3) - 0.5) * 0.08, z * k); }
      g.translate(0, 0.65, 0);
      const light = lin('#a8a196'), dark = lin('#6d675e'), snow = lin('#f1efe8');
      return colorize(g, (x, y, z, f) => (y > 1.02 ? jit(snow, 0.05, f) : jit(y > 0.6 ? light : dark, 0.2, f + seed)));
    };
    N.mountain_A = peak(31); N.mountain_B = peak(32); N.mountain_C = peak(33);
    // trigo (tufo de espigas)
    const wheat = (col, col2) => {
      const parts = [];
      for (let i = 0; i < 20; i++) {
        const x = (H(i, 1, 41) - 0.5) * 0.85, z = (H(i, 2, 41) - 0.5) * 0.85, h = 0.26 + H(i, 3, 41) * 0.1;
        parts.push(colorize(new THREE.ConeGeometry(0.035, h, 4).translate(x, h / 2, z), (xx, y, zz, f) => jit(y > h * 0.55 ? col2 : col, 0.2, f + i)));
      }
      return merge(parts);
    };
    // touceiras de capim e flores do campo (mesmo estilo facetado)
    const tuft = (seed, flowers) => {
      const parts = [], g1 = lin('#5f9a3c'), g2 = lin('#7fb24a');
      for (let i = 0; i < 6; i++) {
        const a = H(i, seed, 1) * 6.28, r = H(i, seed, 2) * 0.09, h = 0.1 + H(i, seed, 3) * 0.1;
        const g = new THREE.ConeGeometry(0.028, h, 3).translate(0, h / 2, 0).rotateZ((H(i, seed, 4) - 0.5) * 0.5).translate(Math.cos(a) * r, 0, Math.sin(a) * r);
        parts.push(colorize(g, (x, y, z, f) => jit(y > h * 0.5 ? g2 : g1, 0.2, f + i + seed)));
      }
      if (flowers) {
        const pal = ['#f4f1e6', '#f2c94c', '#e76f8a', '#9b8cf2'].map(lin);
        for (let i = 0; i < 3; i++) {
          const a = H(i, seed, 5) * 6.28, r = 0.03 + H(i, seed, 6) * 0.07;
          const g = new THREE.OctahedronGeometry(0.025, 0).translate(Math.cos(a) * r, 0.16 + H(i, seed, 7) * 0.05, Math.sin(a) * r);
          const c = pal[Math.floor(H(i, seed, 8) * pal.length)];
          parts.push(colorize(g, () => c));
        }
      }
      return merge(parts);
    };
    // arbusto baixo (decoração do campo)
    const bush = (seed) => {
      const parts = [];
      for (let i = 0; i < 4; i++) {
        const a = H(i, seed, 1) * 6.28, r = 0.08 + H(i, seed, 2) * 0.08, s = 0.12 + H(i, seed, 3) * 0.08;
        const g = lumpy(new THREE.IcosahedronGeometry(s, 0), 0.3, seed + i).scale(1, 0.8, 1).translate(Math.cos(a) * r, s * 0.7, Math.sin(a) * r);
        parts.push(colorize(g, (x, y, z, f) => jit(y > s ? leafC : H(f, seed, i) < 0.5 ? leafA : leafB, 0.25, f + seed * 3)));
      }
      if (H(seed, 1, 1) < 0.5) for (let i = 0; i < 4; i++) parts.push(colorize(new THREE.OctahedronGeometry(0.022, 0).translate((H(i, seed, 8) - 0.5) * 0.25, 0.2 + H(i, seed, 9) * 0.06, (H(i, seed, 10) - 0.5) * 0.25), () => lin(seed % 2 ? '#e0405a' : '#f4e9c8')));
      return merge(parts);
    };
    N.bush = bush(61); N.bush2 = bush(62);
    N.tuft = tuft(51, false);
    N.flower = tuft(52, true);
    N.grain = wheat(lin('#c99a3a'), lin('#e8c160'));
    N.grainG = wheat(lin('#5f9a3a'), lin('#8fc45a'));
  };
})(window.KM);
