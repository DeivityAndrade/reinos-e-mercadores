# 🗺️ Roadmap — Reinos & Mercadores

Estado atual: **v0.7** (out/2026). Jogo jogável de ponta a ponta: Tutorial, Conquista (10 fases), Campanha (14 missões), Escaramuça, Multijogador por sala, Editor de mapas, PWA offline, celular/tablet.

Este roadmap é uma proposta. Prioridades podem mudar conforme os testes com jogadores.

---

## ✅ Já entregue (v0.1 → v0.7)

| Versão | Destaques |
|---|---|
| ≤ v0.4 | Economia por estradas, 27 construções / 28 recursos, Escola e profissões, exército em grupos, IA, campanha de 14 missões, editor, registro de mensagens, PWA |
| v0.5 | Mercado, estrada inteligente (A*), prioridade de obra, alertas no minimapa, tendência de recursos, ponto de encontro, casas em chamas, vila viva, otimização de malhas (24,6 → 14,2 ms/quadro) |
| v0.5+ | Modo Conquista (10 fases, coroas), arte própria por código, 6 tipos de mapa, 4 estratégias de IA, multijogador por código de sala, áudio gravado CC0, controles de toque |
| v0.6 | IA econômica sem trapaça, combate por flanco e linha de visão, tutorial de 26 passos, biomas (Outono, Pântano, Tundra) |
| v0.7 | Começo enxuto, obras mais longas, paz territorial por quadrantes, rota das tropas, bordas do mapa, personagens Quaternius |

---

## 🎯 v0.8 — Estabilidade e qualidade (curto prazo)

Objetivo: consolidar o que existe antes de crescer.

- **Testes automáticos no CI:** rodar `tools/check.js` (e `--balance` em modo curto) a cada PR via GitHub Actions. Hoje depende de Node instalado localmente.
- **Teste de sincronia do multijogador:** verificar que duas simulações com a mesma semente e os mesmos comandos geram o mesmo hash de estado (detecção de *desync* com aviso na tela).
- **Reconexão no multijogador:** retomar a partida se a conexão WebRTC cair, a partir do último estado confirmado.
- **Versão dos saves:** migrar saves antigos (`KM.VERSION`) em vez de invalidar; avisar quando o save é de outra versão.
- **Desempenho em celular:** medir quadros por segundo em aparelho médio com 200+ unidades; ajustar o nível "baixo" de qualidade (sombras, pós-processamento, densidade de grama).
- **Organização do código:** `render3d.js` (~1,9 mil linhas) e `art.js` (~1,3 mil) concentram muita coisa; separar terreno, personagens, câmera e pós-processamento em módulos menores.
- **Revisão de balanceamento da v0.7:** confirmar com simulações que o começo enxuto (2 construtores, 2 carregadores, 55 ouros) e as obras +50% não travam a IA nem deixam a Escaramuça lenta demais.

**Pronto quando:** CI verde em todo PR, nenhum *desync* em 10 partidas de teste de 30 min, saves da v0.7 carregam na v0.8.

---

## 🏰 v0.9 — Conteúdo e profundidade (médio prazo)

Objetivo: mais motivo para voltar ao jogo.

- **Novas construções e cadeias:** pesca (água já existe nos mapas), vinícola/vinho como alimento de luxo, muralhas e portões.
- **Unidades:** arqueiros montados, máquinas de cerco (aríete/catapulta) ligadas à estratégia "Cerco" da IA.
- **Clima e estações:** inverno reduz colheita (estender a regra da Tundra), chuva desacelera tropas.
- **Conquista estendida:** fases XI–XV com novos biomas (deserto, litoral/ilhas) e objetivos de comércio.
- **Editor de mapas 2.0:** gatilhos e objetivos simples (para criar missões próprias), compartilhamento por código/arquivo.
- **Replays:** como a simulação é determinística, gravar só a semente + comandos e reproduzir a partida.
- **Acessibilidade:** modo daltônico para as cores dos reinos, tamanho de fonte da interface, legendas para avisos sonoros.

**Pronto quando:** ao menos 3 novas construções, 5 novas fases e replays funcionando.

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

- Multijogador para até 4 humanos e modo espectador.
- Servidor de encontro próprio (hoje usa o ntfy.sh público).
- Ranking online opcional para a Conquista (melhores tempos).
- Suporte a mods: dados de `js/config.js` carregáveis por arquivo JSON.
- Campanha nova com história própria.

---

## ⚠️ Riscos e dependências

| Risco | Mitigação |
|---|---|
| Dependência do ntfy.sh para o encontro no multijogador | Manter o modo manual; avaliar servidor próprio pós-1.0 |
| Desempenho em celulares fracos | Medir cedo (v0.8) e manter o nível gráfico "baixo" |
| *Desync* com novas mecânicas | Teste de hash de estado no CI antes de qualquer mecânica nova |
| Arquivos grandes e difíceis de manter | Modularizar na v0.8 antes de adicionar conteúdo |
| Licenças dos assets | Usar só CC0/MIT e registrar em `assets/*/CREDITS` |
