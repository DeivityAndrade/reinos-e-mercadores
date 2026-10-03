'use strict';
// Regressões do menu sem navegador: node tools/check-menu.js
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..'), nodes = new Map();
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const guideAt = html.indexOf('class="mgrid menu-guide"'), savesAt = html.indexOf('id="continue"');
assert(guideAt >= 0 && savesAt > guideAt, 'partidas salvas ficam abaixo das opções de ajuda');
const element = () => ({ innerHTML: '', textContent: '', dataset: {}, scrollTop: 120, listeners: {},
  classList: { toggle(name, on) { this[name] = on; }, contains(name) { return !!this[name]; } },
  addEventListener(type, fn) { this.listeners[type] = fn; }, focus() { document.activeElement = this; } });
const get = selector => { if (!nodes.has(selector)) nodes.set(selector, element()); return nodes.get(selector); };
const screens = [...html.matchAll(/<(?:div|nav) class="screen( hidden)?" data-s="([a-z]+)"/g)].map(m => {
  const el = element(); el.dataset.s = m[2]; el.classList.toggle('hidden', !!m[1]); return el;
});
const document = { activeElement: null, querySelector: selector => {
  if (selector === '#menu .screen:not(.hidden) h3') {
    const current = screens.find(el => !el.classList.contains('hidden'));
    return current.dataset.s === 'main' ? null : get('heading-' + current.dataset.s);
  }
  return get(selector);
}, querySelectorAll: () => screens };
get('#menu').contains = el => el != null;
const context = vm.createContext({ window: {}, document, localStorage: { getItem: () => null }, console });
for (const file of ['icons', 'config', 'ui']) vm.runInContext(fs.readFileSync(path.join(root, 'js', file + '.js'), 'utf8'), context);
const KM = context.window.KM, calls = [], saves = new Map();
KM.saveMeta = slot => saves.get(slot);
KM.fmtTime = time => String(time);
KM.editor = { fillMapLists: () => calls.push('maps'), open: mode => calls.push('editor:' + mode) };
KM.ui.renderCampaign = () => calls.push('campaign');
KM.ui.renderConquest = () => calls.push('conquest');
KM.ui.renderBiomes = () => calls.push('biomes');
KM.net = { active: false, role: null, close() { calls.push('close-room'); this.role = null; } };
KM.startGame = opts => calls.push('mission:' + opts.mission);
KM.load = slot => calls.push('load:' + slot);
get('#cdiff').value = 'normal';
KM.ui.initMenu();
assert.equal(get('#menu-version').textContent, 'v' + KM.VERSION);
assert.equal(get('#continue').innerHTML, '');
assert.equal(document.activeElement, null, 'initial load must not steal focus');
const click = dataset => {
  document.activeElement = element();
  get('#menu').listeners.click({ target: { closest: () => ({ dataset }) } });
};
for (const screen of ['conquest', 'campaign', 'skirmish', 'mp', 'editor', 'main']) {
  click({ screen });
  assert.equal(get('#menu').dataset.screen, screen);
  assert.deepEqual(screens.filter(el => !el.classList.contains('hidden')).map(el => el.dataset.s), [screen]);
  assert.equal(get('#menu .hero').scrollTop, 0);
  assert.equal(document.activeElement, get(screen === 'main' ? '#menu h1' : 'heading-' + screen));
}
assert.deepEqual(calls, ['conquest', 'campaign', 'maps', 'biomes', 'maps']);
KM.net.role = 'host'; get('#mpbox').innerHTML = 'room'; click({ screen: 'main' });
assert(calls.includes('close-room')); assert.equal(get('#mpbox').innerHTML, '');
click({ mission: 't1' }); click({ help: '1' }); click({ editor: 'new' });
assert(calls.includes('mission:t1')); assert(calls.includes('editor:new'));
assert.equal(get('#help').classList.contains('hidden'), false);
saves.set(0, { v3: true, date: 10, time: 60, name: 'Autosave' });
saves.set(1, { v3: false, date: 40, time: 80, name: 'Antigo' });
saves.set(2, { v3: true, date: 30, time: 90, name: '<img src=x onerror="alert(1)">&' });
  saves.set(3, { v3: true, date: 20, time: 70, name: 'Campanha' });
  KM.ui.refreshMenu();
  const resume = get('#continue').innerHTML;
  assert(resume.includes('Continuar partida'));
  assert.deepEqual([...resume.matchAll(/data-cont="(\d)"/g)].map(m => m[1]), ['2', '3']);
  assert.equal((resume.match(/resume-game latest/g) || []).length, 1);
  assert(!resume.includes('data-cont="0"')); assert(!resume.includes('data-cont="1"'));
assert(!resume.includes('<img')); assert(resume.includes('&lt;img')); assert(resume.includes('&quot;')); assert(resume.includes('&amp;'));
click({ cont: '0' }); click({ cont: '2' }); assert(calls.includes('load:0')); assert(calls.includes('load:2'));
saves.clear(); KM.ui.refreshMenu(); assert.equal(get('#continue').innerHTML, '');
  console.log('MENU_PASS: primeira visita, 6 telas, foco/rolagem, saída da sala, tutorial/ajuda/editor, duas saves mais recentes, autosave e nomes escapados.');
console.log('LIMIT: layout, toque e renderização WebGL precisam de conferência em navegador.');
