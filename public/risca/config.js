// Risca e Arrisca — configuração partilhada entre a TV e o comando.
// Reutiliza o servidor de salas e o modo estático do Ecos de Sagres (../shared/config.js).
export { wsUrl, STATIC_MODE } from '../shared/config.js';

export const RISCA = {
  // ID da aplicação Cast deste jogo (https://cast.google.com/publish → Add new application → Custom Receiver,
  // URL https://cmmleite22-beep.github.io/ecos-de-sagres/risca/tv/?cast=1). Enquanto for 'CHANGE_ME',
  // o botão Chromecast fica escondido e joga-se pelo código da sala (npm start).
  CAST_APP_ID: '6179B961',
  CAST_NAMESPACE: 'urn:x-cast:pt.riscaearrisca.game',
  MAX_PLAYERS: 8,
  MIN_PLAYERS: 2,
};

// Protocolo (JSON, igual em WebSocket e no canal Cast)
// Comando -> TV
//   { t:'join', name }                      entrar (no WS o servidor já trata o join)
//   { t:'settings', rounds, time, theme, custom:[...] }   só o chefe da sala, no lobby
//   { t:'start' }                           começar (precisa de 2 jogadores)
//   { t:'pick', i }                         quem desenha escolhe a palavra (0..2)
//   { t:'pen', s, c, w, p:[x,y,x,y…] }      traço (s = n.º do traço; coordenadas 0..800 × 0..600)
//   { t:'fill', x, y, c }  { t:'undo' }  { t:'clear' }  { t:'giveup' }
//   { t:'guess', text }                     palpite
//   { t:'react', e }                        reação (emoji) a voar na TV
//   { t:'again' }                           voltar ao lobby depois do pódio
// TV -> Comando
//   { t:'welcome', id, name, color }
//   { t:'lobby', players:[{id,name,color,score}], leader, settings, phase }
//   { t:'st', phase, round, rounds, drawer, isDrawer, word?, choices?, pattern, left, dur, guessed, score, rank, gain, word? }
//   { t:'res', ok:'yes'|'close'|'no', text, gain }
//   { t:'buzz', ms }
