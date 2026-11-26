// Arranque do ecrã da TV (funciona num browser normal ou como Cast Web Receiver).
import { Game } from './game/game.js';
import { Hud } from './game/hud.js';
import { Net } from './game/net.js';

const params = new URLSearchParams(location.search);
// Qualidade: 'cast' no Chromecast (720p, sem bloom), 'high' em PC/Google TV potente. Forçar com ?q=
const quality = params.get('q') || (window.IS_CAST ? 'cast' : 'high');

const hud = new Hud();
const net = new Net();
const game = new Game(document.getElementById('c'), hud, net, quality);
hud.setPlayers([]);
hud.setCastMode(!!window.IS_CAST);
net.start();
game.enableKeyboard();
game.loop();
window.__game = game; // útil para depuração/testes
