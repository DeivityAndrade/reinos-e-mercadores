'use strict';
// node --experimental-vm-modules tools/check-ui.js
// Valida HTML, ícones, comandos e enquadramento com as malhas/esqueletos reais.
// Não substitui uma revisão visual em WebGL no navegador.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..'), modules = new Map();
global.ProgressEvent = class { constructor(type, values) { this.type = type; Object.assign(this, values); } };
function moduleFor(file) {
  file = path.resolve(file);
  if (!modules.has(file)) modules.set(file, new vm.SourceTextModule(fs.readFileSync(file, 'utf8'), { identifier: file }));
  return modules.get(file);
}
const linker = (name, parent) => moduleFor(name === 'three' ? path.join(root, 'js/vendor/three/build/three.module.js') : path.resolve(path.dirname(parent.identifier), name));
(async () => {
  const loaderModule = moduleFor(path.join(root, 'js/vendor/three/examples/jsm/loaders/GLTFLoader.js'));
  await loaderModule.link(linker); await loaderModule.evaluate();
  const skeleton = moduleFor(path.join(root, 'js/vendor/three/examples/jsm/utils/SkeletonUtils.js'));
  if (skeleton.status === 'unlinked') await skeleton.link(linker);
  if (skeleton.status !== 'evaluated') await skeleton.evaluate();
  const THREE = { ...modules.get(path.join(root, 'js/vendor/three/build/three.module.js')).namespace, SkeletonUtils: skeleton.namespace,
    BufferGeometryUtils: modules.get(path.join(root, 'js/vendor/three/examples/jsm/utils/BufferGeometryUtils.js')).namespace };
  THREE.TextureLoader = class { async loadAsync() { return new THREE.Texture({ width: 512, height: 512 }); } };
  const nodes = new Map(), styles = [], commands = [];
  const context2d = new Proxy({ createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }) }, { get: (o, k) => o[k] || (() => {}) });
  const element = () => ({ innerHTML: '', dataset: {}, style: {}, classList: { add() {}, remove() {}, contains() {}, toggle() {} },
    addEventListener() {}, getContext: () => context2d, toDataURL: () => 'data:image/png;base64,fixture' });
  const document = { querySelector: k => { if (!nodes.has(k)) nodes.set(k, element()); return nodes.get(k); }, querySelectorAll: () => [],
    getElementById: id => styles.find(s => s.id === id), createElement: element, head: { appendChild: s => styles.push(s) } };
  const ctx = vm.createContext({ console, performance, Math, THREE, document, Path2D: class { constructor(d) { assert(/^[Mm]/.test(d)); } },
    window: { THREE, addEventListener() {} }, localStorage: { getItem: () => null }, requestAnimationFrame() {}, setInterval() {}, setTimeout() {} });
  for (const f of ['icons', 'config', 'util', 'map', 'world', 'economy', 'units', 'military', 'ai', 'campaign', 'cmd', 'main', 'art', 'people', 'ui'])
    vm.runInContext(fs.readFileSync(path.join(root, 'js', f + '.js'), 'utf8'), ctx, { filename: f });
  const KM = ctx.window.KM;
  KM.initIcons(); KM.initIcons(); assert.equal(styles.length, 1);
  assert(!KM.icon('" onload=alert(1)').includes('onload'), 'unknown icon names must not enter markup');
  const style = styles[0].textContent;
  for (const defs of [KM.RES, KM.HOUSES, KM.PROF, KM.SOLDIERS]) for (const d of Object.values(defs))
    assert(style.includes(`[data-icon="${d.i}"]`), d.n + ': undefined data icon');
  for (const file of ['index.html', ...fs.readdirSync(path.join(root, 'js')).filter(f => f.endsWith('.js')).map(f => 'js/' + f)]) {
    const src = fs.readFileSync(path.join(root, file), 'utf8');
    assert(!/\p{Extended_Pictographic}/u.test(src), 'emoji remains in ' + file);
    for (const match of src.matchAll(/data-icon=(?:"|')?([a-z]+)/g)) assert(style.includes(`[data-icon="${match[1]}"]`), `${file}: undefined icon ${match[1]}`);
  }
  for (const f of ['config', 'icons', 'ui', 'art', 'render3d']) assert(!fs.readFileSync(path.join(root, 'js', f + '.js'), 'utf8').includes('\uFFFD'), f + ': invalid UTF-8');
  assert(!/Segoe UI Emoji|Noto Color Emoji/.test(fs.readFileSync(path.join(root, 'js/render3d.js'), 'utf8')));
  KM.R = { icons: Object.fromEntries(KM.PROF_ORDER.map(t => ['p_' + t, true])) };
  const S = KM.newState({ seed: 4, opponents: 1, diff: 'normal' }); KM.S = S;
  const school = Object.values(S.houses).find(h => h.owner === 0 && h.type === 'school');
  KM.ui.selHouse = school.id;
  let html = KM.ui.housePanel(S, school);
  for (const p of KM.PROF_ORDER) {
    assert(html.includes(`hic-p_${p}`), p + ': missing portrait');
    assert(html.includes(`<small>${KM.PROF[p].n}</small>`), p + ': name hidden');
  }
  assert(html.includes('Bloqueado')); assert(html.includes('1 ouro por treino'));
  assert(!html.includes('<i class=ui-icon data-icon=coin aria-hidden=true></i> cada'));
  KM.issue = c => { commands.push(c); KM.exec(S, { ...c, o: 0 }); };
  const click = action => KM.ui.onPanelClick({ target: { closest: () => ({ dataset: { act2: action } }) } });
  const count = school.queue.length; click('train:serf'); assert.equal(school.queue.length, count + 1);
  html = KM.ui.housePanel(S, school); assert(html.includes('aria-label="Remover Carregador"'));
  click('unq:' + count); assert.equal(school.queue.length, count);
  const locked = KM.PROF_ORDER.find(p => !KM.profUnlocked(S, 0, p));
  let toast; KM.ui.toast = msg => { toast = msg; };
  click('lockedp:' + locked); assert(toast.includes(KM.PROF[locked].n)); assert(!toast.includes('<i'));
  S.players[0].all = true; html = KM.ui.housePanel(S, school); assert(!html.includes('class="locked"'));
  delete KM.R.icons; html = KM.ui.housePanel(S, school); assert(html.includes('data-icon="basket"'), 'fallback missing');
  assert(!KM.reqNames(['school', 'storehouse']).includes('<i'), 'plain-text prerequisites contain markup');
  const hostileName = '<img src=x onerror=alert(1)>'; S.players[1].name = hostileName;
  const enemySchool = Object.values(S.houses).find(h => h.owner === 1 && h.type === 'school');
  assert(KM.ui.housePanel(S, enemySchool).includes('&lt;img'), 'player name must remain escaped');
  console.log('UI_PASS: all professions, locked/unlocked/fallback, train/cancel, icon coverage, escaping and no emojis.');

  // The real GLTFLoader parses local geometry/animations; images and WebGL are stubbed.
  const loader = new loaderModule.namespace.GLTFLoader();
  loader.register(parser => ({ name: 'offline-test-images', loadTexture: i => {
    const texture = new THREE.Texture({ width: 512, height: 512 });
    texture.name = parser.json.images[parser.json.textures[i].source].uri;
    return Promise.resolve(texture);
  } }));
  const localLoader = { loadAsync: async url => {
    const file = path.join(root, url);
    let data = fs.readFileSync(file);
    if (file.endsWith('.gltf')) {
      const json = JSON.parse(data);
      for (const b of json.buffers) b.uri = 'data:application/octet-stream;base64,' + fs.readFileSync(path.join(path.dirname(file), b.uri)).toString('base64');
      data = JSON.stringify(json);
    } else data = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
    return loader.parseAsync(data, '');
  } };
  KM.ART.init(THREE); await KM.PEOPLE.load(localLoader); assert(KM.PEOPLE.ready);
  const projections = [], frameSizes = [];
  THREE.WebGLRenderer = class {
    constructor({ canvas }) { frameSizes.push(canvas.width); }
    setClearColor() {} dispose() {}
    render(scene, cam) {
      scene.updateMatrixWorld(true); cam.updateMatrixWorld(true);
      if (!cam.isOrthographicCamera) return;
      const group = scene.children.find(o => o.isGroup);
      const head = group.getObjectByName('Head'); assert(head);
      const face = head.getWorldPosition(new THREE.Vector3()).project(cam);
      assert(Math.abs(face.x) < 0.2 && face.y > 0 && face.y < 0.7, 'head outside portrait frame');
      assert.equal(cam.top - cam.bottom, KM.PEOPLE_SCALE * 1.25);
      let meshes = 0;
      group.traverse(o => { if (o.isSkinnedMesh) {
        meshes++; assert(o.geometry.attributes.position.count > 500);
        const ids = o.geometry.attributes.skinIndex, weights = o.geometry.attributes.skinWeight;
        const headIndex = o.skeleton.bones.indexOf(head);
        for (let i = 0; i < ids.count; i++) {
          if (ids.getX(i) !== headIndex || weights.getX(i) < 0.8) continue;
          const v = o.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(o.matrixWorld).project(cam);
          assert(Math.abs(v.x) < 1 && v.y < 1 && v.y > -1, 'head/hair/hat clipped by portrait camera');
        }
      } });
      assert(meshes > 0); projections.push(face);
    }
  };
  vm.runInContext(fs.readFileSync(path.join(root, 'js/render3d.js'), 'utf8').replace('let THREE = null;', 'let THREE = window.THREE;'), ctx);
  // Cavalry is unrelated to school portraits and needs a separate horse asset.
  const order = KM.SOLDIER_ORDER; KM.SOLDIER_ORDER = order.filter(t => !KM.SOLDIERS[t].cav);
  KM.R.makeHouseIcons(); KM.SOLDIER_ORDER = order;
  assert.equal(frameSizes[0], 256); assert.equal(projections.length, KM.PROF_ORDER.length);
  for (const p of KM.PROF_ORDER) assert(KM.R.icons['p_' + p]);
  console.log('PORTRAITS_PASS: 14 actual character rigs, idle poses, head framing, consistent zoom and 256px canvas.');
  console.log('LIMIT: GPU rendering, textures and final visual appearance require a browser.');
})().catch(e => { console.error(e); process.exitCode = 1; });
