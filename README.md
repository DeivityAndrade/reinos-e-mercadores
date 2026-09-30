# ⚜️ Reinos & Mercadores

Um jogo de estratégia econômica medieval em tempo real, **inspirado em Knights and Merchants (1998)**, refeito com qualidade de vida de 2026.
Mundo em **3D estilizado com câmera 2.5D** (Three.js), com modelos feitos por artistas e licença livre (CC0).

> "Knights and Merchants" é marca registrada dos seus donos. Este é um projeto de fã original, com nome e código próprios. Nenhum arquivo do jogo original é usado.

## ▶️ Como jogar

Dê dois cliques em **`Jogar.bat`**. Ele liga um pequeno servidor local e abre o jogo no navegador (Chrome, Edge ou Firefox).
Deixe a janela preta aberta enquanto joga; feche-a para encerrar.

> Abrir o `index.html` direto não funciona mais: o navegador bloqueia o carregamento dos modelos 3D a partir de arquivos locais.

**Câmera:** `WASD`/setas/bordas movem · roda do mouse aproxima · **botão do meio arrastado gira e inclina** · `,` e `.` giram · botão direito arrastado (sem tropas selecionadas) arrasta o mapa.

## 🎮 Modos

| Modo | Descrição |
|---|---|
| **👑 Conquista** (estilo KaM) | 10 fases em que o objetivo é sempre **eliminar todos os reinos rivais**: 1 rival nas fases I a III, 2 nas IV a VI e 3 nas VII a X, mais fortes a cada fase. Rivais com personalidade (equilibrado, agressivo, construtor, fortificado), fases com rivais aliados entre si ou "todos contra todos". Desafios opcionais valem coroas (até 4 por fase) |
| **Campanha "A Reunificação de Aldor"** | 14 missões com briefing, objetivos, aliados e até 3 inimigos simultâneos |
| **Escaramuça** | Mapa procedural ou feito no editor, 1 a 3 oponentes, aliado opcional, IA com economia real ou em ondas |
| **Multijogador online** | P2P direto entre dois navegadores (WebRTC, sem servidor), 1 contra 1 ou cooperativo contra a IA, com chat |
| **Editor de mapas** | Terreno, relevo, árvores, rochas, minérios, até 4 bases e casas prontas. Salva localmente e exporta/importa arquivos |

## 🆕 Novidades da versão 0.4
- **Tutorial interativo** (botão 🎓 no menu ou Missão I): 13 passos guiados, com destaque nos botões e uma seta no mapa. Os passos avançam sozinhos quando você faz a ação pedida.
- **Aviso "⚠ sem estrada"** sobre qualquer casa que não esteja ligada ao Armazém, o erro mais comum de quem está começando.
- **Visual:** chão com textura e variação de tons, sombra nos vales (oclusão), grama alta e flores balançando ao vento, árvores com vento.
- **Áudio:**
  - Música medieval com alaúde dedilhado, flauta doce, sanfona e tambor, com reverberação de salão.
  - São 5 peças compostas na hora, mais uma trilha de batalha.
  - Efeitos refeitos com som posicional estéreo e vento ambiente.
  - Vozes dos soldados opcionais.
- **Opções** (aba ⚙️): volume geral, de música e de efeitos; qualidade gráfica (alta, média ou baixa, para PCs fracos); rolar pela borda da tela.
- **IA mais esperta:**
  - Defende a própria cidade quando é atacada.
  - Reúne o exército antes de atacar, em vez de mandar soldados aos poucos.
  - Encomenda nas oficinas só o que falta.
  - O tamanho dos ataques foi calibrado por dificuldade.
- **Estatísticas da partida** com gráficos (cidadãos, soldados, casas e recursos ao longo do tempo) e uma tabela por jogador, na tela final e na aba Objetivos.
- **Mensagens recentes** na aba Objetivos, e a tecla `Z` leva até o último aviso.
- **Conselheiro 🧙:** avisa quando acaba o ouro (e a Escola para), a pedra ou a madeira com obras esperando, ou quando o povo passa fome. Ele também diz o que construir para resolver.
- **Balanceamento testado:** um "jogador justo" automático (mesma cidade inicial que você, sem bônus, seguindo a árvore de progressão) vence a IA do Normal em cerca de 2 de 3 partidas. Ele chega ao Quartel aos 3 a 4 minutos. O ouro inicial passou para 40, e soldados parados reagem a inimigos a até 9 casas de distância.
- **Instalável e offline (PWA):** no Chrome ou Edge, use "Instalar aplicativo" na barra de endereço. Depois de aberto uma vez, funciona sem internet.

