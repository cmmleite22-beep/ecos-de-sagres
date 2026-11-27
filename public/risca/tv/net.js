// Rede do lado da TV (igual à dos outros jogos, com o canal Cast deste):
//  1) WebSocket para o servidor de salas (telemóveis entram por QR/código)
//  2) Canal Cast personalizado (telemóveis ligados ao Chromecast pelo Chrome)
import { RISCA, wsUrl, STATIC_MODE } from '../config.js';

export class Net {
  constructor() { this.handlers = {}; this.code = null; this.ws = null; this.castCtx = null; }
  on(evt, fn) { (this.handlers[evt] ||= []).push(fn); }
  emit(evt, ...a) { (this.handlers[evt] || []).forEach((f) => f(...a)); }

  start() {
    if (!STATIC_MODE) this.connectWS();
    this.startCast();
  }

  connectWS() {
    let ws;
    try { ws = new WebSocket(wsUrl()); } catch { return; }
    this.ws = ws;
    ws.onopen = () => ws.send(JSON.stringify({ t: 'host', code: this.code, max: RISCA.MAX_PLAYERS }));
    ws.onmessage = (e) => {
      let m; try { m = JSON.parse(e.data); } catch { return; }
      if (m.t === 'hosted') { this.code = m.code; this.emit('room', m.code); return; }
      this.dispatch(m);
    };
    ws.onclose = () => { this.emit('room', null); setTimeout(() => this.connectWS(), 2000); };
    ws.onerror = () => {};
  }

  startCast() {
    const ctx = window.__castCtx; // arrancado cedo em index.html
    if (!ctx) return;
    const handle = ({ kind, ev }) => {
      if (kind === 'bye') { this.dispatch({ t: 'leave', id: 'c_' + ev.senderId }); return; }
      let m; try { m = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data; } catch { return; }
      this.dispatch({ ...m, id: 'c_' + ev.senderId });
    };
    this.castCtx = ctx;
    this.emit('cast', true);
    const q = window.__castQ || [];
    window.__castSink = handle;
    q.splice(0).forEach(handle);
  }

  dispatch(m) {
    switch (m.t) {
      case 'join': this.emit('join', m.id, m.name); break;
      case 'leave': this.emit('leave', m.id); break;
      case 'in': this.emit('input', m.id, m); break;
      default: this.emit('msg', m.id, m);
    }
  }

  send(id, msg) {
    if (id && id.startsWith('c_')) { this.castCtx?.sendCustomMessage(RISCA.CAST_NAMESPACE, id.slice(2), msg); return; }
    if (id && id.startsWith('kb')) return; // jogadores de teclado
    if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(id ? { ...msg, to: id } : msg));
    if (!id && this.castCtx) this.castCtx.sendCustomMessage(RISCA.CAST_NAMESPACE, undefined, msg);
  }
}
