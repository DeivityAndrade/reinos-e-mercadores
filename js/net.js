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

    // ---------- salas por código (apresentação pelo ntfy.sh; depois a partida é direta entre os navegadores) ----------
    RELAY: 'https://ntfy.sh/',
    roomTopic(code) { return 'reinos-mercadores-sala-' + code.toLowerCase(); },
    post(msg) { return fetch(this.RELAY + this.roomTopic(this.code), { method: 'POST', body: JSON.stringify(msg) }).catch(() => this.status('<div class="warn">Sem conexão com o servidor de salas. Tente o modo manual.</div>')); },
    listen(onMsg) {
      if (this.es) this.es.close();
      const es = this.es = new EventSource(this.RELAY + this.roomTopic(this.code) + '/sse');
      es.onmessage = (e) => { try { const m = JSON.parse(e.data); if (m.event === 'message') { const d = JSON.parse(m.message); if (d.from !== this.myId) onMsg(d); } } catch (err) { /* ignora */ } };
      return new Promise((res) => { es.onopen = res; setTimeout(res, 5000); });
    },
    stopListen() { if (this.es) { this.es.close(); this.es = null; } },
    async roomHost() {
      this.role = 'host'; this.myId = 'h' + Math.random().toString(36).slice(2, 9);
      const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      this.code = Array.from({ length: 5 }, () => A[Math.floor(Math.random() * A.length)]).join('');
      this.status('<p class="muted">Abrindo sala...</p>');
      await this.listen(async (d) => {
        if (d.t === 'hello' && !this.guestId) {
          this.guestId = d.from;
          this.status('<p class="muted">Amigo encontrado! Conectando...</p>');
          const pc = this.newPC();
          this.bind(pc.createDataChannel('km', { ordered: true }));
          await pc.setLocalDescription(await pc.createOffer());
          await this.gather(pc);
          this.post({ t: 'offer', from: this.myId, to: d.from, sdp: pc.localDescription });
        } else if (d.t === 'hello' && this.guestId && d.from !== this.guestId) this.post({ t: 'full', from: this.myId, to: d.from });
        if (d.t === 'answer' && d.to === this.myId && this.pc) { await this.pc.setRemoteDescription(d.sdp); this.stopListen(); }
      });
      this.guestId = null;
      this.status(`<p class="muted">Passe este código para o seu amigo:</p><div class="roomcode">${this.code}</div>
        <button class="mbtn" data-net="copycode">📋 Copiar código</button><p class="muted">⏳ Aguardando alguém entrar na sala...</p>`);
    },
    async roomJoin(code) {
      code = (code || '').trim().toUpperCase();
      if (!/^[A-Z0-9]{5}$/.test(code)) { KM.ui.toast('O código da sala tem 5 letras/números.', 'warn'); return; }
      this.role = 'guest'; this.myId = 'g' + Math.random().toString(36).slice(2, 9); this.code = code;
      this.status('<p class="muted">Procurando a sala...</p>');
      await this.listen(async (d) => {
        if (d.to !== this.myId) return;
        if (d.t === 'full') { this.stopListen(); this.status('<div class="warn">Essa sala já está cheia.</div>'); return; }
        if (d.t === 'offer') {
          const pc = this.newPC();
          pc.ondatachannel = (e) => this.bind(e.channel);
          await pc.setRemoteDescription(d.sdp);
          await pc.setLocalDescription(await pc.createAnswer());
          await this.gather(pc);
          this.post({ t: 'answer', from: this.myId, to: d.from, sdp: pc.localDescription });
          this.stopListen();
          this.status('<p class="muted">Conectando...</p>');
        }
      });
      this.post({ t: 'hello', from: this.myId });
      // se o anfitrião não responder, avisa
      setTimeout(() => { if (!this.connected && this.role === 'guest' && this.es) this.status('<div class="warn">Sala não encontrada. Confira o código e se o anfitrião está com a sala aberta.</div><button class="mbtn" data-net="join">Tentar de novo</button>'); }, 15000);
    },

    // ---------- tela de conexão ----------
    menu(action) {
      const box = $('#mpbox');
      if (action === 'room') this.roomHost();
      if (action === 'enter') {
        box.innerHTML = `<p class="muted">Digite o <b>código da sala</b> que seu amigo passou:</p><input id="mpcode" maxlength="5" placeholder="EX: K7Q2M" class="codein">
          <button class="mbtn primary" data-net="enterok">🤝 Entrar</button>`;
        setTimeout(() => { const i = $('#mpcode'); if (i) i.focus(); }, 50);
      }
      if (action === 'enterok') this.roomJoin($('#mpcode').value);
      if (action === 'copycode') { navigator.clipboard && navigator.clipboard.writeText(this.code); KM.ui.toast('Código copiado!', 'ok'); }
      if (action === 'manual') box.innerHTML = `<p class="muted">Modo manual: troquem os códigos longos por mensagem (não usa servidor de salas).</p><div class="mgrid"><button class="mbtn" data-net="host">👑 Criar (manual)</button><button class="mbtn" data-net="join">🤝 Entrar (manual)</button></div>`;
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
      if (!silent) this.stopListen();
      this.dc = null; this.pc = null; this.active = false; this.connected = false;
    },
  };
})(window.KM);
