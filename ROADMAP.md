# 🗺️ Roadmap — O Último Feudo

Estado atual do código: **v0.8.0**, conferido em **02/10/2026** (`KM.VERSION` em `js/config.js`). Implementados: Tutorial (26 passos), Conquista (10 fases), Campanha (14 missões), Escaramuça, Multijogador por sala (2 a 4 humanos; até 4 reinos contando as IAs), Editor de mapas, PWA com cache sob demanda e controles de celular/tablet.

As entregas abaixo refletem o código local. Os próximos marcos são propostas, sem prazo de entrega; prioridades podem mudar conforme os testes com jogadores. A disponibilidade da publicação online não foi verificada nesta revisão.

---

## ✅ Já entregue (v0.1 → v0.8)

| Versão | Destaques |
|---|---|
| ≤ v0.4 | Economia por estradas, 27 construções / 28 recursos, Escola e profissões, exército em grupos, IA, campanha de 14 missões, editor, registro de mensagens, PWA |
| v0.5 | Mercado, estrada inteligente (A*), prioridade de obra, alertas no minimapa, tendência de recursos, ponto de encontro, casas em chamas, vila viva, otimização de malhas (24,6 → 14,2 ms/quadro) |
| v0.5+ | Modo Conquista (10 fases, coroas), arte própria por código, 6 tipos de mapa, 4 estratégias de IA, multijogador por código de sala, áudio gravado CC0, controles de toque |
| v0.6 | IA econômica sem trapaça, combate por flanco e linha de visão, tutorial de 26 passos, biomas (Outono, Pântano, Tundra) |
| v0.7 | Começo enxuto, obras mais longas, paz territorial por quadrantes, rota das tropas, bordas do mapa, personagens Quaternius; salas com até 4 humanos, times e substituição de convidado por IA |
| v0.8 | Rotação de construções e portas em quatro direções, Quartel liberado pela Serraria, Camponês armado sem armas, círculo de alcance das casas e torres; regressões de rotação e recrutamento |

Também já existem pesca e vinícola/vinho, exportação/importação de mapas por arquivo, checksum periódico com aviso de dessincronização e testes de determinismo com quatro humanos. Esses recursos não são entregas futuras.

**Validação local em 02/10/2026:** com Node.js v24.19.0, `node tools/check.js` passou em 25 grupos e `node tools/net-check.js` em 4 grupos. Isso cobre simulação, salvar/carregar, regras da v0.8, times, repasse de comandos, sala cheia e desconexão com canais falsos. Não houve teste em navegadores reais, medição em celular, verificação da publicação ou execução de `--balance` nesta revisão. Não há workflow de CI no repositório.

---

## 🎯 Próximo marco — Estabilidade e qualidade (curto prazo)

Objetivo: consolidar o que existe antes de crescer.

- **Testes automáticos no CI:** rodar `tools/check.js` e `tools/net-check.js` a cada PR via GitHub Actions. Avaliar uma execução de balanceamento separada; hoje `--balance` roda três sementes por até 40 minutos de simulação cada e não oferece modo curto.
- **Sincronia em condições reais:** ampliar a cobertura existente de checksum/determinismo com partidas WebRTC de 2, 3 e 4 humanos, latência, aba em segundo plano e quedas. A detecção com aviso já existe; falta validar sessões longas em rede real.
- **Reconexão no multijogador:** retomar a partida se a conexão WebRTC cair, a partir do último estado confirmado. Hoje o convidado que cai vira IA; a queda do anfitrião encerra a sessão compartilhada e os convidados continuam localmente.
- **Migração dos saves:** definir compatibilidade entre versões e migrar formatos antigos. Hoje `KM.VERSION` identifica a versão nos metadados, `KM.SAVE_V` controla a compatibilidade de formato, saves antigos incompatíveis são rejeitados com aviso e há ajustes pontuais no carregamento.
- **Desempenho em celular:** medir quadros por segundo em aparelho médio com 200+ unidades; ajustar o nível "baixo" de qualidade (sombras, pós-processamento, densidade de grama).
- **Organização do código:** `render3d.js` e `art.js` ainda concentram terreno, câmera, pós-processamento e arte. Os personagens Quaternius já estão em `people.js`; avaliar outras separações conforme a necessidade.
- **Revisão de balanceamento da v0.8:** avaliar começo enxuto (2 construtores, 2 carregadores, 55 ouros), obras +50%, Quartel antecipado e Camponês armado em simulações e partidas humanas. As regressões de regras não substituem essa avaliação.
- **Offline/PWA:** validar instalação e uso sem rede, explicitar o cache sob demanda e avaliar download prévio dos assets. Hoje os pedidos de áudio em streaming (Range) não são armazenados pelo service worker.

