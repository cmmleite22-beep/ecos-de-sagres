// Arranque do ecrã da TV (browser normal ou Cast Web Receiver).
import { Jogo } from './jogo.js';
import { Net } from './net.js';
import { Som } from './som.js';
import { STATIC_MODE } from '../config.js';

const start = () => {
  const net = new Net();
  const jogo = new Jogo(net, new Som());
  jogo.hud.setCastMode(STATIC_MODE);
  jogo.lobbyChanged();
  net.start();
  window.__risca = jogo; // depuração e testes
};
Promise.race([document.fonts?.ready || Promise.resolve(), new Promise((r) => setTimeout(r, 1500))]).catch(() => {}).then(start);
