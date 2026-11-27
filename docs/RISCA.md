# Risca e Arrisca — desenhar e adivinhar

Jogo de festa para **2 a 8 pessoas**, com a mesma base dos outros jogos deste repositório:
a **TV** mostra o desenho, os palpites e a pontuação; cada **telemóvel** é o lápis (de quem desenha)
ou o teclado (de quem adivinha). Não é preciso instalar nada na TV.

- TV: `/risca/tv/` (no Chromecast: `https://cmmleite22-beep.github.io/ecos-de-sagres/risca/tv/?cast=1`)
- Telemóvel: `/risca/comando/` (ou só `/risca/`)

## Como jogar
1. Cada pessoa abre o comando no telemóvel e entra (código QR e código da sala, ou **Ligar ao Chromecast**).
2. Quem entrou primeiro é o **chefe da sala** e escolhe as regras: número de voltas (1 a 5), tempo para desenhar
   (45 a 120 s) e o tema. Qualquer pessoa pode tocar em **COMEÇAR**.
3. À vez, quem desenha recebe **três palavras secretas** (fácil, média e difícil) e escolhe uma em 15 segundos.
   As mais difíceis valem mais pontos (×1,3 e ×1,6). Se não escolher, o jogo escolhe por ela.
4. Desenha no telemóvel com lápis (14 cores, 4 grossuras), borracha, balde de tinta, desfazer e limpar.
   O desenho aparece na TV enquanto é feito.
5. Os outros escrevem palpites no telemóvel. Os palpites errados aparecem na TV; os certos não (aparece só "acertou!").
   - Maiúsculas, acentos, hífenes e artigos não contam: "O Golfinho" = "golfinho".
   - Se o palpite tiver só uma letra trocada (duas em palavras compridas), o telemóvel avisa **"estás quase!"**
     e a TV mostra "está quase!" sem revelar o que foi escrito.
6. Com o tempo vão aparecendo **letras de ajuda** na TV (no máximo um terço da palavra).
7. A vez acaba quando todos acertam, quando o tempo acaba ou se quem desenha desistir ou sair.
   A TV mostra a palavra e os pontos ganhos.
8. Depois de todos desenharem em todas as voltas aparece o **pódio** e a **galeria com os desenhos** do jogo.
   **JOGAR DE NOVO** volta à sala de espera.

Quem já acertou pode mandar **reações** (👏 😂 🤯 🔥 …) que sobem no ecrã da TV.

### Pontos
- Quem acerta: 40 a 150 pontos, conforme a rapidez, +20 para o primeiro, vezes o multiplicador da palavra.
- Quem desenha: 25 por cada pessoa que acerta (+20 se todos acertarem), vezes o multiplicador.
- Quem sai a meio e volta a entrar com o mesmo nome recupera os pontos.

### Temas
Tudo misturado, Animais, Comida, Casa e objetos, Natureza e lugares, Ações e profissões, Desporto e lazer,
Portugal e Açores (cerca de 420 palavras em português de Portugal, em `public/risca/palavras.js`)
e **As nossas palavras**: o chefe da sala escreve a sua lista no telemóvel (separada por vírgulas),
útil para rever vocabulário numa aula.

## Técnica
- 2D leve: o desenho é feito numa tela de 800×600 com as mesmas operações na TV e no telemóvel
  (`quadro.js`), por isso fica igual nos dois. O resto do ecrã da TV é HTML.
- O telemóvel envia os traços em pacotes pequenos de 45 em 45 ms (coordenadas inteiras), pelo servidor
  de salas (WebSocket) ou pelo canal Cast `urn:x-cast:pt.riscaearrisca.game`.
- A TV manda no jogo: só ela conhece a palavra secreta e só a envia a quem desenha (e a quem já acertou).
- O servidor de salas passou a aceitar que cada jogo peça o número de lugares (este pede 8; os outros continuam com 4).

| Ficheiro (`public/risca/`) | Responsabilidade |
|---|---|
| `config.js` | ID Cast, canal e protocolo |
| `palavras.js` | temas, palavras, comparação de palpites, letras de ajuda |
| `quadro.js` | desenho (traços, balde de tinta, desfazer), partilhado pela TV e pelo telemóvel |
| `tv/jogo.js` | regras, vezes, pontos e ecrã da TV |
| `tv/net.js`, `tv/som.js` | rede e sons |
| `comando/` | comando do telemóvel (PWA) |

## Chromecast
Aplicação Cast registada e publicada: **6179B961** (em `public/risca/config.js`). Como foi registada:
1. <https://cast.google.com/publish> → **Add new application → Custom Receiver**, nome "Risca e Arrisca",
   URL `https://cmmleite22-beep.github.io/ecos-de-sagres/risca/tv/?cast=1`.
2. Em **Sender Details → Chrome**, endereço do comando `https://cmmleite22-beep.github.io/ecos-de-sagres/risca/comando/`
   (Listing em NO) e **Save**: sem isto a consola não deixa publicar.
3. **Publish** (para não ser preciso registar o número de série da TV).

## Teste
```bash
npm start &
node tests/risca-e2e.mjs        # TV + 3 telemóveis simulados; capturas em shots/risca/
node tests/risca-cast-stub.mjs  # caminho Chromecast com o SDK simulado
```