## 🧪 Ferramenta de balanceamento
`tools/sim.js` simula partidas inteiras sem desenhar nada: 40 minutos de jogo rodam em poucos segundos. Com o jogo aberto, cole no console do navegador:
```js
const s = document.createElement('script'); s.src = 'tools/sim.js'; document.body.appendChild(s);
KM.sim.bots({ seed: 7, minutes: 40 })               // IA contra IA, registro a cada 5 minutos
KM.sim.bots({ seed: 7, minutes: 40, fair: true })   // "jogador justo" (como um humano) contra a IA
```


## ⚖️ Mercado e novas mecânicas (v0.5)
- **Mercado** (liberado depois da Taverna e da Pedreira):
  - Troque o que sobra pelo que falta: escolha o que vender e o que comprar e encomende trocas.
  - Os carregadores levam a mercadoria até o Mercado, e o que foi comprado vai para o Armazém.
  - Os preços seguem o valor de cada recurso, mais 50% de taxa do mercador. Não substitui a produção, mas salva quando falta ouro ou pedra.
- **Estrada inteligente:** ao arrastar, a estrada contorna casas, árvores e água e aproveita as estradas que já existem.
- **Prioridade de obra:** ☆ no painel da obra. Construtores e carregadores atendem essa obra primeiro, e uma ⭐ aparece sobre ela.
- **Alertas no minimapa:** ataques e avisos piscam no minimapa.
- **Tendência dos recursos:** a barra do topo mostra quanto cada recurso sobe ou desce por minuto (▲/▼).
- **Produção de cada casa:** o painel mostra quanto a casa produziu e o aproveitamento (% do tempo trabalhando), com aviso quando ela passa muito tempo parada.
- **Recuperação:** soldados bem alimentados recuperam vida devagar depois de 8 s sem lutar.
- **IA tática:**
  - Escolhe o alvo pesando distância, defesas (soldados e torres) e valor (Armazém, Escola e Quartel).
  - Recua quando o ataque fracassa, com menos de 30% das tropas.
- **Ponto de encontro do Quartel:** com o Quartel selecionado, o botão direito no mapa define onde os novos soldados se reúnem (🚩).
- **Comandos de exército:** `Tab` alterna entre seus grupos (`Shift+Tab` volta). O botão direito no minimapa manda as tropas selecionadas para lá (`Shift` = ataque-mover).
- **Casas em chamas:** construções muito danificadas pegam fogo e soltam fumaça escura. Os construtores consertam quando o inimigo sai de perto.
- **Vila viva:** cidadãos ociosos passeiam em volta do seu posto, e os carregadores circulam pelas estradas.
- **Tutorial na Conquista:** aparece na fase I para quem ainda não concluiu nem fechou o tutorial.
- **Desempenho:** as 6 partes do corpo de cada personagem viram uma malha só, e só o corpo projeta sombra. Numa batalha com 209 soldados, o tempo por quadro caiu de 24,6 ms para 14,2 ms.

- **Tipos de mapa:** continente, rio (com vaus), lagos, cordilheiras, floresta densa e planalto central (montanha rica em minério disputada por todos). Escolha na Escaramuça ou use "Surpresa". Cada fase da Conquista tem um tipo próprio, e todas as bases continuam ligadas por terra.
- **Estratégias da IA:** cada reino ataca de um jeito.
  - **Assalto:** exército concentrado.
  - **Pinça:** divide o exército, que ataca por dois lados ao mesmo tempo.
  - **Cerco:** derruba primeiro as torres.
  - **Saque:** grupos rápidos atacam fazendas, minas e lenhadores mal defendidos e recuam quando apanham.

  Na Conquista, o estilo segue a personalidade de cada reino e aparece no briefing.

## 👑 Modo Conquista
- A vitória é sempre a mesma: **eliminar todos os reinos rivais**. Um reino cai quando fica sem Armazém, Escola e Quartel prontos e sem nenhum soldado.
- **Desafios opcionais** (construir algo, formar tropas, vencer rápido) valem **coroas**: 1 pela vitória e 1 por desafio, até 4 por fase. As melhores marcas ficam salvas.
- Você sempre começa do básico, seguindo a árvore de progressão.
- A dificuldade (Fácil, Normal ou Difícil) muda a força dos rivais e o tempo de paz.
- **Testado com o "jogador justo" automático** (sem bônus, seguindo a progressão):
  - No Normal, ele vence as fases I a III em cerca de 28 minutos.
  - Nas fases intermediárias, ele derruba parte dos rivais e perde disputas apertadas.
  - A fase X o derrota. A curva de dificuldade sobe como deve.
