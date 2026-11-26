// Protocolo de mensagens (JSON). Igual em WebSocket e no canal Cast.
//
// Comando -> TV
//   { t:'join', name, char }                 entrar (no Cast; no WS é tratado pelo servidor)
//   { t:'in', x, y, b, lx, ly, rx, ry, s }   input: joystick de movimento x,y em [-1,1]; b = bits de botões;
//                                            lx,ly = deslocamento do dedo na zona de mira (px desde o último envio);
//                                            rx,ry = 2.º joystick (opcional) em [-1,1]; s = nº de sequência
//   { t:'char', char }                       mudar de personagem no lobby
//   { t:'start' }                            pedir início (qualquer jogador)
// TV -> Comando
//   { t:'welcome', id, char, color }         confirmação + cor do jogador
//   { t:'state', hp, max, relics, kills, team, total, phase }  estado para o HUD do comando
//   { t:'buzz', ms }                         vibração (dano, apanhar relíquia)
//   { t:'lobby', players:[{id,name,char}] }  quem está na sala

export const BTN = { JUMP: 1, SPRINT: 2, ACTION: 4, FIRE: 8 };

export const CHARACTERS = [
  { id: 'ana',   name: 'Ana Varela',     role: 'Arqueóloga',   color: '#e0a040' },
  { id: 'tito',  name: 'Tito Brandão',   role: 'Mecânico',     color: '#3fa7d6' },
  { id: 'ines',  name: 'Inês Kwan',      role: 'Linguista',    color: '#d6457a' },
  { id: 'rafa',  name: 'Rafa Okoro',     role: 'Escalador',    color: '#59c26b' },
];
