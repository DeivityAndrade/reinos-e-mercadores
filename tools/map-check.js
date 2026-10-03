'use strict';
// Regressões do formato de mapas, sem navegador e sem tocar em arquivos do usuário.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const storage = new Map();
const toasts = [];
const nodes = new Map();
const node = (key) => {
  if (!nodes.has(key)) nodes.set(key, {
    value: '', textContent: '', innerHTML: '', dataset: {}, scrollTop: 0, listeners: {},
    classList: { add() {}, remove() {}, toggle() {} },
    contains() { return false; },
    addEventListener(type, fn) { this.listeners[type] = fn; },
  });
  return nodes.get(key);
};
let lastInput = null;
const context = {
  console, performance, Math, setTimeout, clearTimeout, setInterval: () => 0, requestAnimationFrame() {},
  window: { KM: {}, addEventListener() {} },
  localStorage: {
    getItem: (key) => storage.has(key) ? storage.get(key) : null,
    setItem: (key, value) => storage.set(key, String(value)),
  },
  document: {
    addEventListener() {},
    querySelector: node,
    querySelectorAll: () => [],
    createElement: (tag) => {
      if (tag !== 'input') return {};
      return (lastInput = { files: [], click() {} });
    },
  },
};
vm.createContext(context);
for (const file of ['icons', 'config', 'util', 'map', 'world', 'economy', 'units', 'military', 'ai', 'campaign', 'cmd', 'main', 'ui', 'editor']) {
  vm.runInContext(fs.readFileSync(path.join(root, 'js', file + '.js'), 'utf8'), context, { filename: file + '.js' });
}
const KM = context.window.KM;
KM.ui.toast = (message) => toasts.push(message);

function mapExport() {
  const generated = KM.genMap(7, { W: 64, H: 64, players: 2 });
  return KM.editor.mapData({ map: generated.m, edStarts: generated.starts, houses: {} });
}

async function importFile(name, data) {
  lastInput = null;
  KM.editor.importFile();
  assert.ok(lastInput, 'o importador deve criar um input de arquivo');
  lastInput.files = [{ name, text: () => Promise.resolve(JSON.stringify(data)) }];
  lastInput.onchange();
  await new Promise((resolve) => setImmediate(resolve));
}

