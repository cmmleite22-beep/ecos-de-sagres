// Arranque do ecrã da TV (browser normal ou Cast Web Receiver).
import { Motor } from './jogo/motor.js';
import { Hud } from './jogo/hud.js';
import { Net } from './jogo/net.js';
import { STATIC_MODE } from '../config.js';

const params = new URLSearchParams(location.search);
// Qualidade: 'cast' (1280×720) no Chromecast/TV, 'high' (1920×1080) num PC. Forçar com ?q=
const quality = params.get('q') || (window.IS_CAST ? 'cast' : (innerWidth * devicePixelRatio > 1600 ? 'high' : 'cast'));

const start = () => {
  const hud = new Hud();
  const net = new Net();
  const motor = new Motor(document.getElementById('c'), net, hud, quality);
  hud.setCastMode(!!window.IS_CAST, STATIC_MODE);
  motor.lobbyChanged();
  net.start();
  motor.enableKeyboard();
  motor.loop();
  window.__luta = motor; // depuração e testes
};
// espera pela letra (no máx. 1,5 s) para os textos do canvas saírem logo com o tipo certo
Promise.race([document.fonts?.load('40px "Russo One"') || Promise.resolve(), new Promise((r) => setTimeout(r, 1500))]).catch(() => {}).then(start);
