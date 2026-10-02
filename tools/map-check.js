'use strict';
// Regressões do formato de mapas, sem navegador e sem tocar em arquivos do usuário.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const storage = new Map();
const toasts = [];
let lastInput = null;
const context = {
  console, performance, Math, setTimeout, clearTimeout,
  window: { KM: {}, addEventListener() {} },
  localStorage: {
    getItem: (key) => storage.has(key) ? storage.get(key) : null,
    setItem: (key, value) => storage.set(key, String(value)),
  },
  document: {
    addEventListener() {},
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: (tag) => {
      if (tag !== 'input') return {};
      return (lastInput = { files: [], click() {} });
    },
  },
};
vm.createContext(context);
for (const file of ['config', 'util', 'map', 'world', 'editor']) {
  vm.runInContext(fs.readFileSync(path.join(root, 'js', file + '.js'), 'utf8'), context, { filename: file + '.js' });
}
const KM = context.window.KM;
KM.ui = { toast: (message) => toasts.push(message) };

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
  console.log('✓ formato, consumidores e importação de mapas');
})().catch((error) => { console.error(error); process.exitCode = 1; });
