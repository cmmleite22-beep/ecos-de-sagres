# ECOS DE SAGRES — Documento de Design (GDD)

**Género:** aventura de ação na primeira pessoa (FPS), cooperativa, com exploração, plataformas, puzzles e tiroteios. Inspirada em Tomb Raider e Uncharted.
**Jogadores:** 1 a 4, no mesmo sofá. A TV mostra o jogo em ecrã dividido e cada telemóvel é o comando de um jogador.
**Plataformas:** TV através de Chromecast (Web Receiver), qualquer browser num PC ou Smart TV, e telemóveis Android como comando (app instalável/PWA).
**Público:** amigos e famílias, a partir dos 12 anos (violência estilizada, sem sangue).

---

## 1. Pilares

1. **Ninguém avança sozinho.** Portões de duas placas, escaladas a pares e fogo de cobertura fazem da cooperação uma mecânica, não só um modo de jogo.
2. **Espetáculo em primeira pessoa.** Fugas de pedras rolantes, saltos sobre abismos e templos iluminados por tochas, vividos pelos olhos da personagem.
3. **Pegar e jogar.** Sem consolas e sem comandos extra: lê-se o código QR, escolhe-se a personagem e começa-se.

## 2. Ciclo de jogo

Explorar → descobrir relíquias e pistas → superar armadilhas e plataformas → resolver puzzles cooperativos → enfrentar mercenários → recuperar a peça do Astrolábio → fugir.

## 3. Câmara e ecrã

| Jogadores | Disposição na TV |
|---|---|
| 1 | Ecrã inteiro (com *bloom* na qualidade alta) |
| 2 | Dividido ao meio, na vertical |
| 3 | Quatro quadrantes; o quarto mostra uma **vista geral** do grupo |
| 4 | Quatro quadrantes |

- Cada vista tem mira, barra de vida, relíquias, abates, indicador da direção do dano e vinheta vermelha quando a vida está baixa.
- O corpo de cada jogador é invisível na própria vista (vê-se só a arma e a mão) e visível nas vistas dos outros, com o nome por cima.
- Se alguém fica muito para trás, é trazido para junto do grupo.

## 4. Controlos (telemóvel na horizontal)

| Zona / botão | Ação |
|---|---|
| Metade esquerda: joystick | Andar (relativo para onde se olha) |
| Metade direita: arrastar o dedo | Olhar e apontar (como um rato) |
| **FOGO** | Disparar (manter para fogo contínuo; arrastar em cima do botão também aponta) |
| **SALTAR** | Saltar; nas trepadeiras, larga e salta para trás |
| **CORRER** | Correr (manter) |
| **AÇÃO** | Interagir (pegar no Astrolábio, alavancas) |
| **Mira 1×** | Sensibilidade da mira: 0,6× / 1× / 1,5× / 2,2× |

O telemóvel vibra quando o jogador leva dano, acerta num inimigo ou apanha uma relíquia.
Para desenvolvimento no PC: WASD, rato (clicar no ecrã para o capturar), Espaço, Shift, E, F (disparar) e Enter (começar).

## 5. Mecânicas

- **Vida:** 100 pontos com regeneração depois de 4 s sem dano (como em Uncharted). As lanças tiram 34 e um tiro inimigo tira 12.
- **Morte:** depois de 2,5 s o jogador volta ao último ponto de controlo da equipa. As vidas são infinitas, o que deixa o jogo amigável para quem joga pouco.
- **Arma:** pistola *hitscan* com cadência de 0,22 s. Um tiro no tronco tira 1 de vida e na cabeça tira 3 (morte imediata). As paredes bloqueiam os tiros.
- **Mercenários:** veem até 26 m quando têm linha de visão, desviam-se para os lados e disparam a cada ~1,5 s. A precisão desce com a distância e quando o alvo corre.
- **Plataformas:** salto com *coyote time* e *buffer*, subida automática de degraus e plataformas móveis que transportam o jogador.
- **Escalada:** dentro de uma zona de trepadeiras, empurrar o joystick para a frente faz subir.
- **Puzzles cooperativos:** placas de pressão que exigem `min(2, nº de jogadores)` pessoas. Em solo basta uma.
- **Relíquias:** 12 ídolos dourados por capítulo, para quem gosta de explorar.

## 6. Capítulo 1: "O Templo das Marés" (jogável)

| # | Zona | Desafio |
|---|---|---|
| 1 | Acampamento | Tutorial de movimento, relíquia em cima dos caixotes |
| 2 | Escadaria e pórtico | Subida, inscrição (diálogo) |
| 3 | Pilares sobre a água | Saltos com balanço |
| 4 | Pátio das lanças | Armadilhas com ritmo e **2 mercenários** |
| 5 | Portão das duas placas | Puzzle cooperativo |
| 6 | Parede de trepadeiras | Escalada até 6 m, **1 mercenário** no topo |
| 7 | Abismo | Plataforma móvel e relíquia no ar |
| 8 | Patamar | **2 mercenários** |
| 9 | Corredor | **Pedra rolante**: fuga em descida e salto final sobre o fosso |
| 10 | Câmara do altar | **3 mercenários**, colunas para cobertura e o Astrolábio |

Duração estimada: 8 a 15 minutos.

## 7. Direção de arte e gráficos

- Estilo **realista estilizado**: materiais PBR (pedra, musgo, areia, metal, âmbar), céu físico com iluminação baseada em imagem, sombras suaves dinâmicas, nevoeiro atmosférico, tochas com luz tremeluzente, água animada, partículas de pó e pirilampos, feixe de luz no altar.
- Toda a geometria e as texturas são **procedurais** (geradas por código). O jogo carrega em segundos e não depende de ficheiros pesados.
- **Perfis de qualidade:**
  - `cast` (Chromecast): 720p, sombras a 1024 px, sem *bloom*, menos vegetação e luzes.
  - `high` (PC, Google TV Streamer, Smart TV potente): resolução nativa, sombras a 2048 px, *bloom*, mais vegetação.
- **Caminho para gráficos de topo:** trocar as personagens e o cenário procedurais por modelos glTF com texturas 2K a 4K (feitos em Blender ou comprados) e animações *mocap*, e lançar uma versão nativa para **Google TV** (Godot/Unity) que reaproveita o mesmo protocolo de comandos. Ver ARQUITETURA.md.

## 8. Som

Sons sintetizados em tempo real (Web Audio): tiros, saltos, relíquias, dano, portão, estrondo da pedra e ambiente de selva com pássaros. Próximo passo: banda sonora orquestral com percussão e gravação de vozes em português.

## 9. Roteiro de produção

| Fase | Conteúdo |
|---|---|
| **v0.1 (feito)** | Arquitetura TV + comandos, FPS em ecrã dividido, Capítulo 1 jogável, mercenários, guião completo |
| v0.2 | Modelos glTF e animações reais, armas adicionais (espingarda, arco), recarregar, cobertura |
| v0.3 | Habilidades únicas por personagem, reanimar colegas caídos |
| v0.4 | Capítulo 2 (Socotra), perseguição em jipes |
| v0.5 | App Android na Play Store (TWA/Capacitor) e registo Cast publicado |
| v1.0 | 6 capítulos, banda sonora, vozes, conquistas |