(async () => {
  const exported = mapExport();
  assert.equal(exported.v, 1);
  assert.equal(KM.validateMapData(exported).ok, true, 'exports atuais devem continuar válidos');
  const rebuilt = KM.mapFromData(exported, 7);
  assert.deepEqual([rebuilt.m.W, rebuilt.m.H], [64, 64]);
  assert.deepEqual(rebuilt.starts, exported.starts);

  const invalid = JSON.parse(JSON.stringify(exported));
  invalid.terrain.pop();
  const keepState = { marker: true };
  KM.simS = keepState;
  KM.setMapSize(77, 77);
  assert.throws(() => KM.mapFromData(invalid, 7), /Mapa inválido/);
  assert.deepEqual([KM.MAP_W, KM.MAP_H], [77, 77], 'mapFromData não altera dimensões antes da validação');
  assert.equal(KM.simS, keepState, 'mapFromData inválido não altera o estado ativo');
  assert.throws(() => KM.newState({ map: invalid }), /Mapa inválido/);
  assert.deepEqual([KM.MAP_W, KM.MAP_H], [77, 77], 'newState rejeita antes de criar o mapa');
  KM.S = keepState; KM.me = 3;
  assert.throws(() => KM.startGame({ map: invalid, me: 0 }), /Mapa inválido/);
  assert.equal(KM.S, keepState, 'startGame inválido preserva a partida');
  assert.equal(KM.me, 3, 'startGame inválido preserva o jogador');
  assert.deepEqual([KM.MAP_W, KM.MAP_H], [77, 77]);

  node('#edmap').value = 'corrompido';
  storage.set('rm_map_corrompido', JSON.stringify(invalid));
  assert.doesNotThrow(() => KM.editor.open('load'));
  assert.equal(KM.S, keepState, 'editor não troca o estado ao rejeitar um salvo');
  node('#seed').value = ''; node('#smap').value = 'corrompido';
  KM.ui.initMenu();
  const startGame = KM.startGame;
  let launched = 0;
  KM.startGame = () => { launched++; };
  const menuClick = () => node('#menu').listeners.click({ target: { closest: () => ({ dataset: { new: '1' } }) } });
  menuClick();
  assert.equal(launched, 0, 'mapa salvo rejeitado não inicia um mapa aleatório');
  storage.set('rm_map_corrompido', JSON.stringify(exported));
  menuClick(); assert.equal(launched, 1, 'mapa salvo válido continua iniciando');
  KM.startGame = () => { throw new Error('falha de mapa'); };
  assert.doesNotThrow(menuClick);
  assert.match(toasts.at(-1), /falha de mapa/);
  KM.startGame = startGame;
  KM.S = { map: { ...rebuilt.m, terrain: [] }, edStarts: exported.starts, houses: {} };
  assert.doesNotThrow(() => KM.editor.test());
  assert.match(toasts.at(-1), /Não foi possível testar/);
  assert.equal(KM.editor.lastTest, undefined);

  storage.set('rm_maps', JSON.stringify(['existente']));
  storage.set('rm_map_invalido', 'mapa anterior');
  await importFile('invalido.rmmap.json', invalid);
  assert.equal(storage.get('rm_map_invalido'), 'mapa anterior', 'importação inválida não sobrescreve o mapa salvo');
  assert.equal(storage.get('rm_maps'), JSON.stringify(['existente']), 'importação inválida não altera a lista');
  assert.match(toasts.at(-1), /array|inválido/i);

  storage.set('rm_map_corrompido', JSON.stringify(invalid));
  assert.equal(KM.editor.loadMapData('corrompido'), null, 'loadMapData rejeita mapa salvo inválido');

  await importFile('novo.rmmap.json', exported);
  assert.equal(storage.get('rm_map_novo'), JSON.stringify(exported), 'importação válida persiste o export atual');
  assert.deepEqual(JSON.parse(storage.get('rm_maps')), ['existente', 'novo']);

  const badVersion = { ...exported, v: 2 };
  assert.equal(KM.validateMapData(badVersion).ok, false);
  const badStart = { ...exported, starts: [{ x: 2, y: 2 }] };
  assert.equal(KM.validateMapData(badStart).ok, false);
  const badHouse = { ...exported, houses: [{ type: 'desconhecida', owner: 0, x: 5, y: 5 }] };
  assert.equal(KM.validateMapData(badHouse).ok, false);
  const clean = JSON.parse(JSON.stringify(exported));
  clean.terrain.fill(KM.T.GRASS); clean.stone.fill(0);
  const house = { type: 'school', owner: 0, x: 5, y: 5 };
  assert.equal(KM.validateMapData({ ...clean, houses: [house] }).ok, true);
  for (const bad of [{ ...house, type: ['school'] }, { ...house, type: '__proto__' }, { ...house, owner: 4 }, { ...house, x: -1 }, { ...house, y: 63 }]) {
    assert.equal(KM.validateMapData({ ...clean, houses: [bad] }).ok, false);
  }
  assert.equal(KM.validateMapData({ ...clean, houses: [house, { ...house }] }).ok, false);
  for (const key of ['terrain', 'hv', 'tree', 'stone', 'ore', 'oreAmt']) {
    for (const value of [NaN, Infinity, -1, '0', 999]) {
      const bad = JSON.parse(JSON.stringify(clean)); bad[key][0] = value;
      assert.equal(KM.validateMapData(bad).ok, false, key + ': ' + value);
    }
  }
  for (const W of [31, 257, Infinity, 64.5, '64']) assert.equal(KM.validateMapData({ ...clean, W }).ok, false);
  assert.equal(KM.validateMapData({ ...clean, biome: '__proto__' }).ok, false);
  assert.equal(KM.validateMapData({ ...clean, starts: [clean.starts[0], clean.starts[0]] }).ok, false);
  const state = KM.newState({ map: exported, seed: 7, diff: 'normal' });
  assert.deepEqual([state.map.W, state.map.H], [64, 64], 'mapa exportado válido inicializa uma partida real');
  console.log('✓ formato, consumidores e importação de mapas');
})().catch((error) => { console.error(error); process.exitCode = 1; });
