'use strict';
// Regressões da simulação, sem navegador. Execute: node tools/check.js
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const element = () => ({ innerHTML: '', textContent: '', dataset: {}, style: {}, classList: { add() {}, remove() {}, contains: () => false }, addEventListener() {} });
const nodes = new Map();
const storage = new Map();
const context = { console, performance, Math, setInterval: () => 0, requestAnimationFrame() {},
  window: { addEventListener() {} }, localStorage: { getItem: (k) => storage.get(k) || null, setItem: (k, v) => storage.set(k, v) },
  document: { querySelector: (k) => { if (!nodes.has(k)) nodes.set(k, element()); return nodes.get(k); }, querySelectorAll: () => [], createElement: element, body: { appendChild() {} } },
};
vm.createContext(context);
for (const file of fs.readdirSync(path.join(root, 'js')).filter((f) => f.endsWith('.js'))) new vm.Script(fs.readFileSync(path.join(root, 'js', file), 'utf8'), { filename: file });
for (const file of ['icons', 'config', 'util', 'map', 'world', 'economy', 'units', 'military', 'ai', 'campaign', 'cmd', 'tutorial', 'main', 'ui', 'input']) vm.runInContext(fs.readFileSync(path.join(root, 'js', file + '.js'), 'utf8'), context, { filename: file });
vm.runInContext(fs.readFileSync(path.join(root, 'tools/sim.js'), 'utf8'), context);
const KM = context.window.KM;
let passed = 0;
function check(name, run) { run(); passed++; console.log('✓ ' + name); }
function flat() {
  const S = KM.newState({ seed: 7, diff: 'normal' });
  S.map = KM.emptyMap(40, 40); KM.setMapSize(40, 40); S.map.explored.fill(15);
  S.units = {}; S.army = {}; S.houses = {}; S.sites = []; S.protected = []; S.resv = {}; S.zones = null;
  S.players.forEach((p) => { p.built = {}; p.out = false; p.ai = null; p.homeStore = 0; });
  KM.rt = { comp: null, roadsDirty: true }; KM.simS = S; KM.me = 0;
  return S;
}
check('Todas as missões e dificuldades inicializam com objetivos válidos', () => {
  for (const diff of Object.keys(KM.DIFF)) {
    for (const mission of ['t1', ...KM.MISSIONS.map((m) => m.id), ...KM.conquestList(diff).map((m) => m.id)]) {
      const S = KM.newState({ mission, diff });
      for (let i = 0; i < 40; i++) KM.step(S, KM.DT);
      assert.equal(S.over, null, mission + '/' + diff);
      for (const g of S.goals) assert.notEqual(KM.goalStatus(S, g).text, '?');
      for (const s of S.sites) assert.ok(KM.walkable(S, s.x, s.y));
    }
  }
});
check('Escaramuça econômica começa com recursos, cidadãos e tropas equivalentes', () => {
  const S = KM.newState({ seed: 7, diff: 'normal' });
  const stocks = [0, 1].map((o) => Object.values(S.houses).find((h) => h.owner === o && h.type === 'storehouse').inv);
  assert.equal(JSON.stringify(stocks[0]), JSON.stringify(stocks[1]));
  assert.equal(Object.values(S.units).filter((u) => u.owner === 0).length, Object.values(S.units).filter((u) => u.owner === 1).length);
  assert.equal(Object.values(S.houses).filter((h) => h.owner === 0).length, Object.values(S.houses).filter((h) => h.owner === 1).length);
});
check('IA econômica não recebe recursos periódicos nem ignora desbloqueios', () => {
  const S = KM.newState({ seed: 1, diff: 'hard' });
  const ai = S.players[1].ai; ai.buildT = ai.fieldT = ai.equipT = ai.next = 1e9;
  const store = Object.values(S.houses).find((h) => h.owner === 1 && h.type === 'storehouse');
  const before = JSON.stringify(store.inv); KM.updateAI(S, 120);
  assert.equal(JSON.stringify(store.inv), before);
  assert.equal(KM.houseUnlocked(S, 1, 'weaponsmithy'), false);
  const bar = KM.addHouse(S, 'barracks', 1, 30, 35, true);
  bar.recruits = 1; bar.inv.sword = bar.inv.ironshield = bar.inv.ironarmor = 1;
  assert.equal(KM.equip(S, bar, 'swordsman'), false);
});
check('Fome e recuperação têm as mesmas regras para humanos e IA econômica', () => {
  const S = flat();
  const a = KM.addUnit(S, 'militia', 0, 3, 3), b = KM.addUnit(S, 'militia', 1, 30, 30);
  a.hunger = b.hunger = 0; a.scanT = b.scanT = 999; a.hp = b.hp = 40;
  KM.updateSoldier(S, a, 1); KM.updateSoldier(S, b, 1);
  assert.equal(a.hp, b.hp); assert.ok(b.hp < 40);
  a.hunger = b.hunger = 80; S.time = 20;
  KM.updateSoldier(S, a, 1); KM.updateSoldier(S, b, 1);
  assert.equal(a.hp, b.hp); assert.ok(a.hp > 39.65);
});
check('IA troca excedentes pagando o Mercado e repõe pedreiras esgotadas mesmo com obras pendentes', () => {
  const S = flat(), o = 1;
  S.players[o].eco = true; KM.setupAI(S, o, { mode: 'economy' }, 'normal');
  const ai = S.players[o].ai; ai.next = ai.fieldT = ai.equipT = 1e9;
  const st = KM.addHouse(S, 'storehouse', o, 3, 3, true);
  st.inv = { wood: 50, stone: 10, gold: 40, bread: 60 };
  KM.addHouse(S, 'school', o, 8, 3, true);
  KM.addHouse(S, 'woodcutter', o, 3, 11, true);
  KM.addHouse(S, 'quarry', o, 8, 11, true);
  KM.addHouse(S, 'quarry', o, 13, 11, true);
  KM.addHouse(S, 'sawmill', o, 8, 17, true);
  KM.addHouse(S, 'inn', o, 3, 17, true);
  const market = KM.addHouse(S, 'market', o, 13, 17, true);
  KM.addHouse(S, 'farm', o, 3, 23, false); KM.addHouse(S, 'farm', o, 8, 23, false);
  S.map.stone[10 * 40 + 30] = 15;
  ai.buildT = 0; KM.updateAI(S, 1);
  assert.equal(market.trade.buy, 'stone'); assert.equal(st.inv.wood, 50);
  assert.equal(Object.values(S.houses).filter((h) => h.owner === o && h.type === 'quarry').length, 3);
  assert.ok(Object.values(S.houses).some((h) => h.type === 'quarry' && h.state !== 'built' && h.prio));
  const rate = KM.tradeRate('wood', 'stone'); market.inv.wood = rate.sellN;
  KM.updateHouse(S, market, 1); KM.updateHouse(S, market, 4);
  assert.equal(market.inv.wood, 0); assert.equal(market.out.stone, rate.buyN);
  assert.equal(market.traded, 1);
});
check('Minas esgotadas são substituídas sem criar minério ou ouro', () => {
  const S = flat(), o = 1;
  S.players[o].eco = true; KM.setupAI(S, o, { mode: 'economy' }, 'normal');
  const ai = S.players[o].ai; ai.next = ai.fieldT = ai.equipT = 1e9; ai.buildT = 0;
  const st = KM.addHouse(S, 'storehouse', o, 3, 3, true); st.inv = { wood: 45, stone: 30, gold: 10, bread: 60 };
  for (const [t, x, y] of [['quarry', 3, 10], ['sawmill', 8, 10], ['inn', 13, 10], ['market', 18, 10], ['coalmine', 3, 17], ['goldmine', 8, 17]]) KM.addHouse(S, t, o, x, y, true);
  S.map.ore[18 * 40 + 3] = 1; S.map.oreAmt[18 * 40 + 3] = 20;
  S.map.ore[18 * 40 + 24] = 3; S.map.oreAmt[18 * 40 + 24] = 20;
  const before = JSON.stringify(st.inv); KM.updateAI(S, 1);
  assert.equal(Object.values(S.houses).filter((h) => h.type === 'goldmine').length, 2);
  assert.equal(S.map.oreAmt[18 * 40 + 24], 20); assert.equal(JSON.stringify(st.inv), before);
});
check('Frente, lado e costas funcionam nas oito direções, sem depender do alvo', () => {
  for (let dir = 0; dir < 8; dir++) {
    const f = KM.DIRS8[dir], target = { x: 10, y: 10, heading: dir, target: { id: 999 } };
    assert.equal(KM.flankMultiplier({ x: 10 + f[0], y: 10 + f[1] }, target), 1);
    assert.equal(KM.flankMultiplier({ x: 10 - f[1], y: 10 + f[0] }, target), 1.15);
    assert.equal(KM.flankMultiplier({ x: 10 - f[0], y: 10 - f[1] }, target), 1.3);
  }
});
check('Ao terminar a marcha, soldados voltam à direção da formação; saves antigos preservam essa direção', () => {
  const S = flat(), u = KM.addUnit(S, 'militia', 0, 5, 5), g = KM.newGroup(S, 0, 'militia', [u]);
  g.dir = 4; u.heading = 2; u.order = { x: 5, y: 5, am: false }; u.scanT = 999;
  KM.updateSoldier(S, u, 1); assert.equal(u.order, null); assert.equal(u.heading, 4);
  delete u.heading; const afterLoad = KM.afterLoad, keepS = KM.S;
  storage.set('rm_save_qa', JSON.stringify(S)); KM.afterLoad = (loaded) => { KM.S = loaded; };
  try { assert.equal(KM.load('qa'), true); assert.equal(KM.S.units[u.id].heading, 4); }
  finally { KM.afterLoad = afterLoad; KM.S = keepS; storage.delete('rm_save_qa'); }
});
check('Tiros respeitam montanhas, casas, a origem da torre e a casa-alvo', () => {
  const S = flat(), target = KM.addUnit(S, 'militia', 1, 10, 16);
  assert.equal(KM.hasLineOfSight(S, 10, 10, target, 'u'), true);
  S.map.terrain[13 * 40 + 10] = KM.T.MOUNTAIN;
  assert.equal(KM.hasLineOfSight(S, 10, 10, target, 'u'), false);
  S.map.terrain[13 * 40 + 10] = KM.T.GRASS;
  const h = KM.addHouse(S, 'school', 1, 9, 13, true);
  assert.equal(KM.hasLineOfSight(S, 10, 10, target, 'u'), false);
  assert.equal(KM.hasLineOfSight(S, 10, 10, h, 'h'), true);
  const tower = KM.addHouse(S, 'tower', 0, 9, 9, true);
  assert.equal(KM.hasLineOfSight(S, KM.hcx(tower), KM.hcy(tower), h, 'h'), true);
});
check('Casas giradas: pegada, entrada nas 4 direções e porta única', () => {
  const S = flat();
  const doors = [0, 1, 2, 3].map((r) => { const h = KM.addHouse(S, 'barracks', 0, 6 + r * 7, 10, true, r); return [h.w, h.h, h.ex - h.x, h.ey - h.y]; });
  assert.deepEqual(doors, [[3, 2, 1, 2], [2, 3, 2, 1], [3, 2, 1, -1], [2, 3, -1, 1]]);
  assert.equal(KM.canPlace(S, 'barracks', 6, 13, 0, 2).ok, false); // porta ao norte no mesmo ladrilho da porta ao sul
  assert.equal(KM.def({ type: 'tower' }).shoot > 0, true);
  assert.equal(KM.houseRange(KM.addHouse(S, 'quarry', 0, 20, 20, true)).r, KM.HOUSES.quarry.radius);
});
check('WASD move a câmera sem perder tropas; Shift+A/S mantém as ordens militares', () => {
  const S = flat(), keepS = KM.S, keepR = KM.R, keepIssue = KM.issue, keepToast = KM.ui.toast;
  const u = KM.addUnit(S, 'militia', 0, 10, 10), group = KM.newGroup(S, 0, 'militia', [u]);
  const orders = [], pans = [];
  const key = (k, down, shiftKey = false, target) => KM.input.key({ key: k, code: '', shiftKey, target }, down);
  KM.S = S; KM.R = { dist: 10, panWorld: (x, y) => pans.push([x, y]), pickTile: () => ({ tx: 15, ty: 15 }), unitScreen: () => ({ x: -100, y: -100 }), pickHouse: () => 0 };
  KM.issue = cmd => orders.push(cmd); KM.ui.toast = () => {};
  try {
    KM.ui.selectGroups([group.id]); KM.ui.attackMove = false;
    for (const [k, dx, dy] of [['a', -1, 0], ['d', 1, 0], ['w', 0, -1], ['s', 0, 1], ['ArrowLeft', -1, 0], ['ArrowDown', 0, 1]]) {
      key(k, true); KM.input.update(0.1); key(k, false);
      const p = pans.pop(); assert.ok(p); assert.equal(Math.sign(p[0]), dx); assert.equal(Math.sign(p[1]), dy);
      assert.deepEqual([...KM.ui.selGroups], [group.id]); assert.ok(KM.ui.selSet.has(u.id));
      assert.equal(KM.ui.attackMove, false); assert.equal(orders.length, 0);
    }
    key('a', true, false, { tagName: 'INPUT' }); KM.input.update(0.1); assert.equal(pans.length, 0);
    key('A', true, true); KM.input.update(0.1); key('A', false, true); key('Shift', false);
    assert.equal(KM.ui.attackMove, true); assert.equal(pans.length, 0);
    KM.input.down({ button: 2, clientX: 200, clientY: 200 }); KM.input.up({ button: 2 });
    assert.equal(orders[0].c, 'move'); assert.equal(orders[0].am, true); assert.equal(KM.ui.attackMove, false);
    key('S', true, true); KM.input.update(0.1); key('S', false, true); key('Shift', false);
    assert.equal(orders[1].c, 'stop'); assert.equal(pans.length, 0); assert.deepEqual([...KM.ui.selGroups], [group.id]);
    KM.ui.clearSel(); key('a', true); KM.input.update(0.1); key('a', false); assert.ok(pans.pop()[0] < 0);
  } finally {
    for (const k of ['a', 's', 'Shift']) key(k, false);
    KM.mouse.down = false; KM.ui.clearSel(); KM.ui.attackMove = false;
    KM.S = keepS; KM.R = keepR; KM.issue = keepIssue; KM.ui.toast = keepToast;
  }
});
check('Minas mostram alcance do centro igual à extração; pedreira mantém alcance da porta', () => {
  for (const type of ['coalmine', 'ironmine', 'goldmine', 'quarry']) for (let rot = 0; rot < 4; rot++) {
    const S = flat(), f = KM.footprint(type, 20, 20, rot), h = { type, x: 20, y: 20, ...f };
    const d = KM.def(h), rg = KM.houseRange(h);
    assert.ok(rg); assert.equal(rg.r, d.mine ? KM.MINE_RADIUS : d.radius);
    assert.equal(rg.x, d.mine ? KM.hcx(h) : h.ex); assert.equal(rg.y, d.mine ? KM.hcy(h) : h.ey);
    if (!d.mine) continue;
    const inside = 23 * S.map.W + 25, outside = 25 * S.map.W + 25;
    S.map.terrain[inside] = S.map.terrain[outside] = KM.T.MOUNTAIN;
    S.map.ore[inside] = S.map.ore[outside] = d.mine; S.map.oreAmt[inside] = S.map.oreAmt[outside] = 2;
    assert.equal(KM.canPlace(S, type, h.x, h.y, 0, rot).ok, true);
    assert.equal(KM.findOre(S, rg.x, rg.y, d.mine, false), true); assert.equal(S.map.oreAmt[inside], 2);
    assert.equal(KM.findOre(S, rg.x, rg.y, d.mine, true), true); assert.equal(S.map.oreAmt[inside], 1);
    assert.equal(KM.findOre(S, rg.x, rg.y, d.mine, true), true);
    assert.equal(KM.findOre(S, rg.x, rg.y, d.mine, true), false); assert.equal(S.map.oreAmt[outside], 2);
    assert.equal(KM.canPlace(S, type, h.x, h.y, 0, rot).ok, false);
  }
});
check('Camponês armado sai do Quartel só com o recruta', () => {
  const S = flat(), bar = KM.addHouse(S, 'barracks', 0, 10, 10, true);
  bar.recruits = 1;
  assert.equal(KM.equip(S, bar, 'levy'), true);
  assert.deepEqual([...KM.TECH.barracks], ['sawmill']);
});
check('Ordens diretas não atacam aliados', () => {
  const S = flat(), a = KM.addUnit(S, 'militia', 0, 5, 5), friend = KM.addUnit(S, 'militia', 0, 6, 5);
  const g = KM.newGroup(S, 0, 'militia', [a]);
  KM.exec(S, { o: 0, c: 'attack', g: [g.id], k: 'u', id: friend.id }); assert.equal(a.target, null);
});
check('Controle territorial vence e reinicia ao ficar contestado ou vazio', () => {
  const S = flat();
  S.sites = [{ id: 'vau', n: 'Vau', x: 20, y: 20, r: 6, owner: -1, held: [0, 0] }];
  for (let k = 0; k < 3; k++) KM.addUnit(S, 'militia', 0, 20 + k, 20);
  for (let t = 2; t <= 180; t += 2) { S.time = t; KM.updateSites(S); }
  const goal = { k: 'any', routes: [{ k: 'destroy' }, { k: 'hold', sites: ['vau'], t: 180 }] };
  assert.equal(KM.goalStatus(S, goal).done, true);
  const enemy = KM.addUnit(S, 'militia', 1, 20, 20); S.time += 2; KM.updateSites(S);
  assert.equal(S.sites[0].contested, true); assert.equal(S.sites[0].held[0], 0);
  delete S.units[enemy.id]; S.units = {}; S.time += 2; KM.updateSites(S); assert.equal(S.sites[0].owner, -1);
});
check('Postos exigem Armazém conectado por estrada pronta', () => {
  const S = flat();
  KM.addHouse(S, 'storehouse', 0, 4, 4, true);
  S.sites = [{ id: 'posto', n: 'Posto', x: 28, y: 28, r: 6, outpost: true, owner: -1, held: [0, 0] }];
  for (let k = 0; k < 3; k++) KM.addUnit(S, 'militia', 0, 28 + k, 28);
  const h = KM.addHouse(S, 'storehouse', 0, 25, 24, true);
  KM.computeRoadComps(S); S.time = 2; KM.updateSites(S); assert.equal(S.sites[0].owner, -1);
  KM.connectRoad(S, h, false); KM.computeRoadComps(S); S.time = 4; KM.updateSites(S); assert.equal(S.sites[0].owner, -1);
  for (let i = 0; i < S.map.road.length; i++) if (S.map.road[i] === 1) S.map.road[i] = 2;
  KM.computeRoadComps(S); S.time = 6; KM.updateSites(S); assert.equal(S.sites[0].owner, 0);
});
check('Casas protegidas causam derrota se destruídas; reparação conta integridade real', () => {
  const S = KM.newState({ mission: 'c3', diff: 'normal' });
  assert.equal(KM.goalStatus(S, { k: 'restore' }).done, false);
  for (const id of S.protected) S.houses[id].hp = S.houses[id].maxHp;
  assert.equal(KM.goalStatus(S, { k: 'restore' }).done, true);
  KM.removeHouse(S, S.houses[S.protected[1]], true); KM.checkGoals(S); assert.equal(S.over, 'lose');
});
check('Expedição exige recursos e exército simultaneamente, sem registrar estoques antigos', () => {
  const S = flat(); S.time = 1200;
  const store = KM.addHouse(S, 'storehouse', 0, 3, 3, true); store.inv.bread = 40;
  const goal = { k: 'all', routes: [{ k: 'survive', t: 1200 }, { k: 'res', r: 'bread', n: 40 }, { k: 'army', n: 2 }] };
  for (let k = 0; k < 2; k++) KM.addUnit(S, 'militia', 0, 10 + k, 10);
  assert.equal(KM.goalStatus(S, goal).done, true); store.inv.bread = 0; assert.equal(KM.goalStatus(S, goal).done, false);
});
check('Tundra leva 25% mais tempo para crescer e saves antigos usam Pradaria', () => {
  const S = flat(); S.map.biome = 'tundra'; S.map.field[0] = 2; S.map.fstage[0] = 1;
  KM.growMap(S, 30); assert.equal(S.map.fstage[0], 1);
  KM.growMap(S, 7.5); assert.equal(S.map.fstage[0], 2);
  delete S.map.biome; assert.equal(KM.biome(S.map).n, 'Pradaria');
});
check('Escaramuça começa com 2 construtores e 2 carregadores; a última Escola não pode ser demolida', () => {
  const S = KM.newState({ seed: 3, diff: 'normal' }); KM.simS = S;
  const mine = Object.values(S.units).filter((u) => u.owner === 0 && !KM.isSoldier(u.type));
  assert.equal(mine.filter((u) => u.type === 'laborer').length, 2); assert.equal(mine.filter((u) => u.type === 'serf').length, 2); assert.equal(mine.length, 4);
  const school = Object.values(S.houses).find((h) => h.owner === 0 && h.type === 'school');
  KM.exec(S, { o: 0, c: 'demolish', id: school.id }); assert.ok(S.houses[school.id]);
  KM.exec(S, { o: 0, c: 'demolishAt', x: school.x, y: school.y }); assert.ok(S.houses[school.id]);
});
check('Durante a paz cada reino fica no próprio quadrante; depois a fronteira abre', () => {
  const S = KM.newState({ seed: 3, diff: 'normal' }); KM.simS = S; KM.me = 0;
  assert.equal(S.peaceEnd, KM.DIFF.normal.peace);
  const z = KM.zone(S, 0), st = S.starts[0], hw = S.map.W >> 1;
  assert.ok(z && st.x >= z.x0 && st.x <= z.x1 && st.y >= z.y0 && st.y <= z.y1);
  const g = Object.values(S.army).find((a) => a.owner === 0);
  KM.exec(S, { o: 0, c: 'move', g: [g.id], x: S.map.W - 3, y: 3 });
  for (const u of KM.groupUnits(S, g)) assert.ok(KM.inZone(S, 0, u.order.x, u.order.y));
  assert.equal(KM.canPlace(S, 'woodcutter', hw + 2, z.y0 + 5, 0).ok, false);
  S.time = S.peaceEnd + 1; assert.equal(KM.zone(S, 0), null);
  KM.exec(S, { o: 0, c: 'move', g: [g.id], x: S.map.W - 3, y: 3 });
  assert.ok(KM.groupUnits(S, g).some((u) => !(u.order.x <= z.x1 && u.order.y >= z.y0)));
  const mis = KM.newState({ mission: 'm2', diff: 'normal' }); assert.equal(mis.zones, null);
});
check('Tutorial completo salva o curso, inclui produção/encomendas/recrutas e conclui a missão', () => {
  const S = KM.newState({ mission: 't1', diff: 'normal' }); KM.tutorial.start(S, true);
  assert.equal(S.tut.course, 'full'); assert.match(KM.tutorial.el.innerHTML, /1\/26/);
  const copy = JSON.parse(JSON.stringify(S)); assert.equal(copy.tut.course, 'full');
  const titles = [];
  while (S.tut) { titles.push(KM.tutorial.el.innerHTML); KM.tutorial.advance(S); }
  assert.ok(titles.some((t) => t.includes('Encomende um machado')));
  assert.ok(titles.some((t) => t.includes('Treine um Recruta')));
  assert.ok(titles.some((t) => t.includes('Abasteça antes de atacar')));
  KM.checkGoals(S); assert.equal(S.over, 'win');
});
check('Guia espera a produção de pão e a formação de um novo soldado', () => {
  const S = flat(), keepUI = KM.ui, keepR = KM.R;
  KM.ui = { tool: null, selGroups: [], tab: 'build' }; KM.R = { focus: { x: 0, y: 0 }, dist: 12, ready: false };
  context.document.querySelector('#brief').classList.contains = () => true;
  context.document.querySelector('#endscreen').classList.contains = () => true;
  try {
    KM.addUnit(S, 'militia', 0, 5, 5); KM.tutorial.start(S, true);
    S.tut.i = 15; KM.tutorial.update(S, 1); assert.equal(S.tut.i, 15);
    const h = KM.addHouse(S, 'bakery', 0, 8, 8, true), worker = KM.addUnit(S, 'baker', 0, h.ex, h.ey);
    h.worker = worker.id; worker.home = worker.inside = h.id; h.inv.flour = 1;
    KM.tutorial.update(S, 1); assert.equal(S.tut.i, 15);
    KM.updateHouse(S, h, 1); KM.updateHouse(S, h, KM.HOUSES.bakery.recipes[0].t);
    assert.equal(h.completed, 1); KM.tutorial.update(S, 1); assert.equal(S.tut.i, 16);
    S.tut.i = 20; KM.tutorial.update(S, 1); assert.equal(S.tut.i, 20);
    KM.addUnit(S, 'militia', 0, 6, 5); KM.tutorial.update(S, 1); assert.equal(S.tut.i, 21);
  } finally { KM.ui = keepUI; KM.R = keepR; KM.tutorial.stop(S); }
});
check('Vitória descobre biomas na progressão e não repete descobertas antigas', () => {
  const keepS = KM.S, keepUI = KM.ui, old = storage.get('rm_conquest');
  KM.ui = { showEnd() {} }; storage.set('rm_conquest', JSON.stringify({ open: 2, crowns: {} }));
  try {
    for (const [mission, biome] of [['c2', 'outono'], ['c3', 'pantano'], ['c7', 'tundra']]) {
      const S = KM.newState({ mission, diff: 'normal' }); KM.S = S;
      S.players.slice(1).forEach((p) => { p.out = true; }); KM.checkGoals(S);
      assert.equal(S.over, 'win'); assert.ok(S.unlockedBiomes.includes(biome));
      assert.equal(KM.conquestProgress().open, +mission.slice(1) + 1);
    }
    const S = KM.newState({ mission: 'c2', diff: 'normal' }); KM.S = S;
    S.players[1].out = true; KM.checkGoals(S); assert.equal(S.unlockedBiomes.length, 0);
  } finally { KM.S = keepS; KM.ui = keepUI; if (old == null) storage.delete('rm_conquest'); else storage.set('rm_conquest', old); }
});
check('Mapa, combate e objetivos reproduzem o mesmo estado e sobrevivem a salvar/carregar', () => {
  function run() { const S = KM.newState({ mission: 'c2', diff: 'normal' }); for (let i = 0; i < 400; i++) KM.step(S, KM.DT); return S; }
  const a = run(), b = run(); assert.equal(JSON.stringify(a), JSON.stringify(b));
  assert.equal(KM.checksum(a), KM.checksum(b));
  const soldier = Object.values(b.units).find((u) => KM.isSoldier(u.type)); soldier.heading = (soldier.heading + 1) % 8;
  assert.notEqual(KM.checksum(a), KM.checksum(b));
  const copy = JSON.parse(JSON.stringify(a));
  KM.simS = copy; KM.setMapSize(copy.map.W, copy.map.H); KM.rt = { comp: null, roadsDirty: true }; KM.computeRoadComps(copy);
  for (let i = 0; i < 40; i++) KM.step(copy, KM.DT);
  KM.simS = a; KM.rt = { comp: null, roadsDirty: true }; KM.computeRoadComps(a);
  for (let i = 0; i < 40; i++) KM.step(a, KM.DT);
  assert.equal(JSON.stringify(a), JSON.stringify(copy));
});
check('Multijogador monta times para 2 a 4 humanos', () => {
  const teams = (cfg) => cfg.players.map((p) => p.team);
  const humansOf = (cfg) => cfg.players.filter((p) => p.human).length;
  for (let n = 2; n <= 4; n++) {
    for (let opp = 0; opp <= 3; opp++) {
      const v = KM.skirmishConfig({ mp: true, humans: n, teams: 'versus', opponents: opp });
      assert.equal(v.players.length, Math.min(4, n + opp), `versus ${n}+${opp}`);
      assert.equal(humansOf(v), n);
      assert.equal(new Set(teams(v)).size, v.players.length, 'todos contra todos: cada reino no seu time');
      v.players.forEach((p, i) => assert.equal(p.team, p.human ? i : 10 + i - n));
      const c = KM.skirmishConfig({ mp: true, humans: n, teams: 'coop', opponents: opp });
      assert.ok(c.players.length <= 4, `coop ${n}+${opp}`);
      assert.equal(humansOf(c), n);
      if (n <= 3) assert.equal(c.players.length, Math.min(4, n + Math.max(1, opp)));
      c.players.forEach((p) => assert.equal(p.team, p.human ? 0 : 9));
      const x = KM.skirmishConfig({ mp: true, humans: n, teams: '2x2', opponents: opp });
      assert.equal(JSON.stringify(teams(x)), "[0,0,1,1]");
      assert.equal(JSON.stringify(x.players.map((p) => !!p.human)), JSON.stringify([0, 1, 2, 3].map((i) => i < n)));
    }
  }
  const S = KM.newState({ mp: true, humans: 4, teams: 'versus', seed: 3, diff: 'normal' });
  assert.equal(S.players.length, 4);
  assert.ok(S.players.every((p) => p.human));
  assert.equal(new Set(S.starts.slice(0, 4).map((s) => s.x + ',' + s.y)).size, 4);
  const solo = KM.skirmishConfig({ diff: 'normal', opponents: 2, ally: true });
  assert.equal(JSON.stringify(teams(solo)), "[0,0,9,9]");
});
check('Quatro humanos com os mesmos comandos geram o mesmo estado; quem sai vira IA no mesmo turno', () => {
  function run() {
    const S = KM.newState({ mp: true, humans: 4, teams: 'versus', seed: 11, diff: 'normal' }); KM.simS = S;
    for (let i = 0; i < 600; i++) {
      if (i === 40) for (let o = 0; o < 4; o++) { const st = S.starts[o]; KM.exec(S, { o, c: 'build', t: 'woodcutter', x: st.x + 4, y: st.y + 3 }); }
      if (i === 200) KM.exec(S, { o: 3, c: 'leave' });
      KM.step(S, KM.DT);
    }
    return S;
  }
  const a = run(), b = run(), c = run();
  assert.equal(KM.checksum(a), KM.checksum(b));
  assert.equal(KM.checksum(b), KM.checksum(c));
  assert.equal(a.players[3].human, false);
  assert.ok(a.players[3].ai);
  assert.ok(a.players.slice(0, 3).every((p) => p.human));
});
if (process.argv.includes('--balance')) {
  for (const seed of [1, 7, 19]) {
    const r = KM.sim.bots({ seed, minutes: 40, fair: true });
    console.log(JSON.stringify({ seed, ms: r.ms, out: r.S.players.map((p) => p.out), log: r.log }));
  }
}
console.log(`${passed} grupos de regressão passaram.`);
