// Ecrã de entrada na TV (HTML por cima do canvas): QR, código da sala, jogadores e cenário.
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export class Hud {
  constructor() { this.fpsAcc = 0; this.fpsN = 0; this.origin = null; }

  async lanOrigin() {
    if (!/^(localhost|127\.)/.test(location.hostname)) return location.origin;
    try {
      const info = await (await fetch('/api/info')).json();
      if (info.ips?.length) return `${location.protocol}//${info.ips[0]}:${location.port || info.port}`;
    } catch {}
    return location.origin;
  }
  controllerUrl(code) {
    const base = (this.origin || location.origin) + location.pathname.replace(/\/tv\/?(index\.html)?$/, '/comando/');
    return code ? `${base}?room=${code}` : base;
  }
  qr(url) {
    const box = $('#qr'); box.innerHTML = '';
    if (!window.qrcode) return;
    const q = window.qrcode(0, 'M'); q.addData(url); q.make();
    box.innerHTML = q.createSvgTag({ cellSize: 5, margin: 2, scalable: true });
  }
  async setRoom(code) {
    if (this.staticMode) return;
    if (!this.origin) this.origin = await this.lanOrigin();
    $('#room-code').textContent = code || '····';
    const url = this.controllerUrl(code);
    $('#join-url').textContent = url.replace(/^https?:\/\//, '');
    if (code) this.qr(url); else $('#qr').innerHTML = '';
    $('#ws-status').textContent = code ? '' : 'A ligar ao servidor…';
  }
  setCastMode(isCast, staticMode) {
    this.staticMode = !!staticMode;
    if (!staticMode) return;
    document.body.classList.add('static');
    const url = this.controllerUrl(null);
    $('#join-url').textContent = url.replace(/^https?:\/\//, '');
    $('#ws-status').textContent = '';
    this.qr(url);
  }
  setLobby(players, stageName, phase) {
    $('#lobby').classList.toggle('hidden', phase !== 'lobby');
    $('#stage-name').textContent = stageName;
    const list = $('#plist');
    list.innerHTML = players.length ? players.map((p, i) => `
      <li style="--c:${p.def.color}"><b>${esc(p.name)}</b><span>${esc(p.def.name)}</span><em>${i < 2 ? (i ? 'Jogador 2' : 'Jogador 1') : 'na fila'}</em></li>`).join('')
      : '<li class="empty">Ninguém ainda… lê o código QR com o telemóvel.</li>';
    $('#start-hint').textContent = !players.length ? '' : players.length === 1
      ? 'Carrega em LUTAR no telemóvel para lutar contra a máquina, ou espera por um amigo.'
      : 'Carrega em LUTAR no telemóvel para começar!';
  }
  fps(dt) {
    this.fpsAcc += dt; this.fpsN++;
    if (this.fpsAcc > 1) { $('#fps').textContent = Math.round(this.fpsN / this.fpsAcc) + ' fps'; this.fpsAcc = 0; this.fpsN = 0; }
  }
}
