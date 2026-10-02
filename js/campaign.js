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

  KM.TUTORIAL_MISSION = {
    id: 't1', n: 'Aprenda a governar', seed: 1101,
    brief: 'Construa sua primeira vila sem ataques inimigos. O guia acompanha você das estradas até a produção de pão e a formação do primeiro soldado. Você pode salvar e continuar depois.',
    player: Object.assign(KM.TOWNS.human(), { soldiers: [], stock: { wood: 45, stone: 50, trunk: 6, gold: 40, bread: 30, sausages: 15, wine: 10, fish: 5 } }),
    ai: { mode: 'none' }, goals: [{ k: 'learn' }],
  };
  // ================= Conquista =================
  // Um reino cai quando fica sem Armazém, Escola e Quartel prontos e sem nenhum soldado.
  const RIVALS = [
    { name: 'Reino de Varga', title: 'o Barão de Varga' }, { name: 'Marca de Tessel', title: 'a Condessa de Tessel' },
    { name: 'Ducado de Orm', title: 'o Duque de Orm' }, { name: 'Terras de Kael', title: 'o Senhor de Kael' },
    { name: 'Principado de Ruvia', title: 'a Princesa de Ruvia' }, { name: 'Condado de Brann', title: 'o Conde de Brann' },
  ];
  // personalidades: agressivo (ataca cedo com grupos menores), construtor (demora, vem forte), fortificado (muitas torres e defensores)
  const PERS = {
    equilibrado: (m, p) => ({ mult: m, peace: p, def: Math.round(4 + 5 * m), attackN: Math.round(12 * m) }),
    agressivo: (m, p) => ({ mult: m * 1.05, peace: Math.round(p * 0.75), def: Math.round(3 + 4 * m), attackN: Math.round(8 * m + 2) }),
    construtor: (m, p) => ({ mult: m * 1.1, peace: Math.round(p * 1.25), def: Math.round(4 + 5 * m), attackN: Math.round(16 * m + 2) }),
    fortificado: (m, p) => ({ mult: m, peace: Math.round(p * 1.1), def: Math.round(8 + 7 * m), attackN: Math.round(14 * m), towers: true }),
  };
  const PERS_N = { equilibrado: 'equilibrado: alterna assaltos e ataques em pinça', agressivo: 'agressivo: ataca cedo e saqueia sua produção', construtor: 'construtor: demora, mas ataca forte pelos dois lados', fortificado: 'fortificado: muitas torres, derruba as suas primeiro' };
  // fases: inimigos [personalidade, força], paz base (s), tamanho do mapa, alianças e desafios opcionais
  const LEVELS = [
    { n: 'O Primeiro Rival', mapType: 'continente', W: 72, peace: 1200, foes: [['equilibrado', 0.5]], text: 'Um único reino vizinho disputa estas terras. Ele é fraco e está distraído com a própria colheita: é o momento de crescer.',
      opt: [{ k: 'build', t: 'bakery', n: 1 }, { k: 'army', n: 10 }, { k: 'fast', t: 45 * 60 }] },
    { n: 'O Vale Dividido', mapType: 'rio', W: 76, peace: 1080, foes: [['agressivo', 0.62]], text: 'Do outro lado do vale, um senhor impaciente já afia as espadas. Espere ataques cedo e prepare torres.',
      opt: [{ k: 'build', t: 'tower', n: 2 }, { k: 'res', r: 'bread', n: 40 }, { k: 'fast', t: 45 * 60 }] },
    { n: 'O Senhor da Colina', mapType: 'cordilheiras', W: 80, peace: 360, foes: [['fortificado', 0.75]], text: 'Você encontrou uma vila arruinada nos bosques de outono. Recupere suas casas e proteja-a por 14 minutos, ou elimine o senhor da colina.',
      opt: [{ k: 'units', t: 'axeman', n: 8 }, { k: 'build', t: 'ironsmithy', n: 1 }, { k: 'fast', t: 50 * 60 }] },
    { n: 'Duas Coroas', mapType: 'lagos', W: 88, peace: 1080, foes: [['equilibrado', 0.6], ['construtor', 0.55]], allied: true, text: 'Dois reinos firmaram um pacto contra você. Um deles demora a se armar, mas quando vier, virá forte.',
      opt: [{ k: 'build', t: 'goldsmelter', n: 1 }, { k: 'army', n: 20 }, { k: 'fast', t: 55 * 60 }] },
    { n: 'Fronteira em Chamas', mapType: 'floresta', W: 92, peace: 960, foes: [['agressivo', 0.68], ['equilibrado', 0.68]], allied: true, text: 'Seus vizinhos querem suas terras antes que você cresça. Aguente a primeira onda e contra-ataque.',
      opt: [{ k: 'units', t: 'bowman', n: 8 }, { k: 'build', t: 'tower', n: 4 }, { k: 'fast', t: 55 * 60 }] },
    { n: 'O Pacto de Ferro', mapType: 'planalto', W: 96, peace: 960, foes: [['fortificado', 0.78], ['construtor', 0.72]], allied: true, text: 'Um reino de muralhas e outro de forjas. Separe-os e derrote um de cada vez.',
      opt: [{ k: 'units', t: 'swordsman', n: 6 }, { k: 'res', r: 'gold', n: 40 }, { k: 'fast', t: 60 * 60 }] },
    { n: 'Três Tronos', mapType: 'rio', W: 100, peace: 1020, foes: [['equilibrado', 0.62], ['agressivo', 0.6], ['construtor', 0.6]], allied: false, text: 'Três reinos, nenhuma aliança: todos lutam contra todos. Deixe que se enfraqueçam e ataque na hora certa.',
      opt: [{ k: 'build', t: 'stables', n: 1 }, { k: 'army', n: 30 }, { k: 'fast', t: 60 * 60 }] },
    { n: 'O Cerco de Pedra', mapType: 'planalto', W: 104, peace: 960, foes: [['fortificado', 0.75], ['equilibrado', 0.75], ['agressivo', 0.7]], allied: false, text: 'Uma fortaleza no centro e dois reinos famintos nas bordas. Todos contra todos, mas você é o alvo mais cobiçado.',
      opt: [{ k: 'units', t: 'crossbowman', n: 8 }, { k: 'build', t: 'armorsmithy', n: 1 }, { k: 'fast', t: 65 * 60 }] },
    { n: 'A Grande Aliança', mapType: 'cordilheiras', W: 108, peace: 900, foes: [['agressivo', 0.85], ['construtor', 0.85], ['equilibrado', 0.85]], allied: true, text: 'Os três reinos restantes se uniram contra você. Eles vão atacar juntos. Fortifique, abasteça e resista.',
      opt: [{ k: 'units', t: 'knight', n: 6 }, { k: 'build', t: 'tower', n: 6 }, { k: 'fast', t: 70 * 60 }] },
    { n: 'O Rei de Todos', mapType: 'lagos', W: 112, peace: 900, foes: [['construtor', 1.0], ['fortificado', 0.95], ['agressivo', 0.95]], allied: true, text: 'A última guerra. Os senhores mais poderosos do continente contra a sua coroa. Vença e todos os reinos serão um só.',
      opt: [{ k: 'army', n: 50 }, { k: 'units', t: 'knight', n: 10 }, { k: 'fast', t: 80 * 60 }] },
  ];
  // Condições e cidades iniciais diferentes fazem cada região pedir um plano próprio.
  const SCENARIOS = {
    1: { biome: 'pradaria', sites: [{ id: 'vau', n: 'Passagem do rio', x: 0.5, y: 0.5, garrison: 6 }],
      goals: [{ k: 'any', routes: [{ k: 'destroy' }, { k: 'hold', sites: ['vau'], t: 180 }] }],
      hint: 'Você pode vencer derrotando o rival ou mantendo a passagem por 3 minutos. Leve pelo menos 3 soldados; a contagem reinicia se o ponto ficar vazio ou contestado.' },
    2: { biome: 'outono', town: 'restore', goals: [{ k: 'any', routes: [{ k: 'destroy' }, { k: 'all', routes: [{ k: 'restore' }, { k: 'survive', t: 840 }] }] }],
      hint: 'As casas marcadas da vila começam danificadas. Construtores reparam com madeira e pedra; mantenha essas casas de pé até a vitória.' },
    3: { biome: 'pantano', sites: [{ id: 'oeste', n: 'Rota oeste', x: 0.4, y: 0.5, outpost: true, garrison: 4 }, { id: 'leste', n: 'Rota leste', x: 0.6, y: 0.5, outpost: true, garrison: 4, rival: 2 }],
      goals: [{ k: 'any', routes: [{ k: 'destroy' }, { k: 'hold', sites: ['oeste', 'leste'], t: 120 }] }],
      hint: 'Abra as duas rotas: em cada ponto, erga um Armazém a até 6 casas do marcador, conecte-o por estrada pronta ao Armazém inicial e mantenha 3 soldados por 2 minutos. Você também pode derrotar os dois rivais.' },
    4: { biome: 'outono', town: 'frontier', peace: 240, goals: [{ k: 'any', routes: [{ k: 'destroy' }, { k: 'survive', t: 960 }] }],
      hint: 'A fronteira já tem produção de pão e tropas, mas sofrerá ataques cedo. Vença resistindo por 16 minutos ou eliminando os rivais. Proteja o Armazém marcado; sua destruição encerra a missão.' },
    5: { biome: 'pantano', sites: [{ id: 'jazida', n: 'Jazida central', x: 0.5, y: 0.5, outpost: true, garrison: 8 }],
      goals: [{ k: 'any', routes: [{ k: 'destroy' }, { k: 'all', routes: [{ k: 'hold', sites: ['jazida'], t: 240 }, { k: 'build', t: 'goldsmelter', n: 1 }] }] }],
      hint: 'Escolha entre conquistar os rivais e sustentar a jazida central: conecte um Armazém ao ponto, mantenha 3 soldados por 4 minutos e construa sua Fundição de ouro.' },
    6: { biome: 'outono', hint: 'Os rivais também lutam entre si. Explore antes de comprometer o exército e aproveite a disputa para crescer.' },
    7: { biome: 'tundra', town: 'siege', hint: 'Você começa com tropas de cerco e uma vila de apoio. Colheitas mais lentas exigem reserva de comida, pesca ou criação de porcos antes de prolongar a guerra.' },
    8: { biome: 'tundra', town: 'frontier', peace: 360,
      goals: [{ k: 'all', routes: [{ k: 'survive', t: 1200 }, { k: 'army', n: 30 }, { k: 'res', r: 'bread', n: 40 }, { k: 'res', r: 'gold', n: 30 }] }],
      hint: 'Prepare a expedição real: sobreviva por 20 minutos e tenha, ao mesmo tempo, 30 soldados, 40 pães e 30 ouros. Proteja o Armazém marcado; perdê-lo encerra a missão. A aliança inimiga tentará interromper o abastecimento.' },
    9: { biome: 'tundra', hint: 'A última região reúne tudo que você aprendeu: produção, abastecimento, formações e escolha do momento de atacar.' },
  };
  function scenarioTown(profile) {
    const town = KM.TOWNS.human();
    if (!profile) return town;
    town.houses = profile === 'restore' ? ['storehouse', 'school', 'woodcutter', 'quarry', 'sawmill', 'inn'] : MED.concat(['weaponworkshop']);
    town.stock = S2({ wood: 55, stone: 65, gold: 45, bread: 45, sausages: 25, axe: 8 });
    if (profile === 'siege') { town.houses = FULL.concat(['ironmine', 'coalmine', 'ironsmithy', 'weaponsmithy', 'armorsmithy']); town.soldiers = [['swordsman', 8], ['crossbowman', 6], ['pikeman', 6]]; }
    return town;
  }
  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
  const DMOD = { easy: { m: 0.8, p: 1.3 }, normal: { m: 1, p: 1 }, hard: { m: 1.2, p: 0.8 } };
  function conquestMission(i, diff) {
    const L = LEVELS[i], D = DMOD[diff] || DMOD.normal, id = 'c' + (i + 1);
    const scenario = SCENARIOS[i] || { biome: 'pradaria' };
    const peace = scenario.peace || L.peace;
    const players = [{ human: true, team: 0, name: KM.NAMES[0], town: scenarioTown(scenario.town) }];
    L.foes.forEach(([pers, m], k) => {
      const riv = RIVALS[(i + k * 2) % RIVALS.length];
      const P = PERS[pers](m * D.m, Math.round(peace * D.p) + k * 60);
      const ai = Object.assign(KM.TOWNS.economy({ peace: P.peace, mult: P.mult, def: P.def }), { attackN: P.attackN, strat: { equilibrado: 'equilibrado', agressivo: 'saque', construtor: 'pinca', fortificado: 'cerco' }[pers] });
      if (P.towers) ai.houses = ai.houses.concat(['woodcutter', 'quarry', 'sawmill', 'inn', 'weaponworkshop', 'barracks', 'tower', 'tower']);
      players.push({ team: L.allied ? 9 : 10 + k, name: riv.name, title: riv.title, pers, ai });
    });
    const foes = players.slice(1);
    const biome = KM.BIOMES[scenario.biome];
    const brief = `${L.text}<br><br><b>${scenario.hint || 'Elimine o reino rival. Um reino cai quando perde o Armazém, a Escola e o Quartel e fica sem soldados.'}</b>`
      + `<br><br><b>${biome.n}</b> — ${biome.desc}`
      + '<br><br>Os rivais produzem seus recursos, respeitam os desbloqueios e precisam alimentar as tropas. As cidades e guarnições iniciais fazem parte do desafio desta região.'
      + `<br><br>${foes.map((p, k) => `<i class="shield" style="background:${KM.COLORS[k + 1]}"></i> <b>${p.name}</b>, governado por ${p.title} (${PERS_N[p.pers]})`).join('<br>')}`
      + (foes.length > 1 ? `<br><br>${L.allied ? 'Os rivais são <b>aliados entre si</b>.' : '<b>Todos contra todos:</b> os rivais também lutam entre si.'}` : '')
      + `<br><br>Primeiro ataque planejado a partir de ${Math.round(Math.min(...foes.map((p) => p.ai.peace)) / 60)} minutos. Defensores reagem a invasões antes disso.`;
    return {
      id, conquest: true, idx: i, n: `${ROMAN[i]} · ${L.n}`, seed: 70000 + i * 1013, W: L.W, mapType: L.mapType, brief, players,
      biome: scenario.biome, scenario: scenario.town || null, sites: scenario.sites || [],
      goals: (scenario.goals || [{ k: 'destroy' }]).concat(L.opt.map((g) => Object.assign({ opt: true }, g))),
    };
  }
  KM.CONQUEST_N = LEVELS.length;
  KM.conquestList = (diff) => LEVELS.map((L, i) => conquestMission(i, diff));
  // procura uma missão da campanha ou uma fase da Conquista
  KM.findMission = function (id, diff) {
    if (!id) return null;
    if (id === 't1') return KM.TUTORIAL_MISSION;
    if (id[0] === 'c') { const i = +id.slice(1) - 1; return LEVELS[i] ? conquestMission(i, diff || 'normal') : null; }
    return KM.MISSIONS.find((m) => m.id === id) || null;
  };
  KM.nextMission = function (id) {
    if (!id) return null;
    if (id[0] === 'c') { const i = +id.slice(1); return i < LEVELS.length ? 'c' + (i + 1) : null; }
    const k = KM.MISSIONS.findIndex((m) => m.id === id);
    return k >= 0 && KM.MISSIONS[k + 1] ? KM.MISSIONS[k + 1].id : null;
  };
  // progresso: fases abertas e coroas (1 pela vitória + 1 por desafio cumprido)
  KM.conquestProgress = function () {
    try { return Object.assign({ open: 1, crowns: {} }, JSON.parse(localStorage.getItem('rm_conquest') || '{}')); } catch (e) { return { open: 1, crowns: {} }; }
  };
  function conquestWin(S) {
    const P = KM.conquestProgress(), i = +S.mission.slice(1);
    const crowns = 1 + S.goals.filter((g) => g.opt && KM.goalStatus(S, g).done).length;
    S.unlockedBiomes = Object.keys(KM.BIOMES).filter((id) => KM.BIOMES[id].unlock > P.open && KM.BIOMES[id].unlock <= i + 1);
    P.open = Math.max(P.open, i + 1);
    P.crowns[S.mission] = Math.max(P.crowns[S.mission] || 0, crowns);
    S.crowns = crowns;
    try { localStorage.setItem('rm_conquest', JSON.stringify(P)); } catch (e) { /* ok */ }
  }

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
    if (g.k === 'any' || g.k === 'all') {
      const statuses = g.routes.map((r) => KM.goalStatus(S, r));
      return { done: g.k === 'any' ? statuses.some((s) => s.done) : statuses.every((s) => s.done),
        text: statuses.map((s) => s.text).join(g.k === 'any' ? ' OU ' : ' + '), prog: statuses.map((s) => s.prog || (s.done ? 'feito' : 'pendente')).join(' · ') };
    }
    if (g.k === 'learn') return { done: !!S.tutorialDone, text: 'Concluir o guia de economia e exército', prog: S.tutorialDone ? 'feito' : 'Siga o tutorial' };
    if (g.k === 'restore') {
      const ids = S.protected || [], houses = ids.map((id) => S.houses[id]);
      const restored = houses.filter((h) => h && h.state === 'built' && h.hp >= h.maxHp * 0.9).length;
      return { done: ids.length > 0 && restored === ids.length, text: 'Recuperar todas as casas marcadas a 90% de integridade', prog: `${restored}/${ids.length}` };
    }
    if (g.k === 'hold') {
      const sites = g.sites.map((id) => (S.sites || []).find((s) => s.id === id));
      return { done: sites.every((s) => s && (s.held[me] || 0) >= g.t), text: `Manter ${sites.map((s, i) => s ? s.n : g.sites[i]).join(' e ')} por ${g.t / 60} min`,
        prog: sites.map((s) => s ? `${s.n}: ${KM.fmtTime(Math.max(0, g.t - (s.held[me] || 0)))}` : 'ponto pendente').join(' · ') };
    }
    if (g.k === 'fast') {
      const left = Math.max(0, g.t - S.time);
      return { done: !!g.done, fail: !g.done && S.time > g.t, text: `Vencer em menos de ${Math.round(g.t / 60)} minutos`, prog: g.done ? 'feito' : S.time > g.t ? 'tempo esgotado' : KM.fmtTime(left) };
    }
    if (g.opt && g.done) { const st = KM.goalStatus(S, Object.assign({}, g, { opt: false, done: false })); return Object.assign(st, { done: true, prog: 'feito' }); }
    if (g.k === 'build') {
      let n = 0;
      for (const id in S.houses) { const h = S.houses[id]; if (h.owner === me && h.type === g.t && h.state === 'built') n++; }
      const d = KM.HOUSES[g.t];
      return { done: n >= g.n, text: `Construir ${g.n > 1 ? g.n + '× ' : ''}${d.n}`, prog: `${Math.min(n, g.n)}/${g.n}` };
    }
    if (g.k === 'res') {
      const n = storeTotal(S, g.r, me);
      return { done: n >= g.n, text: `Ter ${g.n} ${KM.RES[g.r].n} no Armazém`, prog: `${Math.min(n, g.n)}/${g.n}` };
    }
    if (g.k === 'army' || g.k === 'units') {
      let n = 0;
      for (const id in S.units) { const u = S.units[id]; if (u.owner === me && KM.isSoldier(u.type) && (!g.t || u.type === g.t)) n++; }
      const lbl = g.t ? `${g.n} ${KM.SOLDIERS[g.t].n}${g.n > 1 ? 's' : ''}` : `${g.n} soldados`;
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
    KM.updateSites(S);
    S.players.forEach((p, o) => {
      if (p.out || !defeated(S, o)) return;
      p.out = true;
      if (o !== KM.me) KM.notify(S, `${p.name} foi derrotado!`, KM.hostile(S, KM.me, o) ? 'ok' : 'danger');
    });
    if (S.over) return;
    // objetivos cumpridos uma vez ficam marcados (ex.: ter 8 cavaleiros); desafios opcionais também
    for (const g of S.goals) if ((g.opt || g.k === 'units' || g.k === 'army') && g.k !== 'fast' && !g.done && KM.goalStatus(S, g).done) {
      g.done = true;
      if (g.opt && KM.S === S) KM.notify(S, `Desafio cumprido: ${KM.goalStatus(S, g).text}`, 'unlock');
    }
    const req = S.goals.filter((g) => !g.opt);
    if (S.players[KM.me].out || (S.protected || []).some((id) => !S.houses[id])) {
      S.over = 'lose';
      if (!S.players[KM.me].out) S.defeatReason = 'Uma construção protegida da vila foi destruída.';
    }
    else if (req.length && req.every((g) => KM.goalStatus(S, g).done)) {
      S.over = 'win';
      for (const g of S.goals) if (g.k === 'fast' && S.time <= g.t) g.done = true;
      if (S.mission && S.mission[0] === 'c') { if (KM.S === S) conquestWin(S); }
      else if (S.mission && S.mission !== 't1') { const i = KM.MISSIONS.findIndex((m) => m.id === S.mission); unlock(i + 2); }
    }
    if (S.over && KM.ui && KM.S === S) KM.ui.showEnd(S.over);
  };
})(window.KM);
