# Pedras e minérios — assets originais

Criados no Blender 5.2.2: rochas mais naturais, com massas assimétricas,
superfícies fraturadas, erosão, fissuras e variação mineral contínua.
Os oito assets aprovados são usados no jogo, com instâncias e material toon.
Se um GLB não carregar, o renderer mantém o modelo procedural correspondente.

- `resources.blend`: conjunto editável, com cores por vértice e cena de apresentação.
- `stone_A.glb` a `stone_E.glb`: cinco silhuetas, de lajes baixas a rochas verticais, com musgo discreto.
- `coal.glb`: cinco blocos de carvão negro com faces de fratura, arestas
  lascadas e fissuras entre os blocos; toda a massa é carvão, sem rocha cinza.
- `coal-preview.png`: aproximação do carvão revisado, renderizada no Blender.
- `ironore.glb`: depósitos irregulares em tons de ferrugem.
- `goldore.glb`: veios dourados cruzando a superfície.
- `resources-preview.png`: apresentação renderizada, 1600 × 1000 pixels.
- `manifest.json`: contagens e dimensões reais de cada exportação.
- `resources-in-game-close.png`: captura anterior à revisão do carvão, gerada da página de avaliação,
  carregando o motor real do jogo. A imagem não foi aberta para inspeção
  visual, conforme solicitado pelo usuário.

Para avaliar ao vivo, inicie o servidor pelo `Jogar.bat` e abra
`http://localhost:8080/tools/resources-preview.html`. Os botões alternam
aproximação e vista do jogo. A prévia usa o carregamento normal dos assets,
o material toon e o pós-processamento do jogo, permanece pausada e desabilita
salvamento; apenas o cenário de avaliação é montado na sessão do iframe.

## Uso

Cada GLB contém uma malha, um material e cores de vértice; não há texturas,
câmeras, luzes, dependências externas ou animações. As superfícies têm normais
facetadas pequenas, fraturas maiores e cores interpoladas para que os
depósitos minerais acompanhem a superfície sem peças flutuantes.

O Blender usa Z para cima; os GLBs usam Y para cima. O pivô está no centro
da base, com altura mínima zero, e a largura é aproximadamente 0,24–0,37
unidade do jogo, compatível com os recursos atuais antes da escala aplicada
pelo renderer. Os objetos ficam separados na cena `.blend` para avaliação;
essa posição de apresentação não é aplicada às exportações.

Os nomes correspondem aos recursos `stone`, `coal`, `ironore` e `goldore`.
`js/render3d.js` preserva o atributo `COLOR_0`, o material toon, o pivô e
o carregamento instanciado. A coleção `Presentation_only`
contém apenas chão, textos, câmera e iluminação da prévia.

## Reproduzir e verificar

Na raiz do projeto, em PowerShell:

```powershell
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --factory-startup --python-exit-code 1 --python tools/create-resources.py
node tools/check-resources.js
node --experimental-vm-modules tools/check-resources-preview.js
```

O gerador usa sementes fixas e substitui os arquivos deste pacote. Ele verifica
malhas fechadas, base no chão, limites finitos e orçamento abaixo de 1800
triângulos por asset. O verificador lê os buffers reais dos GLBs e confere
índices, triângulos não degenerados, normais, paleta, pivô, ausência de
dependências externas e estrutura dos arquivos de entrega. Esta revisão
tem aproximadamente 1140–1192 triângulos nas pedras, no ferro e no ouro: mais detalhes que
a versão inicial. Ainda não houve benchmark de uma partida completa.

O carvão revisado tem 252 triângulos e material com brilho discreto. Sua
paleta escura e faces mais claras também funcionam na conversão toon da
prévia. Os sete GLBs já aprovados foram preservados. Para atualizar apenas
o carvão no conjunto existente, sem reconstruir os outros recursos:

```powershell
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --factory-startup --python-exit-code 1 --python tools/create-resources.py -- --update-coal
```

O teste usa o carregamento e a preparação do renderer normal, o GLTFLoader,
a simulação e InstancedMesh reais, com DOM e chamadas WebGL simulados.
Verifica oito modelos, fallback para asset ausente/inválido, cena pausada,
salvamento desabilitado e alternância entre as duas câmeras. Não valida
aparência visual nem desempenho gráfico. A captura em navegador não tem
relatório DOM associado; a segunda tentativa foi bloqueada pela ferramenta.

Arte original criada para este projeto, sem modelos externos reutilizados.
