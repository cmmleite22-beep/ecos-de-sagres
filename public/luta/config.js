// Fúria Atlântica — configuração partilhada entre a TV e o comando.
// Reutiliza o servidor de salas e o modo estático do Ecos de Sagres (../shared/config.js).
export { wsUrl, STATIC_MODE } from '../shared/config.js';

export const LUTA = {
  // ID da aplicação Cast deste jogo (https://cast.google.com/publish → Add new application → Custom Receiver,
  // URL https://cmmleite22-beep.github.io/ecos-de-sagres/luta/tv/?cast=1). Enquanto for 'CHANGE_ME',
  // o botão Chromecast fica escondido e joga-se pelo código da sala (npm start).
  CAST_APP_ID: 'C8074D94',
  CAST_NAMESPACE: 'urn:x-cast:pt.furiaatlantica.game',
  MAX_PLAYERS: 4,
};

// Protocolo (JSON, igual em WebSocket e no canal Cast)
// Comando -> TV
//   { t:'join', name, char }      entrar (no WS o servidor já trata o join)
//   { t:'in', x, y, b, s }        joystick x,y em [-1,1] (cima = +y); b = bits dos botões
//   { t:'char', char }            mudar de lutador
//   { t:'start' }                 começar a luta (com 1 jogador luta contra a máquina)
//   { t:'stage', dir }            mudar de cenário no ecrã de escolha (+1 / -1)
// TV -> Comando
//   { t:'welcome', id, name, char, color }
//   { t:'lobby', players:[{id,name,char,slot}], phase, stage }
//   { t:'state', hp, max, meter, slot, phase, rounds, foe, result }
//   { t:'buzz', ms }
export const BTN = { PUNCH: 1, KICK: 2, SPECIAL: 4, BLOCK: 8, SUPER: 16 };
