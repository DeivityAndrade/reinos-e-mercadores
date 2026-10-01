'use strict';
/* Motor 3D (Three.js) — mundo 2.5D estilizado com modelos CC0 (KayKit, Quaternius).
   Substitui o render 2D mantendo a mesma interface KM.R usada pelo resto do jogo.
   Coordenadas: 1 ladrilho = 1 unidade; x do jogo -> X, y do jogo -> Z, altura -> Y. */
(function (KM) {
  const HY = 0.32;      // altura do relevo por unidade de altura do mapa
  const WL = 0.05;      // nível da água
  const BED = -0.42;    // fundo dos lagos
  const COLORS = ['blue', 'red', 'green', 'yellow'];
  const AS = 'assets/kaykit/medieval/';
  let THREE = null;

  KM.shade = function (a, f) {
    const c = [parseInt(a.slice(1, 3), 16), parseInt(a.slice(3, 5), 16), parseInt(a.slice(5, 7), 16)], t = Math.abs(f), to = f > 0 ? 255 : 0;
    return `rgb(${Math.round(c[0] + (to - c[0]) * t)},${Math.round(c[1] + (to - c[1]) * t)},${Math.round(c[2] + (to - c[2]) * t)})`;
  };
  KM.icon = (ch, size) => (KM.pixIcon ? KM.pixIcon(ch, size) : null);

  // ---------------- tabelas visuais ----------------

  // personagem de cada unidade: modelo base + peças visíveis
  const CHAR = {
    serf: { m: 'Rogue_Hooded', show: [] },
    laborer: { m: 'Barbarian', show: ['1H_Axe'], hide: ['Barbarian_Hat'] },
    woodcutter: { m: 'Barbarian', show: ['2H_Axe'] },
    stonemason: { m: 'Barbarian', show: ['1H_Axe'], hide: ['Barbarian_Hat'] },
    farmer: { m: 'Rogue', show: ['Knife'] },
    carpenter: { m: 'Rogue', show: [] },
    miner: { m: 'Barbarian', show: ['1H_Axe'], hide: ['Barbarian_Hat'] },
    breeder: { m: 'Rogue', show: [] },
    fisher: { m: 'Rogue_Hooded', show: [] },
    metallurgist: { m: 'Barbarian', show: [], hide: ['Barbarian_Hat'] },
    smith: { m: 'Barbarian', show: [] },
    baker: { m: 'Rogue', show: [] },
    butcher: { m: 'Rogue', show: ['Knife'] },
    recruit: { m: 'Knight', show: [], hide: ['Knight_Helmet'] },
    militia: { m: 'Barbarian', show: ['1H_Axe'] },
    axeman: { m: 'Barbarian', show: ['1H_Axe', 'Barbarian_Round_Shield'] },
    swordsman: { m: 'Knight', show: ['1H_Sword', 'Badge_Shield', 'Knight_Helmet'] },
    bowman: { m: 'Rogue', show: ['1H_Crossbow'] },
    crossbowman: { m: 'Rogue_Hooded', show: ['2H_Crossbow'] },
    lancer: { m: 'Barbarian', show: ['Barbarian_Round_Shield'], spear: 1.25 },
    pikeman: { m: 'Knight', show: ['Knight_Helmet'], spear: 1.8 },
    scout: { m: 'Barbarian', show: ['1H_Axe'], horse: true },
    knight: { m: 'Knight', show: ['1H_Sword', 'Rectangle_Shield', 'Knight_Helmet'], horse: true },
  };
  const OPTIONAL = ['1H_Axe_Offhand', 'Barbarian_Round_Shield', '1H_Axe', '2H_Axe', 'Mug', '1H_Sword_Offhand', 'Badge_Shield', 'Rectangle_Shield', 'Round_Shield', 'Spike_Shield', '1H_Sword', '2H_Sword', 'Knight_Helmet', 'Knife_Offhand', '1H_Crossbow', '2H_Crossbow', 'Knife', 'Throwable'];
  const CARRY = { trunk: 'resource_lumber', wood: 'resource_lumber', stone: 'resource_stone', corn: 'sack', flour: 'sack', bread: 'sack', skin: 'sack', leather: 'sack' };

  const R = KM.R = {
    ready: false, progress: 0, S: null, showGrid: false, sprites: {}, vis: { x0: 0, x1: 0, y0: 0, y1: 0 },
    focus: { x: 40, y: 40 }, dist: 20, yaw: 0, pitch: 0.9, time: 0,
    gltf: {}, proto: {},

    // ================= inicialização =================
    init(canvas) {
      this.cv = canvas;
      this.ov = document.createElement('canvas');
      this.ov.id = 'overlay';
      canvas.after(this.ov);
      this.og = this.ov.getContext('2d');
      window.addEventListener('resize', () => this.resize());
      const boot = () => { THREE = window.THREE; this.setup(); this.resize(); this.loadAll(); };
      if (window.THREE) boot(); else window.addEventListener('three-ready', boot, { once: true });
    },
    setup() {
      const r = this.renderer = new THREE.WebGLRenderer({ canvas: this.cv, antialias: true, powerPreference: 'high-performance' });
      r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      r.outputColorSpace = THREE.SRGBColorSpace;
      r.toneMapping = THREE.ACESFilmicToneMapping;
      r.toneMappingExposure = 1.0;
      r.shadowMap.enabled = this.gfx !== 'low';
      r.shadowMap.type = THREE.PCFShadowMap;
      const sc = this.scene = new THREE.Scene();
      const sky = new THREE.Color('#86bfe3');
      sc.background = sky;
      sc.fog = new THREE.Fog(sky, 40, 110);
      this.camera = new THREE.PerspectiveCamera(34, 1, 0.5, 400);
      const hemi = new THREE.HemisphereLight('#d6e4ff', '#6a5c44', 1.35);
      sc.add(hemi);
      const sun = this.sun = new THREE.DirectionalLight('#ffe7c2', 2.1);
      sun.castShadow = true;
      sun.shadow.mapSize.set(this.gfx === 'high' ? 2048 : 1024, this.gfx === 'high' ? 2048 : 1024);
      const sh = sun.shadow.camera;
      sh.left = -26; sh.right = 26; sh.top = 26; sh.bottom = -26; sh.near = 1; sh.far = 120;
      sun.shadow.bias = -0.0004;
      sun.shadow.normalBias = 0.03;
      sc.add(sun); sc.add(sun.target);
      this.world = new THREE.Group(); sc.add(this.world);
      this.loader = new THREE.GLTFLoader();
      this.ray = new THREE.Raycaster();
    },
    // ================= pós-processamento: "mapa ilustrado" =================
    // contorno a tinta (profundidade + cor), gradação quente, hachuras nas sombras, grão de papel e vinheta
    setupPost() {
      const r = this.renderer, size = r.getDrawingBufferSize(new THREE.Vector2());
      const rt = this.rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 });
      rt.depthTexture = new THREE.DepthTexture(size.x, size.y);
      this.postMat = new THREE.ShaderMaterial({
        uniforms: {
          tColor: { value: rt.texture }, tDepth: { value: rt.depthTexture }, tPaper: { value: KM.ART.paperTex },
          uRes: { value: size.clone() }, uNear: { value: this.camera.near }, uFar: { value: this.camera.far }, uPx: { value: 1 },
          uInk: { value: 1 }, uHatch: { value: 1 },
        },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
        fragmentShader: `
          uniform sampler2D tColor, tDepth, tPaper; uniform vec2 uRes; uniform float uNear, uFar, uPx, uInk, uHatch;
          varying vec2 vUv;
          float lin(float d) { float z = d * 2.0 - 1.0; return (2.0 * uNear * uFar) / (uFar + uNear - z * (uFar - uNear)); }
          float D(vec2 o) { return lin(texture2D(tDepth, vUv + o).r); }
          float L(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
          vec3 C(vec2 o) { vec3 c = texture2D(tColor, vUv + o).rgb; return c / (1.0 + c); }
          void main() {
            vec2 px = uPx / uRes;
            vec3 col = texture2D(tColor, vUv).rgb;
            // contorno pela profundidade (laplaciano relativo): silhuetas e degraus
            float d0 = D(vec2(0.0));
            float dl = D(vec2(-px.x, 0.0)), dr = D(vec2(px.x, 0.0)), du = D(vec2(0.0, px.y)), dd = D(vec2(0.0, -px.y));
            float lap = (abs(dl + dr - 2.0 * d0) + abs(du + dd - 2.0 * d0)) / max(d0, 0.001);
            float eD = smoothstep(0.012, 0.035, lap);
            // contorno pela cor (Sobel na luminância): divisas entre telhado, parede e vigas
            float tl = L(C(vec2(-px.x, px.y))), tc = L(C(vec2(0.0, px.y))), tr = L(C(vec2(px.x, px.y)));
            float ml = L(C(vec2(-px.x, 0.0))), mr = L(C(vec2(px.x, 0.0)));
            float bl = L(C(vec2(-px.x, -px.y))), bc = L(C(vec2(0.0, -px.y))), br = L(C(vec2(px.x, -px.y)));
            float gx = -tl - 2.0 * ml - bl + tr + 2.0 * mr + br, gy = -tl - 2.0 * tc - tr + bl + 2.0 * bc + br;
            float eC = smoothstep(0.2, 0.4, sqrt(gx * gx + gy * gy));
            // longe da câmera o traço afina (evita "ruído" no horizonte)
            float fade = 1.0 - smoothstep(uFar * 0.12, uFar * 0.3, d0);
            float ink = clamp(max(eD, eC * 0.7) * fade, 0.0, 1.0) * uInk;
            gl_FragColor = vec4(col, 1.0);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
            vec3 c = gl_FragColor.rgb;
            // gradação: sombras frias e arroxeadas, luzes quentes, um pouco mais de saturação
            float l = L(c);
            c = mix(c, c * vec3(0.86, 0.9, 1.08), (1.0 - smoothstep(0.15, 0.55, l)) * 0.55);
            c = mix(c, c * vec3(1.05, 1.0, 0.92), smoothstep(0.5, 0.95, l) * 0.5);
            c = mix(vec3(L(c)), c, 1.03);
            // hachuras em traço de pena nas áreas escuras
            vec2 fc = gl_FragCoord.xy / uPx;
            float h1 = step(0.72, fract((fc.x + fc.y) / 5.0)), h2 = step(0.72, fract((fc.x - fc.y) / 5.0));
            float dark = 1.0 - smoothstep(0.12, 0.34, l);
            c *= 1.0 - (h1 * dark + h2 * max(0.0, dark - 0.5) * 2.0) * 0.18 * uHatch * fade;
            // traço de tinta sépia
            c = mix(c, vec3(0.16, 0.1, 0.06), ink * 0.82);
            // papel e vinheta
            float paper = texture2D(tPaper, gl_FragCoord.xy / (256.0 * uPx)).r;
            c *= 0.9 + paper * 0.12;
            c = mix(c, c * vec3(1.03, 0.99, 0.9), 0.35);
            vec2 v = vUv - 0.5;
            c *= 1.0 - dot(v, v) * 0.55;
            gl_FragColor = vec4(c, 1.0);
          }`,
        depthTest: false, depthWrite: false,
      });
      this.postScene = new THREE.Scene();
      const q = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.postMat);
      q.frustumCulled = false;
      this.postScene.add(q);
      this.postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    },
    renderScene() {
      const r = this.renderer;
      if (this.gfx === 'low' || !this.postMat) { r.render(this.scene, this.camera); return; }
      const size = r.getDrawingBufferSize(this.tmpV2 || (this.tmpV2 = new THREE.Vector2()));
      if (this.rt.width !== size.x || this.rt.height !== size.y) { this.rt.setSize(size.x, size.y); }
      const U = this.postMat.uniforms;
      U.uRes.value.copy(size); U.uNear.value = this.camera.near; U.uFar.value = this.camera.far; U.uPx.value = r.getPixelRatio();
      r.setRenderTarget(this.rt);
      r.render(this.scene, this.camera);
      r.setRenderTarget(null);
      r.render(this.postScene, this.postCam);
    },
    // qualidade gráfica: alta / média / baixa (sombras, resolução e grama)
    gfx: (() => { try { return localStorage.getItem('rm_gfx') || 'high'; } catch (e) { return 'high'; } })(),
    setGfx(q) {
      this.gfx = q;
      try { localStorage.setItem('rm_gfx', q); } catch (e) { /* ok */ }
      this.applyGfx();
      if (this.S && this.built) this.objDirty = true;
    },
    applyGfx() {
      const r = this.renderer;
      if (!r) return;
      const q = this.gfx;
      r.shadowMap.enabled = q !== 'low';
      const ms = q === 'high' ? 2048 : 1024;
      if (this.sun.shadow.mapSize.x !== ms) { this.sun.shadow.mapSize.set(ms, ms); if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; } }
      this.scene.traverse((o) => { if (o.material) { const ms2 = Array.isArray(o.material) ? o.material : [o.material]; ms2.forEach((m) => { m.needsUpdate = true; }); } });
      this.resize();
    },
    resize() {
      this.vw = innerWidth; this.vh = innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (this.renderer) this.renderer.setPixelRatio(this.gfx === 'high' ? dpr : this.gfx === 'medium' ? Math.min(dpr, 1.25) : 1);
      this.ov.width = Math.floor(innerWidth * dpr); this.ov.height = Math.floor(innerHeight * dpr);
      this.ov.style.width = innerWidth + 'px'; this.ov.style.height = innerHeight + 'px';
      this.odpr = dpr;
      if (!this.renderer) return;
      this.renderer.setSize(innerWidth, innerHeight, false);
      this.cv.style.width = innerWidth + 'px'; this.cv.style.height = innerHeight + 'px';
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
    },

    // ================= carregamento dos modelos =================
    async loadAll() {
      const list = [];
      // construções, árvores, rochas e montanhas são arte própria (art.js); daqui vêm só personagens, animais e itens carregados
      for (const n of ['cloud_big', 'cloud_small']) list.push([n, `${AS}decoration/nature/${n}.gltf`]);

      for (const n of ['Barbarian', 'Knight', 'Rogue', 'Rogue_Hooded']) list.push([n, `assets/kaykit/chars/${n}.glb`]);
      list.push(['horse', 'assets/quaternius/horse.glb'], ['pig', 'assets/quaternius/pig.glb']);
      let done = 0;
      const upd = () => { this.progress = done / list.length; const el = document.getElementById('loadbar'); if (el) { el.style.setProperty('--p', Math.round(this.progress * 100) + '%'); el.dataset.t = this.progress < 1 ? `Carregando o reino… ${Math.round(this.progress * 100)}%` : ''; el.classList.toggle('done', this.progress >= 1); } };
      upd();
      const q = list.slice();
      const worker = async () => {
        while (q.length) {
          const [k, url] = q.shift();
          try { this.gltf[k] = await this.loader.loadAsync(url); }
          catch (e) { console.warn('Falha ao carregar', url, e); }
          done++; upd();
        }
      };
      await Promise.all([worker(), worker(), worker(), worker(), worker(), worker()]);
      await KM.PEOPLE.load(this.loader);
      this.prepare();
      this.ready = true;
      upd();
      if (this.S && !this.built) this.buildBase(this.S);
    },
    prepare() {
      for (const k in this.gltf) {
        const g = this.gltf[k];
        g.scene.traverse((o) => {
          if (o.isMesh) {
            o.castShadow = true; o.receiveShadow = true;
            if (o.material) { o.material.side = THREE.FrontSide; if (o.material.map) o.material.map.anisotropy = 4; }
          }
        });
        g.scene.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(g.scene);
        this.proto[k] = { box, size: box.getSize(new THREE.Vector3()), anims: g.animations || [] };
      }
      // arte própria: materiais pintados (toon) para tudo, inclusive personagens e animais
      KM.ART.init(THREE);
      KM.ART.buildNature();
      this.setupPost();
      this.windU = KM.ART.windU;
      for (const k in this.gltf) this.gltf[k].scene.traverse((o) => { if (o.isMesh && o.material) o.material = Array.isArray(o.material) ? o.material.map(KM.ART.toonify) : KM.ART.toonify(o.material); });
      // geometrias para instanciar (árvores, rochas, montanhas, trigo)
      const N = KM.ART.nature, rockM = KM.ART.mat('rock');
      const leafWind = KM.ART.mat('leaf').clone(); this.windify(leafWind, 0.03, 0.6);
      const wheatWind = KM.ART.mat('leaf').clone(); this.windify(wheatWind, 0.5, 1.3);
      this.inst = {
        tree_single_A: { geo: N.treeA, mat: leafWind }, tree_single_B: { geo: N.treeB, mat: leafWind }, tree_single_C: { geo: N.treeC, mat: leafWind },
        rock_single_A: { geo: N.rockA, mat: rockM }, rock_single_B: { geo: N.rockB, mat: rockM }, rock_single_C: { geo: N.rockC, mat: rockM }, rock_single_D: { geo: N.rockD, mat: rockM }, rock_single_E: { geo: N.rockE, mat: rockM },
        mountain_A: { geo: N.mountain_A, mat: rockM }, mountain_B: { geo: N.mountain_B, mat: rockM }, mountain_C: { geo: N.mountain_C, mat: rockM },
        ore1: { geo: N.ore1, mat: rockM }, ore2: { geo: N.ore2, mat: rockM }, ore3: { geo: N.ore3, mat: rockM },
        grain: { geo: N.grain, mat: wheatWind }, grainG: { geo: N.grainG, mat: wheatWind },
      };
      // esqueleto de referência (posição de cada osso na pose de ligação) para os personagens próprios
      this.rig = {};
      for (const k of ['Barbarian', 'Knight', 'Rogue', 'Rogue_Hooded', 'horse', 'pig']) {
        const g = this.gltf[k];
        if (!g) continue;
        let sk = null;
        g.scene.traverse((o) => { if (o.isSkinnedMesh && !sk) sk = o.skeleton; });
        if (!sk) continue;
        const idx = {}, P = {};
        sk.bones.forEach((b, i) => { idx[b.name] = i; P[b.name] = new THREE.Vector3().setFromMatrixPosition(sk.boneInverses[i].clone().invert()); });
        this.rig[k] = { idx, P };
      }
      // altura de referência dos personagens
      this.charH = this.proto.Knight ? this.proto.Knight.size.y : 2.4;
      this.makeTextures();
      try { this.makeHouseIcons(); } catch (e) { console.warn("ícones", e); }
    },
    // miniaturas das construções (renderizadas das próprias casas 3D) para os ícones da interface
    makeHouseIcons() {
      const size = 112, cv = document.createElement('canvas');
      cv.width = cv.height = size;
      let r;
      try { r = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, preserveDrawingBuffer: true }); } catch (e) { return; }
      r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.setClearColor(0x000000, 0);
      const sc = new THREE.Scene();
      sc.add(new THREE.HemisphereLight('#eef3ff', '#7a6a50', 2.1));
      const sun = new THREE.DirectionalLight('#ffe7c2', 2.4); sun.position.set(-3, 5, 4); sc.add(sun);
      const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
      this.icons = {};
      for (const t in KM.HOUSES) {
        const d = KM.HOUSES[t];
        const m = KM.ART.house(t, d.w, d.h, KM.me || 0, (d.w >> 1) + 0.5 - d.w / 2);
        m.scale.y = 1.12;
        sc.add(m);
        const box = new THREE.Box3().setFromObject(m), c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3()).length();
        cam.position.set(c.x + s * 0.55, c.y + s * 0.62, c.z + s * 1.15);
        cam.lookAt(c.x, c.y - s * 0.03, c.z);
        r.render(sc, cam);
        this.icons[t] = cv.toDataURL('image/png');
        sc.remove(m);
      }
      // personagens: soldados e profissões, em pose de descanso (primeiro quadro da animação "Idle")
      for (const t of KM.SOLDIER_ORDER.concat(KM.PROF_ORDER)) {
        const cfg = CHAR[t] || CHAR.serf;
        let body;
        if (KM.PEOPLE.ready) {
          const p = KM.PEOPLE.build(t, KM.me || 0, 7);
          body = p.obj;
          const mixer = new THREE.AnimationMixer(p.inner);
          mixer.clipAction(KM.PEOPLE.clips[KM.SOLDIERS[t] ? 'Sword_Idle' : 'Idle_Loop']).play(); mixer.update(0.4);
        } else {
          if (!this.rig[cfg.m] || !this.gltf[cfg.m]) continue;
          body = this.model(cfg.m);
          const inner = body.userData.inner, parts = [];
          inner.traverse((o) => { if (o.isSkinnedMesh) parts.push(o); });
          const rm = []; inner.traverse((o) => { if (o.isMesh) rm.push(o); });
          const own = new THREE.SkinnedMesh(KM.ART.character(t, KM.me || 0, this.rig[cfg.m]), KM.ART.charMat());
          parts[0].parent.add(own); own.bind(parts[0].skeleton, parts[0].bindMatrix);
          for (const p of rm) p.parent.remove(p);
          const mixer = new THREE.AnimationMixer(inner);
          const clip = this.proto[cfg.m].anims.find((a) => a.name === 'Idle') || this.proto[cfg.m].anims[0];
          if (clip) { mixer.clipAction(clip).play(); mixer.update(0.4); }
        }
        const g = new THREE.Group(); g.add(body);
        if (cfg.horse) {
          const hz = this.model('horse'); this.ownAnimal(hz, 'horse', t === 'knight' ? KM.me || 0 : null);
          const hp = this.proto.horse, q = KM.PEOPLE.ready, hs = (1.2 / Math.max(hp.size.x, hp.size.z)) / (q ? 1 : 0.26);
          hz.scale.setScalar(hs); body.position.y = hp.size.y * hs * (q ? 0.56 : 0.66); if (q) body.scale.multiplyScalar(0.95); g.add(hz);
        }
        g.rotation.y = 0.5;
        sc.add(g); g.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(g), c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3()).length();
        cam.position.set(c.x + s * 0.12, c.y + s * 0.2, c.z + s * 0.92);
        cam.lookAt(c.x, c.y, c.z);
        r.render(sc, cam);
        this.icons['u_' + t] = cv.toDataURL('image/png');
        sc.remove(g);
      }
      r.dispose();
      // uma classe CSS por construção (a imagem não se repete no HTML que é redesenhado a todo momento)
      const st = document.createElement('style');
      st.textContent = Object.keys(this.icons).map((t) => `.hic-${t}{background-image:url(${this.icons[t]})}`).join(' ');
      document.head.appendChild(st);
    },
    // vento: desloca os vértices proporcionalmente à altura (só em malhas instanciadas)
    windify(mat, amp, freq) {
      const U = this.windU || (this.windU = { value: 0 });
      mat.onBeforeCompile = (sh) => {
        sh.uniforms.uWind = U;
        sh.vertexShader = sh.vertexShader
          .replace('#include <common>', '#include <common>\nuniform float uWind;')
          .replace('#include <begin_vertex>', `#include <begin_vertex>
#ifdef USE_INSTANCING
  vec2 ip = vec2(instanceMatrix[3].x, instanceMatrix[3].z);
  float hh = max(0.0, position.y);
  float ph = uWind * ${freq.toFixed(2)} * 2.2 + ip.x * 0.37 + ip.y * 0.29;
  transformed.x += (sin(ph) + 0.35 * sin(ph * 2.3 + 1.7)) * ${amp.toFixed(3)} * hh * hh;
  transformed.z += cos(ph * 0.8 + 0.6) * ${(amp * 0.6).toFixed(3)} * hh * hh;
#endif`);
      };
      mat.customProgramCacheKey = () => 'wind' + amp + freq;
    },
    // modelo pronto para uso (clone), com a base apoiada em y=0 e centro em x,z=0
    model(k) {
      const g = this.gltf[k];
      if (!g) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), new THREE.MeshStandardMaterial({ color: '#c33' })); return m; }
      const skinned = k === 'Barbarian' || k === 'Knight' || k === 'Rogue' || k === 'Rogue_Hooded' || k === 'horse' || k === 'pig';
      const s = skinned ? THREE.SkeletonUtils.clone(g.scene) : g.scene.clone(true);
      const b = this.proto[k].box, c = b.getCenter(new THREE.Vector3());
      const wrap = new THREE.Group();
      s.position.set(-c.x, -b.min.y, -c.z);
      wrap.add(s);
      wrap.userData.inner = s;
      return wrap;
    },

    // ================= texturas geradas (estradas, solo, contornos) =================
    makeTextures() {
      const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
      const H = KM.hash;
      // atlas de estradas 4x4 (máscara N=1 L=2 S=4 O=8): caminho de terra batida com bordas suaves e pedras chatas,
      // em tons próximos do chão (sem contornos duros que viram "carimbo")
      const S = 128, M = 28, road = mk(S * 4, S * 4), g = road.getContext('2d');
      // textura da terra (um pouco maior que a célula, para as bordas emendarem)
      const earth = mk(S + 2 * M, S + 2 * M), e = earth.getContext('2d');
      e.fillStyle = '#a2845a'; e.fillRect(0, 0, S + 2 * M, S + 2 * M);
      for (let k = 0; k < 700; k++) {
        const x = H(k, 7, 1) * (S + 2 * M), y = H(k, 7, 2) * (S + 2 * M), t = (H(k, 7, 3) - 0.5) * 34;
        e.fillStyle = `rgba(${150 + t},${122 + t},${84 + t * 0.7},0.55)`;
        e.beginPath(); e.arc(x, y, 1 + H(k, 7, 4) * 3.5, 0, 7); e.fill();
      }
      for (let k = 0; k < 46; k++) {
        const x = H(k, 8, 1) * (S + 2 * M), y = H(k, 8, 2) * (S + 2 * M), r = 6 + H(k, 8, 3) * 7, n = 6 + Math.floor(H(k, 8, 4) * 3);
        const t = (H(k, 8, 5) - 0.5) * 26, pts = [];
        for (let i = 0; i < n; i++) { const a = (i / n) * 6.283 + H(k, i, 6) * 0.6, rr = r * (0.75 + H(k, i, 7) * 0.4); pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.8]); }
        const path = () => { e.beginPath(); pts.forEach(([px, py], i) => (i ? e.lineTo(px, py) : e.moveTo(px, py))); e.closePath(); };
        e.save(); e.translate(1.5, 2); path(); e.fillStyle = 'rgba(70,48,24,0.22)'; e.fill(); e.restore();
        path(); e.fillStyle = `rgb(${186 + t},${166 + t},${132 + t * 0.8})`; e.fill();
        e.save(); e.translate(-1, -1.2); e.scale(1, 1); path(); e.fillStyle = 'rgba(255,248,226,0.12)'; e.fill(); e.restore();
      }
      for (let mask = 0; mask < 16; mask++) {
        const ox = (mask % 4) * S, oy = Math.floor(mask / 4) * S;
        const tmp = mk(S + 2 * M, S + 2 * M), t = tmp.getContext('2d');
        const c = M + S / 2, r = S * 0.38;
        t.filter = 'blur(6px)';
        t.fillStyle = '#fff';
        t.beginPath(); t.arc(c, c, r, 0, 7); t.fill();
        if (mask & 1) t.fillRect(c - r, 0, 2 * r, c);
        if (mask & 4) t.fillRect(c - r, c, 2 * r, S + 2 * M - c);
        if (mask & 8) t.fillRect(0, c - r, c, 2 * r);
        if (mask & 2) t.fillRect(c, c - r, S + 2 * M - c, 2 * r);
        t.filter = 'none';
        t.globalCompositeOperation = 'source-in';
        t.drawImage(earth, 0, 0);
        g.drawImage(tmp, M, M, S, S, ox, oy, S, S);
      }
      this.roadTex = new THREE.CanvasTexture(road);
      this.roadTex.colorSpace = THREE.SRGBColorSpace; this.roadTex.anisotropy = 8;
      // solo lavrado: atlas 4x4 por vizinhança (como as estradas) com sulcos irregulares e bordas que se fundem ao capim
      const SS = 128, SM = 24, soil = mk(SS * 4, SS * 4), s = soil.getContext('2d');
      const furrow = mk(SS + 2 * SM, SS + 2 * SM), fu = furrow.getContext('2d');
      fu.fillStyle = '#7d5a35'; fu.fillRect(0, 0, SS + 2 * SM, SS + 2 * SM);
      for (let r = -1; r < 12; r++) {
        const y0 = r * 15 + 6;
        fu.strokeStyle = 'rgba(70,46,24,0.55)'; fu.lineWidth = 5; fu.beginPath();
        for (let x = 0; x <= SS + 2 * SM; x += 8) fu.lineTo(x, y0 + Math.sin(x * 0.08 + r) * 1.6 + (H(x, r, 81) - 0.5) * 1.5);
        fu.stroke();
        fu.strokeStyle = 'rgba(160,120,78,0.5)'; fu.lineWidth = 3; fu.beginPath();
        for (let x = 0; x <= SS + 2 * SM; x += 8) fu.lineTo(x, y0 - 5 + Math.sin(x * 0.08 + r) * 1.6);
        fu.stroke();
      }
      for (let k = 0; k < 400; k++) { fu.fillStyle = `rgba(${90 + H(k, 3, 82) * 70},${62 + H(k, 4, 82) * 50},${36 + H(k, 5, 82) * 30},0.5)`; fu.beginPath(); fu.arc(H(k, 1, 82) * (SS + 2 * SM), H(k, 2, 82) * (SS + 2 * SM), 1 + H(k, 6, 82) * 2, 0, 7); fu.fill(); }
      for (let mask = 0; mask < 16; mask++) {
        const ox = (mask % 4) * SS, oy = Math.floor(mask / 4) * SS;
        const tmp = mk(SS + 2 * SM, SS + 2 * SM), t = tmp.getContext('2d');
        const a = SM + 8, b = SM + SS - 8;
        t.filter = 'blur(4px)'; t.fillStyle = '#fff';
        t.beginPath(); t.roundRect(a, a, b - a, b - a, 14); t.fill();
        if (mask & 1) t.fillRect(a, 0, b - a, SM + 20);
        if (mask & 4) t.fillRect(a, b - 20, b - a, SS + 2 * SM - b + 20);
        if (mask & 8) t.fillRect(0, a, SM + 20, b - a);
        if (mask & 2) t.fillRect(b - 20, a, SS + 2 * SM - b + 20, b - a);
        // cantos internos preenchidos quando há vizinhos nas duas direções
        if ((mask & 1) && (mask & 8)) t.fillRect(0, 0, SM + 20, SM + 20);
        if ((mask & 1) && (mask & 2)) t.fillRect(b - 20, 0, SS + 2 * SM - b + 20, SM + 20);
        if ((mask & 4) && (mask & 8)) t.fillRect(0, b - 20, SM + 20, SS + 2 * SM - b + 20);
        if ((mask & 4) && (mask & 2)) t.fillRect(b - 20, b - 20, SS + 2 * SM - b + 20, SS + 2 * SM - b + 20);
        t.filter = 'none';
        t.globalCompositeOperation = 'source-in';
        t.drawImage(furrow, 0, 0);
        s.drawImage(tmp, SM, SM, SS, SS, ox, oy, SS, SS);
      }
      this.soilTex = new THREE.CanvasTexture(soil); this.soilTex.colorSpace = THREE.SRGBColorSpace; this.soilTex.anisotropy = 8;
      // contorno tracejado (planos)
      const dash = mk(64, 64), d = dash.getContext('2d');
      d.strokeStyle = '#fff'; d.lineWidth = 5; d.setLineDash([9, 6]); d.strokeRect(5, 5, 54, 54);
      this.dashTex = new THREE.CanvasTexture(dash);
      const solid = mk(8, 8), so = solid.getContext('2d'); so.fillStyle = '#fff'; so.fillRect(0, 0, 8, 8);
      this.solidTex = new THREE.CanvasTexture(solid);
      // mapa normal da água (ruído suave)
      const wn = mk(256, 256), w = wn.getContext('2d'), img = w.createImageData(256, 256), N = KM.makeNoise(31);
      for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
        const f = (xx, yy) => N((xx % 256) / 32, (yy % 256) / 32, 3);
        const dx = f(x + 1, y) - f(x + 255, y), dy = f(x, y + 1) - f(x, y + 255);
        const o = (y * 256 + x) * 4;
        img.data[o] = 128 + dx * 500; img.data[o + 1] = 128 + dy * 500; img.data[o + 2] = 255; img.data[o + 3] = 255;
      }
      w.putImageData(img, 0, 0);
      this.waterNormal = new THREE.CanvasTexture(wn);
      this.waterNormal.wrapS = this.waterNormal.wrapT = THREE.RepeatWrapping;
      // fumaça
      const sm = mk(64, 64), m = sm.getContext('2d'), gr = m.createRadialGradient(32, 32, 2, 32, 32, 30);
      gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      m.fillStyle = gr; m.fillRect(0, 0, 64, 64);
      this.smokeTex = new THREE.CanvasTexture(sm);
      { const tm = KM.ART.mat('leaf').clone(); this.windify(tm, 1.6, 1.1); this.inst.tuft = { geo: KM.ART.nature.tuft, mat: tm }; this.inst.flower = { geo: KM.ART.nature.flower, mat: tm }; this.inst.bush = { geo: KM.ART.nature.bush, mat: this.inst.tree_single_A.mat }; this.inst.bush2 = { geo: KM.ART.nature.bush2, mat: this.inst.tree_single_A.mat }; }
    },

    // ================= construção do mundo =================
    buildBase(S) {
      this.S = S;
      if (!this.ready) { this.built = false; return; }
      this.built = true;
      if (this.world) { this.scene.remove(this.world); this.dispose(this.world); }
      this.world = new THREE.Group(); this.scene.add(this.world);
      this.houseVis = {}; this.unitVis = {}; this.dying = []; this.projVis = []; this.smoke = [];
      this.sums = {};
      this.buildTerrain(S);
      this.buildWater(S);
      this.buildFog(S);
      this.rebuildObjects(S, true);
      this.rebuildDecals(S);
      this.fogDirty = true;
      this.selRings = [];
      // nuvens decorativas
      for (let k = 0; k < 8; k++) {
        const c = this.model(k % 2 ? 'cloud_big' : 'cloud_small');
        c.position.set(KM.hash(k, 1, 4) * S.map.W, 7 + KM.hash(k, 2, 4) * 3, KM.hash(k, 3, 4) * S.map.H);
        c.scale.setScalar(3 + KM.hash(k, 5, 4) * 2);
        // nuvens invisíveis: só a sombra delas passa sobre o terreno
        c.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; o.material = o.material.clone(); o.material.colorWrite = false; o.material.depthWrite = false; } });
        c.position.y = 16;
        c.userData.cloud = 0.3 + KM.hash(k, 6, 4) * 0.4;
        this.world.add(c);
      }
    },
    dispose(obj) { obj.traverse((o) => { if (o.geometry && o.userData.own) o.geometry.dispose(); }); },

    // altura do terreno (unidades 3D) num ponto em coordenadas de ladrilho
    groundY(fx, fy) {
      const m = this.S.map;
      const tx = Math.floor(fx), ty = Math.floor(fy);
      if (KM.inb(tx, ty) && m.terrain[ty * m.W + tx] === 1) return WL;
      return KM.hAt(m, KM.clamp(fx, 0, m.W), KM.clamp(fy, 0, m.H)) * HY + this.mLift(m, fx, fy);
    },
    // relevo extra (só visual) nas montanhas: colinas rochosas que sobem da borda para o miolo
    mLift(m, fx, fy) {
      const tx = Math.floor(fx), ty = Math.floor(fy);
      let n = 0, t = 0;
      for (let dy = -2; dy <= 1; dy++) for (let dx = -2; dx <= 1; dx++) {
        const x = Math.round(fx) + dx, y = Math.round(fy) + dy;
        t++; if (KM.inb(x, y) && m.terrain[y * m.W + x] === 2) n++;
      }
      if (!n) return 0;
      const f = n / t;
      const N = this.mNoise || (this.mNoise = KM.makeNoise(4242));
      void tx; void ty;
      return Math.pow(f, 1.5) * (0.45 + N(fx / 3, fy / 3, 2) * 0.95);
    },

    // ---------- terreno ----------
    buildTerrain(S) {
      const m = S.map, SUB = 2, VW = m.W * SUB + 1, VH = m.H * SUB + 1;
      this.tSub = SUB; this.tVW = VW; this.tVH = VH;
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(VW * VH * 3), col = new Float32Array(VW * VH * 3);
      const idx = [];
      for (let y = 0; y < VH - 1; y++) for (let x = 0; x < VW - 1; x++) {
        const a = y * VW + x, b = a + 1, c = a + VW, d = c + 1;
        if ((x + y) % 2) idx.push(a, c, b, b, c, d); else idx.push(a, c, d, a, d, b);
      }
      geo.setIndex(idx);
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      this.tGeo = geo;
      this.updateTerrain(S, 0, 0, m.W - 1, m.H - 1);
      const mat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: KM.ART.gradient });
      // detalhe procedural no chão (manchas e grão em várias escalas), evita o aspecto "liso"
      mat.onBeforeCompile = (sh) => {
        sh.vertexShader = sh.vertexShader
          .replace('#include <common>', '#include <common>\nvarying vec3 vWP;')
          .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
        sh.fragmentShader = sh.fragmentShader
          .replace('#include <common>', `#include <common>
varying vec3 vWP;
float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }`)
          .replace('#include <color_fragment>', `#include <color_fragment>
  vec2 q = vWP.xz;
  float big = vn(q * 0.23), mid = vn(q * 1.3 + 7.1), fine = vn(q * 6.5 + 3.3), grain = h21(floor(q * 22.0));
  float green = clamp((diffuseColor.g - diffuseColor.r) * 12.0, 0.0, 1.0);
  // pinceladas: ruído esticado em diagonal, como tinta aplicada com pincel largo
  vec2 sq = vec2(q.x * 0.7 + q.y * 0.7, -q.x * 0.7 + q.y * 0.7);
  float stroke = vn(vec2(sq.x * 1.2, sq.y * 7.0)) * 0.6 + vn(vec2(sq.x * 2.6 + 4.0, sq.y * 13.0)) * 0.4;
  diffuseColor.rgb *= 0.8 + big * 0.2 + mid * 0.09 + fine * 0.05 + stroke * 0.13 + grain * 0.04 * green;
  // manchas de tons: capim seco (quente), relva fresca (fria)
  float warm = smoothstep(0.45, 0.8, vn(q * 0.11 + 19.0)), cool = smoothstep(0.5, 0.85, vn(q * 0.17 + 41.0));
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.2, 1.05, 0.72), green * warm * 0.8);
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.86, 1.0, 1.02), green * cool * (1.0 - warm) * 0.6);
  // rocha: estratos e fendas
  float sat = max(diffuseColor.r, max(diffuseColor.g, diffuseColor.b)) - min(diffuseColor.r, min(diffuseColor.g, diffuseColor.b));
  float rocky = (1.0 - smoothstep(0.06, 0.13, sat)) * step(0.02, vWP.y + 0.3);
  float strata = vn(vec2(q.x * 0.6 + q.y * 0.3, vWP.y * 9.0 + q.y * 0.4));
  float crack = smoothstep(0.47, 0.5, vn(q * 2.2 + 13.0)) * (1.0 - smoothstep(0.5, 0.53, vn(q * 2.2 + 13.0)));
  diffuseColor.rgb *= 1.0 - rocky * (strata * 0.22 + crack * 0.35);
  `);
      };
      mat.customProgramCacheKey = () => 'terrain-detail';
      const mesh = this.terrain = new THREE.Mesh(geo, mat);
      mesh.receiveShadow = true; mesh.userData.own = true;
      this.world.add(mesh);
      // borda do mapa (saia de terra)
      const skirt = new THREE.Mesh(new THREE.BoxGeometry(m.W + 0.2, 1.2, m.H + 0.2), KM.ART.toonify(new THREE.MeshStandardMaterial({ color: '#5a4630' })));
      skirt.position.set(m.W / 2, BED - 0.62, m.H / 2);
      skirt.userData.own = true;
      this.world.add(skirt);
      this.buildOuter(S);
    },
    // além da borda: terras vizinhas (colinas, mata fechada e serras) que escurecem e somem na névoa,
    // em vez de o chão terminar num corte seco. Só visual: ninguém anda ou constrói ali.
    buildOuter(S) {
      const m = S.map, M = 30, SUB = 2, OW = (m.W + 2 * M) * SUB + 1, OH = (m.H + 2 * M) * SUB + 1;
      const N = KM.makeNoise(S.seed + 911), biome = KM.biome(m);
      const tp = this.tGeo.attributes.position.array, TVW = this.tVW;
      const pos = new Float32Array(OW * OH * 3), col = new Float32Array(OW * OH * 3), idx = [];
      const sm = (a, b, x) => { const t = KM.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
      const hOut = (fx, fy) => {
        const cx = KM.clamp(fx, 0, m.W), cy = KM.clamp(fy, 0, m.H), d = Math.hypot(fx - cx, fy - cy);
        const hb = tp[(Math.round(cy * SUB) * TVW + Math.round(cx * SUB)) * 3 + 1];
        if (d === 0) return { h: hb, d };
        // colinas que crescem para longe do mapa; serras no fundo
        const hill = 0.25 + N(fx / 8, fy / 8, 3) * 1.4 + N(fx / 3, fy / 3, 2) * 0.35 + Math.max(0, d - 8) * 0.07 + Math.pow(Math.max(0, N(fx / 14 + 7, fy / 14, 2) - 0.45), 1.5) * 9 * sm(10, 22, d);
        const target = Math.max(WL + 0.2, Math.min(hb, 1.6) * 0.6) + hill;
        return { h: hb + (target - hb) * sm(0, 7, d), d };
      };
      for (let vy = 0; vy < OH; vy++) for (let vx = 0; vx < OW; vx++) {
        const fx = vx / SUB - M, fy = vy / SUB - M, { h, d } = hOut(fx, fy);
        const o = (vy * OW + vx) * 3;
        pos[o] = fx; pos[o + 1] = h + (d > 0 ? (KM.hash(vx, vy, 93) - 0.5) * 0.05 : 0); pos[o + 2] = fy;
        // grama do bioma, rocha nas encostas altas; escurece e esfria com a distância (lê como "fora do reino")
        const k = N(fx / 6, fy / 6, 3), rock = sm(1.6, 2.8, h);
        let r = biome.grass2[0] + (biome.grass[0] - biome.grass2[0]) * k, g = biome.grass2[1] + (biome.grass[1] - biome.grass2[1]) * k, b = biome.grass2[2] + (biome.grass[2] - biome.grass2[2]) * k;
        r += (0.46 - r) * rock; g += (0.43 - g) * rock; b += (0.4 - b) * rock;
        if (h < WL + 0.12) { r += (0.62 - r) * 0.5; g += (0.55 - g) * 0.5; b += (0.38 - b) * 0.5; }
        const dim = 1 - sm(0, 5, d) * 0.2 - sm(5, M - 4, d) * 0.36, cool = sm(4, M, d) * 0.25;
        r *= dim * (1 - cool * 0.3); g *= dim; b *= dim * (1 + cool * 0.25);
        col[o] = Math.pow(r, 2.2); col[o + 1] = Math.pow(g, 2.2); col[o + 2] = Math.pow(b, 2.2);
      }
      const ix0 = M * SUB, ix1 = (M + m.W) * SUB, iy0 = M * SUB, iy1 = (M + m.H) * SUB;
      for (let y = 0; y < OH - 1; y++) for (let x = 0; x < OW - 1; x++) {
        if (x >= ix0 && x < ix1 && y >= iy0 && y < iy1) continue; // miolo: é o próprio mapa
        const a = y * OW + x, b2 = a + 1, c = a + OW, d = c + 1;
        if ((x + y) % 2) idx.push(a, c, b2, b2, c, d); else idx.push(a, c, d, a, d, b2);
      }
      const geo = new THREE.BufferGeometry();
      geo.setIndex(idx);
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      geo.computeVertexNormals();
      const mesh = new THREE.Mesh(geo, this.terrain.material);
      mesh.receiveShadow = true; mesh.userData.own = true;
      this.world.add(mesh);
      // mata fechada e serras espalhadas pelo anel externo (instanciadas)
      const lists = {}, add = (k, x, z, s, sy) => (lists[k] = lists[k] || []).push([x, z, s, sy || s]);
      for (let ty = -M + 1; ty < m.H + M - 1; ty++) for (let tx = -M + 1; tx < m.W + M - 1; tx++) {
        if (tx >= -1 && tx <= m.W && ty >= -1 && ty <= m.H) continue;
        const cx = tx + 0.5 + (KM.hash(tx, ty, 41) - 0.5) * 0.6, cy = ty + 0.5 + (KM.hash(tx, ty, 42) - 0.5) * 0.6;
        const { h, d } = hOut(cx, cy);
        if (h < WL + 0.15) continue;
        const forest = N(cx / 7 + 3, cy / 7, 2), hk = KM.hash(tx, ty, 43);
        if (h > 2.6 && hk < 0.25) add('mountain_' + 'ABC'[Math.floor(KM.hash(tx, ty, 44) * 3)], cx, cy, 1 + KM.hash(tx, ty, 45) * 0.8, 0.9 + KM.hash(tx, ty, 46) * 0.9);
        else if (forest > 0.42 - Math.min(0.15, d * 0.01) && hk < 0.62) {
          const pine = biome.pine, ht = KM.hash(tx, ty, 47);
          add(ht > 1 - pine ? 'tree_single_C' : ht < (1 - pine) * 0.57 ? 'tree_single_A' : 'tree_single_B', cx, cy, 0.8 + KM.hash(tx, ty, 48) * 0.35);
        }
      }
      const dummy = new THREE.Object3D(), tint = biome.tint;
      for (const k in lists) {
        const src = this.inst[k];
        if (!src) continue;
        const L = lists[k], im = new THREE.InstancedMesh(src.geo, src.mat, L.length);
        L.forEach(([x, z, s, sy], j) => {
          const { h, d } = hOut(x, z);
          dummy.position.set(x, h - (k.startsWith('mountain') ? 0.1 : 0), z);
          dummy.rotation.set(0, KM.hash(j, L.length, 49) * 6.28, 0);
          dummy.scale.set(s, sy, s);
          dummy.updateMatrix();
          im.setMatrixAt(j, dummy.matrix);
          const dim = 1 - sm(0, 5, d) * 0.18 - sm(5, M - 4, d) * 0.38;
          im.setColorAt(j, new THREE.Color().setRGB((k.startsWith('tree') ? tint[0] : 1) * dim, (k.startsWith('tree') ? tint[1] : 1) * dim, (k.startsWith('tree') ? tint[2] : 1) * dim));
        });
        im.castShadow = true; im.receiveShadow = true;
        this.world.add(im);
      }
    },
    updateTerrain(S, x0, y0, x1, y1) {
      const m = S.map, SUB = this.tSub, VW = this.tVW, VH = this.tVH;
      const pos = this.tGeo.attributes.position.array, col = this.tGeo.attributes.color.array;
      const vx0 = Math.max(0, (x0 - 1) * SUB), vx1 = Math.min(VW - 1, (x1 + 2) * SUB);
      const vy0 = Math.max(0, (y0 - 1) * SUB), vy1 = Math.min(VH - 1, (y1 + 2) * SUB);
      const C = {
        grass: [0.43, 0.57, 0.27], grass2: [0.3, 0.45, 0.2], sand: [0.86, 0.76, 0.52], rock: [0.5, 0.46, 0.41], rock2: [0.3, 0.28, 0.26],
        bed: [0.24, 0.38, 0.4], dirt: [0.55, 0.42, 0.27],
      };
      const biome = KM.biome(m);
      C.grass = biome.grass; C.grass2 = biome.grass2; C.sand = biome.sand;
      const N = KM.makeNoise(S.seed + 5);
      for (let vy = vy0; vy <= vy1; vy++) for (let vx = vx0; vx <= vx1; vx++) {
        const fx = vx / SUB, fy = vy / SUB;
        // ladrilhos que tocam este vértice
        let water = 0, n = 0, r = 0, g = 0, b = 0, house = 0;
        const txs = Number.isInteger(fx) ? [fx - 1, fx] : [Math.floor(fx)];
        const tys = Number.isInteger(fy) ? [fy - 1, fy] : [Math.floor(fy)];
        for (const ty of tys) for (const tx of txs) {
          if (!KM.inb(tx, ty)) continue;
          const i = ty * m.W + tx, t = m.terrain[i];
          n++;
          let c;
          if (t === 1) { water++; c = C.bed; }
          else if (t === 3) c = C.sand;
          else if (t === 2) { const k = N(tx / 3, ty / 3, 2); c = [C.rock2[0] + (C.rock[0] - C.rock2[0]) * k, C.rock2[1] + (C.rock[1] - C.rock2[1]) * k, C.rock2[2] + (C.rock[2] - C.rock2[2]) * k]; }
          else { const k = N(fx / 7, fy / 7, 3); c = [C.grass2[0] + (C.grass[0] - C.grass2[0]) * k, C.grass2[1] + (C.grass[1] - C.grass2[1]) * k, C.grass2[2] + (C.grass[2] - C.grass2[2]) * k]; }
          if (m.house[i] && t !== 1) house++;
          r += c[0]; g += c[1]; b += c[2];
        }
        if (!n) n = 1;
        r /= n; g /= n; b /= n;
        if (house) { const k = 0.12 * house / n; r += (C.dirt[0] - r) * k; g += (C.dirt[1] - g) * k; b += (C.dirt[2] - b) * k; }
        const jitter = (KM.hash(vx, vy, 77) - 0.5) * 0.05;
        const ww = water / n;
        // oclusão ambiente "assada": vales e pés de encosta ficam mais escuros, cristas mais claras
        if (ww < 1) {
          const h0 = KM.hAt(m, fx, fy);
          let s = 0;
          for (const [ox, oy] of [[1.5, 0], [-1.5, 0], [0, 1.5], [0, -1.5], [1, 1], [-1, -1], [1, -1], [-1, 1]]) s += KM.hAt(m, KM.clamp(fx + ox, 0, m.W), KM.clamp(fy + oy, 0, m.H)) - h0;
          const ao = KM.clamp(1 - s * 0.045, 0.62, 1.1);
          r *= ao; g *= ao; b *= ao * (ao < 1 ? 1.04 : 1);
          // costa: faixa de areia úmida perto da água
          if (water) { const k = 0.35; r += (0.62 - r) * k; g += (0.55 - g) * k; b += (0.38 - b) * k; }
        }
        let h = (KM.hAt(m, fx, fy) * HY + this.mLift(m, fx, fy)) * (1 - ww) + BED * ww;
        h += (KM.hash(vx, vy, 91) - 0.5) * 0.04 * (1 - ww);
        const o = (vy * VW + vx) * 3;
        pos[o] = fx; pos[o + 1] = h; pos[o + 2] = fy;
        col[o] = Math.pow(Math.max(0, r + jitter), 2.2); col[o + 1] = Math.pow(Math.max(0, g + jitter), 2.2); col[o + 2] = Math.pow(Math.max(0, b + jitter * 0.6), 2.2);
      }
      this.tGeo.attributes.position.needsUpdate = true;
      this.tGeo.attributes.color.needsUpdate = true;
      this.tGeo.computeVertexNormals();
      this.tGeo.computeBoundingSphere();
    },
    buildWater(S) {
      const m = S.map;
      const geo = new THREE.PlaneGeometry(m.W + 40, m.H + 40, 1, 1);
      geo.rotateX(-Math.PI / 2);
      this.shoreTex = new THREE.DataTexture(new Uint8Array(m.W * m.H * 4), m.W, m.H, THREE.RGBAFormat);
      this.shoreTex.magFilter = this.shoreTex.minFilter = THREE.LinearFilter;
      this.updateShore(S);
      const mat = this.waterMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.25, metalness: 0.0, transparent: true, opacity: 0.9, normalMap: this.waterNormal, normalScale: new THREE.Vector2(0.3, 0.3) });
      // água pintada: rasa e clara na margem, funda no meio, ondas de espuma batendo na costa
      mat.onBeforeCompile = (sh) => {
        sh.uniforms.tShore = { value: this.shoreTex };
        sh.uniforms.uMap = { value: new THREE.Vector2(m.W, m.H) };
        sh.uniforms.uTime = KM.ART.windU;
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;')
          .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vWP; uniform sampler2D tShore; uniform vec2 uMap; uniform float uTime;
float wh(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float wn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(wh(i), wh(i + vec2(1, 0)), f.x), mix(wh(i + vec2(0, 1)), wh(i + vec2(1, 1)), f.x), f.y); }`)
          .replace('#include <color_fragment>', `#include <color_fragment>
  float d = texture2D(tShore, vWP.xz / uMap).r;
  vec3 shallow = vec3(0.16, 0.5, 0.48), deep = vec3(0.03, 0.16, 0.3);
  diffuseColor.rgb = mix(shallow, deep, smoothstep(0.05, 0.75, d));
  float n = wn(vWP.xz * 2.2 + vec2(uTime * 0.15, uTime * 0.1));
  float band = smoothstep(0.82, 0.97, sin(d * 26.0 - uTime * 1.6 + n * 2.5) * 0.5 + 0.5) * (1.0 - smoothstep(0.06, 0.32, d));
  float edge = 1.0 - smoothstep(0.0, 0.09 + n * 0.05, d);
  float foam = clamp(max(band * (0.6 + n * 0.5), edge), 0.0, 1.0);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.95, 0.98, 1.0), foam * 0.85);
  // brilhos soltos na água funda
  diffuseColor.rgb += smoothstep(0.93, 0.99, wn(vWP.xz * 5.0 - uTime * 0.3)) * 0.12 * smoothstep(0.3, 0.8, d);`);
      };
      mat.customProgramCacheKey = () => 'water-painted';
      this.waterNormal.repeat.set((m.W + 40) / 6, (m.H + 40) / 6);
      const w = new THREE.Mesh(geo, mat);
      w.position.set(m.W / 2, WL, m.H / 2);
      w.receiveShadow = true; w.userData.own = true;
      this.world.add(w);
    },
    // distância de cada ladrilho de água até a terra (0 = margem, 255 = fundo)
    updateShore(S) {
      const m = S.map, W = m.W, H = m.H, dist = new Float32Array(W * H).fill(99), q = [];
      for (let i = 0; i < W * H; i++) if (m.terrain[i] !== 1) { dist[i] = 0; q.push(i); }
      for (let k = 0; k < q.length; k++) {
        const i = q[k], x = i % W, y = (i / W) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const xx = x + dx, yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          const j = yy * W + xx;
          if (dist[j] > dist[i] + 1) { dist[j] = dist[i] + 1; q.push(j); }
        }
      }
      const data = this.shoreTex.image.data;
      for (let i = 0; i < W * H; i++) { const v = Math.min(255, Math.round((Math.min(dist[i], 5) / 5) * 255)); data[i * 4] = v; data[i * 4 + 1] = v; data[i * 4 + 2] = v; data[i * 4 + 3] = 255; }
      this.shoreTex.needsUpdate = true;
    },

    // ---------- névoa de guerra ----------
    buildFog(S) {
      const m = S.map, VW = m.W + 1, VH = m.H + 1;
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(VW * VH * 3), col = new Float32Array(VW * VH * 4);
      const idx = [];
      for (let y = 0; y < VH - 1; y++) for (let x = 0; x < VW - 1; x++) { const a = y * VW + x; idx.push(a, a + VW, a + 1, a + 1, a + VW, a + VW + 1); }
      geo.setIndex(idx);
      for (let y = 0; y < VH; y++) for (let x = 0; x < VW; x++) {
        const o = (y * VW + x) * 3;
        pos[o] = x; pos[o + 1] = Math.max(KM.hAt(m, x, y) * HY + this.mLift(m, x, y), WL) + 0.06; pos[o + 2] = y;
      }
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(col, 4));
      const mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide });
      const mesh = this.fogMesh = new THREE.Mesh(geo, mat);
      mesh.renderOrder = 5; mesh.userData.own = true;
      this.world.add(mesh);
    },
    fogSet() { this.fogDirty = true; },
    updateFog(S) {
      const m = S.map, VW = m.W + 1, bit = 1 << KM.me, col = this.fogMesh.geometry.attributes.color.array;
      const pos = this.fogMesh.geometry.attributes.position.array;
      for (let vy = 0; vy <= m.H; vy++) for (let vx = 0; vx <= m.W; vx++) {
        let e = 0, n = 0;
        for (let dy = -1; dy <= 0; dy++) for (let dx = -1; dx <= 0; dx++) {
          const x = vx + dx, y = vy + dy;
          if (x < 0 || y < 0 || x >= m.W || y >= m.H) continue;
          n++; if (m.explored[y * m.W + x] & bit) e++;
        }
        const a = S.editor ? 0 : n ? 1 - e / n : 1;
        const o = (vy * VW + vx) * 4;
        col[o] = 0.03; col[o + 1] = 0.04; col[o + 2] = 0.06; col[o + 3] = a >= 0.99 ? 1 : a * 0.9;
        pos[(vy * VW + vx) * 3 + 1] = Math.max(KM.hAt(m, vx, vy) * HY + this.mLift(m, vx, vy), WL) + 0.06;
      }
      this.fogMesh.geometry.attributes.color.needsUpdate = true;
      this.fogMesh.geometry.attributes.position.needsUpdate = true;
    },
    seen(S, x, y) { return S.editor || KM.isExp(S, KM.clamp(Math.round(y), 0, S.map.H - 1) * S.map.W + KM.clamp(Math.round(x), 0, S.map.W - 1)); },

    // ---------- árvores, rochas, minérios, montanhas, plantações (instanciados) ----------
    rebuildObjects(S, force) {
      const m = S.map;
      if (this.objGroup) { this.world.remove(this.objGroup); this.objGroup.traverse((o) => { if (o.isInstancedMesh) o.dispose(); }); }
      const G = this.objGroup = new THREE.Group();
      this.world.add(G);
      const lists = {};
      const add = (k, x, y, z, s, rot, sy) => (lists[k] = lists[k] || []).push([x, y, z, s, rot, sy == null ? s : sy]);
      const TS = [0, 0.32, 0.52, 0.76, 0.95];
      for (let ty = 0; ty < m.H; ty++) for (let tx = 0; tx < m.W; tx++) {
        const i = ty * m.W + tx;
        if (!S.editor && !(m.explored[i] & (1 << KM.me))) continue;
        const cx = tx + 0.5 + (KM.hash(tx, ty, 1) - 0.5) * 0.3, cy = ty + 0.5 + (KM.hash(tx, ty, 2) - 0.5) * 0.3;
        if (m.tree[i]) {
          const hk = KM.hash(tx, ty, 3), pine = KM.biome(m).pine;
          const k = hk > 1 - pine ? 'tree_single_C' : hk < (1 - pine) * 0.57 ? 'tree_single_A' : 'tree_single_B';
          add(k, cx, this.groundY(cx, cy), cy, TS[m.tree[i]] * (0.85 + KM.hash(tx, ty, 4) * 0.3), KM.hash(tx, ty, 5) * 6.28);
        }
        if (m.stone[i]) {
          const n = m.stone[i] >= 5 ? 3 : m.stone[i] >= 3 ? 2 : 1;
          for (let k = 0; k < n; k++) {
            const rx = tx + 0.5 + (KM.hash(tx + k, ty, 6) - 0.5) * 0.55, ry = ty + 0.5 + (KM.hash(tx, ty + k, 7) - 0.5) * 0.55;
            add('rock_single_' + 'ABCDE'[Math.floor(KM.hash(tx, ty, 8 + k) * 5)], rx, this.groundY(rx, ry), ry, 1.6 + KM.hash(tx, ty, 9 + k) * 1.2, KM.hash(tx, ty, 10 + k) * 6.28);
          }
        }
        if (m.terrain[i] === 2) {
          if (m.ore[i]) {
            const k = ['', 'ore1', 'ore2', 'ore3'][m.ore[i]];
            const nn = m.oreAmt[i] > 8 ? 2 : 1;
            for (let j = 0; j < nn; j++) { const rx = tx + 0.3 + KM.hash(tx, ty, 20 + j) * 0.4, ry = ty + 0.3 + KM.hash(tx, ty, 22 + j) * 0.4; add(k, rx, this.groundY(rx, ry), ry, 1.4, KM.hash(tx, ty, 24 + j) * 6.28); }
          } else {
            // montanha: picos rochosos no miolo, penedos na borda
            let n8 = 0;
            for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (KM.inb(tx + dx, ty + dy) && m.terrain[(ty + dy) * m.W + tx + dx] === 2) n8++;
            const hk = KM.hash(tx, ty, 30), gy = this.groundY(tx + 0.5, ty + 0.5);
            if (n8 === 9 && hk < 0.6) add('mountain_' + 'ABC'[Math.floor(KM.hash(tx, ty, 31) * 3)], tx + 0.5 + (KM.hash(tx, ty, 34) - 0.5) * 0.4, gy - 0.1, ty + 0.5 + (KM.hash(tx, ty, 35) - 0.5) * 0.4, 0.8 + KM.hash(tx, ty, 32) * 0.5, KM.hash(tx, ty, 33) * 6.28, 0.7 + KM.hash(tx, ty, 36) * 0.6);
            else if (n8 >= 6 && hk < 0.5) add('rock_single_' + 'ABCDE'[Math.floor(KM.hash(tx, ty, 37) * 5)], tx + 0.5, gy, ty + 0.5, 2.6 + KM.hash(tx, ty, 38) * 1.4, KM.hash(tx, ty, 39) * 6.28);
          }
        }
        // grama alta e flores em campo aberto
        if (this.gfx !== 'low' && m.terrain[i] === 0 && !m.house[i] && !m.road[i] && !m.field[i] && !m.stone[i]) {
          const hb = KM.hash(tx, ty, 70);
          if (hb < 0.035 && !m.tree[i]) add(hb < 0.017 ? 'bush' : 'bush2', tx + 0.3 + KM.hash(tx, ty, 71) * 0.4, this.groundY(tx + 0.5, ty + 0.5), ty + 0.3 + KM.hash(tx, ty, 72) * 0.4, 0.9 + KM.hash(tx, ty, 73) * 0.6, KM.hash(tx, ty, 74) * 6.28);
          const hk = KM.hash(tx, ty, 60);
          const nt = hk < 0.4 ? 0 : hk < 0.85 ? 1 : 2;
          for (let k = 0; k < nt; k++) {
            const rx = tx + 0.15 + KM.hash(tx, ty, 61 + k) * 0.7, ry = ty + 0.15 + KM.hash(tx, ty, 63 + k) * 0.7;
            add(KM.hash(tx, ty, 65 + k) < 0.1 ? 'flower' : 'tuft', rx, this.groundY(rx, ry) - 0.02, ry, 0.8 + KM.hash(tx, ty, 67 + k) * 0.6, KM.hash(tx, ty, 69 + k) * 3.14);
          }
        }
        const f = m.field[i];
        if ((f === 2 || f === 4) && m.fstage[i] > 0) {
          const gy = this.groundY(tx + 0.5, ty + 0.5), st = m.fstage[i];
          if (f === 2) {
            if (st <= 2) for (let k = 0; k < 9; k++) add('sprout', tx + 0.2 + (k % 3) * 0.3, gy, ty + 0.2 + Math.floor(k / 3) * 0.3, st === 1 ? 0.5 : 0.9, 0);
            else add(st === 4 ? 'grain' : 'grainG', tx + 0.5, gy, ty + 0.5, 1, (tx + ty) % 2 ? 0 : Math.PI / 3, st === 4 ? 1 : 0.7);
          } else {
            for (let k = 0; k < 3; k++) add('vine', tx + 0.2 + k * 0.3, gy, ty + 0.5, 1, 0, 0.3 + st * 0.12);
            if (st >= 4) for (let k = 0; k < 6; k++) add('grape', tx + 0.2 + (k % 3) * 0.3 + 0.05, gy + 0.25, ty + 0.4 + Math.floor(k / 3) * 0.2, 1, 0);
          }
        }
      }
      const dummy = new THREE.Object3D();
      for (const k in lists) {
        let geo, mat;
        if (k === 'sprout') { geo = this.sproutGeo || (this.sproutGeo = new THREE.ConeGeometry(0.05, 0.16, 5).translate(0, 0.08, 0)); mat = this.sproutMat || (this.sproutMat = KM.ART.toonify(new THREE.MeshStandardMaterial({ color: '#6fbf45' }))); }
        else if (k === 'vine') { geo = this.vineGeo || (this.vineGeo = new THREE.BoxGeometry(0.12, 1, 0.5).translate(0, 0.5, 0)); mat = this.vineMat || (this.vineMat = KM.ART.toonify(new THREE.MeshStandardMaterial({ color: '#3f7f34' }))); }
        else if (k === 'grape') { geo = this.grapeGeo || (this.grapeGeo = new THREE.SphereGeometry(0.05, 6, 5)); mat = this.grapeMat || (this.grapeMat = KM.ART.toonify(new THREE.MeshStandardMaterial({ color: '#5b2370' }))); }
        else { const src = this.inst[k]; if (!src) continue; geo = src.geo; mat = src.mat; }
        const L = lists[k];
        const im = new THREE.InstancedMesh(geo, mat, L.length);
        const box = this.inst[k] && this.inst[k].box;
        const baseY = box ? -box.min.y : 0;
        L.forEach(([x, y, z, s, rot, sy], j) => {
          dummy.position.set(x, y + baseY * sy, z);
          dummy.rotation.set(0, rot, 0);
          dummy.scale.set(s, sy, s);
          dummy.updateMatrix();
          im.setMatrixAt(j, dummy.matrix);
          if (k.startsWith('tree_single') || k === 'bush' || k === 'bush2' || k === 'tuft') {
            const tint = KM.biome(m).tint;
            im.setColorAt(j, new THREE.Color().setRGB(tint[0], tint[1], tint[2]));
          }
        });
        im.castShadow = k !== 'sprout' && k !== 'grape' && k !== 'tuft' && k !== 'flower';
        im.receiveShadow = true;
        G.add(im);
      }
    },

    // ---------- estradas, planos e campos (decalques no chão) ----------
    quadsMesh(items, tex, transparent, opacity, lift) {
      if (!items.length) return null;
      const pos = [], uv = [], col = [], idx = [];
      const m = this.S.map;
      let v = 0;
      for (const it of items) {
        const { x, y, u0 = 0, v0 = 0, u1 = 1, v1 = 1, c = [1, 1, 1], pad = 0 } = it;
        const pts = [[x - pad, y - pad], [x + 1 + pad, y - pad], [x - pad, y + 1 + pad], [x + 1 + pad, y + 1 + pad]];
        const sub = 2;
        // subdividido para acompanhar o relevo
        for (let j = 0; j <= sub; j++) for (let i = 0; i <= sub; i++) {
          const px = pts[0][0] + (pts[1][0] - pts[0][0]) * (i / sub), py = pts[0][1] + (pts[2][1] - pts[0][1]) * (j / sub);
          pos.push(px, KM.hAt(m, KM.clamp(px, 0, m.W), KM.clamp(py, 0, m.H)) * HY + (lift || 0.025), py);
          uv.push(u0 + (u1 - u0) * (i / sub), 1 - (v0 + (v1 - v0) * (j / sub)));
          col.push(c[0], c[1], c[2]);
        }
        for (let j = 0; j < sub; j++) for (let i = 0; i < sub; i++) {
          const a = v + j * (sub + 1) + i, b = a + 1, cc = a + sub + 1, d = cc + 1;
          idx.push(a, cc, b, b, cc, d);
        }
        v += (sub + 1) * (sub + 1);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      const mat = new THREE.MeshToonMaterial({ map: tex, vertexColors: true, gradientMap: KM.ART.gradient, transparent: !!transparent, opacity: opacity || 1, depthWrite: !transparent, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.receiveShadow = true; mesh.userData.own = true;
      return mesh;
    },
    rebuildDecals(S) {
      const m = S.map;
      if (this.decals) { this.world.remove(this.decals); this.dispose(this.decals); }
      const G = this.decals = new THREE.Group();
      this.world.add(G);
      const roads = [], plans = [], soils = [], stones = [];
      const isR = (x, y) => KM.inb(x, y) && m.road[y * m.W + x] === 2;
      for (let y = 0; y < m.H; y++) for (let x = 0; x < m.W; x++) {
        const i = y * m.W + x;
        if (!S.editor && !(m.explored[i] & (1 << KM.me))) continue;
        if (m.road[i] === 2) {
          const mask = (isR(x, y - 1) ? 1 : 0) | (isR(x + 1, y) ? 2 : 0) | (isR(x, y + 1) ? 4 : 0) | (isR(x - 1, y) ? 8 : 0);
          const u0 = (mask % 4) / 4, v0 = Math.floor(mask / 4) / 4;
          roads.push({ x, y, u0: u0 + 0.002, v0: v0 + 0.002, u1: u0 + 0.248, v1: v0 + 0.248 });
        } else if (m.road[i] === 1 && m.rown[i] >= 0 && (S.editor || m.rown[i] === KM.me)) {
          const c = new THREE.Color(KM.pcolor(S, m.rown[i]));
          plans.push({ x, y, c: [c.r, c.g, c.b] });
          if (m.rmat[i] === 2) stones.push([x, y]);
        }
        const f = m.field[i];
        if (f === 2 || f === 4) {
          const isF = (xx, yy) => KM.inb(xx, yy) && (m.field[yy * m.W + xx] === 2 || m.field[yy * m.W + xx] === 4);
          const fm = (isF(x, y - 1) ? 1 : 0) | (isF(x + 1, y) ? 2 : 0) | (isF(x, y + 1) ? 4 : 0) | (isF(x - 1, y) ? 8 : 0);
          const u0 = (fm % 4) / 4, v0 = Math.floor(fm / 4) / 4;
          soils.push({ x, y, u0: u0 + 0.002, v0: v0 + 0.002, u1: u0 + 0.248, v1: v0 + 0.248, c: f === 4 ? [0.9, 0.85, 0.8] : [1, 1, 1] });
        }
        else if ((f === 1 || f === 3) && (S.editor || m.fown[i] === KM.me)) plans.push({ x, y, c: f === 1 ? [1, 0.9, 0.35] : [0.75, 0.35, 0.8] });
      }
      const add = (o) => { if (o) G.add(o); };
      add(this.quadsMesh(soils, this.soilTex, true, 1, 0.02));
      add(this.quadsMesh(roads, this.roadTex, true, 1, 0.03));
      add(this.quadsMesh(plans, this.dashTex, true, 0.95, 0.04));
      for (const [x, y] of stones) { const r = KM.ART.carry('stone'); r.scale.setScalar(0.8); r.position.set(x + 0.5, this.groundY(x + 0.5, y + 0.5) + 0.02, y + 0.5); G.add(r); }
    },
    checksum(arrs) {
      let h = 0;
      for (const a of arrs) for (let i = 0; i < a.length; i++) h = (h * 31 + a[i] * (i + 7)) | 0;
      return h;
    },

    // ---------- casas ----------
    houseKey(S, h) {
      const prog = h.total ? h.used / h.total : 0;
      return h.state + '|' + (h.state === 'site' ? Math.min(3, Math.floor(prog * 4)) : '') + '|' + h.owner + '|' + (h.state === 'site' ? Object.values(h.mat).map((m) => m.have).join(',') : '');
    },
    buildHouse(S, h) {
      const G = new THREE.Group();
      const cx = h.x + h.w / 2, cy = h.y + h.h / 2;
      let gy = -1e9;
      for (let y = h.y; y <= h.y + h.h; y++) for (let x = h.x; x <= h.x + h.w; x++) gy = Math.max(gy, KM.hAt(S.map, x, y) * HY);
      G.position.set(cx, gy, cy);
      // chão de terra batida sob a casa (esconde degraus do relevo)
      // fundação: laterais de pedra (aparecem em terreno inclinado) e terra batida por cima
      let gmin = 1e9;
      for (let y = h.y; y <= h.y + h.h; y++) for (let x = h.x; x <= h.x + h.w; x++) gmin = Math.min(gmin, KM.hAt(S.map, x, y) * HY);
      const st = KM.ART.mat('stone'), di = KM.ART.mat('dirt');
      const pad = new THREE.Mesh(this.padGeo || (this.padGeo = new THREE.BoxGeometry(1, 1, 1).translate(0, -0.48, 0)), this.padMats || (this.padMats = [st, st, di, di, st, st]));
      pad.scale.set(h.w * 0.8, gy - gmin + 0.12, h.h * 0.74); pad.receiveShadow = true; pad.castShadow = true;
      G.add(pad);
      const dx = (h.ex + 0.5) - cx;
      if (h.state === 'plan') {
        G.add(KM.ART.plan(h.w, h.h));
        pad.material = this.planPadMats || (this.planPadMats = [KM.ART.mat('stone'), KM.ART.mat('stone'), KM.ART.mat('dirt'), KM.ART.mat('dirt'), KM.ART.mat('stone'), KM.ART.mat('stone')].map((m) => Object.assign(m.clone(), { transparent: true, opacity: 0.55 })));
      } else if (h.state === 'site') {
        const prog = h.total ? h.used / h.total : 0;
        const stage = prog <= 0 ? 0 : prog < 0.34 ? 1 : prog < 0.67 ? 2 : 3;
        G.add(KM.ART.site(h.w, h.h, stage));
        // pilhas de material entregue
        let k = 0;
        for (const r in h.mat) {
          const n = h.mat[r].have;
          for (let j = 0; j < Math.min(n, 4); j++) {
            const o = KM.ART.carry(r === 'wood' ? 'planks' : 'stone');
            o.scale.setScalar(0.85);
            o.position.set(-h.w / 2 + 0.3 + k * 0.55, j * 0.09, h.h / 2 - 0.12);
            G.add(o);
          }
          k++;
        }
      } else {
        const model = KM.ART.house(h.type, h.w, h.h, h.owner, dx);
        model.scale.y = 1.12;
        G.add(model);
        const info = model.userData.info || {};
        G.userData.fan = model.getObjectByName('fan') || null;
        G.userData.smoke = info.smoke || null;
        // animais vivos no cercado (porcos, cavalos)
        const pen = info.pen;
        if (pen) {
          const kind = h.type === 'swine' ? 'pig' : 'horse';
          const n = kind === 'pig' ? 3 : 1;
          for (let i = 0; i < n; i++) {
            const o = this.model(kind), p = this.proto[kind];
            if (!p) break;
            this.ownAnimal(o, kind, null);
            o.scale.setScalar(kind === 'pig' ? 0.3 / Math.max(0.01, p.size.x) : 0.85 / Math.max(0.01, p.size.z));
            o.position.set(pen[0] + (i - (n - 1) / 2) * 0.28, 0, pen[1] + (i % 2) * 0.12);
            o.rotation.y = KM.hash(h.id, i, 3) * 6.28;
            const mixer = new THREE.AnimationMixer(o.userData.inner);
            const clip = p.anims.find((a) => /Idle|Eating/.test(a.name)) || p.anims[0];
            if (clip) { const a = mixer.clipAction(clip); a.time = Math.random() * 3; a.play(); }
            (G.userData.mixers = G.userData.mixers || []).push(mixer);
            G.add(o);
          }
        }
        G.userData.top = new THREE.Box3().setFromObject(model).max.y - gy;
      }
      G.userData.key = this.houseKey(S, h);
      return G;
    },
    iconTex(ch) {
      this.iconCache = this.iconCache || {};
      if (this.iconCache[ch]) return this.iconCache[ch];
      const c = document.createElement('canvas'); c.width = c.height = 96;
      const g = c.getContext('2d');
      g.fillStyle = 'rgba(40,28,18,0.85)'; g.beginPath(); g.arc(48, 48, 44, 0, 7); g.fill();
      g.strokeStyle = '#e8c56b'; g.lineWidth = 5; g.stroke();
      g.font = '54px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ch, 48, 52);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      return (this.iconCache[ch] = t);
    },

    // ---------- unidades ----------
    // troca as malhas de um animal clonado (cavalo/porco) pela versão própria, mantendo esqueleto e animações
    ownAnimal(obj, kind, owner) {
      const inner = obj.userData.inner || obj;
      const parts = [];
      inner.traverse((o) => { if (o.isSkinnedMesh) parts.push(o); });
      if (!parts.length || !this.rig[kind]) return;
      const p0 = parts[0];
      const m = new THREE.SkinnedMesh(KM.ART.animal(kind, this.rig[kind], owner), KM.ART.charMat());
      m.castShadow = true; m.name = 'body';
      p0.parent.add(m);
      m.bind(p0.skeleton, p0.bindMatrix);
      for (const p of parts) p.parent.remove(p);
    },
    // pessoa Quaternius (people.js): um esqueleto, animações da Universal Animation Library
    buildPerson(S, u) {
      const cfg = CHAR[u.type] || CHAR.serf;
      const p = KM.PEOPLE.build(u.type, u.owner, u.id);
      const root = new THREE.Group(), body = p.obj;
      const vis = { root, body, cfg, q: true, mixer: new THREE.AnimationMixer(p.inner), actions: {}, cur: null, yaw: 0 };
      for (const k in KM.PEOPLE.clips) vis.actions[k] = vis.mixer.clipAction(KM.PEOPLE.clips[k]);
      if (cfg.horse) {
        const horse = this.model('horse');
        this.ownAnimal(horse, 'horse', u.type === 'knight' ? u.owner : null);
        const hp = this.proto.horse, hs = 1.2 / Math.max(hp.size.x, hp.size.z);
        horse.scale.setScalar(hs);
        root.add(horse);
        vis.horse = horse;
        vis.hmixer = new THREE.AnimationMixer(horse.userData.inner);
        vis.hactions = {};
        for (const a of hp.anims) vis.hactions[a.name.replace(/^.*\|/, '')] = vis.hmixer.clipAction(a);
        body.scale.multiplyScalar(0.95);
        body.position.y = hp.size.y * hs * 0.56; // quadril um pouco acima do dorso do cavalo
      }
      root.add(body);
      if (KM.SOLDIERS[u.type]) {
        const team = new THREE.Color(KM.pcolor(S, u.owner));
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.17, 0.21, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: team.multiplyScalar(0.8), transparent: true, opacity: 0.32, depthWrite: false }));
        ring.position.y = 0.03; ring.renderOrder = 2; ring.userData.own = true;
        root.add(ring);
      }
      this.world.add(root);
      return vis;
    },
    buildUnit(S, u) {
      if (KM.PEOPLE.ready) return this.buildPerson(S, u);
      const cfg = CHAR[u.type] || CHAR.serf;
      const root = new THREE.Group();
      const body = this.model(cfg.m);
      const inner = body.userData.inner;
      const scale = 0.58 / 2.0;
      body.scale.setScalar(scale);
      const vis = { root, body, cfg, mixer: new THREE.AnimationMixer(inner), actions: {}, cur: null, yaw: 0 };
      const team = new THREE.Color(KM.pcolor(S, u.owner));
      let hand = null;
      inner.traverse((o) => {
        if (!o.isMesh && !o.isSkinnedMesh) return;
        const n = o.name;
        if (OPTIONAL.includes(n)) { o.visible = cfg.show.includes(n); if (n === '1H_Axe' || n === '1H_Sword') hand = o.parent; }
        if (cfg.hide && cfg.hide.includes(n)) o.visible = false;
        if (/Cape/.test(n)) { o.material = o.material.clone(); o.material.color = team.clone().multiplyScalar(1.05); }
        o.castShadow = false;
      });
      // personagem próprio: uma malha gerada (corpo, roupa, chapéu, armas) presa ao mesmo esqueleto das animações
      const parts = [], extras = [];
      inner.traverse((o) => { if (o.isSkinnedMesh) parts.push(o); else if (o.isMesh) extras.push(o); });
      if (this.rig[cfg.m] && parts.length) {
        const p0 = parts[0];
        const own = new THREE.SkinnedMesh(KM.ART.character(u.type, u.owner, this.rig[cfg.m], u.id), KM.ART.charMat());
        own.name = 'body'; own.castShadow = true;
        p0.parent.add(own);
        own.bind(p0.skeleton, p0.bindMatrix);
        for (const p of parts.concat(extras)) p.parent.remove(p);
        vis.own = true;
      } else for (const p of parts) p.castShadow = true;
      if (cfg.spear && hand && !vis.own) {
        const sp = new THREE.Group();
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, cfg.spear / scale * 0.6, 6), KM.ART.toonify(new THREE.MeshStandardMaterial({ color: '#7a5230' })));
        const tip = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.35, 6), KM.ART.toonify(new THREE.MeshStandardMaterial({ color: '#cfd6de' })));
        tip.position.y = cfg.spear / scale * 0.3 + 0.15;
        sp.add(shaft, tip);
        sp.position.y = cfg.spear / scale * 0.12;
        hand.add(sp);
      }
      if (cfg.horse) {
        const horse = this.model('horse');
        this.ownAnimal(horse, 'horse', u.type === 'knight' ? u.owner : null);
        const hp = this.proto.horse;
        const hs = 1.2 / Math.max(hp.size.x, hp.size.z);
        body.scale.multiplyScalar(0.9);
        horse.scale.setScalar(hs);
        root.add(horse);
        vis.horse = horse;
        vis.hmixer = new THREE.AnimationMixer(horse.userData.inner);
        vis.hactions = {};
        for (const a of hp.anims) vis.hactions[a.name.replace(/^.*\|/, '')] = vis.hmixer.clipAction(a);
        body.position.y = hp.size.y * hs * 0.66;
        body.position.z = -0.05;
      }
      root.add(body);
      for (const a of this.proto[cfg.m].anims) vis.actions[a.name] = vis.mixer.clipAction(a);
      // anel de time sob os soldados
      if (KM.SOLDIERS[u.type]) {
        // marca discreta do reino sob os soldados (a seleção tem anel próprio, mais forte)
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.15, 0.185, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: team.clone().multiplyScalar(0.8), transparent: true, opacity: 0.32, depthWrite: false }));
        ring.position.y = 0.03; ring.renderOrder = 2; ring.userData.own = true;
        root.add(ring);
      }
      this.world.add(root);
      return vis;
    },
    play(vis, name, opts) {
      opts = opts || {};
      if (vis.q) name = KM.PEOPLE.anim(name);
      if (vis.cur === name && !opts.restart) { if (opts.ts) vis.actions[name].timeScale = opts.ts; return; }
      const a = vis.actions[name];
      if (!a) return;
      a.reset();
      a.setLoop(opts.once ? THREE.LoopOnce : THREE.LoopRepeat);
      a.clampWhenFinished = !!opts.once;
      a.timeScale = opts.ts || 1;
      if (vis.cur && vis.actions[vis.cur]) a.crossFadeFrom(vis.actions[vis.cur], opts.fade || 0.18, false);
      a.play();
      vis.cur = name;
    },
    hplay(vis, name) {
      if (!vis.hactions || vis.hcur === name) return;
      const a = vis.hactions[name] || vis.hactions.Idle;
      if (!a) return;
      a.reset(); a.play();
      if (vis.hcur && vis.hactions[vis.hcur]) a.crossFadeFrom(vis.hactions[vis.hcur], 0.2, false);
      vis.hcur = name;
    },
    unitAnim(S, u, vis) {
      const sd = KM.SOLDIERS[u.type], t = u.task;
      const moving = !!u.path;
      if (vis.horse) {
        this.hplay(vis, moving ? (sd.spd > 2.8 ? 'Gallop' : 'Walk') : 'Idle');
        if (u.atkA > 0.2) this.play(vis, '1H_Melee_Attack_Slice_Diagonal', { restart: vis.cur !== '1H_Melee_Attack_Slice_Diagonal', ts: 1.6 });
        else if (!(u.atkA > 0)) this.play(vis, 'Sit_Chair_Idle');
        return;
      }
      if (u.atkA > 0.2) {
        const nm = sd && sd.range ? (u.type === 'crossbowman' ? '2H_Ranged_Shoot' : '1H_Ranged_Shoot') : u.type === 'pikeman' || u.type === 'lancer' ? '2H_Melee_Attack_Stab' : u.type === 'swordsman' ? '1H_Melee_Attack_Slice_Diagonal' : '1H_Melee_Attack_Chop';
        this.play(vis, nm, { restart: vis.cur !== nm, ts: 1.5, fade: 0.08 });
        return;
      }
      if (u.atkA > 0) return;
      if (moving) { const nm = sd ? 'Walking_B' : u.carry ? 'Walking_C' : 'Walking_A'; this.play(vis, nm, { ts: (sd ? sd.spd : 1.6) * (!vis.q ? 0.62 : nm === 'Walking_C' ? 0.95 : 0.5) }); return; }
      const working = u.work || (t && (t.type === 'build' || t.type === 'repair' || t.type === 'road' || t.type === 'field' || t.type === 'level') && u.wt > 0);
      if (working) {
        let nm = '1H_Melee_Attack_Chop';
        if (t && t.type === 'gather') nm = { chop: '2H_Melee_Attack_Chop', mine: '1H_Melee_Attack_Chop', harvest: '1H_Melee_Attack_Slice_Horizontal', sow: 'Interact', plant: 'PickUp', fish: '1H_Ranged_Aiming' }[t.kind] || 'Interact';
        if (t && t.type === 'field') nm = 'Interact';
        this.play(vis, nm, { ts: 0.9 });
        return;
      }
      if (sd && u.target) { this.play(vis, sd.range ? '1H_Ranged_Aiming' : 'Blocking'); return; }
      this.play(vis, sd ? '2H_Melee_Idle' : 'Idle', { ts: 0.9 });
    },
    setCarry(vis, res) {
      if (vis.carryRes === res) return;
      if (vis.carryObj) { vis.root.remove(vis.carryObj); vis.carryObj = null; }
      vis.carryRes = res;
      if (!res) return;
      // itens próprios: troncos, tábuas, pedra, saco ou caixote, levados no ombro
      const k = res === 'trunk' ? 'logs' : res === 'wood' ? 'planks' : res === 'stone' ? 'stone' : (KM.FOOD[res] || ['corn', 'flour', 'skin', 'leather', 'coal', 'ironore', 'goldore'].includes(res)) ? 'sack' : 'crate';
      const o = KM.ART.carry(k);
      o.scale.setScalar(0.62);
      if (vis.q) { o.scale.setScalar(0.72); o.position.set(0, 0.62, -0.1); } else o.position.set(0, 0.36, -0.06);
      vis.root.add(o);
      vis.carryObj = o;
    },

    // ================= quadro =================
    frame(S, dt, ui) {
      if (!this.renderer) return;
      // janela aberta minimizada ou oculta: ajusta o tamanho quando ela aparecer
      if (this.vw !== innerWidth || this.vh !== innerHeight) this.resize();
      if (!innerWidth || !innerHeight) return;
      this.time += dt;
      if (!S) {
        // cenário vivo por trás do menu principal
        this.og.clearRect(0, 0, this.ov.width, this.ov.height);
        if (!this.ready) { this.renderer.setClearColor('#1a1410'); this.renderer.clear(); return; }
        if (!this.menuS) {
          const keepMe = KM.me, keepS = KM.simS;
          this.menuS = KM.newState({ seed: 20261, diff: 'normal', opponents: 1, aiMode: 'economy' });
          this.menuS.map.explored.fill(15);
          KM.me = keepMe; KM.simS = keepS;
          const st = Object.values(this.menuS.houses).find((h) => h.owner === 1 && h.type === 'storehouse');
          this.menuFocus = st ? { x: st.ex + 1, y: st.ey - 1 } : { x: 60, y: 20 };
        }
        const MS = this.menuS;
        if (this.S !== MS) { KM.setMapSize(MS.map.W, MS.map.H); this.buildBase(MS); this.fogDirty = true; }
        this.focus.x = this.menuFocus.x; this.focus.y = this.menuFocus.y;
        this.dist = 21; this.pitch = 0.62; this.yaw = this.time * 0.05;
        this.updateCamera(dt);
        if (this.fogDirty) { this.fogDirty = false; this.updateFog(MS); }
        this.syncHouses(MS, dt, { });
        this.syncUnits(MS, dt, {});
        this.syncFx(MS, dt);
        this.waterNormal.offset.set(this.time * 0.01, this.time * 0.006);
        if (this.windU) this.windU.value = this.time;
        for (const c of this.world.children) if (c.userData.cloud) { c.position.x += c.userData.cloud * dt; if (c.position.x > MS.map.W + 20) c.position.x = -20; }
        this.renderScene();
        return;
      }
      if (S !== this.S || (!this.built && this.ready)) this.buildBase(S);
      if (!this.ready || !this.built) { this.og.clearRect(0, 0, this.ov.width, this.ov.height); return; }
      const m = S.map;
      // terreno alterado
      if (this.tDirty) { const d = this.tDirty; this.tDirty = null; this.updateTerrain(S, d[0], d[1], d[2], d[3]); if (this.shoreTex) this.updateShore(S); this.fogDirty = true; this.objDirty = true; this.decalDirty = true; for (const id in this.houseVis) this.houseVis[id].userData.key = ''; }
      this.chkT = (this.chkT || 0) - dt;
      if (this.chkT <= 0) {
        this.chkT = 0.5;
        const so = this.checksum([m.tree, m.stone, m.fstage, m.field, m.ore]);
        if (so !== this.sums.obj) { this.sums.obj = so; this.objDirty = true; }
        const sd = this.checksum([m.road, m.field, m.rmat]);
        if (sd !== this.sums.dec) { this.sums.dec = sd; this.decalDirty = true; }
      }
      if (this.fogDirty) { this.fogDirty = false; this.updateFog(S); this.fogRebuildT = 0.6; }
      if (this.fogRebuildT != null) { this.fogRebuildT -= dt; if (this.fogRebuildT <= 0) { this.fogRebuildT = null; this.objDirty = true; this.decalDirty = true; } }
      if (this.objDirty) { this.objDirty = false; this.rebuildObjects(S); }
      if (this.decalDirty) { this.decalDirty = false; this.rebuildDecals(S); }

      this.updateCamera(dt);
      this.syncHouses(S, dt, ui);
      this.syncUnits(S, dt, ui);
      this.syncProjectiles(S, dt);
      this.syncFx(S, dt);
      this.syncTools(S, ui);
      this.syncZone(S, dt);
      // água e nuvens animadas
      this.waterNormal.offset.set(this.time * 0.01, this.time * 0.006);
      if (this.windU) this.windU.value = this.time;
      for (const c of this.world.children) if (c.userData.cloud) { c.position.x += c.userData.cloud * dt; if (c.position.x > m.W + 20) c.position.x = -20; }
      this.renderScene();
      this.drawOverlay(S, ui);
    },

    // ---------- câmera ----------
    updateCamera(dt) {
      const S = this.S, m = S.map;
      this.focus.x = KM.clamp(this.focus.x, 0, m.W); this.focus.y = KM.clamp(this.focus.y, 0, m.H);
      const gy = KM.hAt(m, this.focus.x, this.focus.y) * HY;
      this.fy = this.fy == null ? gy : this.fy + (gy - this.fy) * Math.min(1, dt * 4);
      const c = this.camera, d = this.dist, p = this.pitch;
      c.position.set(this.focus.x + Math.sin(this.yaw) * d * Math.cos(p), this.fy + d * Math.sin(p), this.focus.y + Math.cos(this.yaw) * d * Math.cos(p));
      c.lookAt(this.focus.x, this.fy, this.focus.y);
      c.updateMatrixWorld();
      this.scene.fog.near = d * 1.6; this.scene.fog.far = d * 4.2;
      const s = this.sun;
      s.position.set(this.focus.x - 20, 26, this.focus.y + 10);
      s.target.position.set(this.focus.x, 0, this.focus.y);
      const ext = KM.clamp(d * 1.25, 14, 60);
      const sc = s.shadow.camera;
      if (sc.right !== ext) { sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.updateProjectionMatrix(); }
      // retângulo visível aproximado (para sons e minimapa)
      const poly = this.viewPoly();
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (const [x, y] of poly) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      this.vis = { x0: Math.max(0, Math.floor(x0)), x1: Math.min(m.W - 1, Math.ceil(x1)), y0: Math.max(0, Math.floor(y0)), y1: Math.min(m.H - 1, Math.ceil(y1)) };
      this.poly = poly;
    },
    centerOn(tx, ty) { this.focus.x = tx + 0.5; this.focus.y = ty + 0.5; },
    // direita da tela = (cos, -sin); "para cima" da tela = (-sin, -cos) no plano x,z
    panScreen(dx, dy) {
      const k = this.dist * 0.00215, cs = Math.cos(this.yaw), sn = Math.sin(this.yaw);
      this.focus.x += (-dx * cs - dy * sn) * k;
      this.focus.y += (dx * sn - dy * cs) * k;
    },
    panWorld(dx, dy) {
      const cs = Math.cos(this.yaw), sn = Math.sin(this.yaw);
      this.focus.x += dx * cs + dy * sn;
      this.focus.y += -dx * sn + dy * cs;
    },
    zoom(f) { this.dist = KM.clamp(this.dist * f, 7, 55); },
    rotate(d) { this.yaw += d; },
    clampCam() { },
    // raio da tela até o chão (marcha sobre o relevo)
    rayGround(sx, sy) {
      const v = new THREE.Vector2((sx / this.vw) * 2 - 1, -(sy / this.vh) * 2 + 1);
      this.ray.setFromCamera(v, this.camera);
      const o = this.ray.ray.origin, d = this.ray.ray.direction, m = this.S.map;
      if (d.y >= -0.01) return null;
      let tPrev = 0;
      for (let t = 0; t < 400; t += 0.2) {
        const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t;
        const gy = x >= 0 && z >= 0 && x <= m.W && z <= m.H ? this.groundY(x, z) : 0;
        if (y <= gy) {
          let a = tPrev, b = t;
          for (let k = 0; k < 10; k++) { const mid = (a + b) / 2; const yy = o.y + d.y * mid, xx = o.x + d.x * mid, zz = o.z + d.z * mid; if (yy <= this.groundY(KM.clamp(xx, 0, m.W), KM.clamp(zz, 0, m.H))) b = mid; else a = mid; }
          return { x: o.x + d.x * b, z: o.z + d.z * b };
        }
        tPrev = t;
      }
      return null;
    },
    pickTile(sx, sy) {
      if (!this.ready || !this.S) return { tx: -1, ty: -1, fx: -1, fy: -1 };
      const p = this.rayGround(sx, sy);
      if (!p) return { tx: -1, ty: -1, fx: -1, fy: -1 };
      return { tx: Math.floor(p.x), ty: Math.floor(p.z), fx: p.x - 0.5, fy: p.z - 0.5 };
    },
    pickHouse(sx, sy) {
      if (!this.ready || !this.houseVis) return 0;
      const v = new THREE.Vector2((sx / this.vw) * 2 - 1, -(sy / this.vh) * 2 + 1);
      this.ray.setFromCamera(v, this.camera);
      const objs = [];
      for (const id in this.houseVis) { const g = this.houseVis[id]; if (g.visible) { g.userData.hid = +id; objs.push(g); } }
      const hits = this.ray.intersectObjects(objs, true);
      for (const hit of hits) {
        let o = hit.object;
        while (o && o.userData.hid == null) o = o.parent;
        if (o && !(hit.object.isSprite)) return o.userData.hid;
      }
      return 0;
    },
    toScreen(x, y, z) {
      const v = new THREE.Vector3(x, y, z).project(this.camera);
      return { x: (v.x + 1) / 2 * this.vw, y: (1 - v.y) / 2 * this.vh, behind: v.z > 1 };
    },
    unitScreen(u) {
      const vis = this.unitVis && this.unitVis[u.id];
      if (vis) { const p = vis.root.position; return this.toScreen(p.x, p.y + 0.35, p.z); }
      return this.toScreen(u.x + 0.5, this.groundY(u.x + 0.5, u.y + 0.5) + 0.35, u.y + 0.5);
    },
    viewPoly() {
      const pts = [[0, 0], [this.vw, 0], [this.vw, this.vh], [0, this.vh]].map(([sx, sy]) => {
        const v = new THREE.Vector2((sx / this.vw) * 2 - 1, -(sy / this.vh) * 2 + 1);
        this.ray.setFromCamera(v, this.camera);
        const o = this.ray.ray.origin, d = this.ray.ray.direction;
        const t = d.y < -0.02 ? (this.fy - o.y) / d.y : 200;
        return [o.x + d.x * Math.min(t, 200), o.z + d.z * Math.min(t, 200)];
      });
      return pts;
    },

    // ---------- sincronização ----------
    syncHouses(S, dt, ui) {
      const seen = {};
      for (const id in S.houses) {
        const h = S.houses[id];
        seen[id] = 1;
        const vis = this.houseVis[id];
        const visible = this.seen(S, h.ex, h.ey) || h.owner === KM.me;
        const key = this.houseKey(S, h);
        if (!vis || vis.userData.key !== key) {
          if (vis) { this.world.remove(vis); }
          const g = this.buildHouse(S, h);
          this.world.add(g);
          this.houseVis[id] = g;
        }
        const g = this.houseVis[id];
        g.visible = visible;
        if (!visible) continue;
        if (g.userData.fan) g.userData.fan.rotation.z += dt * (h.work ? 2.2 : 0.25);
        if (g.userData.mixers) for (const mx of g.userData.mixers) mx.update(dt);
        const sm = g.userData.smoke;
        if (h.state === 'built' && sm && h.work && Math.random() < dt * 3) this.puff(g.position.x + sm[0], g.position.y + sm[1], g.position.z + sm[2], 0.6);
        // casa muito danificada: fogo e fumaça escura
        if (h.state === 'built' && h.hp < h.maxHp * 0.5) {
          const dmg = 1 - h.hp / h.maxHp, top = g.userData.top || 1;
          if (Math.random() < dt * 10 * dmg) this.puff(g.position.x + (Math.random() - 0.5) * h.w * 0.5, g.position.y + top * (0.82 + Math.random() * 0.25), g.position.z + (Math.random() - 0.5) * h.h * 0.2, 1.2 + dmg * 1.2, Math.random() < 0.5 ? '#ff5a10' : '#ffd040', 0.6 + Math.random() * 0.4, false, 1);
          if (Math.random() < dt * 4 * dmg) this.puff(g.position.x + (Math.random() - 0.5) * h.w * 0.4, g.position.y + top, g.position.z, 1.1 + dmg, '#3a322c', 2.5 + Math.random(), false, 0.8);
        }
      }
      for (const id in this.houseVis) if (!seen[id]) { this.world.remove(this.houseVis[id]); delete this.houseVis[id]; }
    },
    syncUnits(S, dt, ui) {
      const seen = {};
      const v = this.vis;
      for (const id in S.units) {
        const u = S.units[id];
        seen[id] = 1;
        let vis = this.unitVis[id];
        const show = !u.inside && (u.owner === KM.me || this.seen(S, u.x, u.y));
        if (!vis) { if (!show) continue; vis = this.unitVis[id] = this.buildUnit(S, u); vis.root.position.set(u.x + 0.5, this.groundY(u.x + 0.5, u.y + 0.5), u.y + 0.5); }
        vis.root.visible = show;
        if (!show) continue;
        const onScreen = u.x >= v.x0 - 3 && u.x <= v.x1 + 3 && u.y >= v.y0 - 3 && u.y <= v.y1 + 3;
        const sd = KM.SOLDIERS[u.type];
        const jx = sd ? (((u.id * 37) % 9) - 4) / 22 : 0, jy = sd ? (((u.id * 53) % 7) - 3) / 22 : 0;
        const X = u.x + 0.5 + jx, Z = u.y + 0.5 + jy;
        const p = vis.root.position;
        const mdx = X - p.x, mdz = Z - p.z;
        p.set(X, this.groundY(X, Z), Z);
        // direção: movimento, alvo ou lado
        let ang = null;
        if (Math.abs(mdx) + Math.abs(mdz) > 0.002) ang = Math.atan2(mdx, mdz);
        const tg = u.target && KM.resolveTarget(S, u.target);
        if (tg && !u.path) { const tx = u.target.k === 'u' ? tg.x + 0.5 : KM.hcx(tg) + 0.5, tz = u.target.k === 'u' ? tg.y + 0.5 : KM.hcy(tg) + 0.5; ang = Math.atan2(tx - X, tz - Z); }
        if (u.task && u.task.type === 'gather' && u.work) ang = Math.atan2(u.task.x + 0.5 - X, u.task.y + 0.5 - Z);
        if (ang == null && sd) { const f = KM.DIRS8[u.heading == null ? 0 : u.heading]; ang = Math.atan2(f[0], f[1]); }
        if (ang != null) vis.yaw = ang;
        let dyaw = vis.yaw - vis.root.rotation.y;
        while (dyaw > Math.PI) dyaw -= Math.PI * 2; while (dyaw < -Math.PI) dyaw += Math.PI * 2;
        vis.root.rotation.y += dyaw * Math.min(1, dt * 10);
        this.setCarry(vis, u.carry);
        if (onScreen) {
          this.unitAnim(S, u, vis);
          vis.mixer.update(dt * (S.paused ? 0 : S.speed || 1));
          if (vis.hmixer) vis.hmixer.update(dt * (S.paused ? 0 : S.speed || 1));
        }
      }
      for (const id in this.unitVis) {
        if (seen[id]) continue;
        const vis = this.unitVis[id];
        delete this.unitVis[id];
        // morreu? toca a animação de morte antes de sumir
        const died = S.fx.some((e) => e.k === 'death' && e.t < 0.3 && Math.abs(e.x + 0.5 - vis.root.position.x) < 0.6 && Math.abs(e.y + 0.5 - vis.root.position.z) < 0.6);
        if (died && vis.root.visible) {
          this.play(vis, 'Death_A', { once: true, fade: 0.1 });
          if (vis.hactions) this.hplay(vis, 'Death');
          this.dying.push({ vis, t: 0 });
        } else this.world.remove(vis.root);
      }
      for (let i = this.dying.length - 1; i >= 0; i--) {
        const d = this.dying[i];
        d.t += dt * (S.paused ? 0 : 1);
        d.vis.mixer.update(dt); if (d.vis.hmixer) d.vis.hmixer.update(dt);
        if (d.t > 2.2) d.vis.root.position.y -= dt * 0.25;
        if (d.t > 3.5) { this.world.remove(d.vis.root); this.dying.splice(i, 1); }
      }
    },
    syncProjectiles(S, dt) {
      const pool = this.projVis;
      while (pool.length < S.proj.length) {
        const g = new THREE.Group();
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.36, 4).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#6b4a2a' }));
        const tip = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.07, 4).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#c9ced6', metalness: 0.5 }));
        tip.position.z = 0.2;
        const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.08), new THREE.MeshStandardMaterial({ color: '#8a8580' }));
        g.add(shaft, tip, stone);
        g.userData = { shaft, tip, stone };
        this.world.add(g);
        pool.push(g);
      }
      pool.forEach((g, i) => {
        const p = S.proj[i];
        g.visible = !!p;
        if (!p) return;
        const f = Math.min(1, p.t / p.T), arc = Math.sin(f * Math.PI) * (p.kind === 'stone' ? 1.6 : 0.9);
        const x = p.x + 0.5, z = p.y + 0.5;
        const y = this.groundY(x, z) + 0.45 + arc;
        const isStone = p.kind === 'stone';
        g.userData.stone.visible = isStone; g.userData.shaft.visible = !isStone; g.userData.tip.visible = !isStone;
        if (!isStone) {
          const nx = p.sx + (p.tx - p.sx) * Math.min(1, f + 0.02) + 0.5, nz = p.sy + (p.ty - p.sy) * Math.min(1, f + 0.02) + 0.5;
          const ny = this.groundY(nx, nz) + 0.45 + Math.sin(Math.min(1, f + 0.02) * Math.PI) * 0.9;
          g.lookAt(nx, ny, nz);
        }
        g.position.set(x, y, z);
        if (!isStone && p.kind === 'arrow') { /* flecha */ }
      });
    },
    puff(x, y, z, s, color, T, blend, op) {
      if (this.smoke.length > 220) return;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.smokeTex, color: color || '#dcdcdc', transparent: true, opacity: 0.7, depthWrite: false, blending: blend ? THREE.AdditiveBlending : THREE.NormalBlending }));
      sp.position.set(x, y, z); sp.scale.setScalar(s * 0.4);
      sp.userData = { t: 0, T: T || 2.2 + Math.random(), vx: (Math.random() - 0.5) * 0.15, s, o: op || 0.65 };
      this.world.add(sp);
      this.smoke.push(sp);
    },
    syncFx(S, dt) {
      for (const e of S.fx) {
        if (e.k === 'smoke' && !e._v) {
          e._v = 1;
          for (let k = 0; k < 14; k++) this.puff(e.x + 0.5 + (Math.random() - 0.5), this.groundY(e.x + 0.5, e.y + 0.5) + 0.3 + Math.random() * 0.6, e.y + 0.5 + (Math.random() - 0.5), 2.2);
        }
        // obra concluída: poeira assentando ao redor e faíscas douradas subindo do telhado
        if (e.k === 'built' && !e._v && this.seen(S, e.x + e.w / 2, e.y + e.h / 2)) {
          e._v = 1;
          const cx = e.x + e.w / 2, cz = e.y + e.h / 2, gy = this.groundY(cx, cz), top = (this.houseVis[e.id] && this.houseVis[e.id].userData.top) || 1.2;
          for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; this.puff(cx + Math.cos(a) * e.w * 0.6, gy + 0.15, cz + Math.sin(a) * e.h * 0.6, 1.4, '#d8c8a8', 1.6 + Math.random() * 0.6, false, 0.5); }
          for (let k = 0; k < 22; k++) this.puff(cx + (Math.random() - 0.5) * e.w * 0.8, gy + top * (0.6 + Math.random() * 0.6), cz + (Math.random() - 0.5) * e.h * 0.6, 0.35 + Math.random() * 0.3, Math.random() < 0.5 ? '#ffd860' : '#fff2b0', 1.2 + Math.random() * 1.2, true, 0.9);
        }
        if (e.k === 'rubble' && !e._v) {
          e._v = 1;
          const o = KM.ART.ruin(e.w, e.h);
          o.position.set(e.x + e.w / 2, KM.hAt(S.map, e.x + e.w / 2, e.y + e.h / 2) * HY, e.y + e.h / 2);
          this.world.add(o);
          (this.rubble = this.rubble || []).push({ o, e });
        }
      }
      if (this.rubble) for (let i = this.rubble.length - 1; i >= 0; i--) { const r = this.rubble[i]; if (!S.fx.includes(r.e)) { this.world.remove(r.o); this.rubble.splice(i, 1); } }
      for (let i = this.smoke.length - 1; i >= 0; i--) {
        const sp = this.smoke[i], u = sp.userData;
        u.t += dt;
        const f = u.t / u.T;
        sp.position.y += dt * 0.35; sp.position.x += u.vx * dt;
        sp.scale.setScalar(u.s * (0.4 + f * 0.9));
        sp.material.opacity = u.o * (1 - f);
        if (f >= 1) { this.world.remove(sp); sp.material.dispose(); this.smoke.splice(i, 1); }
      }
    },

    // ---------- fronteira da paz: cortina de luz nas divisas do quadrante do jogador ----------
    syncZone(S, dt) {
      const z = KM.zone(S, KM.me), key = z ? [z.x0, z.y0, z.x1, z.y1].join() : '';
      if (this.zoneMesh && this.zoneMesh.parent !== this.world) this.zoneMesh = null;
      if (key !== this.zoneKey || (z && !this.zoneMesh)) {
        this.zoneKey = key;
        if (this.zoneMesh) { this.world.remove(this.zoneMesh); this.zoneMesh.geometry.dispose(); this.zoneMesh = null; }
        if (!z) return;
        if (!this.zoneTex) {
          const cv = document.createElement('canvas'); cv.width = 32; cv.height = 64;
          const g = cv.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 64);
          gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.75, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0.9)');
          g.fillStyle = gr; g.fillRect(0, 0, 32, 64);
          g.clearRect(20, 0, 12, 52); // fenda entre os "painéis": lê como uma cerca de luz
          this.zoneTex = new THREE.CanvasTexture(cv);
          this.zoneTex.wrapS = THREE.RepeatWrapping; this.zoneTex.colorSpace = THREE.SRGBColorSpace;
        }
        const m = S.map, segs = [];
        // só as divisas internas: as bordas do mapa já são o limite
        // [x0, y0, x1, y1, direção para fora do território]
        if (z.x0 > 0) segs.push([z.x0, z.y0, z.x0, z.y1 + 1, -1, 0]);
        if (z.x1 < m.W - 1) segs.push([z.x1 + 1, z.y0, z.x1 + 1, z.y1 + 1, 1, 0]);
        if (z.y0 > 0) segs.push([z.x0, z.y0, z.x1 + 1, z.y0, 0, -1]);
        if (z.y1 < m.H - 1) segs.push([z.x0, z.y1 + 1, z.x1 + 1, z.y1 + 1, 0, 1]);
        const pos = [], uv = [], idx = [];
        const strip = (pts) => {
          // pts: pares [baixo, cima] por amostra; vira uma tira de quads
          const base = pos.length / 3;
          pts.forEach(([a, b, u], i) => {
            pos.push(...a, ...b); uv.push(u, 0, u, 1); // v=0: forte na divisa, some para v=1
            if (i < pts.length - 1) { const k = base + i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
          });
        };
        for (const [x0, y0, x1, y1, nx, ny] of segs) {
          const L = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(L * 2), wall = [], ground = [];
          for (let i = 0; i <= n; i++) {
            const f = i / n, x = x0 + (x1 - x0) * f, y = y0 + (y1 - y0) * f, gy = Math.max(this.groundY(x, y), WL);
            const ox = x + nx * 1.2, oy = y + ny * 1.2, go = Math.max(this.groundY(ox, oy), WL);
            // cortina de luz na divisa e faixa no chão do lado de fora (lida bem de cima)
            wall.push([[x, gy + 0.02, y], [x, gy + 1.1, y], f * L * 0.5]);
            ground.push([[x, gy + 0.05, y], [ox, go + 0.05, oy], f * L * 0.5]);
          }
          strip(wall); strip(ground);
        }
        const geo = new THREE.BufferGeometry();
        geo.setIndex(idx);
        geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
        const col = new THREE.Color(KM.pcolor(S, KM.me)).lerp(new THREE.Color('#fff4d0'), 0.45);
        const mesh = this.zoneMesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: this.zoneTex, color: col, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false }));
        mesh.renderOrder = 6;
        this.world.add(mesh);
      }
      if (this.zoneMesh) {
        this.zoneTex.offset.x -= dt * 0.25;
        // pisca mais forte no último minuto de paz
        const left = S.peaceEnd - S.time;
        this.zoneMesh.material.opacity = left < 60 ? 0.55 + Math.sin(this.time * 6) * 0.35 : 0.85;
      }
    },

    // ---------- seleção, fantasma de construção, prévias ----------
    syncTools(S, ui) {
      if (this.toolGroup) { this.world.remove(this.toolGroup); this.dispose(this.toolGroup); }
      const G = this.toolGroup = new THREE.Group();
      this.world.add(G);
      const m = S.map;
      // anéis de seleção
      const ringMat = this.ringMat || (this.ringMat = new THREE.MeshBasicMaterial({ color: '#ffe066', transparent: true, opacity: 0.95, depthWrite: false }));
      const ringGeo = this.ringGeo || (this.ringGeo = new THREE.RingGeometry(0.22, 0.28, 24).rotateX(-Math.PI / 2));
      if (ui.selSet) for (const id of ui.selSet) {
        const vis = this.unitVis[id];
        if (!vis || !vis.root.visible) continue;
        const r = new THREE.Mesh(ringGeo, ringMat);
        r.position.copy(vis.root.position); r.position.y += 0.04; r.renderOrder = 4;
        G.add(r);
      }
      const tiles = [];
      if (ui.selHouse && S.houses[ui.selHouse]) {
        const h = S.houses[ui.selHouse];
        for (let y = h.y; y < h.y + h.h; y++) for (let x = h.x; x < h.x + h.w; x++) tiles.push({ x, y, c: [1, 0.88, 0.4] });
      }
      const tool = ui.tool, hov = ui.hover;
      if (tool && hov && hov.tx >= 0) {
        if (tool.build) {
          const d = KM.HOUSES[tool.build];
          const x = hov.tx - (d.w >> 1), y = hov.ty - (d.h >> 1);
          const ok = KM.canPlace(S, tool.build, x, y, KM.me).ok;
          const c = ok ? [0.45, 0.95, 0.4] : [1, 0.3, 0.3];
          for (let yy = y; yy < y + d.h; yy++) for (let xx = x; xx < x + d.w; xx++) if (KM.inb(xx, yy)) tiles.push({ x: xx, y: yy, c, fill: true });
          if (KM.inb(x + (d.w >> 1), y + d.h)) tiles.push({ x: x + (d.w >> 1), y: y + d.h, c: [1, 0.85, 0.2], fill: true });
          // prévia do prédio
          const ghostKey = tool.build + '|' + KM.me;
          if (this.ghostKey !== ghostKey) {
            this.ghostKey = ghostKey;
            const fake = { id: 0, type: tool.build, owner: KM.me, x: 0, y: 0, w: d.w, h: d.h, ex: d.w >> 1, ey: d.h, state: 'built', total: 1, used: 1, mat: {} };
            this.ghost = this.buildHouse(S, fake);
            const fade = (mt) => Object.assign(mt.clone(), { transparent: true, opacity: 0.6 });
            this.ghost.traverse((o) => { if (o.isMesh) { o.material = Array.isArray(o.material) ? o.material.map(fade) : fade(o.material); o.castShadow = false; } });
          }
          let gy = -1e9;
          for (let yy = y; yy <= y + d.h; yy++) for (let xx = x; xx <= x + d.w; xx++) gy = Math.max(gy, KM.hAt(m, KM.clamp(xx, 0, m.W), KM.clamp(yy, 0, m.H)) * HY);
          this.ghost.position.set(x + d.w / 2, gy, y + d.h / 2);
          G.add(this.ghost);
          if (d.radius) {
            const circ = new THREE.Mesh(new THREE.RingGeometry(d.radius - 0.05, d.radius + 0.05, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.5, depthWrite: false }));
            circ.userData.own = true;
            circ.position.set(x + (d.w >> 1) + 0.5, gy + 0.08, y + d.h + 0.5);
            G.add(circ);
          }
        } else if (ui.drag && ui.drag.tiles) {
          for (const [x, y, ok] of ui.drag.tiles) tiles.push({ x, y, c: ok ? (tool === 'road' ? [0.85, 0.65, 0.45] : tool === 'field' ? [1, 0.9, 0.35] : [0.8, 0.4, 0.85]) : [1, 0.3, 0.3], fill: true });
        } else tiles.push({ x: hov.tx, y: hov.ty, c: tool === 'demolish' ? [1, 0.3, 0.3] : [1, 0.9, 0.4] });
      }
      if (S.editor && hov && hov.tx >= 0 && KM.editor.tool !== 'house' && KM.editor.tool !== 'start') {
        const r = KM.editor.brush;
        const circ = new THREE.Mesh(new THREE.RingGeometry(r - 0.55, r - 0.45, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffe066', transparent: true, opacity: 0.9, depthWrite: false }));
        circ.userData.own = true;
        circ.position.set(hov.tx + 0.5, this.groundY(hov.tx + 0.5, hov.ty + 0.5) + 0.1, hov.ty + 0.5);
        G.add(circ);
      }
      if (S.editor) S.edStarts.forEach((s, k) => {
        const f = KM.ART.flagPole(k);
        f.scale.setScalar(1.3);
        f.position.set(s.x + 0.5, this.groundY(s.x + 0.5, s.y + 0.5), s.y + 0.5);
        G.add(f);
        const circ = new THREE.Mesh(new THREE.RingGeometry(7.3, 7.5, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: KM.COLORS[k], transparent: true, opacity: 0.8, depthWrite: false }));
        circ.userData.own = true;
        circ.position.set(s.x + 0.5, this.groundY(s.x + 0.5, s.y + 0.5) + 0.1, s.y + 0.5);
        G.add(circ);
      });
      const fill = tiles.filter((t) => t.fill), out = tiles.filter((t) => !t.fill);
      const a = this.quadsMesh(fill, this.solidTex, true, 0.45, 0.06); if (a) G.add(a);
      const b = this.quadsMesh(out, this.dashTex, true, 1, 0.07); if (b) G.add(b);
    },

    // ---------- camada 2D por cima (barras, estandartes, rótulos, caixa de seleção) ----------
    drawOverlay(S, ui) {
      const g = this.og, dpr = this.odpr;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, this.ov.width, this.ov.height);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const bar = (x, y, w, f, col) => {
        g.fillStyle = 'rgba(15,12,10,0.75)'; g.fillRect(x - 1, y - 1, w + 2, 6);
        g.fillStyle = col; g.fillRect(x, y, w * KM.clamp(f, 0, 1), 4);
      };
      const sel = ui.selSet;
      for (const id in this.unitVis) {
        const vis = this.unitVis[id], u = S.units[id];
        if (!u || !vis.root.visible) continue;
        const p = vis.root.position;
        const grp = u.g && S.army[u.g];
        const lead = grp && grp.m[0] === u.id;
        const selected = sel && sel.has(u.id);
        if (!(u.hp < u.maxHp || selected || lead || (u.hunger < 25 && u.owner === KM.me))) continue;
        const top = (vis.horse ? 1.05 : 0.8) + (vis.q ? 0.2 : 0);
        const q = this.toScreen(p.x, p.y + top, p.z);
        if (q.behind || q.x < -50 || q.y < -50 || q.x > this.vw + 50 || q.y > this.vh + 50) continue;
        if (u.hp < u.maxHp || selected) bar(q.x - 14, q.y - 6, 28, u.hp / u.maxHp, u.owner === KM.me ? '#5fd35a' : KM.hostile(S, KM.me, u.owner) ? '#ef4b4b' : '#3fa6ff');
        if (lead) {
          // estandarte do grupo: mastro com ponta dourada, flâmula ondulante de duas pontas e número num escudo de pergaminho
          const col = KM.pcolor(S, u.owner);
          const bx = q.x + 14, by = q.y - 30, wv = this.time * 6 + u.id;
          g.fillStyle = '#4a3220'; g.fillRect(bx - 1, by - 2, 2.5, 30);
          g.fillStyle = '#e8c060'; g.beginPath(); g.arc(bx + 0.25, by - 3, 2.6, 0, 7); g.fill();
          const pts = [];
          for (let i = 0; i <= 6; i++) { const t = i / 6; pts.push([bx + 1.5 + t * 22, by + Math.sin(wv - t * 3) * 1.8 * t]); }
          g.beginPath();
          pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
          const tip = pts[6];
          g.lineTo(tip[0] - 5, tip[1] + 6.5); g.lineTo(tip[0], tip[1] + 13);
          for (let i = 6; i >= 0; i--) g.lineTo(pts[i][0], pts[i][1] + 13);
          g.closePath();
          g.fillStyle = col; g.fill();
          g.strokeStyle = 'rgba(20,12,6,0.65)'; g.lineWidth = 1.2; g.stroke();
          g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(bx + 2, by + 1 + Math.sin(wv) * 0.3, 14, 2);
          if (grp.m.length > 1) {
            const sx = bx - 9, sy = by + 1;
            g.beginPath(); g.moveTo(sx - 8, sy - 7); g.lineTo(sx + 8, sy - 7); g.lineTo(sx + 8, sy + 2); g.quadraticCurveTo(sx + 8, sy + 8, sx, sy + 11); g.quadraticCurveTo(sx - 8, sy + 8, sx - 8, sy + 2); g.closePath();
            g.fillStyle = '#efe0bc'; g.fill(); g.strokeStyle = '#6a4a22'; g.lineWidth = 1.3; g.stroke();
            g.font = '800 10.5px "Alegreya Sans", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
            g.fillStyle = '#3a2410'; g.fillText(grp.m.length, sx, sy + 1);
          }
        }
        if (u.hunger < 25 && u.owner === KM.me) { g.font = '14px "Segoe UI Emoji",sans-serif'; g.textAlign = 'center'; g.fillText('🍗', q.x, q.y - 16); }
        if (u.flankedAt != null && S.time - u.flankedAt < 1.2) {
          g.font = '700 12px "Alegreya Sans",sans-serif'; g.textAlign = 'center';
          g.fillStyle = '#ffe066'; g.fillText(u.flankBonus >= 1.3 ? 'Costas +30%' : 'Flanco +15%', q.x, q.y - 28);
        }
      }
      for (const id in this.houseVis) {
        const hv = this.houseVis[id], h = S.houses[id];
        if (!h || !hv.visible) continue;
        const selected = ui.selHouse === h.id;
        const mine = h.owner === KM.me;
        const d = KM.def(h);
        const top = (hv.userData.top || 1.2) + 0.2;
        const q = this.toScreen(hv.position.x, hv.position.y + top, hv.position.z);
        if (q.behind || q.x < -80 || q.y < -80 || q.x > this.vw + 80 || q.y > this.vh + 80) continue;
        if (h.state === 'site') bar(q.x - 24, q.y, 48, h.total ? h.used / h.total : 0, '#f5b83a');
        if (mine && h.prio && h.state !== 'built') { g.font = '16px "Segoe UI Emoji",sans-serif'; g.textAlign = 'center'; g.fillText('⭐', q.x + 34, q.y + 5); }
        else if (h.hp < h.maxHp || selected) bar(q.x - 24, q.y, 48, h.hp / h.maxHp, mine ? '#5fd35a' : KM.hostile(S, KM.me, h.owner) ? '#ef4b4b' : '#3fa6ff');
        if (mine && !S.editor) {
          if ((S.protected || []).includes(h.id)) { g.font = '14px "Segoe UI Emoji",sans-serif'; g.textAlign = 'center'; g.fillStyle = '#ffe066'; g.fillText('🛡️ Proteger', q.x, q.y - 17); }
          // casas sem estrada até o Armazém: o erro mais comum de quem está começando
          if (!this.linkT || this.time - this.linkT > 1) { this.linkT = this.time; this.unlinked = new Set(); for (const hid in S.houses) { const o = S.houses[hid]; if (o.owner === KM.me && !KM.roadLinked(S, o)) this.unlinked.add(o.id); } }
          if (this.unlinked && this.unlinked.has(h.id)) {
            g.font = '700 12px "Alegreya Sans", sans-serif';
            const txt = '⚠ sem estrada', w = g.measureText(txt).width + 14;
            g.fillStyle = 'rgba(120,30,20,0.9)'; g.beginPath(); g.roundRect(q.x - w / 2, q.y - 40, w, 20, 5); g.fill();
            g.fillStyle = '#ffe9c9'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, q.x, q.y - 29.5);
            continue;
          }
        }
        if (mine && h.state === 'built') {
          const needsWorker = d.worker && !h.worker, noOrders = h.orders && !h.orders.some((o) => o > 0);
          const badge = needsWorker ? '❗' : h.paused ? '⏸️' : noOrders ? '📋' : null;
          if (badge && Math.floor(this.time * 2) % 2 === 0) { g.font = '18px "Segoe UI Emoji",sans-serif'; g.textAlign = 'center'; g.fillText(badge, q.x, q.y - 14); }
        }
      }
      // Os objetivos territoriais têm marcadores próprios, visíveis também sem seleção.
      for (const site of S.sites || []) {
        const q = this.toScreen(site.x + 0.5, this.groundY(site.x + 0.5, site.y + 0.5) + 0.15, site.y + 0.5);
        if (q.behind || q.x < 0 || q.y < 0 || q.x > this.vw || q.y > this.vh) continue;
        const color = site.contested ? '#ff6050' : site.owner >= 0 ? S.players[site.owner].color : '#ffe066';
        g.beginPath();
        for (let k = 0; k <= 32; k++) {
          const a = k / 32 * Math.PI * 2, x = KM.clamp(site.x + 0.5 + Math.cos(a) * site.r, 0, S.map.W - 1), y = KM.clamp(site.y + 0.5 + Math.sin(a) * site.r, 0, S.map.H - 1);
          const p = this.toScreen(x, this.groundY(x, y) + 0.08, y);
          if (k) g.lineTo(p.x, p.y); else g.moveTo(p.x, p.y);
        }
        g.strokeStyle = color; g.lineWidth = 2; g.setLineDash([6, 4]); g.stroke(); g.setLineDash([]);
        const text = `🚩 ${site.n}${site.outpost ? ' · posto' : ''}${site.contested ? ' · contestado' : ''}`;
        g.font = '700 14px "Alegreya Sans",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        const w = g.measureText(text).width + 20;
        g.fillStyle = 'rgba(28,20,14,0.9)'; g.fillRect(q.x - w / 2, q.y - 32, w, 25);
        g.fillStyle = color; g.fillText(text, q.x, q.y - 19);
      }
      this.drawRoutes(S, ui);
      // obra concluída: nome subindo sobre a casa
      for (const e of S.fx) {
        if (e.k !== 'built' || e.o !== KM.me || e.t > e.T) continue;
        const hv = this.houseVis[e.id], h = S.houses[e.id];
        if (!hv || !hv.visible || !h) continue;
        const f = e.t / e.T, q = this.toScreen(hv.position.x, hv.position.y + (hv.userData.top || 1.2) + 0.3, hv.position.z);
        if (q.behind) continue;
        const txt = `✔ ${KM.def(h).n} concluído!`;
        g.globalAlpha = f < 0.12 ? f / 0.12 : 1 - Math.max(0, (f - 0.6) / 0.4);
        g.font = '800 17px "Alegreya Sans", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        const y = q.y - 52 - f * 26, w = g.measureText(txt).width + 26;
        g.fillStyle = 'rgba(40,26,10,0.88)'; g.beginPath(); g.roundRect(q.x - w / 2, y - 14, w, 28, 8); g.fill();
        g.strokeStyle = '#e8c56b'; g.lineWidth = 1.5; g.stroke();
        g.fillStyle = '#ffe9a8'; g.fillText(txt, q.x, y + 1);
        g.globalAlpha = 1;
      }
      // ponto de encontro do Quartel selecionado
      const sb = ui.selHouse && S.houses[ui.selHouse];
      if (sb && sb.type === 'barracks' && sb.owner === KM.me && sb.state === 'built') {
        const rp = sb.rally || { x: sb.ex, y: sb.ey + 3 };
        const q = this.toScreen(rp.x + 0.5, this.groundY(rp.x + 0.5, rp.y + 0.5) + 0.5, rp.y + 0.5);
        if (!q.behind) { g.font = '22px "Segoe UI Emoji",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.fillText('🚩', q.x + 6, q.y); }
      }
      // nome da casa sob o mouse
      if (!S.editor && ui.hover && !ui.tool && KM.inb(ui.hover.tx, ui.hover.ty)) {
        const m = S.map;
        let hid = m.house[ui.hover.ty * m.W + ui.hover.tx];
        const h = hid && S.houses[hid];
        const hv = h && this.houseVis[hid];
        if (h && hv && hv.visible && h.state === 'built') {
          const q = this.toScreen(hv.position.x, hv.position.y + (hv.userData.top || 1.2) + 0.2, hv.position.z);
          const d = KM.def(h);
          g.font = '600 14px "Alegreya Sans", sans-serif';
          const txt = `${d.i}  ${d.n}`, w = g.measureText(txt).width + 22;
          g.fillStyle = 'rgba(28,20,14,0.88)'; g.beginPath(); g.roundRect(q.x - w / 2, q.y - 44, w, 26, 6); g.fill();
          g.strokeStyle = 'rgba(232,197,107,0.7)'; g.lineWidth = 1; g.stroke();
          g.fillStyle = '#f3e3bf'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, q.x, q.y - 31);
        }
      }
      if (ui.box) {
        const b = ui.box;
        g.fillStyle = 'rgba(255,224,102,0.12)'; g.strokeStyle = '#ffe066'; g.lineWidth = 1.5;
        const x = Math.min(b.x0, b.x1), y = Math.min(b.y0, b.y1), w = Math.abs(b.x1 - b.x0), hh = Math.abs(b.y1 - b.y0);
        g.fillRect(x, y, w, hh); g.strokeRect(x + 0.5, y + 0.5, w, hh);
      }
    },

    // rota das tropas selecionadas (como no KaM): trilha tracejada pelo caminho real, marcas onde cada
    // soldado vai parar e um estandarte fincado no destino; ataque ordenado ganha linha vermelha até o alvo
    drawRoutes(S, ui) {
      const g = this.og;
      const gp = (x, y, lift) => this.toScreen(x + 0.5, Math.max(this.groundY(x + 0.5, y + 0.5), WL) + (lift || 0.05), y + 0.5);
      // clique de ordem: anel que se abre no chão
      for (const e of S.fx) {
        if (e.k !== 'order' || e.t > e.T) continue;
        const q = gp(e.x, e.y), f = e.t / e.T, r = 8 + f * 22;
        if (q.behind) continue;
        g.strokeStyle = `rgba(255,233,168,${1 - f})`; g.lineWidth = 2.5;
        g.beginPath(); g.ellipse(q.x, q.y, r, r * 0.45, 0, 0, 7); g.stroke();
      }
      const groups = new Map();
      if (ui.selSet) for (const id of ui.selSet) { const u = S.units[id]; if (u && u.owner === KM.me && u.g && S.army[u.g]) groups.set(u.g, S.army[u.g]); }
      const col = KM.pcolor(S, KM.me);
      for (const grp of groups.values()) {
        const us = KM.groupUnits(S, grp);
        if (!us.length) continue;
        const atk = us.find((u) => u.forced && u.target && KM.resolveTarget(S, u.target));
        if (atk) {
          const tg = KM.resolveTarget(S, atk.target), c = KM.groupCenter(S, grp);
          const b = gp(atk.target.k === 'u' ? tg.x : KM.hcx(tg), atk.target.k === 'u' ? tg.y : KM.hcy(tg), 0.08), a = gp(c.x, c.y, 0.08);
          if (a.behind || b.behind) continue;
          g.setLineDash([8, 6]); g.lineDashOffset = -this.time * 18; g.strokeStyle = 'rgba(255,80,60,0.9)'; g.lineWidth = 2.4;
          g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); g.setLineDash([]); g.lineDashOffset = 0;
          g.lineWidth = 2; g.beginPath(); g.ellipse(b.x, b.y, 16, 7, 0, 0, 7); g.stroke();
          g.font = '16px "Segoe UI Emoji",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.fillText('⚔️', b.x, b.y - 10);
          continue;
        }
        const movers = us.filter((u) => u.order);
        if (!movers.length) continue;
        // líder: quem tem o caminho mais longo pela frente
        const left = (u) => (u.path ? u.path.length - u.pi : 0);
        const lead = movers.reduce((a, b) => (left(b) > left(a) ? b : a));
        const pts = [[lead.x, lead.y]];
        if (lead.path) for (let i = lead.pi; i < lead.path.length; i++) pts.push(lead.path[i]);
        pts.push([grp.ax, grp.ay]);
        const sp = pts.map(([x, y]) => gp(x, y, 0.06));
        if (sp.some((q) => q.behind)) continue;
        g.lineJoin = 'round'; g.lineCap = 'round';
        g.beginPath(); sp.forEach((q, i) => (i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y)));
        g.strokeStyle = 'rgba(25,15,6,0.45)'; g.lineWidth = 5; g.stroke();
        g.setLineDash([2, 9]); g.lineDashOffset = -this.time * 16; g.strokeStyle = '#fff1c4'; g.lineWidth = 3.2; g.stroke();
        g.setLineDash([]); g.lineDashOffset = 0; g.lineCap = 'butt';
        // marcas no chão onde cada soldado vai ficar
        g.fillStyle = 'rgba(255,241,196,0.8)';
        for (const u of movers) { const q = gp(u.order.x, u.order.y, 0.05); if (!q.behind) { g.beginPath(); g.ellipse(q.x, q.y, 3.2, 1.7, 0, 0, 7); g.fill(); } }
        // estandarte fincado no destino, na cor do reino
        const q = gp(grp.ax, grp.ay, 0.05), wv = this.time * 5 + grp.id;
        const pulse = 1 + Math.sin(this.time * 4) * 0.12;
        g.fillStyle = 'rgba(20,12,6,0.25)'; g.beginPath(); g.ellipse(q.x, q.y, 15, 6.5, 0, 0, 7); g.fill();
        g.strokeStyle = col; g.lineWidth = 2.5; g.beginPath(); g.ellipse(q.x, q.y, 15 * pulse, 6.5 * pulse, 0, 0, 7); g.stroke();
        g.fillStyle = '#4a3220'; g.fillRect(q.x - 1.5, q.y - 40, 3, 40);
        g.fillStyle = '#e8c060'; g.beginPath(); g.arc(q.x, q.y - 41, 3.2, 0, 7); g.fill();
        g.beginPath(); g.moveTo(q.x + 1.5, q.y - 38);
        for (let i = 1; i <= 8; i++) { const t = i / 8; g.lineTo(q.x + 1.5 + t * 26, q.y - 38 + Math.sin(wv - t * 3) * 2.2 * t + t * 4); }
        g.lineTo(q.x + 21, q.y - 27);
        for (let i = 8; i >= 0; i--) { const t = i / 8; g.lineTo(q.x + 1.5 + t * 26, q.y - 22 + Math.sin(wv - t * 3) * 2.2 * t - t); }
        g.closePath(); g.fillStyle = col; g.fill(); g.strokeStyle = 'rgba(20,12,6,0.7)'; g.lineWidth = 1.3; g.stroke();
        g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillRect(q.x + 3, q.y - 36, 16, 2.5);
      }
    },

    // ---------- compatibilidade com o editor e o mundo ----------
    redrawTile(S, x, y) { this.reproject(S, x - 1, y - 1, x + 1, y + 1); },
    drawTileFlat() { },
    reproject(S, x0, y0, x1, y1) {
      if (!this.built) return;
      const d = this.tDirty;
      this.tDirty = d ? [Math.min(d[0], x0), Math.min(d[1], y0), Math.max(d[2], x1), Math.max(d[3], y1)] : [x0, y0, x1, y1];
      KM.ui && (KM.ui.miniDirty = true);
    },
    get base() { return this.built; },
  };
})(window.KM);