- Os testes mostraram que as minas se esgotavam em minutos (só 10 minérios). Agora cada veio tem de 14 a 35 minérios por ladrilho, e a mina alcança 5 casas.

## 🌳 Progressão (como no original)
O jogo começa só com o básico: **Armazém, Escola, Lenhador e Pedreira**, e os profissionais correspondentes (carregador, construtor, lenhador, pedreiro). Cada construção erguida libera novas opções:

`Lenhador → Serraria → Taverna / Fazenda / Oficina de armas → Moinho → Padaria · Criação de porcos → Açougue / Curtume · Minas → Fundições → Ferrarias · Oficina de armas → Quartel → Torre / Estábulo`

- A aba **Construir** mostra os **Próximos passos** (o que construir para liberar o quê), casas bloqueadas com cadeado e o selo **NOVO** no que acabou de liberar.
- A **Escola** só treina profissões cujas casas já estão liberadas; o **Recruta** exige um Quartel.
- O **Quartel** libera soldados conforme as oficinas e ferrarias construídas (espadachins exigem as ferrarias; cavalaria exige o Estábulo).
- A **Árvore de progresso** (aba Objetivos) mostra tudo, dividido em eras.
- Na Escaramuça há a opção **"Tudo liberado (modo livre)"** para jogar sem progressão.
- As regras ficam em `KM.TECH` e `KM.SOLDIER_REQ` no `js/config.js`.

## 🏰 Mecânicas do original

- **Logística por estradas:** carregadores só entregam entre casas ligadas ao mesmo Armazém. Cada trecho de estrada custa 1 pedra.
- **Construção em etapas:** terreno de terra → nivelamento → fundação → andaime → casa pronta. Construtores também reparam casas danificadas.
- **27 recursos e 26 construções**, com todas as cadeias de produção do original.
- **Escola, 14 profissões e recrutas.** O treino automático é opcional.
- **Encomendas** nas oficinas e ferrarias, **distribuição** de carvão, ferro, trigo e madeira, **bloqueio** de recursos no Armazém, casas pausáveis.
- **Fome:** cidadãos comem na Taverna. Soldados recebem comida levada pelos carregadores e morrem se passarem fome.
- **Exército em grupos:** formação, girar, colunas, dividir, unir, alimentar, ataque-mover, anti-cavalaria e bônus de flanco.
- **Torres com recruta e pedras. IA** que constrói a cidade, planta, minera, forja armas, treina e ataca.
- **Até 4 jogadores por mapa, com times e aliados. Névoa de guerra.**

## 🎨 Direção de arte própria: "vila medieval ilustrada"
- **Personagens próprios:** 23 tipos (carregador, construtor, lenhador, padeiro com chapéu de cozinheiro, ferreiro de avental, soldados de tabardo na cor do reino, espadachins de cota de malha, cavaleiros de elmo com pluma…), com as armas de cada ofício e escudos. Cada personagem é **uma única malha** facetada, com 1 desenho por unidade. Os cavalos também são próprios, e os dos cavaleiros levam manta na cor do reino.
- **Construções feitas pelo próprio jogo** (`js/art.js`), sem modelos prontos: são 26 projetos com silhueta própria.
  - Materiais: enxaimel com reboco caiado, tábuas, toras, pedra de cantaria; telhados de palha, telha ou ardósia.
  - Exemplos: moinho de vento com pás girando, taverna com andar avançado, escola com torre do sino, quartel com ameias, mina escorada em madeira, fornalhas com brasa, chiqueiro e estábulo com animais vivos.
  - A cor do reino aparece em portas, venezianas e estandartes que tremulam.
- **Estilo pintado:**
  - Sombreamento em faixas (toon) e contorno a tinta sépia.
  - Gradação quente com sombras arroxeadas, hachuras de pena nas áreas escuras, grão de papel e vinheta.
  - Tudo isso é um pós-processamento próprio.
