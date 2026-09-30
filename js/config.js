'use strict';
/* Reinos & Mercadores — dados do jogo (data-driven).
   Tudo que define economia, casas, profissões e soldados fica aqui. */
window.KM = window.KM || {};
(function (KM) {
  KM.VERSION = '0.4.0';
  KM.TILE = 32;
  KM.MAP_W = 80;
  KM.MAP_H = 80;
  KM.HS = 9;          // pixels por unidade de altura do relevo (2.5D)
  KM.MAXH = 9;        // altura máxima do terreno
  KM.DT = 0.05; // segundos por tick de simulação (20 ticks/s)
  KM.TURN = 4;  // ticks por turno de rede (lockstep)
  KM.me = 0;    // jogador local
  KM.NAMES = ['Você', 'Barão Vermelho', 'Duque Verde', 'Conde Dourado'];

  KM.T = { GRASS: 0, WATER: 1, MOUNTAIN: 2, SAND: 3 };
  KM.ORE = { NONE: 0, COAL: 1, IRON: 2, GOLD: 3 };
  KM.IN_CAP = 5;
  KM.OUT_CAP = 5;
  KM.PLAYER = 0;
  KM.ENEMY = 1;
  KM.COLORS = ['#3b82f6', '#dc2626', '#16a34a', '#eab308'];

  KM.RES = {
    trunk: { n: 'Tronco', i: '🪵' },
    stone: { n: 'Pedra', i: '🪨' },
    wood: { n: 'Madeira', i: '🪜' },
    coal: { n: 'Carvão', i: '⚫' },
    ironore: { n: 'Minério de ferro', i: '🟤' },
    goldore: { n: 'Minério de ouro', i: '🟡' },
    iron: { n: 'Ferro', i: '🔩' },
    gold: { n: 'Ouro', i: '🪙' },
    corn: { n: 'Trigo', i: '🌾' },
    flour: { n: 'Farinha', i: '🥣' },
    bread: { n: 'Pão', i: '🍞' },
    pig: { n: 'Porco', i: '🐖' },
    skin: { n: 'Pele', i: '🐾' },
    sausages: { n: 'Salsichas', i: '🌭' },
    leather: { n: 'Couro', i: '🧳' },
    wine: { n: 'Vinho', i: '🍷' },
    fish: { n: 'Peixe', i: '🐟' },
    horse: { n: 'Cavalo', i: '🐎' },
    axe: { n: 'Machado', i: '🪓' },
    sword: { n: 'Espada', i: '🗡️' },
    bow: { n: 'Arco', i: '🏹' },
    crossbow: { n: 'Besta', i: '🎯' },
    lance: { n: 'Lança', i: '🦯' },
    pike: { n: 'Pique', i: '🔱' },
    shield: { n: 'Escudo de madeira', i: '🛡️' },
    ironshield: { n: 'Escudo de ferro', i: '🔰' },
    armor: { n: 'Armadura de couro', i: '🦺' },
    ironarmor: { n: 'Cota de malha', i: '⛓️' },
  };
  KM.RES_ORDER = Object.keys(KM.RES);
  KM.FOOD = { sausages: 60, fish: 50, bread: 40, wine: 30 };
  KM.WEAPONS = ['axe', 'sword', 'bow', 'crossbow', 'lance', 'pike', 'shield', 'ironshield', 'armor', 'ironarmor', 'horse'];

  KM.PROF = {
    serf: { n: 'Carregador', c: '#b08850', i: '🧺', t: 8 },
    laborer: { n: 'Construtor', c: '#e0a030', i: '🔨', t: 10 },
    woodcutter: { n: 'Lenhador', c: '#4f8a34', i: '🪓', t: 12 },
    stonemason: { n: 'Pedreiro', c: '#9a9a9a', i: '⛏️', t: 12 },
    farmer: { n: 'Agricultor', c: '#d0b440', i: '🌾', t: 12 },
    carpenter: { n: 'Carpinteiro', c: '#a0602a', i: '🪚', t: 12 },
    miner: { n: 'Mineiro', c: '#50506a', i: '⛏️', t: 12 },
    breeder: { n: 'Criador', c: '#c07a66', i: '🐖', t: 12 },
    fisher: { n: 'Pescador', c: '#3a80b0', i: '🎣', t: 12 },
    metallurgist: { n: 'Metalúrgico', c: '#c05020', i: '🔥', t: 14 },
    smith: { n: 'Ferreiro', c: '#3a3a3a', i: '⚒️', t: 14 },
    baker: { n: 'Padeiro', c: '#efe2c4', i: '🥖', t: 12 },
    butcher: { n: 'Açougueiro', c: '#b83232', i: '🔪', t: 12 },
    recruit: { n: 'Recruta', c: '#6f7a4a', i: '🪖', t: 10 },
  };
  KM.PROF_ORDER = Object.keys(KM.PROF);

  KM.SOLDIERS = {
    militia: { n: 'Miliciano', i: '🪓', hp: 60, atk: 12, def: 1, spd: 1.7, cost: { axe: 1 } },
    axeman: { n: 'Guerreiro de machado', i: '🪓', hp: 90, atk: 14, def: 4, spd: 1.6, cost: { axe: 1, shield: 1, armor: 1 } },
    swordsman: { n: 'Espadachim', i: '🗡️', hp: 130, atk: 19, def: 8, spd: 1.5, iron: true, cost: { sword: 1, ironshield: 1, ironarmor: 1 } },
    bowman: { n: 'Arqueiro', i: '🏹', hp: 60, atk: 11, def: 2, spd: 1.6, range: 6, cost: { bow: 1, armor: 1 } },
    crossbowman: { n: 'Besteiro', i: '🎯', hp: 75, atk: 16, def: 4, spd: 1.5, range: 7, iron: true, cost: { crossbow: 1, ironarmor: 1 } },
    lancer: { n: 'Lanceiro', i: '🦯', hp: 80, atk: 12, def: 3, spd: 1.6, antiCav: 2, cost: { lance: 1, armor: 1 } },
    pikeman: { n: 'Piqueiro', i: '🔱', hp: 105, atk: 16, def: 6, spd: 1.5, antiCav: 2, iron: true, cost: { pike: 1, ironarmor: 1 } },
    scout: { n: 'Batedor', i: '🐎', hp: 80, atk: 12, def: 3, spd: 3.0, cav: true, cost: { axe: 1, armor: 1, horse: 1 } },
    knight: { n: 'Cavaleiro', i: '🐎', hp: 150, atk: 21, def: 9, spd: 2.6, cav: true, iron: true, cost: { sword: 1, ironshield: 1, ironarmor: 1, horse: 1 } },
  };
  KM.SOLDIER_ORDER = Object.keys(KM.SOLDIERS);

  // g = grupo no menu de construção
  KM.HOUSES = {
    storehouse: { n: 'Armazém', i: '📦', g: 'Básico', w: 3, h: 2, cost: { wood: 4, stone: 4 }, hp: 700, roof: '#7c4a2a', wall: '#caa878', accepts: 'all', desc: 'Guarda todos os recursos. O coração da sua economia.' },
    school: { n: 'Escola', i: '🎓', g: 'Básico', w: 2, h: 2, cost: { wood: 5, stone: 4 }, hp: 500, roof: '#3e5c8a', wall: '#d8cdb4', accepts: ['gold'], desc: 'Treina novos cidadãos. Cada um custa 1 ouro.' },
    inn: { n: 'Taverna', i: '🍺', g: 'Básico', w: 2, h: 2, cost: { wood: 4, stone: 4 }, hp: 450, roof: '#8a3a2a', wall: '#d2b48c', accepts: ['bread', 'sausages', 'wine', 'fish'], desc: 'Cidadãos com fome vêm aqui comer. Sem comida, trabalham devagar.' },
    woodcutter: { n: 'Lenhador', i: '🪓', g: 'Básico', w: 2, h: 2, cost: { wood: 3, stone: 2 }, hp: 300, worker: 'woodcutter', gather: 'tree', out: 'trunk', radius: 8, roof: '#5f4527', wall: '#b08a5a', desc: 'Corta árvores maduras e planta mudas ao redor.' },
    quarry: { n: 'Pedreira', i: '⛏️', g: 'Básico', w: 2, h: 2, cost: { wood: 3, stone: 1 }, hp: 300, worker: 'stonemason', gather: 'stone', out: 'stone', radius: 10, roof: '#6b6b6b', wall: '#bdb3a0', desc: 'Extrai pedra das rochas próximas.' },
    sawmill: { n: 'Serraria', i: '🪚', g: 'Básico', w: 2, h: 2, cost: { wood: 3, stone: 3 }, hp: 350, worker: 'carpenter', recipes: [{ in: { trunk: 1 }, out: { wood: 2 }, t: 9 }], roof: '#8b5a2b', wall: '#c9a66b', desc: 'Transforma troncos em madeira.' },

    farm: { n: 'Fazenda', i: '🌾', g: 'Alimentos', w: 3, h: 2, cost: { wood: 4, stone: 3 }, hp: 350, worker: 'farmer', gather: 'corn', out: 'corn', radius: 6, roof: '#b8913e', wall: '#d9c79a', desc: 'Semeia e colhe trigo nos campos ao redor. Desenhe campos de trigo perto dela!' },
    vineyard: { n: 'Vinícola', i: '🍇', g: 'Alimentos', w: 2, h: 2, cost: { wood: 3, stone: 2 }, hp: 300, worker: 'farmer', gather: 'wine', out: 'wine', radius: 6, roof: '#6b2a4a', wall: '#d9c79a', desc: 'Colhe uvas dos vinhedos ao redor e produz vinho.' },
    fisher: { n: 'Pescador', i: '🎣', g: 'Alimentos', w: 2, h: 2, cost: { wood: 3, stone: 1 }, hp: 300, worker: 'fisher', gather: 'fish', out: 'fish', radius: 10, roof: '#2f5f7f', wall: '#c9b99a', desc: 'Pesca em lagos e rios próximos.' },
    mill: { n: 'Moinho', i: '🌀', g: 'Alimentos', w: 2, h: 2, cost: { wood: 3, stone: 3 }, hp: 350, worker: 'baker', recipes: [{ in: { corn: 1 }, out: { flour: 1 }, t: 7 }], roof: '#9a7b4f', wall: '#e6dcc2', desc: 'Mói trigo em farinha.' },
    bakery: { n: 'Padaria', i: '🍞', g: 'Alimentos', w: 2, h: 2, cost: { wood: 3, stone: 3 }, hp: 350, worker: 'baker', recipes: [{ in: { flour: 1 }, out: { bread: 2 }, t: 10 }], roof: '#a0522d', wall: '#e6d2a8', desc: 'Assa pão com farinha.' },
    swine: { n: 'Criação de porcos', i: '🐖', g: 'Alimentos', w: 3, h: 2, cost: { wood: 4, stone: 3 }, hp: 350, worker: 'breeder', recipes: [{ in: { corn: 2 }, out: { pig: 1, skin: 1 }, t: 16 }], roof: '#8a6a4a', wall: '#d8c09a', desc: 'Cria porcos com trigo. Gera porcos e peles.' },
    butcher: { n: 'Açougue', i: '🔪', g: 'Alimentos', w: 2, h: 2, cost: { wood: 3, stone: 3 }, hp: 350, worker: 'butcher', recipes: [{ in: { pig: 1 }, out: { sausages: 3 }, t: 10 }], roof: '#8b2e2e', wall: '#e0cfb0', desc: 'Transforma porcos em salsichas.' },

    tannery: { n: 'Curtume', i: '🧳', g: 'Indústria', w: 2, h: 2, cost: { wood: 3, stone: 3 }, hp: 350, worker: 'butcher', recipes: [{ in: { skin: 1 }, out: { leather: 2 }, t: 10 }], roof: '#6e4b2a', wall: '#cdb58f', desc: 'Curte peles para fazer couro.' },
    coalmine: { n: 'Mina de carvão', i: '⚫', g: 'Indústria', w: 2, h: 2, cost: { wood: 5 }, hp: 300, worker: 'miner', mine: 1, recipes: [{ in: {}, out: { coal: 1 }, t: 12 }], roof: '#3a3a3a', wall: '#7a6f64', desc: 'Construa ao lado de montanhas com carvão (pontos pretos).' },
    ironmine: { n: 'Mina de ferro', i: '🟤', g: 'Indústria', w: 2, h: 2, cost: { wood: 5 }, hp: 300, worker: 'miner', mine: 2, recipes: [{ in: {}, out: { ironore: 1 }, t: 14 }], roof: '#5a3a2a', wall: '#7a6f64', desc: 'Construa ao lado de montanhas com ferro (pontos avermelhados).' },
    goldmine: { n: 'Mina de ouro', i: '🟡', g: 'Indústria', w: 2, h: 2, cost: { wood: 5 }, hp: 300, worker: 'miner', mine: 3, recipes: [{ in: {}, out: { goldore: 1 }, t: 16 }], roof: '#7a6420', wall: '#7a6f64', desc: 'Construa ao lado de montanhas com ouro (pontos dourados).' },
    ironsmithy: { n: 'Fundição de ferro', i: '🔩', g: 'Indústria', w: 2, h: 2, cost: { wood: 3, stone: 4 }, hp: 400, worker: 'metallurgist', recipes: [{ in: { ironore: 1, coal: 1 }, out: { iron: 1 }, t: 11 }], roof: '#4b4b55', wall: '#b9ab93', desc: 'Funde minério de ferro com carvão.' },
    goldsmelter: { n: 'Fundição de ouro', i: '🪙', g: 'Indústria', w: 2, h: 2, cost: { wood: 3, stone: 4 }, hp: 400, worker: 'metallurgist', recipes: [{ in: { goldore: 1, coal: 1 }, out: { gold: 2 }, t: 11 }], roof: '#8a6d1f', wall: '#b9ab93', desc: 'Funde minério de ouro com carvão. Ouro paga a Escola.' },

    weaponworkshop: { n: 'Oficina de armas', i: '🏹', g: 'Militar', w: 2, h: 2, cost: { wood: 3, stone: 3 }, hp: 400, worker: 'carpenter', recipes: [{ in: { wood: 2 }, out: { axe: 1 }, t: 14 }, { in: { wood: 2 }, out: { bow: 1 }, t: 14 }, { in: { wood: 2 }, out: { lance: 1 }, t: 14 }], roof: '#6b4423', wall: '#c9a66b', desc: 'Faz machados, arcos e lanças de madeira.' },
    armorworkshop: { n: 'Oficina de armaduras', i: '🛡️', g: 'Militar', w: 2, h: 2, cost: { wood: 3, stone: 3 }, hp: 400, worker: 'carpenter', recipes: [{ in: { wood: 1 }, out: { shield: 1 }, t: 12 }, { in: { leather: 1 }, out: { armor: 1 }, t: 12 }], roof: '#6b4423', wall: '#c9a66b', desc: 'Faz escudos de madeira e armaduras de couro.' },
    weaponsmithy: { n: 'Ferraria de armas', i: '🗡️', g: 'Militar', w: 2, h: 2, cost: { wood: 3, stone: 4 }, hp: 450, worker: 'smith', recipes: [{ in: { iron: 1, coal: 1 }, out: { sword: 1 }, t: 16 }, { in: { iron: 1, coal: 1 }, out: { crossbow: 1 }, t: 16 }, { in: { iron: 1, coal: 1 }, out: { pike: 1 }, t: 16 }], roof: '#3f3f46', wall: '#a8a29e', desc: 'Forja espadas, bestas e piques.' },
    armorsmithy: { n: 'Ferraria de armaduras', i: '⛓️', g: 'Militar', w: 2, h: 2, cost: { wood: 3, stone: 4 }, hp: 450, worker: 'smith', recipes: [{ in: { iron: 1, coal: 1 }, out: { ironshield: 1 }, t: 16 }, { in: { iron: 1, coal: 1 }, out: { ironarmor: 1 }, t: 16 }], roof: '#3f3f46', wall: '#a8a29e', desc: 'Forja escudos de ferro e cotas de malha.' },
    stables: { n: 'Estábulo', i: '🐎', g: 'Militar', w: 3, h: 2, cost: { wood: 4, stone: 3 }, hp: 400, worker: 'breeder', recipes: [{ in: { corn: 2 }, out: { horse: 1 }, t: 22 }], roof: '#7a5230', wall: '#d2b48c', desc: 'Cria cavalos para batedores e cavaleiros.' },
    barracks: { n: 'Quartel', i: '⚔️', g: 'Militar', w: 3, h: 2, cost: { wood: 6, stone: 6 }, hp: 800, accepts: KM.WEAPONS, cap: 30, roof: '#4a4a52', wall: '#b0a590', desc: 'Guarda armas e equipa recrutas (treinados na Escola) como soldados.' },
    tower: { n: 'Torre de vigia', i: '🗼', g: 'Militar', w: 2, h: 2, cost: { wood: 2, stone: 6 }, hp: 600, worker: 'recruit', accepts: ['stone'], roof: '#555', wall: '#a09888', desc: 'Um recruta lá dentro atira pedras em inimigos próximos. Consome pedra.' },
  };

  // Distribuição (como no menu original): quanto de cada recurso cada tipo de casa pode pedir (0-5)
  KM.DIST = {
    coal: ['ironsmithy', 'goldsmelter', 'weaponsmithy', 'armorsmithy'],
    iron: ['weaponsmithy', 'armorsmithy'],
    corn: ['mill', 'swine', 'stables'],
    wood: ['weaponworkshop', 'armorworkshop'],
  };
  KM.defaultDist = function () {
    const d = {};
    for (const r in KM.DIST) { d[r] = {}; for (const t of KM.DIST[r]) d[r][t] = 5; }
    return d;
  };
  KM.INF = 999; // encomenda contínua

  // ---------- Progressão (árvore de construções, como no original) ----------
  // Cada casa só pode ser construída depois que TODAS as casas listadas já foram erguidas ao menos uma vez.
  // Casas sem entrada estão disponíveis desde o início.
  KM.TECH = {
    sawmill: ['woodcutter'],
    inn: ['sawmill'],
    farm: ['sawmill'],
    fisher: ['inn'],
    vineyard: ['inn'],
    mill: ['farm'],
    bakery: ['mill'],
    swine: ['farm'],
    butcher: ['swine'],
    tannery: ['swine'],
    coalmine: ['quarry', 'sawmill'],
    ironmine: ['coalmine'],
    goldmine: ['coalmine'],
    ironsmithy: ['ironmine'],
    goldsmelter: ['goldmine'],
    weaponworkshop: ['inn'],
    armorworkshop: ['tannery'],
    barracks: ['weaponworkshop'],
    tower: ['barracks'],
    weaponsmithy: ['ironsmithy', 'barracks'],
    armorsmithy: ['ironsmithy', 'barracks'],
    stables: ['farm', 'barracks'],
  };
  // Soldiers exigem uma construção já erguida (além das armas no quartel)
  KM.SOLDIER_REQ = {
    militia: ['barracks'], axeman: ['barracks', 'armorworkshop'], bowman: ['barracks'], lancer: ['barracks'],
    swordsman: ['weaponsmithy', 'armorsmithy'], crossbowman: ['weaponsmithy'], pikeman: ['weaponsmithy'],
    scout: ['stables'], knight: ['stables', 'weaponsmithy', 'armorsmithy'],
  };
  KM.HOUSE_GROUPS = ['Básico', 'Alimentos', 'Indústria', 'Militar'];

  KM.DIFF = {
    easy: { n: 'Fácil', peace: 900, interval: 240, mult: 0.7, def: 6 },
    normal: { n: 'Normal', peace: 600, interval: 190, mult: 1, def: 8 },
    hard: { n: 'Difícil', peace: 360, interval: 150, mult: 1.4, def: 11 },
  };
})(window.KM);
