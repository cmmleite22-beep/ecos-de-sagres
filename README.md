# Ecos de Sagres

Aventura de ação **na primeira pessoa**, cooperativa para 1 a 4 jogadores, inspirada em Tomb Raider e Uncharted.
O jogo aparece na **TV (Chromecast ou qualquer browser)** em ecrã dividido e os **telemóveis Android são os comandos**.

- 📜 Guião: [docs/GUIAO.md](docs/GUIAO.md)
- 🎮 Design do jogo: [docs/GDD.md](docs/GDD.md)
- 🏗️ Arquitetura e decisão sobre os gráficos: [docs/ARQUITETURA.md](docs/ARQUITETURA.md)

## Experimentar já (rede de casa, 5 minutos)

Precisas de um computador com [Node.js 18+](https://nodejs.org).

```bash
npm install
npm start
```

1. **TV:** abre `http://localhost:8080/tv/` no computador e põe em ecrã inteiro (F11). Para o ver na TV:
   - liga o PC à TV por HDMI, **ou**
   - no Chrome, menu ⋮ → **Transmitir…** → escolhe o Chromecast → *Transmitir separador*. É a forma mais rápida de testar com um Chromecast, mas tem mais atraso do que o modo receiver descrito abaixo.
2. **Telemóveis:** ligados ao mesmo Wi-Fi, leem o código QR que aparece na TV (ou abrem o endereço mostrado e escrevem o código de 4 letras).
3. Escolhe a personagem e carrega em **COMEÇAR**.
4. Opcional: no Chrome do Android, menu ⋮ → **Adicionar ao ecrã principal** instala o comando como app.

No PC também se joga com teclado e rato: WASD, rato (clica no ecrã), Espaço, Shift, E, F/clique para disparar e Enter para começar.
Qualidade gráfica: `?q=high` (PC) ou `?q=cast` (leve). O Chromecast escolhe `cast` automaticamente.

## Correr diretamente no Chromecast (modo receiver, menos atraso)

O Chromecast só abre receivers em **HTTPS** e registados na Google:

1. Aloja o projeto num servidor com HTTPS (Render, Railway, Fly.io ou um VPS) com `npm start`. A variável `PORT` é respeitada.
2. Regista-te em <https://cast.google.com/publish> (taxa única de 5 USD), cria uma app **Custom Receiver** com o URL `https://O-TEU-DOMINIO/tv/` e regista o número de série do teu Chromecast para testes.
3. Põe o *Application ID* em `public/shared/config.js` → `CAST_APP_ID`.
4. No telemóvel, abre `https://O-TEU-DOMINIO/controller/`. Aparece o botão **Ligar ao Chromecast**: o primeiro telemóvel lança o jogo na TV e os outros juntam-se. Também podem continuar a entrar pelo código QR.

## Testes

```bash
npm start &
NODE_PATH=$(npm root -g) node tests/e2e.mjs   # requer Playwright instalado globalmente
```
O teste abre a TV e dois telemóveis simulados e verifica movimento, mira, tiros, dano inimigo, portão cooperativo, escalada, pedra rolante e vitória. Grava capturas em `shots/`.

## Estrutura

```
server/server.js        servidor HTTP + salas WebSocket
public/tv/              o jogo (Three.js) — também é o Cast Web Receiver
public/controller/      o comando (PWA para Android) — também é o Cast Web Sender
public/shared/          configuração e protocolo
docs/                   guião, GDD, arquitetura
tests/                  testes ponta-a-ponta (Playwright)
```
