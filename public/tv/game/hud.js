// Interface sobreposta da TV (HTML/CSS por cima do canvas 3D).
import { CHARACTERS } from '../../shared/protocol.js';

const $ = (s) => document.querySelector(s);

export class Hud {
  constructor() {
    this.code = null;
    this.fpsAcc = 0; this.fpsN = 0;
  }

  async lanOrigin() {
    if (!/^(localhost|127\.)/.test(location.hostname)) return location.origin;
    try {
      const info = await (await fetch('/api/info')).json();
      if (info.ips?.length) return `${location.protocol}//${info.ips[0]}:${location.port || info.port}`;
    } catch {}
    return location.origin;
  }

  controllerUrl(code) {
    const base = (this.origin || location.origin) + location.pathname.replace(/\/tv\/?(index\.html)?$/, '/controller/');
    return code ? `${base}?room=${code}` : base;
  }

  async setRoom(code) {
    this.code = code;
    if (!this.origin) this.origin = await this.lanOrigin();
    $('#room-code').textContent = code || '····';
    const url = this.controllerUrl(code);
    $('#join-url').textContent = url.replace(/^https?:\/\//, '');
    const qrBox = $('#qr');
    qrBox.innerHTML = '';
    if (code && window.qrcode) {
      const qr = window.qrcode(0, 'M');
      qr.addData(url); qr.make();
      qrBox.innerHTML = qr.createSvgTag({ cellSize: 5, margin: 2, scalable: true });
    }
    $('#ws-status').textContent = code ? '' : 'A ligar ao servidor…';
  }

  setCastMode(on, staticMode) {
    $('#cast-hint').style.display = on || staticMode ? 'block' : 'none';
    this.staticMode = !!staticMode;
    if (staticMode) {
      const lbl = [...document.querySelectorAll('.join p')].find((p) => p.textContent.trim() === 'Código da sala');
      if (lbl) lbl.style.display = 'none';
      // sem servidor: não há QR nem código; entra-se pelo botão Chromecast no telemóvel
      document.querySelector('.join').classList.add('static');
      const url = this.controllerUrl(null);
      $('#join-url').textContent = url.replace(/^https?:\/\//, '');
      $('#ws-status').textContent = '';
      $('#room-code').textContent = '';
      $('#cast-hint').textContent = 'Abre este endereço no Chrome do telemóvel e toca em "Ligar ao Chromecast".';
      if (window.qrcode) {
        const qr = window.qrcode(0, 'M'); qr.addData(url); qr.make();
        $('#qr').innerHTML = qr.createSvgTag({ cellSize: 5, margin: 2, scalable: true });
      }
    }
  }

  setPlayers(list) {
    // cartões no lobby
    const slots = $('#slots');
    slots.innerHTML = '';
    for (let i = 0; i < 4; i++) {
      const p = list[i];
      const el = document.createElement('div');
      el.className = 'slot' + (p ? ' on' : '');
      if (p) {
        const c = CHARACTERS.find((k) => k.id === p.char);
        el.style.setProperty('--c', p.color);
        el.innerHTML = `<b>${esc(p.name)}</b><span>${c.name} · ${c.role}</span>`;
      } else el.innerHTML = `<b>Jogador ${i + 1}</b><span>à espera…</span>`;
      slots.appendChild(el);
    }
    $('#start-hint').textContent = list.length ? 'Carrega em COMEÇAR no telemóvel'
      : this.staticMode ? 'Abre o comando no telemóvel e toca em "Ligar ao Chromecast"' : 'Lê o código QR com o telemóvel para entrar';
    // barra de jogadores durante o jogo
    const bar = $('#players');
    bar.innerHTML = list.map((p) => `
      <div class="pcard${p.dead ? ' dead' : ''}" style="--c:${p.color}">
        <b>${esc(p.name)}</b>
        <span class="hearts">♥ ${Math.max(0, p.hp)}</span>
        <span class="rel">◆ ${p.relics}</span>
      </div>`).join('');
  }

  hideWin() { $('#win').classList.add('hidden'); }
  setRelics(n, total) { $('#relics').textContent = `◆ ${n} / ${total}`; }
  showLobby(on) { $('#lobby').classList.toggle('hidden', !on); $('#ingame').classList.toggle('hidden', on); }

  toast(text, ms = 2000) {
    const t = $('#toast');
    t.textContent = text; t.classList.add('show');
    clearTimeout(this._tt);
    this._tt = setTimeout(() => t.classList.remove('show'), ms);
  }

  dialog(who, text, color) {
    const d = $('#dialog');
    if (!who) { d.classList.remove('show'); return; }
    d.innerHTML = `<b style="color:${color || '#fff'}">${esc(who)}</b> ${esc(text)}`;
    d.classList.add('show');
  }

  showWin(players, found, total, secs = 0) {
    const m = Math.floor(secs / 60), s = Math.floor(secs % 60);
    $('#win-stats').innerHTML = `
      <p>Tempo: ${m}m ${String(s).padStart(2, '0')}s · Relíquias: ${found}/${total}</p>
      ${players.map((p) => `<p style="color:${p.char.color}">${esc(p.name)} — ◆ ${p.relics}</p>`).join('')}
      <p class="next">Capítulo 2 — "Areias de Socotra": em breve.</p>
      <p class="next">Carrega em JOGAR DE NOVO no telemóvel para repetir o capítulo.</p>`;
    $('#win').classList.remove('hidden');
  }

  // ---- vistas em ecrã dividido: mira, vida, dano, marcador de acerto ----
  layout(rects, players) {
    const box = $('#views');
    box.innerHTML = '';
    this.views = rects.map(([x, y, w, h], i) => {
      const p = players[i];
      const el = document.createElement('div');
      el.className = 'view' + (p ? '' : ' overview');
      Object.assign(el.style, { left: x * 100 + '%', top: (1 - y - h) * 100 + '%', width: w * 100 + '%', height: h * 100 + '%' });
      if (p) {
        el.style.setProperty('--c', p.char.color);
        el.innerHTML = `
          <div class="vig"></div>
          <div class="cross"><i></i><i></i><i></i><i></i></div>
          <div class="hitm">✕</div>
          <div class="dmgdir"></div>
          <div class="vbar"><b>${esc(p.name)}</b><div class="hpbar"><div></div></div><span class="vk"></span></div>
          <div class="dead">A recuperar…</div>`;
      } else el.innerHTML = '<div class="ovlabel">Vista geral</div>';
      box.appendChild(el);
      return el;
    });
  }

  hurt(i, angle) {
    const v = this.views?.[i]; if (!v) return;
    const vig = v.querySelector('.vig');
    vig.classList.remove('on'); void vig.offsetWidth; vig.classList.add('on');
    if (angle !== null && angle !== undefined) {
      const d = v.querySelector('.dmgdir');
      d.style.transform = `translate(-50%, -50%) rotate(${-angle}rad)`;
      d.classList.remove('on'); void d.offsetWidth; d.classList.add('on');
    }
  }

  hitmarker(i, head) {
    const v = this.views?.[i]; if (!v) return;
    const h = v.querySelector('.hitm');
    h.classList.toggle('head', !!head);
    h.classList.remove('on'); void h.offsetWidth; h.classList.add('on');
  }

  frame(players, dt, max) {
    this.fps(dt);
    if (!this.views) return;
    players.forEach((p, i) => {
      const v = this.views[i]; if (!v) return;
      const bar = v.querySelector('.hpbar div');
      if (bar) {
        bar.style.width = Math.max(0, p.hp / max * 100) + '%';
        bar.classList.toggle('low', p.hp < max * 0.35);
        v.querySelector('.vig').classList.toggle('low', p.hp < max * 0.35 && !p.dead);
        v.querySelector('.dead').style.display = p.dead ? 'flex' : 'none';
        v.querySelector('.vk').textContent = `◆ ${p.relics}   ✕ ${p.kills}`;
      }
    });
  }

  fps(dt) {
    this.fpsAcc += dt; this.fpsN++;
    if (this.fpsAcc > 1) {
      $('#fps').textContent = Math.round(this.fpsN / this.fpsAcc) + ' fps';
      this.fpsAcc = 0; this.fpsN = 0;
    }
  }
}

function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
