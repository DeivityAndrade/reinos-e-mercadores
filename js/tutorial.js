'use strict';
/* Tutorial completo e guia da Missão I: destaque na interface e seta no mapa.
   O progresso fica em S.tut, então sobrevive a salvar/carregar. */
(function (KM) {
  const $ = (s) => document.querySelector(s);
  const mine = (S, type, built) => Object.values(S.houses).filter((h) => h.owner === KM.me && h.type === type && (!built || h.state === 'built'));
  const has = (S, type) => mine(S, type).length > 0;
  const linked = (S, type) => mine(S, type).some((h) => KM.roadLinked(S, h));
  const built = (S, type) => mine(S, type, true).length > 0;
  const store = (S) => mine(S, 'storehouse')[0];
  // ladrilho mais próximo do Armazém que satisfaz f (para a seta no mapa)
  function nearTile(S, f) {
    const st = store(S);
    if (!st) return null;
    const m = S.map;
    for (let r = 3; r < 22; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const x = st.ex + dx, y = st.ey + dy;
      if (KM.inb(x, y) && f(m, y * m.W + x)) return { x, y };
    }
    return null;
  }
  const houseAt = (S, type) => { const h = mine(S, type)[0]; return h ? { x: h.ex, y: h.ey } : null; };

  const STEPS = [
    { t: '👑 Bem-vindo, senhor!', b: 'Seu reino cresce com uma boa <b>logística</b>: casas produzem, carregadores levam os recursos pelas estradas e construtores erguem novas casas.<br><br>Você pode fechar o guia e continuar jogando a qualquer momento.', next: 'Vamos lá' },
    { t: '🎥 Câmera', b: 'Mova a câmera com <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> ou arrastando com o <b>botão direito</b>. Use a <b>roda do mouse</b> para aproximar. O <b>botão do meio</b> gira a vista.', done: (S, T) => T.moved > 6, next: 'Pular' },
    { t: '🪓 O Lenhador', b: 'Precisamos de madeira. Na aba <b>Construir</b>, clique no <b>Lenhador</b>.', hl: '[data-build="woodcutter"]', done: (S) => (KM.ui.tool && KM.ui.tool.build === 'woodcutter') || has(S, 'woodcutter') },
    { t: '🌲 Onde construir', b: 'Coloque o Lenhador <b>perto das árvores</b>, onde a marca ficar verde. A seta mostra uma floresta próxima.<br><small>Botão direito cancela.</small>', at: (S) => nearTile(S, (m, i) => m.tree[i] >= 3), done: (S) => has(S, 'woodcutter') },
    { t: '🛤️ Estradas', b: 'Casas <b>sem estrada</b> até o Armazém não recebem nada (veja o aviso vermelho sobre ela). Escolha <b>Estrada</b> (<kbd>R</kbd>) e <b>arraste</b> da porta do Lenhador até uma estrada existente.<br><small>Cada trecho custa 1 🪨 pedra.</small>', hl: '[data-tool="road"]', at: (S) => houseAt(S, 'woodcutter'), done: (S) => linked(S, 'woodcutter') },
    { t: '⛏️ A Pedreira', b: 'Agora a <b>Pedreira</b>: coloque-a perto das <b>rochas cinzentas</b> e ligue-a com estrada também.', hl: '[data-build="quarry"]', at: (S) => (has(S, 'quarry') ? houseAt(S, 'quarry') : nearTile(S, (m, i) => m.stone[i] > 0)), done: (S) => linked(S, 'quarry') },
    { t: '⏩ Deixe o povo trabalhar', b: 'Os <b>construtores</b> 🔨 nivelam o terreno e erguem a casa com o material que os <b>carregadores</b> 🧺 trazem. Acelere o tempo no topo da tela (<b>2×</b> ou <kbd>+</kbd>) e espere o Lenhador ficar pronto.', hl: '[data-speed="2"],[data-speed="3"]', done: (S) => built(S, 'woodcutter') },
    { t: '🔓 Nova construção liberada!', b: 'Cada casa nova <b>libera outras</b>. O Lenhador liberou a <b>Serraria</b>, que transforma troncos 🪵 em madeira 🪜. Construa a Serraria perto do Armazém e ligue-a com estrada.', hl: '[data-build="sawmill"]', done: (S) => linked(S, 'sawmill') },
    { t: '🔍 Painel da casa', b: 'Clique numa casa pronta (por exemplo, o <b>Lenhador</b>) para ver o trabalhador, o estoque e a produção. Um <b>❗</b> sobre a casa indica que falta trabalhador (treine na Escola).', at: (S) => houseAt(S, 'woodcutter'), done: (S) => { const h = S.houses[KM.ui.selHouse]; return !!(h && h.owner === KM.me && h.type !== 'storehouse'); }, next: 'Pular' },
    { t: '📜 Próximos passos', b: 'O quadro <b>Próximos passos</b> no topo da aba Construir sempre mostra o que construir para liberar mais coisas. A árvore completa fica na aba <b>Objetivos</b>.<br><br>Espere a Serraria ficar pronta.', hl: '.progress-card', done: (S) => built(S, 'sawmill') },
    { t: '🍺 A Taverna', b: 'A Serraria liberou a <b>Taverna</b> e a <b>Fazenda</b>. Cidadãos com fome trabalham pela metade, então construa a <b>Taverna</b> e ligue-a com estrada.', hl: '[data-build="inn"]', done: (S) => linked(S, 'inn') },
    { t: '🎯 Objetivos', b: 'Abra a aba <b>Objetivos</b> para ver o que falta para vencer a missão.', hl: '[data-tab="goals"]', done: () => KM.ui.tab === 'goals' },
    { t: '🏆 Tutorial concluído!', b: 'Agora é com você: complete os objetivos da missão. Dicas:<br>• <kbd>Espaço</kbd> volta ao Armazém.<br>• Um aviso <b>⚠ sem estrada</b> sobre uma casa quer dizer que ela está isolada.<br>• <kbd>F1</kbd> abre a ajuda completa.', next: 'Fechar' },
  ];

  const newSoldiers = (S) => Object.values(S.units).filter((u) => u.owner === KM.me && KM.isSoldier(u.type) && u.id >= (S.tut.startNid || 0));
  const FULL = STEPS.slice(0, 11).concat([
    { t: '🌾 Comece a produzir comida', b: 'Construa uma <b>Fazenda</b>, ligue sua porta à estrada e espere a obra terminar. O treino automático da Escola pode formar o agricultor que falta.', hl: '[data-build="farm"]', done: (S) => built(S, 'farm') && linked(S, 'farm') },
    { t: '🌱 Campos perto da Fazenda', b: 'Escolha <b>Campo de trigo</b> (<kbd>F</kbd>) e desenhe pelo menos <b>4 campos</b> num raio de 6 casas da Fazenda. Deixe a entrada livre. O agricultor semeia e colhe esses campos.', hl: '[data-tool="field"]', at: (S) => houseAt(S, 'farm'), done: (S) => mine(S, 'farm').some((h) => S.map.field.filter((f, i) => (f === 1 || f === 2) && S.map.fown[i] === KM.me && Math.hypot(i % S.map.W - h.ex, Math.floor(i / S.map.W) - h.ey) <= 6).length >= 4) },
    { t: '🌀 Trigo vira farinha', b: 'Construa o <b>Moinho</b> e ligue-o ao Armazém. Um padeiro transforma trigo em farinha. Cada etapa da cadeia precisa de estrada e de trabalhador.', hl: '[data-build="mill"]', done: (S) => built(S, 'mill') && linked(S, 'mill') },
    { t: '🍞 Farinha vira pão', b: 'Construa a <b>Padaria</b> e ligue-a com estrada. A farinha vem do Moinho; o pão abastece a Taverna e os soldados.', hl: '[data-build="bakery"]', done: (S) => built(S, 'bakery') && linked(S, 'bakery') },
    { t: '🔍 Acompanhe a cadeia', b: 'Espere a Padaria terminar seu primeiro lote. Se parar, confira o trabalhador, a estrada e os estoques de entrada e saída. A Escola precisa de ouro para treinar quem falta.', focus: 'bakery', at: (S) => houseAt(S, 'bakery'), done: (S) => mine(S, 'bakery').some((h) => (h.completed || 0) > 0) },
    { t: '🏹 Prepare a Oficina de armas', b: 'Construa a <b>Oficina de armas</b> e ligue-a por estrada. Ela precisa de um carpinteiro e só trabalha quando você faz <b>encomendas</b>.', hl: '[data-build="weaponworkshop"]', done: (S) => built(S, 'weaponworkshop') && linked(S, 'weaponworkshop') },
    { t: '📋 Encomende um machado', b: 'Abra a Oficina e clique no <b>+</b> da primeira receita (machado), ou em <b>∞</b> para produção contínua. Cada machado consome 2 madeiras.', focus: 'weaponworkshop', hl: '[data-act2="ord:0:1"],[data-act2="ord:0:inf"]', done: (S) => mine(S, 'weaponworkshop').some((h) => h.orders[0] > 0 || (h.cnt[0] || 0) > 0) },
    { t: '⚔️ Construa o Quartel', b: 'O <b>Quartel</b> recebe armas e equipa recrutas. Construa-o, ligue sua porta e deixe os carregadores trazerem os machados.', hl: '[data-build="barracks"]', done: (S) => built(S, 'barracks') && linked(S, 'barracks') },
    { t: '🪖 Treine um Recruta', b: 'Abra a <b>Escola</b> e escolha <b>Recruta</b> (1 ouro). Ele vai sozinho ao Quartel. Recrutas são encomendados por você; o treino automático atende os trabalhadores da economia.', focus: 'school', hl: '[data-act2="train:recruit"]', done: (S) => mine(S, 'school').some((h) => h.queue.includes('recruit')) || mine(S, 'barracks').some((h) => h.recruits > 0) || Object.values(S.units).some((u) => u.owner === KM.me && u.type === 'recruit' && !u.home) },
    { t: '🪓 Equipe seu primeiro Miliciano', b: 'Abra o <b>Quartel</b>. Quando houver 1 recruta e 1 machado no estoque, clique em <b>Miliciano</b>. Se faltar arma, confira a encomenda da Oficina.', focus: 'barracks', hl: '[data-act2="equip:militia"]', done: (S) => newSoldiers(S).length > 0 },
    { t: '🚩 Selecione seu grupo', b: 'Clique numa tropa ou pressione <kbd>Tab</kbd> para selecionar um grupo. O painel permite girar a formação, mudar as colunas e pedir comida.', done: () => KM.ui.selGroups.length > 0, next: 'Pular' },
    { t: '⚔️ Marche e proteja seus flancos', b: '<b>Botão direito</b> manda marchar. <kbd>A</kbd> e depois botão direito dá a ordem de ataque-mover. Com tropas selecionadas, use as <b>setas</b> para mover a câmera.<br><br>Golpes corpo a corpo pelo lado recebem <b>+15%</b>; pelas costas, <b>+30%</b>. Lanceiros causam dano dobrado à cavalaria. Montanhas e casas bloqueiam tiros.', done: (S) => newSoldiers(S).some((u) => u.order || u.path), next: 'Entendi' },
    { t: '🍖 Abasteça antes de atacar', b: 'Todos os exércitos de economia precisam comer, inclusive os rivais. Os carregadores levam comida do Armazém. Tropas com fome ficam lentas e podem morrer.<br><br>Selecione um grupo e clique em <b>Chamar carregadores com comida</b> (<kbd>H</kbd>). Eles só pedem comida quando precisam.', hl: '[data-act2="feed"]', next: 'Entendi' },
    STEPS[11],
    { t: '🏆 Seu reino está preparado!', b: 'Você aprendeu construção, estradas, comida, encomendas, recrutas e ordens militares. Na Conquista, leia os objetivos: algumas fases permitem vencer controlando uma passagem ou reconstruindo a vila.', next: 'Concluir tutorial' },
  ]);
  const steps = (S) => S.tut && S.tut.course === 'full' ? FULL : STEPS;

  const T = KM.tutorial = {
    el: null, mark: null, lastI: -1, t: 0,
    start(S, full) { S.tut = { i: 0, course: full ? 'full' : 'basic', startNid: S.nid }; this.lastI = -1; this.pf = null; this.t = 0; this.render(S); },
    stop(S) { if (S) S.tut = null; this.hide(); },
    hide() {
      if (this.el) this.el.classList.add('hidden');
      if (this.mark) this.mark.style.display = 'none';
      document.querySelectorAll('.tut-hl').forEach((e) => e.classList.remove('tut-hl'));
    },
    ensure() {
      if (this.el) return;
      const el = this.el = document.createElement('div');
      el.id = 'tutor'; el.className = 'hidden';
      document.body.appendChild(el);
      el.addEventListener('click', (e) => {
        const S = KM.S;
        if (!S || !S.tut) return;
        if (e.target.closest('[data-tnext]')) this.advance(S);
        const focus = e.target.closest('[data-tfocus]');
        if (focus) { const h = mine(S, focus.dataset.tfocus)[0]; if (h) { KM.ui.selectHouse(h.id); KM.R.centerOn(h.ex, h.ey); } }
        if (e.target.closest('[data-tclose]')) { try { localStorage.setItem(S.tut.course === 'full' ? 'rm_tut_full_dismissed' : 'rm_tut_done', '1'); } catch (err) { /* ok */ } this.stop(S); }
      });
      const mk = this.mark = document.createElement('div');
      mk.id = 'tutmark'; mk.textContent = '⬇';
      document.body.appendChild(mk);
    },
    advance(S) {
      S.tut.i++;
      S.tut.moved = 0;
      if (S.tut.i >= steps(S).length) {
        if (S.tut.course === 'full') S.tutorialDone = true;
        try { localStorage.setItem(S.tut.course === 'full' ? 'rm_tut_full_done' : 'rm_tut_done', '1'); } catch (e) { /* ok */ }
        this.stop(S); return;
      }
      KM.sfx && KM.sfx('click');
      this.render(S);
    },
    render(S) {
      this.ensure();
      const list = steps(S), st = list[S.tut.i];
      if (!st) { this.stop(S); return; }
      this.lastI = S.tut.i;
      this.el.innerHTML = `<div class="tut-head"><span>Tutorial · ${S.tut.i + 1}/${list.length}</span><button data-tclose="1" title="Fechar o tutorial">✕</button></div>
        <h3>${st.t}</h3><div class="tut-body">${st.b}</div>
        <div class="tut-bar"><i style="width:${((S.tut.i) / (list.length - 1)) * 100}%"></i></div>
        ${st.focus ? `<button class="mbtn" data-tfocus="${st.focus}">Abrir ${KM.HOUSES[st.focus].n}</button>` : ''}
        ${st.next ? `<button class="mbtn primary" data-tnext="1">${st.next}</button>` : '<div class="tut-wait">⏳ Aguardando você…</div>'}`;
      this.el.classList.remove('hidden');
    },
    // chamado a cada quadro pela interface
    update(S, dt) {
      const covered = !$('#brief').classList.contains('hidden') || !$('#endscreen').classList.contains('hidden');
      if (!S || !S.tut || S.editor || covered) { if (this.el && !this.el.classList.contains('hidden')) this.hide(); return; }
      if (this.lastI !== S.tut.i || this.el.classList.contains('hidden')) this.render(S);
      const st = steps(S)[S.tut.i];
      if (!st) { this.stop(S); return; }
      // quanto a câmera andou (passo da câmera)
      const f = KM.R.focus;
      if (this.pf) S.tut.moved = (S.tut.moved || 0) + Math.hypot(f.x - this.pf.x, f.y - this.pf.y) + Math.abs((KM.R.dist || 0) - (this.pd || 0)) * 0.5;
      this.pf = { x: f.x, y: f.y }; this.pd = KM.R.dist;
      this.t += dt;
      if (this.t > 0.3) {
        this.t = 0;
        document.querySelectorAll('.tut-hl').forEach((e) => { if (!st.hl || !e.matches(st.hl)) e.classList.remove('tut-hl'); });
        if (st.hl) document.querySelectorAll(st.hl).forEach((e) => e.classList.add('tut-hl'));
        if (st.done && st.done(S, S.tut)) { this.advance(S); return; }
        this.target = st.at ? st.at(S) : null;
      }
      const mk = this.mark;
      if (this.target && KM.R.ready) {
        const p = this.target;
        const q = KM.R.toScreen(p.x + 0.5, KM.R.groundY(p.x + 0.5, p.y + 0.5) + 1.6, p.y + 0.5);
        if (!q.behind) {
          mk.style.display = 'block';
          mk.style.left = KM.clamp(q.x, 250, innerWidth - 20) + 'px';
          mk.style.top = KM.clamp(q.y, 60, innerHeight - 60) + 'px';
        } else mk.style.display = 'none';
      } else mk.style.display = 'none';
    },
  };
})(window.KM);
