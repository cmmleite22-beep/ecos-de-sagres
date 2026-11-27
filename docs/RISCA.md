# Risca e Arrisca — desenhar e adivinhar

Jogo de festa para **2 a 8 pessoas**, com a mesma base dos outros jogos deste repositório:
a **TV** mostra o desenho, os palpites e a pontuação; cada **telemóvel** é o lápis (de quem desenha)
ou o teclado (de quem adivinha). Não é preciso instalar nada na TV.

- TV: `/risca/tv/` (no Chromecast: `https://risca-e-arrisca.web.app/risca/tv/?cast=1`)
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

### Modos de jogo (o chefe da sala escolhe)
- **✏️ Clássico**: as regras acima.
- **👥 Equipas**: 2 a 4 equipas (Vermelha, Azul, Verde, Amarela). Cada pessoa escolhe a equipa no telemóvel;
  as equipas desenham à vez e os pontos de cada membro somam para a equipa. Uma equipa pode ter um só telemóvel
  (por exemplo, numa turma) ou vários. O pódio final é das equipas.
- **🔄 Passa o Risco** (sem pontos): todos desenham ao mesmo tempo uma palavra secreta. Cada desenho passa ao
  seguinte, que escreve o que acha que é; o seguinte desenha esse palpite, e assim por diante até cada cadeia
  dar a volta. No fim, a TV mostra cada cadeia peça a peça (o chefe da sala pode avançar com **Seguinte**).
- **🧒 Modo pequenos** (clássico e equipas): em vez de escrever, quem adivinha escolhe entre 4 palavras.
  Uma opção errada fica riscada e é preciso esperar 3 segundos para tentar outra.

### Lápis de Ouro e galeria
No fim (clássico e equipas, com 2 ou mais desenhos) há 25 segundos para votar no telemóvel no melhor desenho
(não vale votar no seu). O vencedor ganha +60 pontos e fica destacado na galeria. No ecrã final, cada pessoa pode
**guardar no telemóvel** qualquer desenho do jogo; quem acabou de desenhar também pode guardar o seu logo a seguir.

### Voltar a entrar
Cada telemóvel tem um identificador guardado. Se a ligação cair (ecrã bloqueado, rede, página recarregada),
o telemóvel volta a entrar sozinho e recupera o lugar, os pontos e até o desenho em curso. Quem está desligado
aparece esbatido na TV ("a voltar…") e tem 3 minutos para voltar; quem desenha tem 15 segundos antes de a vez acabar.

Quem já acertou pode mandar **reações** (👏 😂 🤯 🔥 …) que sobem no ecrã da TV.

### Pontos
- Quem acerta: 40 a 150 pontos, conforme a rapidez, +20 para o primeiro, vezes o multiplicador da palavra.
- Quem desenha: 25 por cada pessoa que acerta (+20 se todos acertarem), vezes o multiplicador.
- Quem sai a meio e volta a entrar com o mesmo nome recupera os pontos.

### Línguas
O jogo fala **português de Portugal, português do Brasil, inglês, espanhol, francês, alemão e chinês** (simplificado).
- Cada telemóvel mostra os textos na sua língua (escolhe-se no primeiro ecrã; por defeito, a do telemóvel).
- A **língua do jogo** (palavras e TV) escolhe-a o chefe da sala; começa na língua do telemóvel dele.
- Os palpites ignoram maiúsculas, acentos e artigos em todas as línguas («die Katze» = «Katze», «Kaese» = «Käse»);
  em chinês escreve-se com caracteres.
- Textos em `public/risca/i18n.js`; palavras em `public/risca/palavras/<língua>.js`. Para acrescentar uma língua,
  basta juntar um bloco de textos e um ficheiro de palavras (o que faltar aparece em português).

### Temas, categorias e conjuntos de palavras
Tudo misturado, Animais, Comida, Casa e objetos, Natureza e lugares, Ações e profissões, Desporto e lazer
(60 palavras por tema em cada língua, em três níveis), mais **Portugal e Açores** em português de Portugal
e **Brasil** em português do Brasil.

No telemóvel do chefe, **✏️ Categorias e palavras**:
- criar **categorias próprias** (ex.: «Ciências») e juntar-lhes **conjuntos de palavras** (ex.: «5.º ano», «Corpo humano»);
  ao escolher a categoria, joga-se com todas as palavras dos seus conjuntos;
- juntar conjuntos também a um **tema do jogo** (ex.: animais dos Açores em «Animais»): entram com as palavras que o tema já tem;
- cada conjunto fica ligado à língua em que foi criado e só entra nos jogos nessa língua;
- fica tudo guardado nesse telemóvel. As listas guardadas antes passam para a categoria «As minhas listas».

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
   URL `https://risca-e-arrisca.web.app/risca/tv/?cast=1`.
2. Em **Sender Details → Chrome**, endereço do comando `https://risca-e-arrisca.web.app/risca/comando/`
   (Listing em NO) e **Save**: sem isto a consola não deixa publicar.
3. **Publish** (para não ser preciso registar o número de série da TV).

## Teste
```bash
npm start &
node tests/risca-e2e.mjs        # TV + 3 telemóveis simulados; capturas em shots/risca/
node tests/risca-novidades.mjs  # voltar a entrar, equipas, modo pequenos, listas, Lápis de Ouro, Passa o Risco
node tests/risca-cast-stub.mjs  # caminho Chromecast com o SDK simulado
```
