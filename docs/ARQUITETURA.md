# Arquitetura técnica

## A decisão principal: onde corre o 3D?

Um Chromecast não corre apps Android nem jogos nativos. Aquilo que "projetamos" nele é uma **página web** (um *Cast Web Receiver*) que o próprio Chromecast abre e desenha. Isto deixa três caminhos:

| Opção | Como funciona | Gráficos | Latência | Veredito |
|---|---|---|---|---|
| A. Espelhar o ecrã do telemóvel | O jogo corre num telemóvel e o Android espelha-o para a TV | Os do telemóvel (bons) | 100 a 250 ms, comprime e perde qualidade | ❌ Ecrã dividido impossível, só um jogador vê bem |
| **B. Receiver WebGL (escolhida)** | O Chromecast corre o jogo 3D (Three.js/WebGL). Os telemóveis só enviam toques | Médios num Chromecast 3.ª geração, bons num Chromecast com Google TV / Google TV Streamer, muito bons num PC | 20 a 60 ms (só viajam toques, não vídeo) | ✅ Funciona em qualquer Chromecast e browser, e permite ecrã dividido |
| C. App nativa Google TV | Jogo nativo (Godot/Unity) instalado no Chromecast com Google TV | Os melhores possíveis no aparelho | Igual à B | ⭐ Evolução natural: reaproveita o comando e o protocolo |

**Sendo honesto sobre os "gráficos de última geração":** nenhum Chromecast tem a GPU de uma PS5. Na opção B o jogo usa as técnicas modernas que a web permite (materiais PBR, iluminação baseada em imagem, sombras dinâmicas, *tone mapping* ACES, *bloom*, nevoeiro volumétrico simulado) e ajusta automaticamente a qualidade: perfil `cast` no Chromecast, `high` num PC ou Smart TV potente. Para chegar perto do aspeto de um Uncharted é preciso a **opção C** (ou abrir a TV num PC ligado por HDMI), com modelos e texturas feitos por artistas. O protocolo dos comandos já está preparado para isso.

## Componentes

```
┌──────────────┐  toques (JSON, ~30/s)  ┌──────────────────┐        ┌───────────────────────────┐
│ Telemóvel 1  │ ─────────────────────▶ │                  │ ─────▶ │  TV  (Chromecast / browser)│
│ comando PWA  │ ◀───── vibração/estado │  Servidor de     │ ◀───── │  - Three.js / WebGL        │
├──────────────┤                        │  salas (Node.js) │        │  - física, regras, IA      │
│ Telemóvel 2  │ ─────────────────────▶ │  WebSocket       │        │  - ecrã dividido 1–4       │
├──────────────┤                        └──────────────────┘        │  - é a "autoridade" do jogo│
│ Telemóvel 3,4│        ou, sem servidor: canal Cast  ───────────▶  │                            │
└──────────────┘     (urn:x-cast:pt.ecosdesagres.game)               └───────────────────────────┘
```

- **`public/tv/`**: o jogo. É a mesma página para um browser normal e para o Chromecast. Quando deteta o Chromecast (*user agent* `CrKey`) carrega o SDK CAF Receiver, ativa o canal de mensagens Cast e baixa a qualidade para `cast`.
- **`public/controller/`**: o comando. É uma PWA instalável no Android ("Adicionar ao ecrã principal"), com ecrã inteiro, orientação horizontal e ecrã sempre ligado. Inclui o botão Chromecast (Web Sender SDK) quando o `CAST_APP_ID` estiver configurado.
- **`server/server.js`**: servidor HTTP estático e *relay* WebSocket com salas de 4 letras. Não tem lógica de jogo.
- **`public/shared/`**: configuração e protocolo comuns.

### Dois modos de ligação

1. **Modo servidor (recomendado, já testado):** a TV abre `/tv/` (no Chromecast, num PC ligado por HDMI ou no browser da Smart TV) e mostra um código QR. Cada telemóvel lê o QR e entra. Funciona com qualquer telemóvel e browser.
2. **Modo Cast puro:** o primeiro telemóvel toca em "Ligar ao Chromecast", o Chromecast abre o receiver e os outros telemóveis juntam-se à mesma sessão (`ORIGIN_SCOPED`). As mensagens vão pelo canal Cast personalizado e não é preciso servidor de jogo, só alojamento HTTPS estático (por exemplo GitHub Pages). Precisa de registo na Google Cast Developer Console.

Os dois modos podem estar ativos ao mesmo tempo, e o jogo trata os jogadores da mesma forma.

### Protocolo (resumo)
Ver `public/shared/protocol.js`. Os principais:
`{t:'in', x, y, b, lx, ly, sens}` vai do comando para a TV: joystick, botões em bits (1 saltar, 2 correr, 4 ação, 8 fogo) e deslocamento do dedo na mira.
`{t:'state', hp, relics, kills…}` e `{t:'buzz', ms}` vão da TV para o comando.

### Ficheiros do jogo (`public/tv/game/`)
| Ficheiro | Responsabilidade |
|---|---|
| `game.js` | Ciclo principal, jogadores, câmaras FPS, ecrã dividido, armas, regras |
| `level1.js` | Construção do Capítulo 1, armadilhas, placas, pedra rolante, diálogos, posições dos inimigos |
| `enemies.js` | Mercenários: visão, mira, disparo, morte |
| `physics.js` | Colisões AABB, degraus, plataformas móveis, *raycast* |
| `character.js` | Personagens procedurais animadas |
| `textures.js` | Texturas e materiais PBR procedurais |
| `audio.js` | Som sintetizado |
| `hud.js` | Interface: lobby, QR, vistas por jogador |
| `net.js` | WebSocket e canal Cast |

## Desempenho

- Física em passos fixos de 120 Hz, separada da renderização.
- Mapa de sombras calculado **uma vez por frame** para todas as vistas (`shadowMap.autoUpdate = false`).
- *Instancing* para árvores, fetos e folhas.
- No perfil `cast`: renderização a 1280×720, antialiasing nativo, sem pós-processamento e no máximo 4 luzes pontuais.
- Com 4 jogadores no Chromecast 3.ª geração conta com 20 a 30 fps. No Chromecast com Google TV 4K ou Google TV Streamer, mais.

## Próximos passos técnicos

1. Substituir as personagens procedurais por **glTF** com animações (Mixamo) e o cenário por *kits* modulares em Blender (texturas KTX2 comprimidas, para caberem na memória do Chromecast).
2. **App Android na Play Store:** empacotar o comando com Bubblewrap (TWA) ou Capacitor. Com Capacitor dá para usar o Cast SDK nativo de Android, que é mais fiável do que o Web Sender.
3. **Versão nativa Google TV** (Godot 4 com o renderizador *Mobile*): o mesmo protocolo JSON por WebSocket, por isso o comando e o servidor não mudam.
4. Persistência (progresso, relíquias) e capítulos seguintes.
