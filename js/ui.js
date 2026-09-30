'use strict';
/* Interface: barra lateral, painéis, notificações, minimapa, menus */
(function (KM) {
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  KM.esc = esc;
  const ri = (r) => KM.RES[r].i;
  const costStr = (c) => Object.keys(c).map((r) => `${ri(r)}${c[r]}`).join(' ');
  const ME = () => KM.me;

  const ui = KM.ui = {
    tool: null, hover: null, drag: null, box: null, selHouse: 0, selUnits: [], selGroups: [], selSet: new Set(),
    tab: 'build', miniDirty: true, lastPanel: '', lastTab: '', t: 0,

    init() {
      this.buildTabs();
      $('#tabs').addEventListener('click', (e) => { const b = e.target.closest('button[data-tab]'); if (b) this.setTab(b.dataset.tab); });
      $('#tabcontent').addEventListener('click', (e) => this.onTabClick(e));
      // sliders de volume: aplica ao arrastar e não redesenha a aba no meio do gesto
      $('#tabcontent').addEventListener('input', (e) => { const k = e.target.dataset && e.target.dataset.vol; if (k) { this.sliding = true; KM.setAudio(k, e.target.value / 100); } });
      $('#tabcontent').addEventListener('change', (e) => { if (e.target.dataset && e.target.dataset.vol) { this.sliding = false; if (e.target.dataset.vol !== 'music') KM.sfx('click'); } });
      try { KM.edgeScroll = localStorage.getItem('rm_edge') !== '0'; } catch (e) { /* ok */ }
      $('#selpanel').addEventListener('click', (e) => this.onPanelClick(e));
      $('#topbar').addEventListener('click', (e) => {
        const b = e.target.closest('[data-speed]'); if (b) this.setSpeed(+b.dataset.speed);
        if (e.target.closest('[data-goals]')) this.setTab('goals');
      });
      for (const el of ['#tabcontent', '#selpanel', '#topbar']) {
        $(el).addEventListener('mousemove', (e) => this.onTip(e));
        $(el).addEventListener('mouseleave', () => this.hideTip());
      }
      const mm = $('#minimap');
      const mmNav = (e) => {
        if (!KM.S) return;
        const r = mm.getBoundingClientRect();
        KM.R.centerOn(((e.clientX - r.left) / r.width) * KM.MAP_W, ((e.clientY - r.top) / r.height) * KM.MAP_H);
      };
      mm.addEventListener('mousedown', (e) => { mmNav(e); this.mmDrag = true; });
      window.addEventListener('mousemove', (e) => { if (this.mmDrag) mmNav(e); });
      window.addEventListener('mouseup', () => { this.mmDrag = false; });
      this.initMenu();
    },

    // ---------- abas ----------
    buildTabs() {
      const tabs = [['build', '🏗️', 'Construir'], ['stock', '📦', 'Estoque'], ['people', '👥', 'Povo'], ['goals', '🎯', 'Objetivos'], ['menu', '⚙️', 'Menu']];
      $('#tabs').innerHTML = tabs.map(([k, i, n]) => `<button data-tab="${k}" class="${k === this.tab ? 'active' : ''}" title="${n}"><span>${i}</span><small>${n}</small></button>`).join('');
    },
    setTab(t) {
      this.tab = t; this.lastTab = '';
      document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === t));
      this.renderTab(true);
    },
    renderTab(force) {
      const S = KM.S;
      if (!S) return;
      if (S.editor) { KM.editor.renderPanel(force); return; }
      const P = S.players[ME()];
      let html = '';
      if (this.tab === 'build') {
        const sig = JSON.stringify(P.built || {}) + (P.all ? 'A' : '');
        if (!force && this.lastTab === 'build' && sig === this.buildSig) { this.markTool(); return; }
        this.buildSig = sig;
        // próximo passo da progressão
        const next = KM.nextUnlocks(S, ME());
        if (!P.all) {
          const shown = next.slice(0, 3);
          if (shown.length) {
            html += `<div class="progress-card"><div class="pc-title">📜 Próximos passos</div>${shown.map((n) => `<div class="pc-row"><span>${KM.HOUSES[n.t].i}</span><div>Construa <b>${KM.HOUSES[n.t].n}</b><small>libera ${n.gives.map((g) => KM.HOUSES[g].i + ' ' + KM.HOUSES[g].n).join(', ')}</small></div></div>`).join('')}<button class="pc-more" data-act="tree">Ver árvore completa ›</button></div>`;
          } else {
            const locked = Object.keys(KM.HOUSES).filter((t) => !KM.houseUnlocked(S, ME(), t)).length;
            if (!locked) html += `<div class="progress-card done"><div class="pc-title">🏰 Reino completo</div><small>Todas as construções estão liberadas.</small></div>`;
          }
        }
        const tools = [['road', '🛤️', 'Estrada', 'R', 'Clique e arraste. Carregadores só entregam por estradas! Cada trecho custa 1 🪨.'], ['field', '🌾', 'Campo de trigo', 'F', 'Arraste para desenhar vários. Perto de uma Fazenda.'], ['vine', '🍇', 'Vinhedo', 'V', 'Arraste para desenhar vários. Perto de uma Vinícola.'], ['demolish', '❌', 'Demolir', 'X', 'Remove casas, estradas ou campos.']];
        html += `<div class="tools">${tools.map(([k, i, n, key, tip]) => `<button class="tool" data-tool="${k}" data-tip="${n} <kbd>${key}</kbd><br><small>${tip}</small>"><span>${i}</span><small>${n}</small></button>`).join('')}</div>`;
        for (const grp of KM.HOUSE_GROUPS) {
          html += `<h4>${grp}</h4><div class="grid">`;
          for (const k in KM.HOUSES) {
            const d = KM.HOUSES[k];
            if (d.g !== grp) continue;
            const open = KM.houseUnlocked(S, ME(), k);
            const isNew = open && KM.TECH[k] && !(P.built || {})[k] && !P.all;
            if (open) html += `<button class="bbtn ${isNew ? 'new' : ''}" data-build="${k}" data-tip="${esc(this.houseTip(k))}"><span class="ic">${d.i}</span><span class="nm">${d.n}</span><span class="cost">${costStr(d.cost)}</span>${isNew ? '<i class="badge-new">novo</i>' : ''}</button>`;
            else html += `<button class="bbtn locked" data-locked="${k}" data-tip="${esc(`<b>🔒 ${d.n}</b><br>Para liberar, construa: ${KM.reqNames(KM.TECH[k])}<br><small>${d.desc || ''}</small>`)}"><span class="ic">${d.i}</span><span class="nm">${d.n}</span><span class="cost">🔒 bloqueado</span></button>`;
          }
          html += '</div>';
        }
        $('#tabcontent').innerHTML = html;
        this.lastTab = 'build';
        this.markTool();
        return;
      }
      if (this.tab === 'stock') {
        const tot = {};
        for (const id in S.houses) { const h = S.houses[id]; if (h.owner === ME() && h.type === 'storehouse' && h.state === 'built') for (const r in h.inv) KM.add(tot, r, h.inv[r]); }
        html = `<h4>Estoque dos armazéns</h4><div class="stock">${KM.RES_ORDER.map((r) => `<div class="srow ${tot[r] ? '' : 'zero'}" data-tip="${KM.RES[r].n}"><span>${ri(r)}</span><span class="sn">${KM.RES[r].n}</span><b>${tot[r] || 0}</b></div>`).join('')}</div>`;
        const dist = P.dist;
        html += `<h4 data-tip="Quanto de cada recurso cada tipo de casa pode pedir (0 a 5). Use para decidir, por exemplo, se o carvão vai para armas ou para ouro.">Distribuição ⓘ</h4>`;
        for (const r in dist) {
          html += `<div class="dist"><div class="dh">${ri(r)} ${KM.RES[r].n}</div>`;
          for (const t in dist[r]) html += `<div class="ratio"><span>${KM.HOUSES[t].i} ${KM.HOUSES[t].n}</span><button data-act="dist:${r}:${t}:-1">−</button><b>${dist[r][t]}</b><button data-act="dist:${r}:${t}:1">+</button></div>`;
          html += '</div>';
        }
      } else if (this.tab === 'people') {
        const c = {}, idle = {}, sold = {};
        let hunger = 0, nc = 0, starving = 0, sh = 0, ns = 0;
        for (const id in S.units) {
          const u = S.units[id];
          if (u.owner !== ME()) continue;
          if (KM.isSoldier(u.type)) { KM.add(sold, u.type, 1); sh += u.hunger; ns++; continue; }
          KM.add(c, u.type, 1); nc++; hunger += u.hunger; if (u.hunger <= 0) starving++;
          const free = u.type === 'serf' || u.type === 'laborer' ? !u.task : !u.home;
          if (free) KM.add(idle, u.type, 1);
        }
        let rec = 0; for (const id in S.houses) { const h = S.houses[id]; if (h.owner === ME() && h.type === 'barracks') rec += h.recruits; }
        const st = S.stats[ME()];
        html = `<h4>Cidadãos (${nc})</h4>
          <div class="meter" data-tip="Fome média. Construa uma Taverna e mantenha comida nela."><span>🍗 Alimentação</span><div class="mbar"><i style="width:${nc ? hunger / nc : 0}%"></i></div></div>
          ${starving ? `<div class="warn">⚠️ ${starving} cidadão(s) passando fome: trabalham na metade da velocidade!</div>` : ''}
          <div class="plist">${KM.PROF_ORDER.filter((p) => c[p]).map((p) => `<div class="prow"><span>${KM.PROF[p].i}</span><span class="sn">${KM.PROF[p].n}</span><b>${c[p]}</b><em>${idle[p] ? idle[p] + ' livre' + (idle[p] > 1 ? 's' : '') : ''}</em></div>`).join('')}</div>
          <label class="chk" data-tip="A Escola treina automaticamente os trabalhadores que suas casas precisam e mantém carregadores suficientes."><input type="checkbox" data-act="auto" ${P.autoTrain ? 'checked' : ''}> Treino automático na Escola</label>
          <h4>Exército (${ns})</h4>
          ${ns ? `<div class="meter" data-tip="Soldados com fome recebem comida dos carregadores. Com fome zero, eles perdem vida."><span>🍖 Tropas</span><div class="mbar"><i style="width:${sh / ns}%"></i></div></div>` : ''}
          <div class="plist">${KM.SOLDIER_ORDER.filter((t) => sold[t]).map((t) => `<div class="prow"><span>${KM.SOLDIERS[t].i}</span><span class="sn">${KM.SOLDIERS[t].n}</span><b>${sold[t]}</b></div>`).join('') || '<div class="muted">Nenhum soldado.</div>'}</div>
          ${rec ? `<div class="muted">🪖 ${rec} recruta(s) aguardando no quartel</div>` : ''}
          <h4>Estatísticas</h4>
          <div class="muted">Casas construídas: ${st.built} · Treinados: ${st.trained}<br>Inimigos abatidos: ${st.killed} · Perdas: ${st.lost}</div>`;
      } else if (this.tab === 'goals') {
        const mis = S.mission && KM.MISSIONS.find((m) => m.id === S.mission);
        html = `<h4>${mis ? esc(mis.n) : S.mp ? 'Multijogador' : 'Escaramuça'}</h4><div class="goals">${S.goals.map((g) => { const st = KM.goalStatus(S, g); return `<div class="goal ${st.done ? 'done' : ''}"><span>${st.done ? '✅' : '⬜'}</span><div>${st.text}<small>${st.prog || ''}</small></div></div>`; }).join('')}</div>`;
        if (mis) html += `<button class="mbtn wide" data-act="brief">📜 Rever briefing</button>`;
        if (!P.all) {
          const total = Object.keys(KM.HOUSES).length, open = Object.keys(KM.HOUSES).filter((t) => KM.houseUnlocked(S, ME(), t)).length;
          html += `<h4>Progresso do reino</h4><div class="meter"><span>🏗️ ${open}/${total} construções</span><div class="mbar"><i style="width:${(open / total) * 100}%"></i></div></div><button class="mbtn wide" data-act="tree">🌳 Árvore de progresso</button>`;
        }
        html += `<button class="mbtn wide" data-act="stats">📊 Estatísticas da partida</button>`;
        html += `<h4>Jogadores</h4><div class="plist">${S.players.map((p, i) => `<div class="prow"><span class="dot" style="background:${p.color}"></span><span class="sn">${esc(p.name)}${i === ME() ? ' (você)' : ''}</span><em class="${p.out ? 'bad' : KM.hostile(S, ME(), i) ? 'bad' : 'good'}">${p.out ? 'derrotado' : i === ME() ? '' : KM.hostile(S, ME(), i) ? 'inimigo' : 'aliado'}</em></div>`).join('')}</div>`;
        const ais = S.players.filter((p, i) => p.ai && p.ai.mode !== 'none' && KM.hostile(S, ME(), i) && !p.out);
        const peace = Math.min(...ais.map((p) => p.ai.next - S.time).filter((x) => x > 0), Infinity);
        if (isFinite(peace)) html += `<div class="muted">Próxima ameaça conhecida em <b>${KM.fmtTime(peace)}</b></div>`;
      } else if (this.tab === 'menu') {
        html = `<h4>Jogo</h4>
          <div class="mgrid">
            <button class="mbtn" data-act="pause">${S.paused ? '▶️ Continuar' : '⏸️ Pausar'} <kbd>P</kbd></button>
            <button class="mbtn" data-act="grid">${KM.R.showGrid ? '▦ Ocultar grade' : '▦ Mostrar grade'} <kbd>G</kbd></button>
            <button class="mbtn" data-act="help">❓ Como jogar <kbd>F1</kbd></button>
          </div>
          <h4>Opções</h4>
          <div class="opts">
            <label><span>🔊 Volume geral</span><input type="range" min="0" max="100" data-vol="master" value="${Math.round(KM.audioCfg.master * 100)}"></label>
            <label><span>🎵 Música</span><input type="range" min="0" max="100" data-vol="music" value="${Math.round(KM.audioCfg.music * 100)}"></label>
            <label><span>🔨 Efeitos</span><input type="range" min="0" max="100" data-vol="sfx" value="${Math.round(KM.audioCfg.sfx * 100)}"></label>
          </div>
          <div class="mgrid">
            <button class="mbtn" data-act="sound">${KM.audioOn ? '🔊 Efeitos ligados' : '🔈 Efeitos desligados'}</button>
            <button class="mbtn" data-act="music">${KM.musicOn ? '🎵 Música ligada' : '🎵 Música desligada'} <kbd>M</kbd></button>
            <button class="mbtn" data-act="voices" data-tip="Os soldados respondem às ordens com voz sintetizada do navegador">${KM.audioCfg.voices ? '🗣️ Vozes ligadas' : '🗣️ Vozes desligadas'}</button>
            <button class="mbtn" data-act="gfx" data-tip="Alta: sombras nítidas e grama · Média: sombras simples · Baixa: sem sombras nem grama (PCs fracos)">🖥️ Gráficos: ${{ high: 'alta', medium: 'média', low: 'baixa' }[KM.R.gfx]}</button>
            <button class="mbtn" data-act="edge">${KM.edgeScroll !== false ? '🖱️ Rolar pela borda: sim' : '🖱️ Rolar pela borda: não'}</button>
          </div>
          ${S.mp ? '<div class="muted">Salvar não está disponível no multijogador.</div>' : `<h4>Salvar / Carregar</h4>
          ${[1, 2, 3].map((s) => { const meta = KM.saveMeta(s); return `<div class="slot"><div><b>Espaço ${s}</b><br><small>${meta ? `${esc(meta.name || '')} · ${KM.fmtTime(meta.time)} · ${new Date(meta.date).toLocaleString('pt-BR')}` : 'vazio'}</small></div><button data-act="save:${s}">💾</button><button data-act="load:${s}" ${meta ? '' : 'disabled'}>📂</button></div>`; }).join('')}
          <div class="muted">Salvamento automático a cada 3 min (<kbd>F5</kbd> salva rápido, <kbd>F9</kbd> carrega).</div>`}
          <h4>Partida</h4>
          ${S.mission ? '<button class="mbtn wide" data-act="restart">🔄 Reiniciar missão</button>' : ''}
          <button class="mbtn wide danger" data-act="quit">🏠 Voltar ao menu principal</button>`;
      }
      if (this.sliding && !force) return;
      if (html !== this.lastTabHtml || force) { $('#tabcontent').innerHTML = html; this.lastTabHtml = html; }
      this.lastTab = this.tab;
    },
    markTool() {
      document.querySelectorAll('#tabcontent [data-tool],#tabcontent [data-build]').forEach((b) => {
        const on = this.tool && ((this.tool.build && this.tool.build === b.dataset.build) || this.tool === b.dataset.tool);
        b.classList.toggle('active', !!on);
      });
    },
    houseTip(k) {
      const d = KM.HOUSES[k];
      let s = `<b>${d.i} ${d.n}</b><br>${d.desc || ''}<br><small>Custo: ${costStr(d.cost)}</small>`;
      if (d.worker) s += `<br><small>Trabalhador: ${KM.PROF[d.worker].i} ${KM.PROF[d.worker].n}</small>`;
      if (d.recipes) s += '<br><small>' + d.recipes.map((r) => `${Object.keys(r.in).map((x) => ri(x) + (r.in[x] > 1 ? '×' + r.in[x] : '')).join('+') || '⛰️'} → ${Object.keys(r.out).map((x) => ri(x) + (r.out[x] > 1 ? '×' + r.out[x] : '')).join('+')}`).join('<br>') + '</small>';
      if (d.gather) s += `<br><small>Produz: ${ri(d.out)} ${KM.RES[d.out].n}</small>`;
      return s;
    },
    onTabClick(e) {
      if (KM.S && KM.S.editor) { KM.editor.onClick(e); return; }
      const b = e.target.closest('button,input');
      if (!b) return;
      if (b.dataset.tool) { this.setTool(this.tool === b.dataset.tool ? null : b.dataset.tool); return; }
      if (b.dataset.build) { this.setTool(this.tool && this.tool.build === b.dataset.build ? null : { build: b.dataset.build }); return; }
      if (b.dataset.locked) { const k = b.dataset.locked; this.toast(`🔒 ${KM.HOUSES[k].n}: construa antes ${KM.reqNames(KM.TECH[k])}.`, 'warn'); KM.sfx && KM.sfx('error'); return; }
      if (b.dataset.act) this.act(b.dataset.act, b, e);
    },
    setTool(t) {
      this.tool = t; this.drag = null;
      if (t) this.clearSel();
      this.markTool();
      document.body.classList.toggle('placing', !!t);
    },

    act(a, el) {
      const S = KM.S;
      const [k, v, w, z] = a.split(':');
      if (k === 'auto') { KM.issue({ c: 'auto', v: el.checked }); return; }
      if (k === 'dist') { KM.issue({ c: 'dist', r: v, t: w, v: S.players[ME()].dist[v][w] + +z }); setTimeout(() => this.renderTab(true), 120); return; }
      if (k === 'pause') this.setSpeed(0);
      if (k === 'grid') { KM.R.showGrid = !KM.R.showGrid; this.renderTab(true); }
      if (k === 'sound') { KM.toggleSfx(); this.renderTab(true); }
      if (k === 'voices') { KM.setAudio('voices', !KM.audioCfg.voices); this.renderTab(true); if (KM.audioCfg.voices) KM.voice('select'); }
      if (k === 'gfx') { KM.R.setGfx({ high: 'medium', medium: 'low', low: 'high' }[KM.R.gfx]); this.renderTab(true); }
      if (k === 'edge') { KM.edgeScroll = KM.edgeScroll === false; try { localStorage.setItem('rm_edge', KM.edgeScroll ? '1' : '0'); } catch (e) { /* ok */ } this.renderTab(true); }
      if (k === 'music') { this.toggleMusic(); this.renderTab(true); }
      if (k === 'help') this.showHelp(true);
      if (k === 'brief') { if (!S.mp) S.paused = true; this.showBriefing(S); }
      if (k === 'tree') this.showTree(true);
      if (k === 'stats') this.showStats();
      if (k === 'restart') { if (confirm('Reiniciar a missão do começo?')) KM.startGame({ mission: S.mission, diff: S.diff }); }
      if (k === 'save') { KM.save(+v); this.toast(`💾 Jogo salvo no espaço ${v}`, 'ok'); this.renderTab(true); }
      if (k === 'load') { if (KM.load(+v)) this.toast(`📂 Jogo carregado do espaço ${v}`, 'ok'); }
      if (k === 'quit') { if (confirm('Sair para o menu principal? O progresso não salvo será perdido.')) KM.quitToMenu(); }
    },
    toggleMusic() {
      KM.musicOn = !KM.musicOn;
      if (KM.musicOn) KM.music.start(); else KM.music.stop();
      try { localStorage.setItem('rm_music', KM.musicOn ? '1' : '0'); } catch (e) { /* ok */ }
    },

    // ---------- seleção ----------
    clearSel() { this.selHouse = 0; this.selUnits = []; this.selGroups = []; this.selSet = new Set(); this.lastPanel = null; },
    selectHouse(id) { this.clearSel(); this.selHouse = id; },
    selectUnits(list) { this.clearSel(); this.selUnits = list.map((u) => u.id); this.refreshSelSet(); },
    selectGroups(gids) {
      this.clearSel(); this.selGroups = [...new Set(gids)]; this.refreshSelSet();
      if (this.myGroups().length) { KM.sfx && KM.sfx('select'); KM.voice && KM.voice('select'); }
    },
    refreshSelSet() {
      const S = KM.S, s = new Set(this.selUnits);
      for (const gid of this.selGroups) { const g = S && S.army[gid]; if (g) for (const id of g.m) s.add(id); }
      this.selSet = s;
    },
    onRemoved(k, id) {
      if (k === 'h' && this.selHouse === id) this.selHouse = 0;
      if (k === 'u' && this.selSet.has(id)) { this.selUnits = this.selUnits.filter((x) => x !== id); this.selSet.delete(id); }
      if (k === 'g') this.selGroups = this.selGroups.filter((x) => x !== id);
    },
    selectedGroups() { const S = KM.S; return this.selGroups.map((id) => S.army[id]).filter(Boolean); },
    myGroups() { return this.selectedGroups().filter((g) => g.owner === ME()); },
    selectedUnits() { return this.selUnits.map((id) => KM.S.units[id]).filter(Boolean); },

    renderPanel() {
      const S = KM.S;
      if (S.editor) { const el = $('#selpanel'); const html = KM.editor.hint(); if (html !== this.lastPanel) { el.innerHTML = html; this.lastPanel = html; el.classList.add('empty'); } return; }
      this.refreshSelSet();
      let html = '';
      if (this.selHouse && S.houses[this.selHouse]) html = this.housePanel(S, S.houses[this.selHouse]);
      else if (this.selGroups.length && this.selectedGroups().length) html = this.groupPanel(S, this.selectedGroups());
      else if (this.selUnits.length && this.selectedUnits().length) html = this.unitPanel(S, this.selectedUnits()[0]);
      else html = `<div class="hint">🖱️ <b>Clique</b> para selecionar · <b>arraste</b> para selecionar tropas · <b>botão direito</b> para ordenar · <kbd>WASD</kbd> câmera · <kbd>Espaço</kbd> base${S.mp ? ' · <kbd>Enter</kbd> chat' : ''}</div>`;
      if (html !== this.lastPanel) {
        const el = $('#selpanel');
        el.innerHTML = html; this.lastPanel = html;
        el.classList.toggle('empty', html.startsWith('<div class="hint">'));
      }
    },

    housePanel(S, h) {
      const d = KM.def(h), mine = h.owner === ME();
      const states = { plan: 'Planejada: aguardando construtor', site: 'Em construção', built: h.paused ? 'Pausada' : 'Pronta' };
      const rel = mine ? states[h.state] : KM.hostile(S, ME(), h.owner) ? `<span class="enemy">Inimigo · ${esc(S.players[h.owner].name)}</span>` : `<span class="good">Aliado · ${esc(S.players[h.owner].name)}</span>`;
      let s = `<div class="ph"><span class="big">${d.i}</span><div><b>${d.n}</b><br><small>${rel}</small></div></div>`;
      s += `<div class="hp"><i style="width:${(h.hp / h.maxHp) * 100}%" class="${mine ? '' : 'e'}"></i><span>${Math.ceil(h.hp)}/${h.maxHp}</span></div>`;
      if (!mine) return s;
      if (h.state !== 'built') {
        s += '<div class="io">';
        for (const r in h.mat) { const mt = h.mat[r]; s += `<div class="chip" data-tip="${KM.RES[r].n}: entregue/necessário">${ri(r)} ${mt.got}/${mt.need}${mt.inc ? ` <em>+${mt.inc}</em>` : ''}</div>`; }
        s += '</div>';
        const prog = h.total ? h.used / h.total : 0;
        s += `<div class="pbar"><i style="width:${prog * 100}%"></i></div>`;
        const road = S.map.road[h.ey * S.map.W + h.ex] === 2;
        const comp = KM.rt.comp && KM.rt.comp[h.ey * S.map.W + h.ex];
        if (!road) s += '<div class="warn">A estrada da entrada ainda não foi construída.</div>';
        else if (!this.connected(S, comp)) s += '<div class="warn">⚠️ Sem estrada até um armazém: os materiais não chegam!</div>';
        s += `<div class="mgrid"><button class="mbtn ${h.noDeliv ? 'on' : ''}" data-act2="hset:noDeliv:${h.noDeliv ? 0 : 1}">${h.noDeliv ? '🚫 Entregas bloqueadas' : '📥 Entregas liberadas'}</button><button class="mbtn danger" data-act2="demolish">❌ Cancelar</button></div>`;
        return s;
      }
      if (d.worker) {
        const w = h.worker && S.units[h.worker];
        s += `<div class="row">${KM.PROF[d.worker].i} ${KM.PROF[d.worker].n}: ${w ? (w.inside === h.id || (w.task && w.task.type === 'gather') ? '<span class="good">trabalhando</span>' : w.task && w.task.type === 'eat' ? '<span class="warnc">comendo</span>' : '<span class="warnc">a caminho</span>') : '<span class="bad">nenhum: treine na Escola</span>'}${w && w.hunger < 25 ? ' 🍗' : ''}</div>`;
      }
      const acc = KM.houseAccepts(h);
      if (acc.length && h.type !== 'barracks') {
        s += `<div class="lbl">Entrada</div><div class="io">${acc.map((r) => `<div class="chip" data-tip="${KM.RES[r].n} (máx. ${KM.houseCap(S, h, r)})">${ri(r)} ${h.inv[r] || 0}${h.inc[r] ? `<em>+${h.inc[r]}</em>` : ''}</div>`).join('')}</div>`;
      }
      const outs = Object.keys(h.out);
      if (outs.length) s += `<div class="lbl">Saída</div><div class="io">${outs.map((r) => `<div class="chip" data-tip="${KM.RES[r].n}">${ri(r)} ${h.out[r]}</div>`).join('')}</div>`;
      if (h.work) s += `<div class="pbar"><i style="width:${(1 - h.work.t / h.work.T) * 100}%"></i></div>`;
      if (d.mine && h.depleted) s += '<div class="warn">O minério próximo acabou.</div>';
      if (h.orders) {
        const any = h.orders.some((o) => o > 0);
        s += `<div class="lbl">Encomendas ${any ? '' : '<span class="bad">(nenhuma: a oficina está parada)</span>'}</div>`;
        d.recipes.forEach((rc, i) => {
          const o = Object.keys(rc.out)[0], v = h.orders[i];
          s += `<div class="ratio"><span>${ri(o)} ${KM.RES[o].n}</span><button data-act2="ord:${i}:-1" data-tip="Shift: −10">−</button><b>${v >= KM.INF ? '∞' : v}</b><button data-act2="ord:${i}:1" data-tip="Shift: +10">+</button><button data-act2="ord:${i}:inf" data-tip="Produção contínua">∞</button></div>`;
        });
      }
      if (h.type === 'storehouse') {
        s += `<div class="lbl">Clique para bloquear a entrada de um recurso</div><div class="io sgridres">${KM.RES_ORDER.map((r) => `<button class="chip ${h.block && h.block[r] ? 'blocked' : ''} ${h.inv[r] ? '' : 'zero'}" data-act2="block:${r}" data-tip="${KM.RES[r].n}${h.block && h.block[r] ? ' (bloqueado)' : ''}">${ri(r)} ${h.inv[r] || 0}</button>`).join('')}</div>`;
      }
      if (h.type === 'school') {
        const P = S.players[ME()];
        s += `<div class="lbl">Fila de treino ${h.trainT ? `: ${KM.PROF[h.queue[0]].n}` : (h.queue.length && !(h.inv.gold > 0) ? ': <span class="bad">sem ouro!</span>' : '')}</div>`;
        if (h.trainT) s += `<div class="pbar"><i style="width:${(1 - h.trainT / h.trainMax) * 100}%"></i></div>`;
        s += `<div class="queue">${h.queue.map((p, i) => `<button data-act2="unq:${i}" data-tip="Remover ${KM.PROF[p].n}">${KM.PROF[p].i}</button>`).join('') || '<small class="muted">vazia</small>'}</div>`;
        s += `<div class="lbl">Treinar (1 🪙 cada)</div><div class="tgrid">${KM.PROF_ORDER.map((p) => {
          if (KM.profUnlocked(S, ME(), p)) return `<button data-act2="train:${p}" data-tip="${KM.PROF[p].n}">${KM.PROF[p].i}<small>${KM.PROF[p].n}</small></button>`;
          const need = p === 'recruit' ? 'Construa um ⚔️ Quartel' : 'Libere uma construção que use este profissional: ' + Object.keys(KM.HOUSES).filter((t) => KM.HOUSES[t].worker === p).map((t) => KM.HOUSES[t].i + ' ' + KM.HOUSES[t].n).join(', ');
          return `<button class="locked" data-act2="lockedp:${p}" data-tip="<b>🔒 ${KM.PROF[p].n}</b><br>${need}">${KM.PROF[p].i}<small>🔒</small></button>`;
        }).join('')}</div>`;
        s += `<label class="chk"><input type="checkbox" data-act2="auto" ${P.autoTrain ? 'checked' : ''}> Treino automático</label>`;
      }
      if (h.type === 'barracks') {
        s += `<div class="row">🪖 Recrutas: <b>${h.recruits}</b> <small class="muted">(treine "Recruta" na Escola)</small></div>`;
        s += `<div class="io">${KM.WEAPONS.map((r) => `<div class="chip ${h.inv[r] ? '' : 'zero'}" data-tip="${KM.RES[r].n}">${ri(r)} ${h.inv[r] || 0}</div>`).join('')}</div>`;
        s += `<div class="lbl">Equipar soldado <small class="muted">(Shift: 5 de uma vez)</small></div><div class="sgrid">${KM.SOLDIER_ORDER.map((t) => {
          const sd = KM.SOLDIERS[t];
          if (!KM.soldierUnlocked(S, ME(), t)) return `<button class="locked" data-act2="lockeds:${t}" data-tip="<b>🔒 ${sd.n}</b><br>Para liberar, construa: ${esc(KM.reqNames(KM.SOLDIER_REQ[t]))}"><span>${sd.i}</span><small>${sd.n}</small><em>🔒 bloqueado</em></button>`;
          const ok = h.recruits > 0 && Object.keys(sd.cost).every((r) => (h.inv[r] || 0) >= sd.cost[r]);
          return `<button data-act2="equip:${t}" class="${ok ? '' : 'off'}" data-tip="<b>${sd.n}</b><br>Vida ${sd.hp} · Ataque ${sd.atk} · Defesa ${sd.def}${sd.range ? ' · Alcance ' + sd.range : ''}${sd.antiCav ? '<br>Forte contra cavalaria' : ''}<br>Custo: 🪖 + ${costStr(sd.cost)}"><span>${sd.i}</span><small>${sd.n}</small><em>${costStr(sd.cost)}</em></button>`;
        }).join('')}</div>`;
      }
      if (h.type === 'tower') s += `<div class="row">Munição: ${h.shots} tiros prontos + ${h.inv.stone || 0} 🪨</div>`;
      s += `<div class="mgrid">`;
      if (d.recipes || d.gather) s += `<button class="mbtn ${h.paused ? 'on' : ''}" data-act2="hset:paused:${h.paused ? 0 : 1}">${h.paused ? '▶️ Retomar' : '⏸️ Pausar'}</button>`;
      if (acc.length) s += `<button class="mbtn ${h.noDeliv ? 'on' : ''}" data-act2="hset:noDeliv:${h.noDeliv ? 0 : 1}">${h.noDeliv ? '🚫 Entregas bloqueadas' : '📥 Entregas liberadas'}</button>`;
      s += `<button class="mbtn ${h.repair ? '' : 'on'}" data-act2="hset:repair:${h.repair ? 0 : 1}" data-tip="Construtores consertam a casa quando danificada">${h.repair ? '🔧 Reparo: sim' : '🔧 Reparo: não'}</button>`;
      s += `<button class="mbtn danger" data-act2="demolish">❌ Demolir</button></div>`;
      return s;
    },
    connected(S, comp) {
      if (comp == null || comp < 0) return false;
      for (const id in S.houses) { const o = S.houses[id]; if (o.owner === ME() && o.type === 'storehouse' && o.state === 'built' && KM.rt.comp[o.ey * S.map.W + o.ex] === comp) return true; }
      return false;
    },
    unitPanel(S, u) {
      const sd = KM.SOLDIERS[u.type], p = KM.PROF[u.type];
      const nm = sd ? sd.n : p.n, ic = sd ? sd.i : p.i;
      const mine = u.owner === ME();
      let s = `<div class="ph"><span class="big">${ic}</span><div><b>${nm}</b><br><small>${mine ? KM.taskText(S, u) : `<span class="${KM.hostile(S, ME(), u.owner) ? 'enemy' : 'good'}">${esc(S.players[u.owner].name)}</span>`}</small></div></div>`;
      s += `<div class="hp"><i style="width:${(u.hp / u.maxHp) * 100}%" class="${mine ? '' : 'e'}"></i><span>${Math.ceil(u.hp)}/${u.maxHp}</span></div>`;
      if (mine) s += `<div class="meter"><span>🍗 Fome</span><div class="mbar"><i style="width:${u.hunger}%"></i></div></div>`;
      return s;
    },
    groupPanel(S, groups) {
      const mine = groups[0].owner === ME();
      let n = 0, hp = 0, mhp = 0, hun = 0;
      const c = {};
      for (const g of groups) for (const u of KM.groupUnits(S, g)) { n++; hp += u.hp; mhp += u.maxHp; hun += u.hunger; KM.add(c, u.type, 1); }
      if (!n) return '';
      const sd = KM.SOLDIERS[groups[0].type];
      let s = `<div class="ph"><span class="big">${groups.length > 1 ? '⚔️' : sd.i}</span><div><b>${groups.length > 1 ? groups.length + ' grupos' : sd.n}</b> · ${n} soldado${n > 1 ? 's' : ''}<br><small>${mine ? this.groupState(S, groups[0]) : `<span class="${KM.hostile(S, ME(), groups[0].owner) ? 'enemy' : 'good'}">${esc(S.players[groups[0].owner].name)}</span>`}</small></div></div>`;
      s += `<div class="hp"><i style="width:${(hp / mhp) * 100}%" class="${mine ? '' : 'e'}"></i><span>Vida ${Math.round((hp / mhp) * 100)}%</span></div>`;
      if (groups.length > 1) s += `<div class="io">${Object.keys(c).map((t) => `<div class="chip">${KM.SOLDIERS[t].i} ${c[t]}</div>`).join('')}</div>`;
      else s += `<div class="muted">Ataque ${sd.atk} · Defesa ${sd.def}${sd.range ? ' · Alcance ' + sd.range : ''}${sd.antiCav ? ' · anti-cavalaria' : ''}</div>`;
      if (!mine) return s;
      s += `<div class="meter"><span>🍖 Comida</span><div class="mbar"><i style="width:${hun / n}%"></i></div></div>`;
      s += `<div class="cmds">
        <button data-act2="stop" data-tip="Parar <kbd>S</kbd>">✋</button>
        <button data-act2="turn:-1" data-tip="Girar à esquerda <kbd>Q</kbd>">↺</button>
        <button data-act2="turn:1" data-tip="Girar à direita <kbd>E</kbd>">↻</button>
        <button data-act2="cols:-1" data-tip="Menos colunas <kbd>[</kbd>">⇤</button>
        <button data-act2="cols:1" data-tip="Mais colunas <kbd>]</kbd>">⇥</button>
        <button data-act2="split" data-tip="Dividir grupo ao meio <kbd>T</kbd>">✂️</button>
        <button data-act2="link" data-tip="Unir grupos selecionados do mesmo tipo <kbd>L</kbd>" ${groups.length > 1 ? '' : 'disabled'}>🔗</button>
        <button data-act2="feed" data-tip="Chamar carregadores com comida <kbd>H</kbd>">🍖</button>
        <button data-act2="amove" data-tip="Atacar-mover <kbd>A</kbd>">⚔️</button>
      </div><div class="muted">Colunas: ${groups[0].cols} · <kbd>Ctrl</kbd>+<kbd>1-9</kbd> cria atalho</div>`;
      return s;
    },
    groupState(S, g) {
      const us = KM.groupUnits(S, g);
      if (us.some((u) => u.target)) return 'Em combate';
      if (us.some((u) => u.order)) return 'Marchando';
      if (us.some((u) => u.hunger < 35)) return 'Com fome';
      return 'Em formação';
    },
    onPanelClick(e) {
      const b = e.target.closest('[data-act2]');
      if (!b) return;
      const S = KM.S, h = S.houses[this.selHouse];
      const [k, a, bb] = b.dataset.act2.split(':');
      const gids = this.myGroups().map((g) => g.id);
      if (k === 'demolish' && h) { KM.issue({ c: 'demolish', id: h.id }); KM.sfx && KM.sfx('demolish'); this.clearSel(); }
      if (k === 'hset' && h) KM.issue({ c: 'hset', id: h.id, k: a, v: bb === '1' });
      if (k === 'ord' && h) {
        const cur = h.orders[+a];
        const v = bb === 'inf' ? (cur >= KM.INF ? 0 : KM.INF) : KM.clamp((cur >= KM.INF ? 99 : cur) + +bb * (e.shiftKey ? 10 : 1), 0, 99);
        KM.issue({ c: 'order', id: h.id, i: +a, v });
      }
      if (k === 'block' && h) KM.issue({ c: 'block', id: h.id, r: a });
      if (k === 'train' && h) { if (h.queue.length < 10) KM.issue({ c: 'train', id: h.id, p: a }); else this.toast('Fila cheia (máx. 10).', 'warn'); }
      if (k === 'lockedp') this.toast(`🔒 ${KM.PROF[a].n} ainda não está disponível. ${a === 'recruit' ? 'Construa um Quartel.' : 'Libere a construção onde ele trabalha.'}`, 'warn');
      if (k === 'lockeds') this.toast(`🔒 ${KM.SOLDIERS[a].n}: construa antes ${KM.reqNames(KM.SOLDIER_REQ[a])}.`, 'warn');
      if (k === 'unq' && h) KM.issue({ c: 'unq', id: h.id, i: +a });
      if (k === 'auto') KM.issue({ c: 'auto', v: b.checked });
      if (k === 'equip' && h) {
        const sd = KM.SOLDIERS[a];
        const ok = h.recruits > 0 && Object.keys(sd.cost).every((r) => (h.inv[r] || 0) >= sd.cost[r]);
        if (!KM.soldierUnlocked(S, ME(), a)) this.toast(`🔒 ${sd.n}: construa antes ${KM.reqNames(KM.SOLDIER_REQ[a])}.`, 'warn');
        else if (!ok) this.toast(h.recruits < 1 ? 'Sem recrutas! Treine "Recruta" na Escola.' : 'Faltam armas ou armaduras no quartel.', 'warn');
        else { KM.issue({ c: 'equip', id: h.id, t: a, n: e.shiftKey ? 5 : 1 }); KM.sfx && KM.sfx('click'); }
      }
      if (k === 'stop') KM.issue({ c: 'stop', g: gids });
      if (k === 'turn') KM.issue({ c: 'turn', g: gids, d: +a });
      if (k === 'cols') KM.issue({ c: 'cols', g: gids, d: +a });
      if (k === 'split') KM.issue({ c: 'split', g: gids });
      if (k === 'link') KM.issue({ c: 'link', g: gids });
      if (k === 'feed') { KM.issue({ c: 'feed', g: gids }); this.toast('🍖 Carregadores levarão comida às tropas.', 'info'); }
      if (k === 'amove') { this.attackMove = true; this.toast('Clique com o botão direito no destino do ataque.', 'info'); }
      this.lastPanel = null;
      setTimeout(() => { this.lastPanel = null; this.renderPanel(); }, 80);
    },

    // ---------- tooltip ----------
    onTip(e) {
      const el = e.target.closest('[data-tip]');
      const tip = $('#tooltip');
      if (!el) { tip.style.display = 'none'; return; }
      tip.innerHTML = el.dataset.tip;
      tip.style.display = 'block';
      const x = Math.min(e.clientX + 16, innerWidth - tip.offsetWidth - 8), y = Math.min(e.clientY + 12, innerHeight - tip.offsetHeight - 8);
      tip.style.left = x + 'px'; tip.style.top = y + 'px';
    },
    hideTip() { $('#tooltip').style.display = 'none'; },

    // ---------- notificações ----------
    toast(msg, kind, pos) {
      const box = $('#toasts');
      if (!box) return;
      const el = document.createElement('div');
      el.className = 'toast ' + (kind || 'info');
      el.innerHTML = esc(msg) + (pos ? ' <span class="go">📍</span>' : '');
      if (pos) { el.style.cursor = 'pointer'; el.onclick = () => KM.R.centerOn(pos.x, pos.y); }
      box.prepend(el);
      while (box.children.length > 6) box.lastChild.remove();
      setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 500); }, kind === 'danger' ? 9000 : 5500);
    },

    // ---------- barra superior ----------
    renderTop() {
      const S = KM.S;
      if (S.editor) { const html = KM.editor.top(); if (html !== this.lastTop) { $('#topbar').innerHTML = html; this.lastTop = html; } return; }
      const tot = {};
      let cit = 0, sol = 0;
      for (const id in S.houses) { const h = S.houses[id]; if (h.owner === ME() && h.type === 'storehouse' && h.state === 'built') for (const r in h.inv) KM.add(tot, r, h.inv[r]); }
      for (const id in S.units) { const u = S.units[id]; if (u.owner !== ME()) continue; if (KM.isSoldier(u.type)) sol++; else cit++; }
      const food = (tot.bread || 0) + (tot.sausages || 0) + (tot.wine || 0) + (tot.fish || 0);
      const ais = S.players.filter((p, i) => p.ai && p.ai.mode !== 'none' && p.ai.mode !== 'outpost' && KM.hostile(S, ME(), i) && !p.out);
      const peace = Math.min(...ais.map((p) => (p.ai.wave === 0 ? p.ai.next - S.time : Infinity)));
      const waves = ais.reduce((a, p) => a + p.ai.wave, 0);
      let threat = '';
      if (ais.length) threat = isFinite(peace) && peace > 0 ? `<span class="peace" data-tip="Tempo de paz antes do primeiro ataque">🕊️ Paz ${KM.fmtTime(peace)}</span>` : `<span class="muted">Ataques: ${waves}</span>`;
      const done = S.goals.filter((g) => KM.goalStatus(S, g).done).length;
      const net = S.mp && KM.net ? `<span class="${KM.net.lag > 0.5 ? 'threat' : 'muted'}" data-tip="Conexão multijogador">📶 ${KM.net.ping}ms</span>` : '';
      const html = `<div class="tb-group">⏱️ ${KM.fmtTime(S.time)} ${threat} ${net} <button class="goalsbtn" data-goals="1" data-tip="Objetivos">🎯 ${done}/${S.goals.length}</button></div>
        <div class="tb-group res"><span data-tip="Madeira">🪜 ${tot.wood || 0}</span><span data-tip="Pedra">🪨 ${tot.stone || 0}</span><span data-tip="Ouro">🪙 ${tot.gold || 0}</span><span data-tip="Comida (pão, salsicha, vinho, peixe)">🍞 ${food}</span><span data-tip="Cidadãos">👥 ${cit}</span><span data-tip="Soldados">⚔️ ${sol}</span></div>
        <div class="tb-group speed">${(S.mp ? [1, 2, 3] : [0, 1, 2, 3, 5]).map((v) => `<button data-speed="${v}" class="${(v === 0 ? S.paused : !S.paused && S.speed === v) ? 'active' : ''}">${v === 0 ? '⏸' : v + '×'}</button>`).join('')}</div>`;
      if (html !== this.lastTop) { $('#topbar').innerHTML = html; this.lastTop = html; }
    },
    setSpeed(v) {
      const S = KM.S;
      if (S.mp) {
        if (KM.me !== 0) { this.toast('Só o anfitrião muda a velocidade.', 'warn'); return; }
        if (v === 0) { this.toast('Não há pausa no multijogador.', 'warn'); return; }
        KM.issue({ c: 'speed', v }); return;
      }
      if (v === 0) S.paused = !S.paused; else { S.paused = false; S.speed = v; }
      this.renderTop();
    },

    // ---------- minimapa ----------
    renderMini() {
      const S = KM.S, cv = $('#minimap'), g = cv.getContext('2d'), m = S.map;
      if (!this.mmImg || this.mmImg.width !== m.W) this.mmImg = g.createImageData(m.W, m.H);
      const d = this.mmImg.data, bit = 1 << ME();
      const col = { 0: [92, 138, 58], 1: [38, 100, 150], 2: [128, 118, 106], 3: [208, 190, 140] };
      for (let i = 0; i < m.W * m.H; i++) {
        let c = col[m.terrain[i]];
        const x = i % m.W, y = (i / m.W) | 0;
        const hl = (KM.vh(m, x + 1, y + 1) - KM.vh(m, x, y)) * 10;
        if (m.tree[i] >= 3) c = [48, 92, 38];
        if (m.stone[i]) c = [170, 165, 155];
        if (m.road[i] === 2) c = [170, 140, 95];
        if (m.field[i] === 2 || m.field[i] === 4) c = [150, 120, 60];
        if (!S.editor && !(m.explored[i] & bit)) { d[i * 4] = 8; d[i * 4 + 1] = 10; d[i * 4 + 2] = 14; d[i * 4 + 3] = 255; continue; }
        d[i * 4] = KM.clamp(c[0] + hl, 0, 255); d[i * 4 + 1] = KM.clamp(c[1] + hl, 0, 255); d[i * 4 + 2] = KM.clamp(c[2] + hl, 0, 255); d[i * 4 + 3] = 255;
      }
      const put = (x, y, c) => { if (!KM.inb(x, y)) return; const i = (y * m.W + x) * 4; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; };
      const pc = S.players.map((p) => { const v = parseInt(p.color.slice(1), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; });
      for (const id in S.houses) {
        const h = S.houses[id];
        if (!S.editor && h.owner !== ME() && !(m.explored[h.y * m.W + h.x] & bit)) continue;
        for (let y = h.y; y < h.y + h.h; y++) for (let x = h.x; x < h.x + h.w; x++) put(x, y, pc[h.owner] || [255, 255, 255]);
      }
      for (const id in S.units) {
        const u = S.units[id];
        if (u.inside) continue;
        const x = Math.round(u.x), y = Math.round(u.y);
        if (u.owner !== ME() && !(m.explored[y * m.W + x] & bit)) continue;
        put(x, y, u.owner === ME() ? [220, 240, 255] : pc[u.owner].map((v) => Math.min(255, v + 60)));
      }
      if (S.editor && S.edStarts) for (const [k, s] of S.edStarts.entries()) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) put(s.x + dx, s.y + dy, pc[k] || [255, 255, 255]);
      if (!this.mmTmp || this.mmTmp.width !== m.W) { this.mmTmp = document.createElement('canvas'); this.mmTmp.width = m.W; this.mmTmp.height = m.H; }
      this.mmTmp.getContext('2d').putImageData(this.mmImg, 0, 0);
      g.imageSmoothingEnabled = false;
      g.clearRect(0, 0, cv.width, cv.height);
      g.drawImage(this.mmTmp, 0, 0, cv.width, cv.height);
      const poly = KM.R.poly, sx = cv.width / m.W, sy = cv.height / m.H;
      if (poly) {
        g.strokeStyle = '#ffe066'; g.lineWidth = 1.5;
        g.beginPath();
        poly.forEach(([x, y], i) => (i ? g.lineTo(x * sx, y * sy) : g.moveTo(x * sx, y * sy)));
        g.closePath(); g.stroke();
      }
    },

    update(dt) {
      if (!KM.S) return;
      this.t += dt;
      this.mt = (this.mt || 0) + dt;
      if (this.mt > 0.25) {
        this.mt = 0;
        this.renderTop();
        this.renderPanel();
        this.renderTab(false);
      }
      this.mmt = (this.mmt || 0) + dt;
      if (this.mmt > 0.5) { this.mmt = 0; this.renderMini(); }
      KM.tutorial.update(KM.S, dt);
    },

    // ---------- menus ----------
    initMenu() {
      try { KM.musicOn = localStorage.getItem('rm_music') !== '0'; } catch (e) { /* ok */ }
      $('#menu').addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        if (b.dataset.new) {
          const seedv = $('#seed').value.trim();
          const map = $('#smap').value ? KM.editor.loadMapData($('#smap').value) : null;
          KM.startGame({ diff: $('#diff').value, aiMode: $('#aimode').value, opponents: +$('#opps').value, ally: $('#ally').checked, allUnlocked: $('#allun').checked, map, seed: seedv ? (parseInt(seedv, 10) || seedv.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 7) >>> 0) : 0 });
        }
        if (b.dataset.cont) KM.load(+b.dataset.cont);
        if (b.dataset.help) this.showHelp(true);
        if (b.dataset.screen) this.menuScreen(b.dataset.screen);
        if (b.dataset.mission) KM.startGame({ mission: b.dataset.mission, diff: $('#cdiff').value });
        if (b.dataset.editor) KM.editor.open(b.dataset.editor);
        if (b.dataset.net) KM.net.menu(b.dataset.net, b);
      });
      $('#help').addEventListener('click', (e) => { if (e.target.closest('[data-close]') || e.target.id === 'help') this.showHelp(false); });
      $('#brief').addEventListener('click', (e) => {
        if (e.target.closest('[data-go]')) { $('#brief').classList.add('hidden'); if (KM.S && !KM.S.mp) KM.S.paused = false; KM.music && KM.music.start(); }
      });
      $('#endscreen').addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        if (b.dataset.cont) { $('#endscreen').classList.add('hidden'); KM.S.over = 'ignored'; }
        if (b.dataset.menu) KM.quitToMenu();
        if (b.dataset.next) KM.startGame({ mission: b.dataset.next, diff: KM.S.diff });
        if (b.dataset.retry) KM.startGame({ mission: KM.S.mission, diff: KM.S.diff });
      });
      this.refreshMenu();
    },
    menuScreen(s) {
      document.querySelectorAll('#menu .screen').forEach((el) => el.classList.toggle('hidden', el.dataset.s !== s));
      if (s === 'campaign') this.renderCampaign();
      if (s === 'skirmish' || s === 'editor') KM.editor.fillMapLists();
    },
    renderCampaign() {
      const prog = KM.campaignProgress();
      $('#missions').innerHTML = KM.MISSIONS.map((m, i) => {
        const open = i + 1 <= prog, done = i + 1 < prog;
        const fake = { houses: {}, units: {}, time: 0, players: [] };
        return `<button class="mission ${open ? '' : 'locked'}" ${open ? `data-mission="${m.id}"` : 'disabled'}><span>${done ? '✅' : open ? '⚔️' : '🔒'}</span><div><b>${m.n}</b><small>${open ? m.goals.map((g) => KM.goalStatus(fake, g).text).join(' · ') : 'Complete a missão anterior'}</small></div></button>`;
      }).join('');
    },
    refreshMenu() {
      const slots = [0, 1, 2, 3].map((s) => ({ s, m: KM.saveMeta(s) })).filter((x) => x.m && x.m.v3).sort((a, b) => b.m.date - a.m.date);
      $('#continue').innerHTML = slots.length ? slots.map(({ s, m }) => `<button class="mbtn" data-cont="${s}">📂 ${s === 0 ? 'Autosave' : 'Espaço ' + s} · ${esc(m.name || '')} · ${KM.fmtTime(m.time)}</button>`).join('') : '';
      this.menuScreen('main');
    },
    showHelp(on) { $('#help').classList.toggle('hidden', !on); },
    // árvore de progresso: colunas por "era", do básico ao militar
    showTree(on) {
      let el = $('#tree');
      if (!el) {
        el = document.createElement('div'); el.id = 'tree'; el.className = 'hidden';
        document.body.appendChild(el);
        el.addEventListener('click', (e) => { if (e.target.id === 'tree' || e.target.closest('[data-close]')) this.showTree(false); });
      }
      if (!on || !KM.S) { el.classList.add('hidden'); return; }
      const S = KM.S, P = S.players[ME()], built = P.built || {};
      const depth = {};
      const dep = (t) => { if (depth[t] != null) return depth[t]; const r = KM.TECH[t]; return (depth[t] = r ? 1 + Math.max(...r.map(dep)) : 0); };
      Object.keys(KM.HOUSES).forEach(dep);
      const cols = [];
      for (const t in depth) (cols[depth[t]] = cols[depth[t]] || []).push(t);
      const ERAS = ['Fundação', 'Serraria', 'Comida e oficinas', 'Criação e minas', 'Metal e quartel', 'Forja', 'Elite'];
      const card = (t) => {
        const d = KM.HOUSES[t], open = KM.houseUnlocked(S, ME(), t), done = built[t];
        const st = done ? 'done' : open ? 'open' : 'lock';
        return `<div class="tcard ${st}" data-tip="${esc(this.houseTip(t))}"><span class="ti">${d.i}</span><div><b>${d.n}</b><small>${done ? '✅ construída' : open ? '🔓 disponível' : '🔒 ' + esc(KM.reqNames(KM.TECH[t]))}</small></div></div>`;
      };
      const sol = KM.SOLDIER_ORDER.map((t) => {
        const sd = KM.SOLDIERS[t], open = KM.soldierUnlocked(S, ME(), t);
        return `<div class="tcard ${open ? 'open' : 'lock'}"><span class="ti">${sd.i}</span><div><b>${sd.n}</b><small>${open ? '🔓 disponível no Quartel' : '🔒 ' + esc(KM.reqNames(KM.SOLDIER_REQ[t]))}</small></div></div>`;
      }).join('');
      el.innerHTML = `<div class="card treecard"><button class="close" data-close="1">✕</button>
        <h2>🌳 Árvore de progresso</h2>
        <p class="muted">Cada construção erguida libera novas opções, como no original. Siga da esquerda para a direita.</p>
        <div class="tcols">${cols.map((c, i) => `<div class="tcol"><div class="tera">${ERAS[i] || 'Era ' + (i + 1)}</div>${c.map(card).join('')}</div>`).join('')}</div>
        <h3>⚔️ Soldados</h3><div class="tsol">${sol}</div></div>`;
      el.classList.remove('hidden');
      el.addEventListener('mousemove', (e) => this.onTip(e));
      el.addEventListener('mouseleave', () => this.hideTip());
    },
    showBriefing(S) {
      const mis = KM.MISSIONS.find((m) => m.id === S.mission);
      if (!mis) return;
      $('#brief').innerHTML = `<div class="card brief"><div class="seal">📜</div><h2>${esc(mis.n)}</h2><div class="btext">${mis.brief}</div>
        <h3>Objetivos</h3><div class="goals">${S.goals.map((g) => `<div class="goal"><span>🎯</span><div>${KM.goalStatus(S, g).text}</div></div>`).join('')}</div>
        ${S.players.length > 1 ? `<h3>Jogadores</h3><div class="plist">${S.players.map((p, i) => `<div class="prow"><span class="dot" style="background:${p.color}"></span><span class="sn">${esc(p.name)}</span><em class="${i === ME() ? '' : KM.hostile(S, ME(), i) ? 'bad' : 'good'}">${i === ME() ? 'você' : KM.hostile(S, ME(), i) ? 'inimigo' : 'aliado'}</em></div>`).join('')}</div>` : ''}
        <button class="mbtn primary" data-go="1">${S.time > 0 ? 'Voltar ao jogo' : 'Começar'}</button></div>`;
      $('#brief').classList.remove('hidden');
    },
    showStats() {
      let el = $('#statsm');
      if (!el) {
        el = document.createElement('div'); el.id = 'statsm';
        document.body.appendChild(el);
        el.addEventListener('click', (e) => { if (e.target.id === 'statsm' || e.target.closest('[data-close]')) el.classList.add('hidden'); });
      }
      const S = KM.S;
      KM.recordHist(S);
      el.innerHTML = `<div class="card endcard"><button class="close" data-close="1">✕</button><h2>📊 Estatísticas</h2>${this.statsHtml(S)}</div>`;
      el.classList.remove('hidden');
      this.bindStats(el, S);
      // a amostra extra não entra no histórico definitivo
      S.hist.t.pop(); S.hist.d.forEach((r) => r.pop());
    },
    showEnd(res) {
      const S = KM.S, el = $('#endscreen');
      if (!S.hist || !S.hist.t.length || S.hist.t[S.hist.t.length - 1] < S.time - 5) KM.recordHist(S);
      const idx = S.mission ? KM.MISSIONS.findIndex((m) => m.id === S.mission) : -1;
      const next = idx >= 0 && KM.MISSIONS[idx + 1];
      const txt = res === 'win' ? (S.mission ? (next ? 'Missão cumprida! O Rei aguarda suas próximas ordens.' : 'Todos os traidores caíram. O Reino de Aldor está reunido sob sua bandeira!') : 'Todos os inimigos foram derrotados. Seu reino prospera!') : 'Seu reino caiu. Os mercadores fugiram e os cavaleiros depuseram as armas.';
      el.innerHTML = `<div class="card endcard"><h1>${res === 'win' ? '🏆 Vitória!' : '💀 Derrota'}</h1><p>${txt}</p>
        ${this.statsHtml(S)}
        <div class="mgrid">${res === 'win' && next ? `<button class="mbtn primary" data-next="${next.id}">➡️ Próxima missão</button>` : ''}${res === 'win' ? '<button class="mbtn" data-cont="1">Continuar jogando</button>' : ''}${res === 'lose' && S.mission ? '<button class="mbtn" data-retry="1">🔄 Tentar de novo</button>' : ''}<button class="mbtn" data-menu="1">Menu principal</button></div></div>`;
      el.classList.remove('hidden');
      this.bindStats(el, S);
      KM.sfx && KM.sfx(res === 'win' ? 'win' : 'horn');
    },
    // estatísticas da partida (tela final e aba Objetivos): tabela por jogador + gráfico ao longo do tempo
    statsHtml(S) {
      const rows = S.players.map((p, o) => {
        const st = S.stats[o] || {};
        return `<tr><td><span class="dot" style="background:${p.color}"></span>${esc(p.name)}${o === ME() ? ' <small>(você)</small>' : ''}</td><td>${st.built || 0}</td><td>${st.trained || 0}</td><td>${st.killed || 0}</td><td>${st.lost || 0}</td><td>${st.razed || 0}</td></tr>`;
      }).join('');
      return `<div class="stats"><div class="muted">Duração: <b>${KM.fmtTime(S.time)}</b></div>
        <table class="stable"><tr><th>Jogador</th><th title="Casas construídas">🏠</th><th title="Cidadãos treinados">🎓</th><th title="Inimigos abatidos">⚔️</th><th title="Perdas">💀</th><th title="Casas inimigas destruídas">🔥</th></tr>${rows}</table>
        <div class="chartbar">${[['0', '👥 Cidadãos'], ['1', '⚔️ Soldados'], ['2', '🏠 Casas'], ['3', '📦 Recursos']].map(([k, n]) => `<button class="${k === '1' ? 'active' : ''}" data-chart="${k}">${n}</button>`).join('')}</div>
        <canvas class="chart" width="560" height="190"></canvas></div>`;
    },
    bindStats(el, S) {
      const cv = el.querySelector('canvas.chart');
      if (!cv) return;
      const draw = (k) => this.drawChart(cv, S, +k);
      el.querySelectorAll('[data-chart]').forEach((b) => b.addEventListener('click', () => {
        el.querySelectorAll('[data-chart]').forEach((x) => x.classList.toggle('active', x === b));
        draw(b.dataset.chart);
      }));
      draw(1);
    },
    drawChart(cv, S, k) {
      const g = cv.getContext('2d'), W = cv.width, H = cv.height, P = { l: 36, r: 10, t: 10, b: 22 };
      g.clearRect(0, 0, W, H);
      const hs = S.hist || { t: [], d: [] };
      const T = hs.t;
      g.font = '11px "Alegreya Sans", sans-serif'; g.fillStyle = '#b3a283';
      if (T.length < 2) { g.textAlign = 'center'; g.fillText('Partida curta demais para o gráfico.', W / 2, H / 2); return; }
      let max = 1;
      hs.d.forEach((rows) => rows.forEach((r) => { max = Math.max(max, r[k]); }));
      max = Math.ceil(max * 1.1);
      const X = (i) => P.l + (T[i] / T[T.length - 1]) * (W - P.l - P.r), Y = (v) => H - P.b - (v / max) * (H - P.t - P.b);
      g.strokeStyle = 'rgba(227,185,92,0.15)'; g.lineWidth = 1;
      for (let q = 0; q <= 4; q++) { const y = Y((max * q) / 4); g.beginPath(); g.moveTo(P.l, y); g.lineTo(W - P.r, y); g.stroke(); g.textAlign = 'right'; g.fillText(Math.round((max * q) / 4), P.l - 5, y + 4); }
      g.textAlign = 'center';
      for (let q = 0; q <= 4; q++) { const tt = (T[T.length - 1] * q) / 4; g.fillText(KM.fmtTime(tt), P.l + (q / 4) * (W - P.l - P.r), H - 6); }
      hs.d.forEach((rows, o) => {
        if (!rows.length) return;
        g.strokeStyle = S.players[o].color; g.lineWidth = o === ME() ? 3 : 2;
        g.beginPath();
        rows.forEach((r, i) => (i ? g.lineTo(X(i), Y(r[k])) : g.moveTo(X(i), Y(r[k]))));
        g.stroke();
      });
    },
  };
})(window.KM);
