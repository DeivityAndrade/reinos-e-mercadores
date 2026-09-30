'use strict';
/* Multijogador P2P (WebRTC DataChannel) com lockstep determinístico.
   Sem servidor: os jogadores trocam códigos de conexão (copiar e colar). */
(function (KM) {
  const $ = (s) => document.querySelector(s);
  const ICE = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }];
  const enc = (o) => btoa(unescape(encodeURIComponent(JSON.stringify(o))));
  const dec = (s) => JSON.parse(decodeURIComponent(escape(atob(s.trim()))));

  const net = KM.net = {
    active: false, pc: null, dc: null, role: null, humans: 2, DELAY: 3,
    inbox: {}, pending: [], hashes: {}, ping: 0, lag: 0, waitT: 0,

    // ---------- tela de conexão ----------
    menu(action) {
      const box = $('#mpbox');
      if (action === 'host') this.host();
      if (action === 'join') {
        box.innerHTML = `<p class="muted">Cole aqui o <b>código do anfitrião</b>:</p><textarea id="mpin" rows="4"></textarea>
          <button class="mbtn primary" data-net="answer">Gerar meu código de resposta</button>`;
      }
      if (action === 'answer') this.join($('#mpin').value);
      if (action === 'accept') this.accept($('#mpin').value);
      if (action === 'copy') { const t = $('#mpout'); t.select(); navigator.clipboard && navigator.clipboard.writeText(t.value); KM.ui.toast('Código copiado!', 'ok'); }
      if (action === 'start') this.startHost();
    },
    status(html) { $('#mpbox').innerHTML = html; },
    showCode(code, next) {
      this.status(`<p class="muted">${next}</p><textarea id="mpout" rows="4" readonly>${code}</textarea>
        <button class="mbtn" data-net="copy">📋 Copiar código</button>
        ${this.role === 'host' ? `<p class="muted">Depois cole o <b>código de resposta</b> do seu amigo:</p><textarea id="mpin" rows="3"></textarea><button class="mbtn primary" data-net="accept">🔗 Conectar</button>` : '<p class="muted">Aguardando o anfitrião conectar...</p>'}`);
    },
    async gather(pc) {
      if (pc.iceGatheringState === 'complete') return;
      await new Promise((res) => {
        const to = setTimeout(res, 4000);
        pc.addEventListener('icegatheringstatechange', () => { if (pc.iceGatheringState === 'complete') { clearTimeout(to); res(); } });
      });
    },
    newPC() {
      this.close(true);
      const pc = this.pc = new RTCPeerConnection({ iceServers: ICE });
      pc.onconnectionstatechange = () => { if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) this.lost(); };
      return pc;
    },
    async host() {
      try {
        this.role = 'host';
        const pc = this.newPC();
        this.bind(pc.createDataChannel('km', { ordered: true }));
        await pc.setLocalDescription(await pc.createOffer());
        this.status('<p class="muted">Gerando código...</p>');
        await this.gather(pc);
        this.showCode(enc(pc.localDescription), 'Envie este <b>código de convite</b> para o seu amigo:');
      } catch (e) { this.status(`<div class="warn">Erro: ${KM.esc(e.message)}</div>`); }
    },
    async join(code) {
      try {
        this.role = 'guest';
        const pc = this.newPC();
        pc.ondatachannel = (e) => this.bind(e.channel);
        await pc.setRemoteDescription(dec(code));
        await pc.setLocalDescription(await pc.createAnswer());
        this.status('<p class="muted">Gerando código...</p>');
        await this.gather(pc);
        this.showCode(enc(pc.localDescription), 'Envie este <b>código de resposta</b> de volta ao anfitrião:');
      } catch (e) { this.status(`<div class="warn">Código inválido: ${KM.esc(e.message)}</div>`); }
    },
    async accept(code) {
      try { await this.pc.setRemoteDescription(dec(code)); this.status('<p class="muted">Conectando...</p>'); }
      catch (e) { this.status(`<div class="warn">Código inválido: ${KM.esc(e.message)}</div>`); }
    },
    bind(dc) {
      this.dc = dc;
      dc.onopen = () => {
        this.connected = true;
        this.pingTimer = setInterval(() => this.sendRaw({ t: 'ping', ts: performance.now() }), 2000);
        if (this.role === 'host') {
          this.status(`<div class="good">✅ Conectado!</div>
            <div class="form">
              <label>Modo<select id="mpteams"><option value="versus">1 contra 1</option><option value="coop">Cooperativo contra a IA</option></select></label>
              <label>Dificuldade da IA<select id="mpdiff"><option value="easy">Fácil</option><option value="normal" selected>Normal</option><option value="hard">Difícil</option></select></label>
              <label>Inimigos IA<select id="mpopp"><option value="0">0</option><option value="1" selected>1</option><option value="2">2</option></select></label>
              <label>Semente<input id="mpseed" placeholder="aleatória"></label>
            </div>
            <button class="mbtn primary" data-net="start">⚔️ Começar partida</button>`);
        } else this.status('<div class="good">✅ Conectado! Aguardando o anfitrião começar a partida...</div>');
      };
      dc.onmessage = (e) => this.onMsg(JSON.parse(e.data));
      dc.onclose = () => this.lost();
    },
    startHost() {
      const teams = $('#mpteams').value;
      let opp = +$('#mpopp').value;
      if (teams === 'coop' && opp < 1) opp = 1;
      const opts = { mp: true, humans: 2, teams, diff: $('#mpdiff').value, opponents: opp, aiMode: 'economy', seed: parseInt($('#mpseed').value, 10) || Math.floor(Math.random() * 1e9) };
      this.sendRaw({ t: 'start', opts });
      this.begin(opts, 0);
    },
    begin(opts, me) {
      this.active = true; this.inbox = {}; this.pending = []; this.hashes = {};
      KM.startGame(Object.assign({}, opts, { me }));
    },

    // ---------- lockstep ----------
    queue(c) { this.pending.push(c); },
    ready(turn) {
      if (turn < this.DELAY) return true;
      const box = this.inbox[turn];
      if (!box) return false;
      for (let o = 0; o < this.humans; o++) if (!box[o]) return false;
      return true;
    },
    take(turn) {
      const box = this.inbox[turn] || {};
      delete this.inbox[turn];
      this.waitT = 0; this.lag = 0;
      const out = [];
      for (let o = 0; o < this.humans; o++) for (const c of box[o] || []) { c.o = o; out.push(c); }
      return out;
    },
    send(turn) {
      const target = turn + this.DELAY;
      const cmds = this.pending; this.pending = [];
      (this.inbox[target] = this.inbox[target] || {})[KM.me] = cmds;
      this.sendRaw({ t: 'turn', n: target, o: KM.me, c: cmds });
    },
    stalled(el) {
      this.waitT += el; this.lag = this.waitT;
      if (this.waitT > 3 && !this.warned) { this.warned = true; KM.ui.toast('⏳ Aguardando o outro jogador...', 'warn'); }
    },
    sendHash(turn, h) { this.hashes[turn] = h; this.sendRaw({ t: 'hash', n: turn, h }); },
    sendRaw(o) { try { if (this.dc && this.dc.readyState === 'open') this.dc.send(JSON.stringify(o)); } catch (e) { /* ok */ } },
    onMsg(m) {
      if (m.t === 'turn') { (this.inbox[m.n] = this.inbox[m.n] || {})[m.o] = m.c; this.warned = false; }
      else if (m.t === 'start') { this.begin(m.opts, 1); }
      else if (m.t === 'ping') this.sendRaw({ t: 'pong', ts: m.ts });
      else if (m.t === 'pong') this.ping = Math.round(performance.now() - m.ts);
      else if (m.t === 'hash') { const mine = this.hashes[m.n]; if (mine != null && mine !== m.h && !this.desync) { this.desync = true; KM.ui.toast('⚠️ Dessincronização detectada entre os jogadores.', 'danger'); } }
      else if (m.t === 'chat') KM.ui.toast(`💬 ${m.name}: ${m.m}`, 'info');
      else if (m.t === 'bye') this.lost();
    },
    chatPrompt() {
      const msg = prompt('Mensagem para o outro jogador:');
      if (!msg) return;
      const name = KM.S.players[KM.me].name;
      this.sendRaw({ t: 'chat', m: msg.slice(0, 200), name });
      KM.ui.toast(`💬 Você: ${msg.slice(0, 200)}`, 'ok');
    },
    lost() {
      if (!this.active && !this.connected) return;
      const wasActive = this.active;
      this.active = false; this.connected = false;
      clearInterval(this.pingTimer);
      if (wasActive && KM.S) {
        KM.ui.toast('🔌 O outro jogador desconectou. A partida continua localmente.', 'danger');
        const other = KM.me === 0 ? 1 : 0;
        if (KM.S.players[other]) { KM.S.players[other].human = false; KM.setupAI(KM.S, other, { mode: 'economy', peace: 0 }, KM.S.diff); }
      }
    },
    close(silent) {
      if (this.dc) { try { this.sendRaw({ t: 'bye' }); this.dc.close(); } catch (e) { /* ok */ } }
      if (this.pc) { try { this.pc.close(); } catch (e) { /* ok */ } }
      clearInterval(this.pingTimer);
      this.dc = null; this.pc = null; this.active = false; this.connected = false;
    },
  };
})(window.KM);
