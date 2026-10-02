'use strict';
// Actual GLTFLoader, simulation and instancing; DOM/WebGL calls are stubbed.
// Run: node --experimental-vm-modules tools/check-resources-preview.js
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const root = path.join(__dirname, '..'), modules = new Map();
function moduleFor(file) {
  file = path.resolve(file);
  if (!modules.has(file)) modules.set(file, new vm.SourceTextModule(fs.readFileSync(file, 'utf8'), { identifier: file }));
  return modules.get(file);
}
const linker = (name, parent) => moduleFor(name === 'three' ? path.join(root, 'js/vendor/three/build/three.module.js') : path.resolve(path.dirname(parent.identifier), name));
const element = () => ({ dataset: {}, style: {}, classList: { add() {}, remove() {} }, addEventListener() {}, disabled: true });
(async () => {
  const loaderModule = moduleFor(path.join(root, 'js/vendor/three/examples/jsm/loaders/GLTFLoader.js'));
  await loaderModule.link(linker); await loaderModule.evaluate();
  const THREE = { ...modules.get(path.join(root, 'js/vendor/three/build/three.module.js')).namespace, BufferGeometryUtils: modules.get(path.join(root, 'js/vendor/three/examples/jsm/utils/BufferGeometryUtils.js')).namespace };
  THREE.TextureLoader = class { async loadAsync() { return new THREE.Texture(); } };
  const loader = new loaderModule.namespace.GLTFLoader();
  const nodes = new Map(), storage = new Map();
  const context2d = new Proxy({ createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }), createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }) }, { get: (obj, key) => obj[key] || (() => {}) });
  const gameDocument = { getElementById: () => null, querySelector: key => { if (!nodes.has(key)) nodes.set(key, element()); return nodes.get(key); }, querySelectorAll: () => [], createElement: () => ({ ...element(), getContext: () => context2d }), body: { classList: { toggle() {} } }, head: { appendChild() {} } };
  const warnings = [];
  const context = vm.createContext({ console: { ...console, warn: (...args) => warnings.push(args) }, Math, performance, window: { THREE, addEventListener() {} }, document: gameDocument, localStorage: { getItem: k => storage.get(k), setItem: (k, v) => storage.set(k, v) }, setInterval: () => 0, requestAnimationFrame() {} });
  for (const file of ['config', 'util', 'map', 'world', 'economy', 'units', 'military', 'ai', 'campaign', 'cmd', 'tutorial', 'main', 'art']) vm.runInContext(fs.readFileSync(path.join(root, 'js', file + '.js'), 'utf8'), context);
  const KM = context.window.KM;
  KM.ART.init(THREE); KM.ART.buildNature();
  const renderSource = fs.readFileSync(path.join(root, 'js/render3d.js'), 'utf8');
  assert(renderSource.includes('let THREE = null;'));
  vm.runInContext(renderSource.replace('let THREE = null;', 'let THREE = window.THREE;'), context);
  KM.input = { update() {} };
  KM.ui = { clearSel() {}, setTool() {}, setTab() {}, toast() {} };
  KM.PEOPLE = { async load() {} };
  const R = KM.R;
  R.setupPost = () => {}; R.windify = () => {}; R.makeTextures = () => {}; R.makeHouseIcons = () => {};
  R.groundY = () => 0;
  R.buildBase = S => { R.S = S; R.world = new THREE.Group(); R.objGroup = null; };
  R.frame = S => R.rebuildObjects(S);
  R.renderer = { info: { render: { calls: 1 } } };
  R.loader = { loadAsync: async url => {
    if (!url.startsWith('assets/own/resources/')) throw new Error('Non-resource fixture omitted');
    const name = path.basename(url.split('?')[0]);
    const bytes = fs.readFileSync(path.join(root, 'assets/own/resources', name));
    return loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  } };
  await R.loadAll();
  assert.equal(R.ready, true);
  assert.equal(R.progress, 1);
  assert.equal(Object.keys(R.resourceModels).length, 8);
  for (const key in R.resourceModels) {
    assert(R.gltf[key]);
    assert(R.inst[key].mat.isMeshToonMaterial && R.inst[key].mat.vertexColors);
    assert(R.inst[key].geo.getAttribute('color'));
  }
  // Missing/malformed assets retain the procedural geometry without affecting
  // the other seven imports. Exercise the production prepare() caller.
  const coal = R.gltf.ore1;
  delete R.gltf.ore1;
  R.prepare();
  assert.equal(R.inst.ore1.geo, KM.ART.nature.ore1);
  assert.notEqual(R.inst.ore2.geo, KM.ART.nature.ore2);
  const invalid = new THREE.Group();
  invalid.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()));
  R.gltf.ore1 = { scene: invalid, animations: [] };
  R.prepare();
  assert.equal(R.inst.ore1.geo, KM.ART.nature.ore1);
  assert(warnings.some(args => String(args[0]).includes('Asset de recurso inválido')));
  R.gltf.ore1 = coal;
  R.prepare();
  const status = element(), close = element(), wide = element();
  const handlers = new Map();
  close.addEventListener = (name, fn) => handlers.set('close', fn);
  wide.addEventListener = (name, fn) => handlers.set('wide', fn);
  const frame = { contentWindow: { KM, THREE }, contentDocument: gameDocument, addEventListener: (name, fn) => handlers.set('load', fn) };
  const parent = vm.createContext({ console, setInterval, clearInterval, URLSearchParams, location: { search: '' }, document: {
    querySelector: key => ({ '#game': frame, '#status': status, '#close': close, '#wide': wide })[key], querySelectorAll: () => [close, wide]
  } });
  const html = fs.readFileSync(path.join(root, 'tools/resources-preview.html'), 'utf8');
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  new vm.Script(script, { filename: 'resources-preview.html' }).runInContext(parent);
  handlers.get('load')();
  const deadline = Date.now() + 10000;
  while (status.dataset.state !== 'ready' && status.dataset.state !== 'error' && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 100));
  assert.equal(status.dataset.state, 'ready', status.textContent);
  assert.equal(status.dataset.models, 8);
  assert(status.dataset.triangles > 0);
  assert.equal(KM.S.paused, true);
  assert.equal(storage.size, 0);
  KM.save(0); assert.equal(storage.size, 0);
  assert.equal(close.disabled, false);
  handlers.get('wide')(); assert.equal(R.dist, 20);
  handlers.get('close')(); assert.equal(R.dist, 13);
  assert.equal(Object.values(KM.S.houses).filter(h => h.type === 'quarry').length, 1);
  // Execute syncTools/rangeRing with real Three.js geometry, omitting only building art and tile quads.
  const ranges = Object.create(R);
  Object.assign(ranges, { world: new THREE.Group(), unitVis: {}, groundY: () => 0, buildHouse: () => new THREE.Group(), quadsMesh: () => null });
  for (const type of ['coalmine', 'ironmine', 'goldmine', 'quarry', 'tower']) for (let rot = 0; rot < 4; rot++) {
    const f = KM.footprint(type, 20, 20, rot), h = { id: 1, type, owner: 0, x: 20, y: 20, ...f };
    const state = { ...KM.S, houses: { 1: h } }, rg = KM.houseRange(h);
    for (const preview of [false, true]) {
      ranges.syncTools(state, { selHouse: preview ? 0 : 1, tool: preview ? { build: type } : null, hover: { tx: 20 + (f.w >> 1), ty: 20 + (f.h >> 1) }, buildRot: rot });
      const ring = ranges.toolGroup.children.find(o => o.geometry?.type === 'RingGeometry');
      const disc = ranges.toolGroup.children.find(o => o.geometry?.type === 'CircleGeometry');
      assert(ring && disc, `${type} rot=${rot} preview=${preview}: missing range`);
      assert.equal(ring.geometry.parameters.outerRadius, rg.r + 0.06);
      assert.equal(disc.geometry.parameters.radius, rg.r);
      assert.equal(ring.position.x, rg.x + 0.5); assert.equal(ring.position.z, rg.y + 0.5);
    }
  }
  ranges.world.remove(ranges.toolGroup); ranges.dispose(ranges.toolGroup);
  console.log('RANGES_PASS: selection/construction rings for coal, iron, gold, quarry and tower in all four rotations.');
  console.log('INTEGRATION_PASS: production loadAll/prepare; eight real GLBs; toon colours; missing/malformed asset fallback.');
  console.log('PREVIEW_PASS: actual instancing; paused state; no saves; both cameras.');
  console.log('WebGL rendering and visual appearance are not validated by this check.');
})().catch(error => { console.error(error); process.exitCode = 1; });
