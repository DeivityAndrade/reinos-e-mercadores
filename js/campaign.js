'use strict';
/* Campanha: missões, objetivos, derrota/vitória, progresso */
(function (KM) {
  const baseStock = { wood: 30, stone: 35, gold: 25, bread: 15, sausages: 10, wine: 10, fish: 5 };
  const S2 = (o) => Object.assign({}, baseStock, o);
  const MED = ['storehouse', 'school', 'inn', 'woodcutter', 'woodcutter', 'sawmill', 'quarry', 'farm', 'mill', 'bakery', 'barracks'];
  const FULL = MED.concat(['swine', 'butcher', 'tannery', 'weaponworkshop', 'armorworkshop', 'tower', 'tower']);
  const WORKERS = [['serf', 14], ['laborer', 6]];
  const econ = (mult, extra) => Object.assign({
    mode: 'economy', peace: 900, mult, def: 8, attackN: Math.round(14 / mult),
    houses: ['school', 'inn', 'woodcutter', 'woodcutter', 'quarry', 'sawmill', 'farm', 'mill', 'bakery', 'barracks', 'weaponworkshop', 'armorworkshop', 'tower', 'tower'],
    stock: { wood: 40, stone: 40, gold: 40, bread: 25, sausages: 15, axe: 4, shield: 3, armor: 3, bow: 3, leather: 4 },
    units: [['serf', 12], ['laborer', 6], ['recruit', 2]], soldiers: [['axeman', 4], ['bowman', 4], ['lancer', 2]],
  }, extra || {});
  const waves = (mult, peace, interval, extra) => Object.assign({
    mode: 'waves', peace, interval, mult, def: 8,
    houses: ['school', 'barracks', 'inn', 'sawmill', 'farm', 'tower', 'tower'], soldiers: [['axeman', 4], ['bowman', 4]],
  }, extra || {});

  KM.MISSIONS = [
    {
      id: 'm1', n: 'I · O Recomeço', seed: 1101,
      brief: 'A guerra civil deixou o Reino de Aldor em ruínas. O Rei confia a você as terras do sul.<br><br>Antes de qualquer exército, precisamos de <b>madeira</b> e <b>pedra</b>. Ligue cada casa ao Armazém com estradas: os carregadores só andam por elas, e cada trecho custa 1 pedra.<br><br>No começo você só pode erguer o básico. <b>Cada construção nova libera outras</b>: o Lenhador libera a Serraria, e a Serraria libera a Taverna. Acompanhe os <b>Próximos passos</b> na aba Construir.',
      player: { houses: ['storehouse', 'school'], stock: baseStock, units: [['serf', 6], ['laborer', 3], ['woodcutter', 1], ['stonemason', 1], ['carpenter', 1]] },
      ai: { mode: 'none' },
      goals: [{ k: 'build', t: 'woodcutter', n: 1 }, { k: 'build', t: 'sawmill', n: 1 }, { k: 'build', t: 'quarry', n: 1 }, { k: 'build', t: 'inn', n: 1 }, { k: 'res', r: 'wood', n: 60 }],
    },
    {
      id: 'm2', n: 'II · Pão e Salsichas', seed: 2202,
      brief: 'O povo tem fome. Cidadãos sem comida trabalham pela metade.<br><br>Construa <b>fazendas</b> e desenhe <b>campos de trigo</b> perto delas (tecla F). O trigo vira farinha no Moinho e pão na Padaria. Também alimenta porcos, que o Açougue transforma em salsichas.',
      player: { houses: ['storehouse', 'school', 'inn', 'woodcutter', 'sawmill', 'quarry'], stock: S2({ wood: 50, stone: 50, gold: 30 }), units: [['serf', 10], ['laborer', 4], ['farmer', 2], ['baker', 2], ['breeder', 1], ['butcher', 1]] },
      ai: { mode: 'none' },
      goals: [{ k: 'build', t: 'farm', n: 2 }, { k: 'build', t: 'mill', n: 1 }, { k: 'build', t: 'bakery', n: 1 }, { k: 'build', t: 'butcher', n: 1 }, { k: 'res', r: 'bread', n: 30 }, { k: 'res', r: 'sausages', n: 20 }],
    },
    {
      id: 'm3', n: 'III · Ferro da Montanha', seed: 3303,
      brief: 'Espiões avisam: o Barão Vermelho está se armando. Precisamos de armas de ferro.<br><br>Construa minas ao lado das montanhas (pontos pretos = carvão, avermelhados = ferro). Funda o ferro, forje armas e armaduras e equipe <b>12 soldados</b> no Quartel. Os recrutas vêm da Escola.<br><br>Pequenos bandos inimigos podem aparecer depois de 20 minutos.',
      player: { houses: ['storehouse', 'school', 'inn', 'woodcutter', 'sawmill', 'quarry', 'farm', 'mill', 'bakery', 'barracks'], stock: S2({ wood: 60, stone: 60, gold: 40, bread: 30 }), units: [['serf', 12], ['laborer', 5], ['miner', 3], ['metallurgist', 1], ['smith', 2], ['recruit', 3]] },
      ai: { mode: 'waves', peace: 1200, interval: 300, mult: 0.5, def: 6, houses: ['school', 'barracks', 'inn', 'tower'], soldiers: [['axeman', 4], ['bowman', 2]] },
      goals: [{ k: 'build', t: 'ironsmithy', n: 1 }, { k: 'build', t: 'weaponsmithy', n: 1 }, { k: 'build', t: 'armorsmithy', n: 1 }, { k: 'army', n: 12 }],
    },
    {
      id: 'm4', n: 'IV · A Fronteira', seed: 4404,
      brief: 'O Barão cruzou a fronteira! Nossas torres e tropas precisam resistir até os reforços do Rei chegarem.<br><br><b>Sobreviva por 20 minutos.</b> Mantenha comida no armazém (soldados com fome morrem!), pedras nas torres e recrutas no quartel.',
      player: { houses: FULL.concat(['tower']), stock: S2({ wood: 60, stone: 80, gold: 50, bread: 40, sausages: 30, axe: 8, shield: 8, armor: 8, bow: 6, lance: 4, leather: 6 }), units: [['serf', 14], ['laborer', 5], ['recruit', 4]], soldiers: [['axeman', 6], ['bowman', 6], ['lancer', 4]], recruits: 4 },
      ai: waves(1.1, 240, 150, { houses: ['school', 'barracks', 'inn', 'tower', 'tower'] }),
      goals: [{ k: 'survive', t: 1200 }],
    },
    {
      id: 'm5', n: 'V · O Posto Avançado', seed: 5505,
      brief: 'Os reforços chegaram. Agora é a nossa vez.<br><br>O Barão mantém um posto avançado a nordeste. <b>Destrua o Armazém, a Escola e o Quartel inimigos e todo o exército dele.</b> Selecione um grupo e clique com o botão direito numa casa inimiga para atacá-la.',
      player: { houses: FULL, stock: S2({ wood: 60, stone: 60, gold: 50, bread: 40, sausages: 30, axe: 6, shield: 6, armor: 6, bow: 6, sword: 4, ironshield: 4, ironarmor: 4 }), units: [['serf', 14], ['laborer', 5], ['recruit', 6]], soldiers: [['swordsman', 6], ['axeman', 8], ['bowman', 8]], recruits: 6 },
      ai: { mode: 'outpost', def: 14, houses: ['school', 'barracks', 'inn', 'sawmill', 'farm', 'tower', 'tower', 'tower'], soldiers: [['axeman', 5], ['bowman', 5], ['lancer', 3], ['swordsman', 3]] },
      goals: [{ k: 'destroy' }],
    },
    {
      id: 'm6', n: 'VI · O Barão Vermelho', seed: 6606,
      brief: 'O Barão Vermelho governa uma cidade próspera e produz o próprio exército, como você.<br><br>Construa uma economia mais forte, forje um exército superior e <b>derrote-o</b>.',
      player: { houses: ['storehouse', 'school', 'inn', 'woodcutter', 'sawmill', 'quarry', 'farm'], stock: S2({ wood: 50, stone: 50, gold: 40, axe: 4, shield: 4, armor: 4 }), units: [['serf', 12], ['laborer', 6], ['baker', 2]], soldiers: [['axeman', 4], ['bowman', 4]] },
      ai: econ(1.1, { peace: 900, attackN: 14 }),
      goals: [{ k: 'destroy' }],
    },
    {
      id: 'm7', n: 'VII · Aliança do Norte', seed: 7707,
      brief: 'O Barão Vermelho fugiu para o leste e jurou vingança. Ele se refez rápido demais: alguém o financia.<br><br>O <b>Duque Verde</b> (aliado, verde) lutará ao nosso lado. Juntos, <b>destruam o novo reduto do Barão</b>.',
      players: [
        { human: true, team: 0, name: 'Você', town: { houses: MED, stock: S2({ wood: 50, stone: 50, gold: 40 }), units: WORKERS, soldiers: [['axeman', 6], ['bowman', 4]] } },
        { team: 1, name: 'Barão Vermelho', ai: econ(1.25, { peace: 720 }) },
        { team: 0, name: 'Duque Verde', ai: econ(0.9, { peace: 900 }) },
      ],
      goals: [{ k: 'destroy' }],
    },
    {
      id: 'm8', n: 'VIII · Dois Barões', seed: 8808,
      brief: 'O financiador se revelou: o <b>Conde Dourado</b> (amarelo) se aliou ao Barão Vermelho.<br><br>O Barão manda ondas de soldados enquanto o Conde fortalece a economia. <b>Derrote os dois.</b>',
      players: [
        { human: true, team: 0, name: 'Você', town: { houses: FULL, stock: S2({ wood: 60, stone: 60, gold: 50, axe: 6, shield: 6, armor: 6 }), units: WORKERS.concat([['recruit', 4]]), soldiers: [['axeman', 6], ['bowman', 6], ['lancer', 4]] } },
        { team: 1, name: 'Barão Vermelho', ai: waves(0.9, 600, 200) },
        { team: 1, name: 'Conde Dourado', ai: econ(1.0, { peace: 1000 }) },
      ],
      goals: [{ k: 'destroy' }],
    },
    {
      id: 'm9', n: 'IX · O Cerco de Pedra', seed: 9909,
      brief: 'O Conde Dourado se escondeu numa fortaleza cercada de torres. Não há tempo para uma economia completa: temos um <b>grande exército</b> e poucos recursos.<br><br>Use arqueiros contra as torres, proteja-os com a infantaria e <b>tome a fortaleza</b>. Não esqueça: soldados precisam comer.',
      players: [
        { human: true, team: 0, name: 'Você', town: { houses: ['storehouse', 'school', 'inn', 'barracks', 'farm', 'mill', 'bakery'], stock: S2({ wood: 30, stone: 20, gold: 10, bread: 80, sausages: 40, wine: 30 }), units: [['serf', 12], ['laborer', 3]], soldiers: [['swordsman', 10], ['axeman', 10], ['crossbowman', 8], ['bowman', 8], ['knight', 5]] } },
        { team: 1, name: 'Conde Dourado', ai: { mode: 'outpost', def: 22, houses: ['school', 'barracks', 'inn', 'tower', 'tower', 'tower', 'tower', 'tower', 'tower'], soldiers: [['pikeman', 6], ['crossbowman', 6], ['swordsman', 6], ['axeman', 6]] } },
      ],
      goals: [{ k: 'destroy' }],
    },
    {
      id: 'm10', n: 'X · Rio de Sangue', seed: 10110,
      brief: 'Com a queda do Conde, os dois exércitos restantes do Barão atacam juntos pelo rio.<br><br><b>Resista por 25 minutos</b> até o Rei reunir a cavalaria.',
      players: [
        { human: true, team: 0, name: 'Você', town: { houses: FULL.concat(['tower', 'tower']), stock: S2({ wood: 70, stone: 90, gold: 60, bread: 50, sausages: 30, axe: 10, shield: 8, armor: 8, bow: 8, lance: 6, leather: 6 }), units: WORKERS.concat([['recruit', 6]]), soldiers: [['axeman', 8], ['bowman', 8], ['lancer', 6]], recruits: 6 } },
        { team: 1, name: 'Barão Vermelho', ai: waves(0.9, 180, 170) },
        { team: 1, name: 'Capitão Rubro', ai: waves(0.8, 300, 190) },
      ],
      goals: [{ k: 'survive', t: 1500 }],
    },
    {
      id: 'm11', n: 'XI · O Ouro do Rei', seed: 11211,
      brief: 'A guerra esvaziou o tesouro real. Nas montanhas do oeste há ouro, mas também saqueadores.<br><br>Construa <b>2 fundições de ouro</b> e junte <b>60 ouro</b> no Armazém.',
      player: { houses: MED, stock: S2({ wood: 60, stone: 60, gold: 20 }), units: WORKERS.concat([['miner', 2], ['metallurgist', 2]]), soldiers: [['axeman', 6], ['bowman', 4]] },
      ai: econ(0.9, { peace: 900 }),
      goals: [{ k: 'build', t: 'goldsmelter', n: 2 }, { k: 'res', r: 'gold', n: 60 }],
    },
    {
      id: 'm12', n: 'XII · Cavalaria Pesada', seed: 12312,
      brief: 'O Rei exige cavaleiros. Crie cavalos no <b>Estábulo</b>, forje espadas, escudos e cotas de malha, e forme <b>8 Cavaleiros</b>. Depois, use-os para <b>derrotar</b> o Barão.',
      player: { houses: FULL, stock: S2({ wood: 60, stone: 60, gold: 50, corn: 20 }), units: WORKERS.concat([['breeder', 2], ['smith', 2], ['miner', 2], ['metallurgist', 1]]), soldiers: [['pikeman', 6], ['crossbowman', 4]] },
      ai: econ(1.1, { peace: 1100 }),
      goals: [{ k: 'units', t: 'knight', n: 8 }, { k: 'destroy' }],
    },
    {
      id: 'm13', n: 'XIII · Três Frentes', seed: 13413,
      brief: 'O Barão reuniu todos os seus vassalos. O Duque Verde volta como nosso aliado.<br><br>Dois inimigos atacam por lados diferentes. <b>Vençam juntos.</b>',
      players: [
        { human: true, team: 0, name: 'Você', town: { houses: FULL, stock: S2({ wood: 60, stone: 60, gold: 50, axe: 6, shield: 6, armor: 6, bow: 6 }), units: WORKERS.concat([['recruit', 4]]), soldiers: [['axeman', 6], ['bowman', 6], ['swordsman', 4]] } },
        { team: 1, name: 'Barão Vermelho', ai: econ(1.2, { peace: 800 }) },
        { team: 0, name: 'Duque Verde', ai: econ(1.0, { peace: 900 }) },
        { team: 1, name: 'Capitão Rubro', ai: waves(0.9, 500, 200) },
      ],
      goals: [{ k: 'destroy' }],
    },
    {
      id: 'm14', n: 'XIV · O Trono de Aldor', seed: 14514,
      brief: 'Os traidores tomaram a capital. Três senhores da guerra, uma só coroa.<br><br>Sem aliados e sem piedade: <b>derrote todos os inimigos</b> e reunifique Aldor.',
      players: [
        { human: true, team: 0, name: 'Você', town: { houses: FULL, stock: S2({ wood: 70, stone: 70, gold: 60, axe: 6, shield: 6, armor: 6, bow: 6 }), units: WORKERS.concat([['recruit', 4]]), soldiers: [['axeman', 8], ['bowman', 6], ['swordsman', 4]] } },
        { team: 1, name: 'Barão Vermelho', ai: econ(1.3, { peace: 900 }) },
        { team: 1, name: 'Conde Dourado', ai: econ(1.1, { peace: 1000 }) },
        { team: 1, name: 'Capitão Rubro', ai: econ(1.0, { peace: 1100 }) },
      ],
      goals: [{ k: 'destroy' }],
    },
  ];

  KM.campaignProgress = function () {
    try { return +(localStorage.getItem('rm_campaign') || 1); } catch (e) { return 1; }
  };
  function unlock(n) {
    try { if (KM.campaignProgress() < n) localStorage.setItem('rm_campaign', String(n)); } catch (e) { /* ok */ }
  }

  function storeTotal(S, r, o) {
    let n = 0;
    for (const id in S.houses) { const h = S.houses[id]; if (h.owner === o && h.type === 'storehouse' && h.state === 'built') n += h.inv[r] || 0; }
    return n;
  }

  KM.goalStatus = function (S, g) {
    const me = KM.me;
    if (g.k === 'build') {
      let n = 0;
      for (const id in S.houses) { const h = S.houses[id]; if (h.owner === me && h.type === g.t && h.state === 'built') n++; }
      const d = KM.HOUSES[g.t];
      return { done: n >= g.n, text: `Construir ${g.n > 1 ? g.n + '× ' : ''}${d.i} ${d.n}`, prog: `${Math.min(n, g.n)}/${g.n}` };
    }
    if (g.k === 'res') {
      const n = storeTotal(S, g.r, me);
      return { done: n >= g.n, text: `Ter ${KM.RES[g.r].i} ${g.n} ${KM.RES[g.r].n} no Armazém`, prog: `${Math.min(n, g.n)}/${g.n}` };
    }
    if (g.k === 'army' || g.k === 'units') {
      let n = 0;
      for (const id in S.units) { const u = S.units[id]; if (u.owner === me && KM.isSoldier(u.type) && (!g.t || u.type === g.t)) n++; }
      const lbl = g.t ? `${KM.SOLDIERS[g.t].i} ${g.n} ${KM.SOLDIERS[g.t].n}${g.n > 1 ? 's' : ''}` : `${g.n} soldados`;
      if (g.done) return { done: true, text: `Ter ${lbl}`, prog: 'feito' };
      return { done: n >= g.n, text: `Ter ${lbl}`, prog: `${Math.min(n, g.n)}/${g.n}` };
    }
    if (g.k === 'survive') return { done: S.time >= g.t, text: `Sobreviver por ${Math.round(g.t / 60)} minutos`, prog: KM.fmtTime(Math.max(0, g.t - S.time)) };
    if (g.k === 'destroy') {
      const foes = (S.players || []).map((p, i) => i).filter((i) => KM.hostile(S, me, i));
      const left = foes.filter((i) => !S.players[i].out);
      return { done: left.length === 0, text: 'Derrotar todos os inimigos', prog: left.length ? left.map((i) => S.players[i].name).join(', ') : 'nenhum restante' };
    }
    return { done: false, text: '?' };
  };

  // um jogador está derrotado quando não tem soldados nem Armazém/Escola/Quartel
  function defeated(S, o) {
    for (const id in S.houses) { const h = S.houses[id]; if (h.owner === o && ['storehouse', 'school', 'barracks'].includes(h.type) && h.state === 'built') return false; }
    for (const id in S.units) { const u = S.units[id]; if (u.owner === o && KM.isSoldier(u.type)) return false; }
    return true;
  }

  KM.checkGoals = function (S) {
    S.players.forEach((p, o) => {
      if (p.out || !defeated(S, o)) return;
      p.out = true;
      if (o !== KM.me) KM.notify(S, `🏳️ ${p.name} foi derrotado!`, KM.hostile(S, KM.me, o) ? 'ok' : 'danger');
    });
    if (S.over) return;
    // objetivos cumpridos uma vez ficam marcados (ex.: ter 8 cavaleiros)
    for (const g of S.goals) if ((g.k === 'units' || g.k === 'army') && !g.done && KM.goalStatus(S, g).done) g.done = true;
    if (S.players[KM.me].out) S.over = 'lose';
    else if (S.goals.length && S.goals.every((g) => KM.goalStatus(S, g).done)) {
      S.over = 'win';
      if (S.mission) { const i = KM.MISSIONS.findIndex((m) => m.id === S.mission); unlock(i + 2); }
    }
    if (S.over && KM.ui) KM.ui.showEnd(S.over);
  };
})(window.KM);
