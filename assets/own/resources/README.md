# Pedras e minérios — assets originais

Criados no Blender 5.2.2 para a natureza facetada da vila medieval ilustrada.
Este pacote está em avaliação; ainda não substitui os modelos do jogo.

- `resources.blend`: conjunto editável, com paleta por face e cena de apresentação.
- `stone_A.glb` a `stone_E.glb`: cinco silhuetas, de lajes baixas a rochas verticais, com musgo discreto.
- `coal.glb`: carvão escuro em camadas largas sobre rocha.
- `ironore.glb`: depósitos quebrados em tons de ferrugem.
- `goldore.glb`: veios estreitos e ramificados em dourado.
- `resources-preview.png`: apresentação renderizada, 1600 × 1000 pixels.
- `manifest.json`: contagens e dimensões reais de cada exportação.

## Uso

Cada GLB contém uma malha, um material e cores de vértice; não há texturas,
câmeras, luzes, dependências externas ou animações. As superfícies têm normais
facetadas e as inclusões minerais acompanham a superfície da rocha.

O Blender usa Z para cima; os GLBs usam Y para cima. O pivô está no centro
da base, com altura mínima zero, e a largura é aproximadamente 0,24–0,37
unidade do jogo, compatível com os recursos atuais antes da escala aplicada
pelo renderer. Os objetos ficam separados na cena `.blend` para avaliação;
essa posição de apresentação não é aplicada às exportações.

Para integração futura, os nomes correspondem aos recursos `stone`, `coal`,
`ironore` e `goldore`. Preserve o atributo `COLOR_0` ao usar o material toon
do jogo e mantenha o carregamento instanciado. A coleção `Presentation_only`
contém apenas chão, textos, câmera e iluminação da prévia.

## Reproduzir e verificar

Na raiz do projeto, em PowerShell:

```powershell
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --factory-startup --python tools/create-resources.py
node tools/check-resources.js
```

O gerador usa sementes fixas e substitui os arquivos deste pacote. Ele verifica
malhas fechadas, base no chão, limites finitos e orçamento abaixo de 400
triângulos por asset. O verificador lê os buffers reais dos GLBs e confere
índices, triângulos não degenerados, normais, paleta, pivô, ausência de
dependências externas e estrutura dos arquivos de entrega.

Arte original criada para este projeto, sem modelos externos reutilizados.
