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
| **Campanha "A Reunificação de Aldor"** | 14 missões com briefing, objetivos, aliados e até 3 inimigos simultâneos |
| **Escaramuça** | Mapa procedural ou feito no editor, 1 a 3 oponentes, aliado opcional, IA com economia real ou em ondas |
| **Multijogador online** | P2P direto entre dois navegadores (WebRTC, sem servidor), 1 contra 1 ou cooperativo contra a IA, com chat |
| **Editor de mapas** | Terreno, relevo, árvores, rochas, minérios, até 4 bases e casas prontas. Salva localmente e exporta/importa arquivos |

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

## 🎨 Visual 3D (Three.js)
- **Terreno com relevo**, água com reflexos animados, sombras suaves, sombras de nuvens passando sobre o mapa.
- **Prédios da KayKit** nas 4 cores de jogador (azul, vermelho, verde, amarelo): armazém-mercado, igreja-escola, taverna, serraria, moinho de vento com pás girando, minas, ferrarias, quartel, torres e casas, com adereços (barris, caixotes, madeira, pedras, cercados com porcos e cavalos animados).
- **Obras em etapas** com andaime e pilhas de material; prédios destruídos viram ruínas com fumaça.
- **Personagens animados** (76 animações): andam, cortam árvores, quebram pedra, colhem, carregam madeira e sacos, lutam, atiram, bloqueiam e morrem. Capas na cor do time; cavaleiros e batedores montados em cavalos animados.
- **Menu principal** com uma vila viva ao fundo e a câmera girando devagar.
- **Sons e música procedurais** com volume pela distância da câmera.

## 📦 Créditos dos modelos (todos CC0, domínio público)
- **KayKit – Medieval Hexagon Pack** e **KayKit – Character Pack: Adventurers**, por Kay Lousberg (kaylousberg.com)
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
js/render3d.js    motor 3D: terreno, água, névoa, instâncias, prédios, personagens, câmera
js/ui.js          painéis, abas, minimapa, briefing, menus
js/input.js       mouse, teclado, seleção por raio no relevo
js/editor.js      editor de mapas
js/net.js         multijogador WebRTC com lockstep
js/main.js        laço de 20 ticks/s, lockstep, salvar/carregar, sons e música
```

**Determinismo:** a simulação usa um RNG próprio guardado no estado do jogo e roda em ticks fixos. Todas as ações dos jogadores passam por `js/cmd.js`. Com isso, dois computadores com a mesma semente e os mesmos comandos chegam exatamente ao mesmo estado.

## ⚖️ Diferenças em relação ao original
- A arte vem de pacotes livres (estilo "low-poly" moderno), não dos sprites do KaM, que são protegidos por direitos autorais.
- Algumas casas compartilham o mesmo modelo (ex.: ferrarias e fundições); por isso elas têm uma placa com o ícone no telhado.
- As missões e o roteiro são novos, não a campanha original.
- O multijogador é para 2 humanos (mais IAs). O original suportava até 8 jogadores via LAN.
