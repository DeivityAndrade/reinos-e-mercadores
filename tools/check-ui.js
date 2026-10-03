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
    getElementById: id => styles.find(s => s.id === id), createElement: element, body: element(), head: { appendChild: s => styles.push(s) } };
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

  S.time = 60; KM.recordResourceFlow(S, 0, 'produced', 'wood', 4);
  KM.recordResourceFlow(S, 0, 'spent', 'wood', 1); KM.recordResourceFlow(S, 1, 'produced', 'wood', 99);
  const economyBefore = JSON.stringify(S), commandsBefore = commands.length;
  KM.ui.setTab('stock'); assert(nodes.get('#tabcontent').innerHTML.includes('data-act="economy"'));
  KM.ui.act('economy');
  const economy = () => nodes.get('#tabcontent').innerHTML;
  assert.equal(KM.ui.tab, 'economy'); assert(economy().includes('unidades por minuto'));
  assert.equal((economy().match(/scope="row"/g) || []).length, KM.RES_ORDER.length);
  assert(economy().includes('<td class="good">4</td><td class="bad">1</td><td class="good">+3</td>'));
  assert(!economy().includes('>99<')); assert.equal(JSON.stringify(S), economyBefore);
  assert.equal(commands.length, commandsBefore, 'opening the panel must not issue multiplayer commands');
  S.paused = true; KM.ui.renderTab(false); assert(economy().includes('Pausado'));
  KM.recordResourceFlow(S, 0, 'spent', 'wood', 5); KM.ui.renderTab(false);
  assert(economy().includes('<td class="bad">-2</td>'));
  S.time = 121; KM.ui.renderTab(false); assert(!economy().includes('>+3<')); assert(!economy().includes('>-2<'));
  KM.ui.renderTop(); assert(nodes.get('#topbar').innerHTML.includes('aria-label="Abrir produção e consumo de recursos"'));
  KM.ui.act('stock'); assert.equal(KM.ui.tab, 'stock');
  const savedFlow = S.resourceFlow; delete S.resourceFlow; KM.ui.openEconomy();
  assert(economy().includes('janela inicial: 0/60 s, sem projeção')); S.resourceFlow = savedFlow;
  KM.recordResourceFlow(S, 1, 'produced', 'stone', 11);
  const oldMe = KM.me; KM.me = 1; KM.ui.renderTab(true);
  assert(economy().includes('<td class="good">11</td>')); assert(!economy().includes('>4<')); KM.me = oldMe;
  KM.touchUI = true; let opened = false;
  const addClass = document.body.classList.add; document.body.classList.add = c => { if (c === 'sb-open') opened = true; };
  KM.ui.openEconomy(); assert(opened); document.body.classList.add = addClass; KM.touchUI = false; S.paused = false;
  console.log('ECONOMY_UI_PASS: 28 resources, measured counts, owner isolation, live update, expiry, pause, old saves, accessible shortcut, touch opening and local-only navigation.');

  const preview = fs.readFileSync(path.join(root, 'preview-interface/producao-consumo.svg'), 'utf8');
  assert(!/[?\uFFFD]/.test(preview), 'resource preview contains corrupted characters');
  for (const label of ['Produção e consumo', 'Prévia do painel', 'simulação local', 'Últimos 60 s', 'fabricação', 'alimentação', 'não conta', 'distribuição', ...KM.RES_ORDER.map(r => KM.RES[r].n)])
    assert(preview.includes(label), 'resource preview missing label: ' + label);
  assert.equal((preview.match(/<text x="49"/g) || []).length, KM.RES_ORDER.length);
  assert(!/<script\b|<foreignObject\b|\bon\w+=|\bhref=/i.test(preview), 'preview must be a self-contained passive SVG');
  console.log('RESOURCE_PREVIEW_PASS: UTF-8 Portuguese labels, 28 resource names and passive SVG.');

  const town = KM.newState({ seed: 4, opponents: 1, allUnlocked: true });
  town.map = KM.emptyMap(48, 48); KM.setMapSize(48, 48); town.houses = {}; town.units = {}; town.army = {}; town.sites = []; town.zones = null;
  KM.S = town;
  const a = KM.addHouse(town, 'goldmine', 0, 4, 4, true), b = KM.addHouse(town, 'goldmine', 0, 10, 4, true);
  a.paused = true; b.depleted = true;
  const plan = KM.addHouse(town, 'goldmine', 0, 16, 4, false), site = KM.addHouse(town, 'goldmine', 0, 22, 4, false);
  site.state = 'site';
  KM.addHouse(town, 'goldmine', 1, 30, 4, true);
  assert.equal(JSON.stringify(KM.ui.houseCounts().goldmine), '{"built":2,"site":1,"plan":1}');
  KM.ui.setTab('build');
  const tab = () => nodes.get('#tabcontent').innerHTML;
  assert(tab().includes('Construir Mina de ouro. 2 prontas · 1 em construção · 1 planejada'));
  assert(tab().includes('+2 obras')); assert(tab().includes('Construir Mina de ferro. 0 prontas'));
  KM.ui.setTool({ build: 'goldmine' }); KM.ui.renderPanel();
  assert(nodes.get('#selpanel').innerHTML.includes('data-act2="locate:goldmine"'));
  assert.equal(KM.ui.buildFocusType(), 'goldmine');
  const centers = [], renderMini = KM.ui.renderMini;
  KM.ui.renderMini = () => {}; KM.R.centerOn = (x, y) => centers.push([x, y]);
  const locate = () => KM.ui.onPanelClick({ target: { closest: () => ({ dataset: { act2: 'locate:goldmine' } }) } });
  for (const h of [a, b, plan, site, a]) { locate(); assert.equal(KM.ui.selHouse, h.id); }
  assert.equal(KM.ui.tool, null, 'locating must leave placement mode');
  assert.deepEqual(centers[0], [KM.hcx(a), KM.hcy(a)]);
  const beforeLocate = KM.checksum(town); KM.ui.locateHouse('ironmine'); KM.ui.locateHouse('invalid');
  assert.equal(KM.checksum(town), beforeLocate, 'navigation is local UI only');
  KM.finishHouse(town, site, true); KM.ui.renderTab(false);
  assert(tab().includes('3 prontas · 0 em construção · 1 planejada'));
  const historical = town.players[0].built.goldmine;
  KM.removeHouse(town, b, false); KM.removeHouse(town, plan, false); KM.ui.renderTab(false);
  assert(tab().includes('2 prontas · 0 em construção · 0 planejadas')); assert(!tab().includes('+2 obras'));
  assert.equal(town.players[0].built.goldmine, historical, 'progression history is independent of current counts');
  KM.ui.setTool({ build: 'ironmine' }); KM.ui.renderPanel();
  assert(/data-act2="locate:ironmine" disabled/.test(nodes.get('#selpanel').innerHTML));
  KM.ui.setTool('road'); assert.equal(KM.ui.buildFocusType(), null);
  KM.ui.setTool(null); KM.ui.selectHouse(Object.values(town.houses).find(h => h.owner === 1).id);
  assert.equal(KM.ui.buildFocusType(), null, 'enemy selection must not highlight or reveal own counts');
  town.editor = true; KM.ui.tool = { build: 'goldmine' }; assert.equal(KM.ui.buildFocusType(), null);
  KM.ui.tool = null; KM.ui.clearSel(); KM.ui.renderMini = renderMini; KM.S = S; KM.setMapSize(S.map.W, S.map.H);
  console.log('BUILDINGS_PASS: current own counts, zero, paused/depleted, plans/sites, completion/removal, cycle/wrap, empty locator, editor/enemy scope and unchanged checksum.');

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
  const group = new THREE.Group(), source = new THREE.MeshToonMaterial({ color: '#ff0000' });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(), source), mesh2 = new THREE.Mesh(mesh.geometry, [source, source]);
  group.add(mesh, mesh2);
  const original = source.color.getHex(); KM.R.muteHouse(group, true);
  assert.notEqual(mesh.material, source); assert.equal(mesh2.material[0], mesh.material); assert.equal(source.color.getHex(), original);
  const shader = { fragmentShader: '#include <opaque_fragment>' }; mesh.material.onBeforeCompile(shader, null);
  assert(shader.fragmentShader.includes('gl_FragColor.rgb = mix'), 'muting must affect textured output');
  const muted = mesh.material; let disposed = 0; muted.addEventListener('dispose', () => disposed++);
  KM.R.muteHouse(group, true); assert.equal(mesh.material, muted, 'stable focus must reuse materials');
  KM.R.muteHouse(group, false); assert.equal(mesh.material, source); assert.equal(mesh2.material[0], source); assert.equal(disposed, 1);
  KM.R.muteHouse(group, true); const removed = mesh.material; let cleaned = false; removed.addEventListener('dispose', () => { cleaned = true; });
  KM.R.dispose(group); assert(cleaned, 'removal/map reload must dispose temporary materials');
  console.log('BUILDING_MATERIALS_PASS: shared originals preserved, arrays supported, shader output muted, stable reuse, restore and disposal.');
  // Cavalry is unrelated to school portraits and needs a separate horse asset.
  const order = KM.SOLDIER_ORDER; KM.SOLDIER_ORDER = order.filter(t => !KM.SOLDIERS[t].cav);
  KM.R.makeHouseIcons(); KM.SOLDIER_ORDER = order;
  assert.equal(frameSizes[0], 256); assert.equal(projections.length, KM.PROF_ORDER.length);
  for (const p of KM.PROF_ORDER) assert(KM.R.icons['p_' + p]);
  console.log('PORTRAITS_PASS: 14 actual character rigs, idle poses, head framing, consistent zoom and 256px canvas.');
  console.log('LIMIT: GPU rendering, textures and final visual appearance require a browser.');
})().catch(e => { console.error(e); process.exitCode = 1; });