- **Natureza facetada:**
  - Carvalhos, pinheiros, arbustos floridos, capim, rochas com musgo e minério aparente.
  - Montanhas rochosas com estratos e fendas, e trigo balançando ao vento.
  - Chão com pinceladas e manchas de capim seco e relva fresca.
  - Água pintada: turquesa na margem, azul-profundo no meio, espuma batendo na costa.
- **Obras próprias:** terreno marcado com estacas, fundação, estrutura de madeira, paredes e andaime. Construções destruídas viram ruínas.
- **Fundação de pedra** que acompanha o relevo, com sombras longas de sol de fim de tarde e sombras de nuvens.
- **Obras em etapas** com andaime e pilhas de material; prédios destruídos viram ruínas com fumaça.
- **Personagens animados** (76 animações): andam, cortam árvores, quebram pedra, colhem, carregam madeira e sacos, lutam, atiram, bloqueiam e morrem. Capas na cor do time; cavaleiros e batedores montados em cavalos animados.
- **Menu principal** com uma vila viva ao fundo e a câmera girando devagar.
- **Sons e música procedurais** com volume pela distância da câmera e panorâmica estéreo.

## 📦 Créditos (todos CC0, domínio público)
- Construções, natureza, texturas e efeitos: **arte própria** gerada por código (`js/art.js`)
- Personagens, cavalos, porcos, roupas, chapéus, armas, escudos e itens carregados: **arte própria** gerada por código (`js/art.js`), presa aos esqueletos de animação.
- Esqueletos e animações (76 dos personagens, mais as do cavalo e do porco): **KayKit – Character Pack: Adventurers**, por Kay Lousberg (kaylousberg.com), e Quaternius. Só a sombra das nuvens usa o KayKit Medieval Hexagon Pack.
- **Animated Animal Pack** e **Farm Animal Pack**, por Quaternius (quaternius.com), via poly.pizza
- **Three.js** (licença MIT)

As licenças estão em `assets/kaykit/` e `js/vendor/three/LICENSE`.

## 🗂️ Estrutura do código

```
Jogar.bat         inicia o servidor local e abre o jogo
serve.ps1         servidor HTTP local
index.html        página, menus e ajuda (carrega o Three.js como módulo)
css/style.css     visual da interface
assets/           modelos 3D (KayKit, Quaternius)
js/vendor/three/  Three.js 0.186 + GLTFLoader + SkeletonUtils
js/config.js      DADOS: recursos, casas, receitas, profissões, soldados, distribuição, dificuldades
js/util.js        RNG determinístico, ruído, heap
js/map.js         geração de mapa com relevo, A*, malha de estradas, nivelamento
js/world.js       jogadores/times, casas, unidades, cidades iniciais, névoa por jogador
js/economy.js     carregadores, construtores, reparo, produção, escola, torres
js/units.js       movimento e tarefas dos cidadãos
js/military.js    grupos, formações, combate, fome dos soldados, projéteis
js/ai.js          IA (economia real / ondas / posto avançado), uma por jogador
js/campaign.js    14 missões, objetivos, derrota/vitória, progresso
js/cmd.js         comandos: toda ação do jogador (base do multijogador)
js/tutorial.js    tutorial interativo da Missão I
js/art.js         arte própria: texturas pintadas, materiais, construções, obras, natureza
js/render3d.js    motor 3D: terreno, água, névoa, instâncias, personagens, câmera, pós-processamento ilustrado
js/ui.js          painéis, abas, minimapa, briefing, menus
js/input.js       mouse, teclado, seleção por raio no relevo
js/editor.js      editor de mapas
js/net.js         multijogador WebRTC com lockstep
js/audio.js       sons, música e vozes procedurais (Web Audio)
js/main.js        laço de 20 ticks/s, lockstep, salvar/carregar, histórico para os gráficos
tools/sim.js      simulador de partidas para balanceamento
sw.js, manifest.webmanifest, icon.svg   modo offline e instalação como aplicativo
```

**Determinismo:** a simulação usa um RNG próprio guardado no estado do jogo e roda em ticks fixos. Todas as ações dos jogadores passam por `js/cmd.js`. Com isso, dois computadores com a mesma semente e os mesmos comandos chegam exatamente ao mesmo estado.

## ⚖️ Diferenças em relação ao original
- A arte é própria (vila medieval ilustrada, gerada por código), não os sprites do KaM, que são protegidos por direitos autorais.
- As missões e o roteiro são novos, não a campanha original.
- O multijogador é para 2 humanos (mais IAs). O original suportava até 8 jogadores via LAN.
