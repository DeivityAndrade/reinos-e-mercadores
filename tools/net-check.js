'use strict';
// Regressões do multijogador (lockstep em estrela), sem navegador. Execute: node tools/net-check.js
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
// net.js valida partida e comandos com KM.DIFF (config.js) e KM.validCommand (cmd.js), como no navegador
const load = (f) => ({ f, src: fs.readFileSync(path.resolve(__dirname, '..', 'js', f), 'utf8') });
const libs = [load('config.js'), load('cmd.js')], netSrc = load('net.js');

class FakePC {
  constructor() { this.iceGatheringState = 'complete'; this.localDescription = { sdp: 'x' }; }
  createDataChannel() { return { readyState: 'connecting', close() {} }; }
  async createOffer() { return {}; }
  async setLocalDescription() {}
  async setRemoteDescription() {}
  addEventListener() {}
  close() {}
}
// um "navegador": contexto isolado com seu próprio KM e sua própria instância de net
function client(me) {
  const KM = {};
  const ctx = { window: { KM }, document: { querySelector: () => null }, performance, setInterval: () => 1, clearInterval() {}, setTimeout, RTCPeerConnection: FakePC, console, JSON, Math, Object, Number, String, Array };
  vm.createContext(ctx);
  for (const l of libs) vm.runInContext(l.src, ctx, { filename: l.f });
  Object.assign(KM, { me, ui: { toast() {} }, esc: (s) => s, COLORS: [], started: null, startGame(o) { KM.started = o; } });
  vm.runInContext(netSrc.src, ctx, { filename: netSrc.f });
  const net = KM.net;
  net.got = [];
  const on = net.onMsg.bind(net);
  net.onMsg = (m, slot) => { net.got.push(m); return on(m, slot); };
  return { KM, net, t: 0, log: [] };
}
const queue = [];
const flush = () => { while (queue.length) queue.shift()(); };
const channel = (target, fromSlot) => ({ readyState: 'open', close() {}, send(s) { queue.push(() => target.net.onMsg(JSON.parse(s), fromSlot)); } });
function room(n) {
  const host = client(0); host.net.role = 'host';
  const guests = [];
  for (let s = 1; s < n; s++) {
    const g = client(s); g.net.role = 'guest';
    host.net.peers[s] = { id: 'g' + s, o: s, dc: channel(g, 0), ping: 0 };
    g.net.peers[0] = { id: 'h', o: 0, dc: channel(host, s), ping: 0 };
    guests.push(g);
  }
  const opts = { mp: true, humans: n, teams: 'versus', diff: 'normal', opponents: 0, aiMode: 'economy', seed: 12345 };
  host.net.begin(opts, 0);
  guests.forEach((g, i) => g.net.begin(opts, i + 1));
  return { host, guests, all: [host, ...guests] };
}
// avança um cliente o quanto o lockstep permitir, registrando o que cada turno executa
function run(c, upTo) {
  while (c.t <= upTo && c.net.ready(c.t)) {
    c.log[c.t] = JSON.stringify(c.net.take(c.t));
    assert.equal(c.net.queue({ c: 'move', g: [1], x: c.t % 10, y: 1, o: c.KM.me }), true);
    c.net.send(c.t);
    c.t++;
  }
}
let passed = 0;
function check(name, fn) { return Promise.resolve(fn()).then(() => { passed++; console.log('✓ ' + name); }); }