**Critérios propostos:** CI verde em todo PR; 10 partidas de rede real de 30 minutos cobrindo 2, 3 e 4 humanos sem *desync*; política de saves documentada e testada com arquivos das versões suportadas; instalação/offline conferidos em navegador e desempenho medido em celular. Esses critérios ainda não foram demonstrados pelos testes locais.

---

## 🏰 v0.9 — Conteúdo e profundidade (médio prazo)

Objetivo: mais motivo para voltar ao jogo.

- **Novas construções e cadeias:** muralhas e portões; definir outras cadeias após os testes de balanceamento. Pesca e vinícola/vinho já estão implementadas.
- **Unidades:** arqueiros montados, máquinas de cerco (aríete/catapulta) ligadas à estratégia "Cerco" da IA.
- **Clima e estações:** inverno reduz colheita (estender a regra da Tundra), chuva desacelera tropas.
- **Conquista estendida:** fases XI–XV com novos biomas (deserto, litoral/ilhas) e objetivos de comércio.
- **Editor de mapas 2.0:** gatilhos e objetivos simples (para criar missões próprias) e compartilhamento por código. Exportação/importação por arquivo já existe.
- **Replays:** como a simulação é determinística, gravar só a semente + comandos e reproduzir a partida.
- **Acessibilidade:** modo daltônico para as cores dos reinos, tamanho de fonte da interface, legendas para avisos sonoros.

**Critérios propostos:** ao menos 3 construções adicionais às já existentes, com escopo definido e balanceado, 5 novas fases e replays funcionando.

---

## 👑 v1.0 — Lançamento

Objetivo: versão "completa" para divulgar.

- **Polimento geral:** revisão de textos (pt-BR), ajuda e tooltips; tela de créditos completa.
- **Idiomas:** inglês e espanhol (extrair textos de `ui.js`, `campaign.js` e `tutorial.js` para arquivos de tradução).
- **Conquistas/estatísticas do jogador:** total de partidas, coroas, recordes, guardados localmente.
- **Página do jogo:** trailer curto, capturas de tela (usar `tools/shot.js`), publicação em itch.io além do GitHub Pages.
- **Teste aberto:** rodada de testes com jogadores reais e coleta de feedback antes de fechar a versão.

**Pronto quando:** sem bugs críticos conhecidos, 3 idiomas, página publicada.

---

## 🔭 Depois da v1.0 (ideias)

- Modo espectador no multijogador (até 4 humanos já é possível desde a v0.7).
- Servidor de encontro próprio (hoje usa o ntfy.sh público).
- Ranking online opcional para a Conquista (melhores tempos).
- Suporte a mods: dados de `js/config.js` carregáveis por arquivo JSON.
- Campanha nova com história própria.

---

## ⚠️ Riscos e dependências

| Risco | Mitigação |
|---|---|
| Dependência do ntfy.sh para o encontro no multijogador | Manter o modo manual; avaliar servidor próprio pós-1.0 |
| Desempenho em celulares fracos | Medir no próximo marco de estabilidade e manter o nível gráfico "baixo" |
| *Desync* com novas mecânicas | Levar as regressões de checksum ao CI e validar sessões reais de rede |
| Arquivos grandes e difíceis de manter | Avaliar separação de responsabilidades no próximo marco de estabilidade |
| Licenças dos assets | Usar só CC0/MIT e registrar em `assets/*/CREDITS` |
