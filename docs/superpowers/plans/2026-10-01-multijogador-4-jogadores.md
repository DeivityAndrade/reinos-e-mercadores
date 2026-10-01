# Multijogador até 4 jogadores — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** sala por código com 2–4 humanos, modos Todos contra todos / Coop / 2×2, IA nas vagas livres, queda determinística.

**Architecture:** estrela — anfitrião (slot 0) tem um peer WebRTC por convidado e repassa `turn`/`hash`/`chat`. A queda de um convidado vira um comando sintético `leave` dentro do fluxo lockstep, então todos convertem o jogador em IA no mesmo turno.

**Tech Stack:** JS puro no navegador, WebRTC DataChannel, ntfy.sh para o encontro, testes em Node (`vm`).

**Spec:** `docs/superpowers/specs/2026-10-01-multijogador-4-jogadores-design.md`

## Global Constraints

- Máximo 4 reinos por partida (humanos + IAs).
- `net.DELAY = humans > 2 ? 4 : 3`.
- Modo manual continua 1×1.
- Escaramuça solo (humans = 1) sem mudança de comportamento.
- Textos em pt-BR, no tom dos existentes.

## Review Focus

- Convidado fecha a aba no lobby → vaga liberada, "Começar" desabilita se ficar sem convidado.
- 5º jogador digita o código → recebe "sala cheia", não derruba a sala.
- Coop com 4 humanos (sem vaga para IA) → opção bloqueada no lobby; `skirmishConfig` nunca passa de 4 reinos.
- Convidado cai no meio da partida com comandos dele já em trânsito → todos aplicam `leave` no mesmo turno, sem travar (`ready` não espera mais por ele).
- Convidado entra depois da partida começar → não recebe oferta.

---

### Task 1: Times para N humanos (`KM.skirmishConfig`)

**Files:** Modify `js/world.js:444-455` · Test `tools/check.js`

**Interfaces:** Produces `KM.skirmishConfig(opts)` aceitando `teams: 'versus'|'coop'|'2x2'` com `humans` 1..4; retorna `players` com `team` conforme a tabela da spec, total ≤ min(4, starts do mapa).

- [ ] Teste `Multijogador monta times para 2 a 4 humanos`: para humans 2..4, `versus` (humanos team = i, IAs 10+k, total = min(4, N+opp)); `coop` (humanos team 0, IAs team 9, ≥1 IA quando N ≤ 3, total ≤ 4 com N = 4); `2x2` (sempre 4 reinos, teams `[0,0,1,1]`, humanos nos primeiros índices). `KM.newState({mp:true, humans:4, teams:'versus', seed:3})` cria 4 jogadores humanos.
- [ ] Rodar `node tools/check.js` → falha no novo teste.
- [ ] Implementar.
- [ ] Rodar → todos passam. Commit.

### Task 2: Rede em estrela, lobby e queda determinística

**Files:** Modify `js/net.js` (reescrita da camada de transporte, lockstep mantido) · `js/cmd.js` (comando `leave`) · Create `tools/net-check.js`

**Interfaces:**
- `net.peers`: `{ [slot]: { id, pc, dc, o } }` (`o` = índice do jogador após o início).
- `net.sendRaw(obj, exceptSlot?)` — broadcast a todos os peers abertos.
- `net.onMsg(m, slot)` — `slot` = de qual peer veio.
- `net.drops`: `{ [o]: n }`; `ready`/`take` ignoram `o` a partir de `n`; `take(n)` inclui `{ c: 'leave', o }` antes dos comandos.
- `net.turn` = último turno passado a `send`.
- `net.dropPeer(slot)` (anfitrião): `n = turn + DELAY + 1`, preenche com `[]` os turnos faltantes de `o` em `[max(DELAY, last[o]+1), n)`, transmite `turn` vazios + `{ t:'drop', o, n }`.
- `KM.exec` `leave`: `players[o].human = false` + `KM.setupAI(S, o, { mode: 'economy', peace: 0 }, S.diff)`; aviso ao jogador local.
- Mensagens novas: `{t:'lobby', n, slot}`, `{t:'start', opts, me}`, `{t:'drop', o, n}`.

- [ ] Teste (`tools/net-check.js`, carrega `config/util/.../cmd/net` num `vm` com DOM falso e 4 instâncias de `net` ligadas por canais falsos): relay do anfitrião não volta ao remetente; `ready(DELAY)` só é verdadeiro com os 4 humanos; após `dropPeer`, todos os clientes produzem o mesmo `take(n)` contendo `leave` e `ready(n+1)` não espera o derrubado; `hello` com sala cheia recebe `full`.
- [ ] Rodar → falha.
- [ ] Implementar.
- [ ] Rodar `node tools/net-check.js` e `node tools/check.js` → passam. Commit.

### Task 3: Determinismo com 4 humanos

**Files:** Test `tools/check.js`

- [ ] Teste `Quatro humanos com os mesmos comandos geram o mesmo estado`: 3 estados `newState({mp:true, humans:4, teams:'versus', seed:11})`, mesma sequência de comandos (`build` de cada jogador + `leave` do jogador 3 no meio), `KM.checksum` igual nos 3 após 600 passos.
- [ ] Rodar → passa (cobre Task 1 + `leave`). Commit.

### Task 4: Interface e documentação

**Files:** `index.html` (ajuda, `foot`), `README.md`, `ROADMAP.md`

- [ ] Ajuda do multijogador: até 4 jogadores, modos, queda vira IA, anfitrião caindo encerra a rede.
- [ ] README tabela de modos + seção da versão; ROADMAP: item "até 4 humanos" feito.
- [ ] Teste manual: servidor local + 4 abas (se o ambiente permitir).
- [ ] Commit.