(async () => {
  await check('Quatro jogadores: o anfitrião repassa as jogadas e todos executam os mesmos turnos', () => {
    const { host, guests, all } = room(4);
    assert.equal(host.net.DELAY, 4);
    for (const c of all) run(c, 3);
    assert.equal(host.net.ready(4), false, 'sem os convidados o turno 4 não pode rodar');
    flush();
    for (const c of all) assert.equal(c.net.ready(4), true);
    for (let k = 0; k < 40; k++) { for (const c of all) run(c, 30); flush(); }
    for (const c of all) assert.ok(c.t > 30, 'ninguém travou');
    for (let t = 0; t <= 30; t++) for (const c of all) assert.equal(c.log[t], host.log[t], 'turno ' + t);
    const t4 = JSON.parse(host.log[4]);
    assert.deepEqual(t4.map((c) => c.o).sort(), [0, 1, 2, 3]);
    for (const g of guests) assert.ok(!g.net.got.some((m) => m.t === 'turn' && m.o === g.KM.me), 'convidado não recebe a própria jogada de volta');
  });

  await check('Convidado que cai vira IA no mesmo turno em todos e ninguém fica esperando por ele', () => {
    const { host, guests, all } = room(4);
    const [g1, g2, g3] = guests;
    for (let k = 0; k < 3; k++) { for (const c of all) run(c, 12); flush(); }
    // o convidado 3 manda mais alguns turnos e cai; parte do que mandou ainda está a caminho
    run(g3, 14);
    queue.length = Math.max(0, queue.length - 1);
    host.net.peerLost(3);
    flush();
    const n = host.net.drops[3];
    assert.ok(n > host.net.turn + host.net.DELAY, 'a saída fica para um turno que ninguém executou');
    for (const g of [g1, g2]) assert.equal(g.net.drops[3], n);
    const alive = [host, g1, g2];
    for (let k = 0; k < 40; k++) { for (const c of alive) run(c, n + 10); flush(); }
    for (const c of alive) assert.ok(c.t > n + 10, 'lockstep segue sem o jogador que saiu');
    for (let t = 0; t <= n + 10; t++) for (const c of alive) assert.equal(c.log[t], host.log[t], 'turno ' + t);
    const atN = JSON.parse(host.log[n]);
    assert.deepEqual(atN[0], { c: 'leave', o: 3 });
    for (let t = n; t <= n + 10; t++) assert.ok(!JSON.parse(host.log[t]).some((c) => c.o === 3 && c.c !== 'leave'));
  });

  await check('Sala aceita até 3 convidados; o quinto recebe "sala cheia"', async () => {
    const h = client(0); h.net.role = 'host'; h.net.myId = 'h1';
    const posts = []; h.net.post = (m) => posts.push(m);
    for (const id of ['a', 'b', 'c', 'a']) await h.net.onRoomMsg({ t: 'hello', from: id });
    assert.deepEqual(Object.keys(h.net.peers).map(Number), [1, 2, 3]);
    assert.deepEqual(posts.filter((m) => m.t === 'offer').map((m) => m.slot), [1, 2, 3]);
    await h.net.onRoomMsg({ t: 'hello', from: 'd' });
    assert.equal(JSON.stringify(posts.at(-1)), JSON.stringify({ t: 'full', from: 'h1', to: 'd' }));
    // vaga liberada no lobby volta a ser oferecida
    h.net.peerLost(2);
    await h.net.onRoomMsg({ t: 'hello', from: 'e' });
    assert.equal(posts.at(-1).slot, 2);
    h.net.started = true;
    await h.net.onRoomMsg({ t: 'hello', from: 'f' });
    assert.equal(posts.at(-1).t, 'full');
  });

  await check('Dois jogadores mantêm o atraso de 3 turnos e a queda do anfitrião libera o convidado', () => {
    const { host, guests } = room(2);
    const g = guests[0];
    assert.equal(g.net.DELAY, 3);
    const execs = [];
    g.KM.S = { players: [{ human: true }, { human: true }] }; g.KM.exec = (S, c) => execs.push(c);
    g.net.peerLost(0);
    assert.equal(g.net.active, false);
    assert.equal(JSON.stringify(execs), JSON.stringify([{ o: 0, c: 'leave' }]));
    assert.ok(host.net.active);
  });

  await check('Pacotes de turno malformados, fora da janela ou grandes demais sao rejeitados sem travar', () => {
    const { host } = room(2);
    assert.equal(host.net.onMsg({ t: 'turn', n: 3, c: [{ c: 'roads', tiles: null }] }, 1), false);
    assert.equal(host.net.onMsg({ t: 'turn', n: Infinity, c: [] }, 1), false);
    assert.equal(host.net.onMsg({ t: 'turn', n: 9999, c: [] }, 1), false);
    assert.equal(host.net.onMsg({ t: 'turn', n: 3, c: Array.from({ length: 129 }, () => ({ c: 'stop', g: [1] })) }, 1), false);
    assert.equal(Object.keys(host.net.inbox).length, 0);
    assert.equal(host.net.active, true);
    assert.equal(host.net.onMsg({ t: 'turn', n: 3, o: 0, c: [{ c: 'move', o: 0, g: [1], x: 2, y: 3 }] }, 1), true);
    assert.equal(host.net.inbox[3][1][0].o, 1, 'a vaga conectada define o dono do comando');
    assert.equal(host.net.store(3, 1, []), false, 'pacote duplicado nao sobrescreve o turno');
    assert.equal(JSON.stringify(host.net.take(3)), JSON.stringify([{ c: 'move', o: 1, g: [1], x: 2, y: 3 }]));
    host.net.inbox[4] = { 1: [{ c: 'roads', tiles: null }] };
    assert.equal(host.net.take(4).length, 0, 'take tambem protege contra caixa adulterada');
  });

  await check('O hash remoto que chega primeiro e comparado quando o hash local chega', () => {
    const { host } = room(2);
    assert.equal(host.net.onMsg({ t: 'hash', n: 0, h: 123 }, 1), true);
    assert.equal(host.net.desync, false);
    assert.equal(host.net.sendHash(0, 124), true);
    assert.equal(host.net.desync, true);
  });

  await check('DataChannel ignora JSON invalido e pacotes acima do limite', () => {
    const g = client(1); g.net.role = 'guest';
    g.net.peers[0] = { id: 'h', o: 0, dc: null, ping: 0 };
    const dc = { readyState: 'open', close() {} };
    g.net.bind(0, dc);
    assert.doesNotThrow(() => dc.onmessage({ data: '{' }));
    assert.doesNotThrow(() => dc.onmessage({ data: ' '.repeat(65537) }));
    assert.equal(g.net.rejected, 2);
    assert.equal(g.net.active, false);
  });
  console.log(`${passed} grupos de regressão do multijogador passaram.`);
})().catch((e) => { console.error(e); process.exit(1); });
