'use strict';
/* Ferramenta de desenvolvimento: simula partidas sem desenhar nada, em alta velocidade.
   Uso (no console do navegador, com o jogo aberto):
     const s = document.createElement('script'); s.src = 'tools/sim.js'; document.body.appendChild(s);
     KM.sim.bots({ seed: 7, minutes: 40 })          // IA contra IA (jogador 0 vira IA)
     KM.sim.run({ mission: 'm3' }, 20, hook)        // qualquer configuração de KM.newState
   Retorna um registro a cada 5 minutos com casas, cidadãos, soldados e comida de cada jogador. */
(function (KM) {
  function snapshot(S) {
    const row = { min: Math.round(S.time / 60) };
    S.players.forEach((p, o) => {
      let b = 0, h = 0, sol = 0, cit = 0;
      for (const id in S.houses) { const x = S.houses[id]; if (x.owner === o) { h++; if (x.state === 'built') b++; } }
      for (const id in S.units) { const u = S.units[id]; if (u.owner === o) { if (KM.isSoldier(u.type)) sol++; else cit++; } }
      const st = Object.values(S.houses).find((x) => x.owner === o && x.type === 'storehouse');
      const food = st ? ['bread', 'sausages', 'wine', 'fish'].reduce((a, r) => a + (st.inv[r] || 0), 0) : 0;
      row['p' + o] = `${b}/${h} casas · ${cit} cid · ${sol} sold · comida ${food}${p.out ? ' · FORA' : ''}`;
    });
    return row;
  }
  KM.sim = {
    run(opts, minutes, hook, every) {
      const keep = { rt: KM.rt, me: KM.me, simS: KM.simS };
      const S = KM.newState(opts);
      KM.rt = { comp: null, roadsDirty: true };
      KM.setMapSize(S.map.W, S.map.H);
      KM.computeRoadComps(S);
      const log = [], t0 = performance.now(), ticks = minutes * 60 * 20, per = (every || 5) * 60 * 20;
      try {
        for (let i = 0; i < ticks; i++) {
          if (hook) hook(S, i);
          KM.step(S, KM.DT);
          if (i % per === 0) log.push(snapshot(S));
          if (S.over && S.over !== 'ignored') { log.push({ fim: S.over, min: (S.time / 60).toFixed(1) }); break; }
        }
        log.push(snapshot(S));
      } finally { KM.rt = keep.rt; KM.me = keep.me; KM.simS = keep.simS; if (KM.S) KM.setMapSize(KM.S.map.W, KM.S.map.H); }
      return { ms: Math.round(performance.now() - t0), log, S };
    },
    // partida só de IAs: termina quando sobra um
    // fair: o jogador 0 começa com a cidade de um humano, sem bônus, e segue a árvore de progressão
    bots({ seed = 1, minutes = 40, diff = 'normal', opponents = 1, mode = 'economy', fair = false } = {}) {
      const cfg = KM.skirmishConfig({ diff, opponents, aiMode: mode });
      const D = KM.DIFF[diff];
      cfg.players[0] = fair
        ? { team: 0, name: 'Justo', ai: Object.assign(KM.TOWNS.human(), { mode: 'economy', fair: true, peace: D.peace + 300, mult: 1, def: 8 }) }
        : { team: 0, name: 'Bot', ai: KM.TOWNS.economy(D) };
      cfg.seed = seed;
      const sk = KM.skirmishConfig, cg = KM.checkGoals;
      KM.skirmishConfig = () => cfg;
      KM.checkGoals = (S) => {
        S.players.forEach((p, o) => {
          if (p.out) return;
          let alive = false;
          for (const id in S.houses) { const h = S.houses[id]; if (h.owner === o && ['storehouse', 'school', 'barracks'].includes(h.type) && h.state === 'built') alive = true; }
          for (const id in S.units) { const u = S.units[id]; if (u.owner === o && KM.isSoldier(u.type)) alive = true; }
          if (!alive) p.out = true;
        });
        if (S.players.filter((p) => !p.out).length <= 1) S.over = 'fim';
      };
      try { return this.run({ diff }, minutes); } finally { KM.skirmishConfig = sk; KM.checkGoals = cg; }
    },
  };
})(window.KM);
