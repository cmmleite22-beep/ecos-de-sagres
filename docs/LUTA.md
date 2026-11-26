# Fúria Atlântica — jogo de luta 1 contra 1

Jogo de luta original para a TV, com os telemóveis como comando. Usa a mesma base do Ecos de Sagres:
a TV abre uma página web (que também é o receiver do Chromecast) e os telemóveis ligam-se por código de sala
(servidor `npm start`) ou pelo botão **Ligar ao Chromecast** (GitHub Pages, sem servidor).

## Como jogar
- **TV:** `http://localhost:8080/luta/tv/` (modo local) ou `https://cmmleite22-beep.github.io/ecos-de-sagres/luta/tv/?cast=1` (Chromecast).
- **Telemóvel:** lê o QR da TV, escolhe o lutador e o cenário e carrega em **LUTAR!**
- Com um só jogador luta-se contra a máquina. Até 4 telemóveis: os outros ficam na fila, o vencedor fica e o vencido sai.
- Melhor de 3 rondas, 99 segundos por ronda.

| Comando | O que faz |
|---|---|
| Joystick ◀ ▶ | andar (para trás afasta-se) |
| Joystick ▲ / ▼ | saltar / baixar |
| SOCO, PONTAPÉ | golpes rápidos; em baixo: soco baixo e rasteira (derruba) |
| DEFESA | defender (▼ + DEFESA defende golpes baixos; golpes de salto defendem-se de pé) |
| ESPECIAL | golpe especial do lutador; ▼ + ESPECIAL = segundo especial |
| SUPER | quando a barra de baixo enche, golpe final com animação |

Um SOCO ou PONTAPÉ que acerte pode ser cancelado num ESPECIAL ou SUPER (combo).

No PC também se joga com teclado: jogador 1 `WASD` + `J K L` (soco, pontapé, especial), `U` defesa, `I` super;
jogador 2 setas + teclado numérico `1 2 3`, `0` defesa, `5` super. `Enter` começa.

## Lutadores (originais)
| | Especial | ▼ + Especial | Super |
|---|---|---|---|
| **Maré** (Rabo de Peixe) — rápida | Onda (projétil) | Remoinho (anti-aéreo) | Tsunami |
| **Basalto** (Pico) — lento e forte | Terramoto (onda no chão, defende-se em baixo) | Avalanche (investida que aguenta um golpe) | Vulcão |
| **Lua** (Mindelo · Lisboa) — acrobata | Voo da Garça (pontapé voador) | Crescente (mortal para trás) | Eclipse |
| **Trovão** (Alfama) — pugilista | Relâmpago (soco em corrida) | Trovoada (gancho elétrico) | Tempestade |

Cenários: Cais de Ponta Delgada ao pôr do sol, Miradouro das Sete Cidades e Telhados de Alfama à noite.

## Técnica
- 2D em Canvas, sem bibliotecas: leve para a TV (60 fps no teste sem placa gráfica). As camadas fixas dos cenários
  são pintadas uma vez; animam-se por cima mar, nuvens, aves, nevoeiro, elétrico e luzes.
- Lutadores desenhados por código: esqueleto com cinemática inversa, roupa e sombreado vetorial, cabelo e fitas com física.
- Lógica a 60 passos/s fixos: golpes com quadros de arranque/ativos/recuperação, *hitstop*, combos, malabarismos no ar.
- Som e música sintetizados (Web Audio), temas originais por cenário.

| Ficheiro (`public/luta/`) | Responsabilidade |
|---|---|
| `config.js` | ID Cast, canal e protocolo |
| `tv/jogo/motor.js` | jogadores, fila, rondas, colisões, projéteis, câmara, HUD |
| `tv/jogo/lutador.js` | estados e física de um lutador |
| `tv/jogo/lutadores.js` | elenco, poses e golpes |
| `tv/jogo/desenho.js` | esqueleto, IK e desenho (também usado nos retratos do telemóvel) |
| `tv/jogo/cenarios.js`, `efeitos.js`, `som.js`, `ia.js`, `net.js`, `hud.js` | cenários, partículas, som, máquina, rede, ecrã de entrada |
| `comando/` | comando do telemóvel (PWA) |

## Chromecast: registar a aplicação (uma vez, grátis — a conta de programador já está paga)
1. <https://cast.google.com/publish> → **Add new application → Custom Receiver**, nome "Fúria Atlântica",
   URL `https://cmmleite22-beep.github.io/ecos-de-sagres/luta/tv/?cast=1`.
2. Publicar a aplicação (como no Ecos de Sagres, para não ser preciso registar o número de série da TV).
3. Copiar o *Application ID* para `public/luta/config.js` → `CAST_APP_ID`.

## Teste
```bash
npm start &
node tests/luta-e2e.mjs     # TV + 2 telemóveis simulados; capturas em shots/luta/
```
