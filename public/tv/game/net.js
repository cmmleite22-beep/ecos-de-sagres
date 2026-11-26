// Rede do lado da TV. Junta dois transportes que entregam as mesmas mensagens ao jogo:
//  1) WebSocket para o servidor de salas (telemóveis entram por QR/código)
//  2) Canal Cast personalizado (telemóveis ligados ao Chromecast pela app/Chrome)
import { CONFIG, wsUrl, STATIC_MODE } from '../../shared/config.js';

export class Net {
  constructor() {
    this.handlers = {};
    this.code = null;
    this.ws = null;
    this.castCtx = null;
    this.wsOk = false;
  }
  on(evt, fn) { (this.handlers[evt] ||= []).push(fn); }
  emit(evt, ...a) { (this.handlers[evt] || []).forEach((f) => f(...a)); }

  start() {
    if (!STATIC_MODE) this.connectWS();
    this.startCast();
  }

  // ---------- WebSocket ----------
  connectWS() {
    let ws;
    try { ws = new WebSocket(wsUrl()); } catch { return; }
    this.ws = ws;
    ws.onopen = () => ws.send(JSON.stringify({ t: 'host', code: this.code }));
    ws.onmessage = (e) => {
      let m; try { m = JSON.parse(e.data); } catch { return; }
      if (m.t === 'hosted') { this.code = m.code; this.wsOk = true; this.emit('room', m.code); return; }
      this.dispatch(m);
    };
    ws.onclose = () => {
      this.wsOk = false;
      this.emit('room', null);
      setTimeout(() => this.connectWS(), 2000); // reconecta e tenta manter o mesmo código
    };
    ws.onerror = () => {};
  }

  // ---------- Cast (Web Receiver) ----------
  startCast() {
    const ctx = window.__castCtx; // arrancado cedo em index.html
    if (!ctx) { if (window.__castErr) this.emit('cast-error', window.__castErr); return; }
    const handle = ({ kind, ev }) => {
      if (kind === 'bye') { this.dispatch({ t: 'leave', id: 'c_' + ev.senderId }); return; }
      let m; try { m = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data; } catch { return; }
      this.dispatch({ ...m, id: 'c_' + ev.senderId, _castSender: ev.senderId });
    };
    // castCtx tem de existir antes de esvaziar a fila: as respostas (welcome/lobby) usam-no
    this.castCtx = ctx;
    this.emit('cast', true);
    const q = window.__castQ || [];
    window.__castSink = handle;
    q.splice(0).forEach(handle);
  }

  dispatch(m) {
    switch (m.t) {
      case 'join': this.emit('join', m.id, m.name, m.char); break;
      case 'leave': this.emit('leave', m.id); break;
      case 'in': this.emit('input', m.id, m); break;
      default: this.emit('msg', m.id, m);
    }
  }

  // Envia para um jogador (id) ou para todos (id = null)
  send(id, msg) {
    if (id && id.startsWith('c_')) {
      this.castCtx?.sendCustomMessage(CONFIG.CAST_NAMESPACE, id.slice(2), msg);
      return;
    }
    if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(id ? { ...msg, to: id } : msg));
    if (!id && this.castCtx) this.castCtx.sendCustomMessage(CONFIG.CAST_NAMESPACE, undefined, msg);
  }
}
