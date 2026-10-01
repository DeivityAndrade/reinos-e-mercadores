# Multijogador para até 4 jogadores — design

Data: 2026-10-01 · Branch: `feat/mp-4-jogadores`

## Objetivo

Permitir partidas online com **2 a 4 humanos** simultâneos na sala por código, mantendo
o jogo sem servidor (WebRTC P2P + ntfy.sh só para o encontro) e o lockstep determinístico.

Sucesso:
- 4 abas/navegadores entram na mesma sala de 5 letras e jogam a mesma partida sem dessincronizar.
- Anfitrião escolhe modo (Todos contra todos, Coop contra IA, 2×2), dificuldade, nº de IAs nas vagas livres e semente.
- Queda de um convidado não trava nem dessincroniza os demais.

Fora do escopo: modo manual (códigos longos) para mais de 2; reconexão; espectador; servidor próprio.

## Estado atual (antes)

- `js/net.js`: um único `pc`/`dc`. Sala aceita 1 convidado e responde `full` aos demais.
  `start` envia `me: 1` fixo. `lost()` assume `other = 1 - me`. Lockstep (`ready`/`take`) já itera `humans`.
- `KM.skirmishConfig` (`js/world.js`): `teams` = `'versus'|'coop'`. IAs sempre `team: 9` (aliadas entre si).
- Mapa procedural e paz por quadrantes já suportam 4 reinos.

## Arquitetura: estrela via anfitrião

- Anfitrião = slot 0. Mantém `peers[slot] = { pc, dc, id }` para slots 1–3.
- Convidado mantém só `peers[0]` (o anfitrião).
- Toda mensagem de convidado (`turn`, `hash`, `chat`) chega ao anfitrião, que a processa e
  **repassa** aos outros convidados (exceto o remetente). Mensagens do anfitrião vão em broadcast.
- Convidado não sabe da topologia: continua enviando ao "único par".

### Sinalização (sala por código)

1. Anfitrião abre a sala e escuta o tópico ntfy até a partida começar (não fecha após o 1º).
2. `hello` de um id novo → se houver vaga e a partida não começou: reserva o próximo slot livre
   (1..3), cria `RTCPeerConnection` + DataChannel, envia `offer` com `{ to, slot, sdp }`.
   Caso contrário responde `full`.
3. `answer` com `to === myId` → aplica no peer daquele convidado (pelo `from`).
4. Convidado guarda o slot vindo do `offer`; fecha o ntfy após enviar `answer` (igual hoje).
5. Ao começar a partida o anfitrião fecha o ntfy.

Se um convidado desconectar **no lobby**, o slot é liberado e a lista atualiza.
Slots são compactados ao começar: humanos recebem `me` = 0..N-1 na ordem dos slots ocupados.

### Lobby

- Anfitrião vê a lista de vagas: `Jogador 1 (você)`, `Jogador 2 ✅`, `Aguardando...`.
- Campos: Modo (`versus` = Todos contra todos, `coop` = Coop contra IA, `2x2`), Dificuldade da IA,
  IAs nas vagas livres (0..4−humanos; no 2×2 é fixo e desabilitado; no coop mínimo 1), Semente.
- "Começar" habilitado com ≥ 1 convidado conectado.
- Convidado vê "Conectado! N jogadores na sala. Aguardando o anfitrião..." (anfitrião envia
  `{ t: 'lobby', n }` a cada mudança).

### Início

`opts = { mp: true, humans: N, teams, diff, opponents, aiMode: 'economy', seed }`.
Anfitrião envia a cada convidado `{ t: 'start', opts, me }` com o `me` daquele convidado e chama `begin(opts, 0)`.
`net.humans = N`; `net.DELAY = N > 2 ? 4 : 3` (convidado ajusta o mesmo a partir de `opts.humans`).

## Times (`KM.skirmishConfig`)

| Modo | Humanos | IAs | Total |
|------|---------|-----|-------|
| `versus` | `team = índice` (cada um no seu) | `team = 10 + k` (cada IA no seu) | N + opponents, máx 4 |
| `coop` | `team 0` | `team 9`, mínimo 1 | N + max(1, opponents), máx 4 |
| `2x2` | índices 0,1 → `team 0`; 2,3 → `team 1` | completam até 4 com a mesma regra por índice | sempre 4 |

Mudança consciente: no `versus` com IAs, elas deixam de ser aliadas entre si.
Escaramuça solo (humans = 1, sem `teams`) não muda.

## Lockstep

- `ready(turn)`: exige comandos de todo humano ainda ativo naquele turno (não derrubado ou `turn < dropTurn[o]`).
- `take(turn)`: humanos derrubados contribuem lista vazia a partir do `dropTurn`; devolve também
  os drops que entram em vigor nesse turno para `main.js` aplicar antes dos comandos.
- `send(turn)`: igual; o anfitrião, ao receber `turn` de convidado, guarda e repassa.
- `hash` e `chat`: anfitrião repassa; cada cliente compara/exibe como hoje.

## Queda de jogador

- **Convidado cai (anfitrião detecta)**: anfitrião calcula `n = turnoAtual + DELAY + 1`,
  completa com `[]` os turnos `< n` que faltarem do derrubado (envia esses `turn` vazios em nome dele)
  e transmite `{ t: 'drop', o, n }`. Todos (inclusive o anfitrião) aplicam no início do turno `n`:
  `players[o].human = false` + `KM.setupAI(S, o, { mode: 'economy', peace: 0 }, S.diff)`,
  e param de esperar comandos de `o` a partir de `n`.
- **Anfitrião cai (convidado detecta)**: a rede acabou. O convidado sai do modo online
  (`active = false`), converte em IA os outros humanos localmente e avisa
  "🔌 O anfitrião desconectou. A partida continua localmente." (como hoje com 2 jogadores).
- Com 2 humanos o comportamento visível fica igual ao atual.

## Arquivos afetados

- `js/net.js` — peers por slot, sala multi-convidado, relay, lobby, `drop`.
- `js/world.js` — `skirmishConfig` com `versus`/`coop`/`2x2` para N humanos.
- `js/main.js` — aplicar drops do turno antes dos comandos.
- `index.html` — ajuda do multijogador.
- `README.md`, `ROADMAP.md` — documentar 4 jogadores; marcar item do roadmap.
- `tools/check.js` — novos testes.

## Testes

Automáticos (`node tools/check.js`):
1. `skirmishConfig` com humans 2/3/4 × `versus`/`coop`/`2x2` × opponents: times e total corretos, máx 4.
2. Lockstep de `KM.net` com canais falsos em memória (1 anfitrião + 3 convidados):
   anfitrião repassa `turn` aos outros e não ao remetente; `ready` só verdadeiro com os 4 conjuntos;
   após `drop` com `n`, `ready(n)` não espera o derrubado e todos geram o mesmo `take(n)`.
3. Determinismo: 3 simulações com mesma semente e mesmos comandos (4 humanos) → mesmo `KM.checksum`.

Manual: 4 abas em `localhost`, sala por código, cada modo, fechar uma aba de convidado no meio.

## Riscos

- Latência maior pelo salto via anfitrião → `DELAY` 4 com 3+ humanos.
- Anfitrião com conexão fraca vira gargalo → documentado; servidor próprio fica pós-1.0 (já no ROADMAP).
- ntfy.sh com várias mensagens simultâneas → mensagens já filtradas por `to`/`from`.
