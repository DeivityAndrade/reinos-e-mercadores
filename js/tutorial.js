'use strict';
/* Tutorial interativo (Missão I): passos guiados com destaque na interface e seta no mapa.
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
    { t: '👑 Bem-vindo, senhor!', b: 'Este tutorial mostra o básico do reino. Você pode fechá-lo a qualquer momento.<br><br>No <b>Knights and Merchants</b>, tudo depende da <b>logística</b>: casas produzem, carregadores levam os recursos pelas estradas e construtores erguem novas casas.', next: 'Vamos lá' },
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

  const T = KM.tutorial = {
    el: null, mark: null, lastI: -1, t: 0,
    start(S) { S.tut = { i: 0 }; this.lastI = -1; this.render(S); },
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
        if (e.target.closest('[data-tclose]')) this.stop(S);
      });
      const mk = this.mark = document.createElement('div');
      mk.id = 'tutmark'; mk.textContent = '⬇';
      document.body.appendChild(mk);
    },
    advance(S) {
      S.tut.i++;
      S.tut.moved = 0;
      if (S.tut.i >= STEPS.length) { this.stop(S); return; }
      KM.sfx && KM.sfx('click');
      this.render(S);
    },
    render(S) {
      this.ensure();
      const st = STEPS[S.tut.i];
      this.lastI = S.tut.i;
      this.el.innerHTML = `<div class="tut-head"><span>Tutorial · ${S.tut.i + 1}/${STEPS.length}</span><button data-tclose="1" title="Fechar o tutorial">✕</button></div>
        <h3>${st.t}</h3><div class="tut-body">${st.b}</div>
        <div class="tut-bar"><i style="width:${((S.tut.i) / (STEPS.length - 1)) * 100}%"></i></div>
        ${st.next ? `<button class="mbtn primary" data-tnext="1">${st.next}</button>` : '<div class="tut-wait">⏳ Aguardando você…</div>'}`;
      this.el.classList.remove('hidden');
    },
    // chamado a cada quadro pela interface
    update(S, dt) {
      const covered = !$('#brief').classList.contains('hidden') || !$('#endscreen').classList.contains('hidden');
      if (!S || !S.tut || S.editor || covered) { if (this.el && !this.el.classList.contains('hidden')) this.hide(); return; }
      if (this.lastI !== S.tut.i || this.el.classList.contains('hidden')) this.render(S);
      const st = STEPS[S.tut.i];
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
