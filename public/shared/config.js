// Configuração partilhada entre TV e comando.
export const CONFIG = {
  // ID da aplicação Cast registada em https://cast.google.com/publish
  // Substitui pelo teu ID depois de registares o receiver (custa 5 USD, uma vez).
  // Enquanto estiver 'CHANGE_ME', o botão Chromecast fica escondido e usa-se o modo por código.
  CAST_APP_ID: 'CHANGE_ME',
  // Canal de mensagens personalizado entre telemóveis e Chromecast
  CAST_NAMESPACE: 'urn:x-cast:pt.ecosdesagres.game',
  // Endereço do servidor WebSocket. Vazio = mesma origem da página.
  WS_URL: '',
  MAX_PLAYERS: 4,
};

export function wsUrl() {
  if (CONFIG.WS_URL) return CONFIG.WS_URL;
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${location.host}/ws`;
}
