// Ecos de Sagres — servidor de salas (HTTP estático + WebSocket relay)
// Uma "sala" = uma TV (host) + até 4 telemóveis (comandos).
// A TV é a autoridade do jogo; o servidor só reencaminha mensagens.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const PORT = Number(process.env.PORT || 8080);
const MAX_PLAYERS = 4;

// Ficheiros de terceiros servidos a partir de node_modules (sem bundler)
const VENDOR = {
  '/vendor/three.module.js': 'node_modules/three/build/three.module.js',
  '/vendor/three.core.js': 'node_modules/three/build/three.core.js',
  '/vendor/qrcode.js': 'node_modules/qrcode-generator/qrcode.js',
};
const VENDOR_DIRS = { '/vendor/addons/': 'node_modules/three/examples/jsm/' };

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};

function resolvePath(urlPath) {
  if (VENDOR[urlPath]) return path.join(ROOT, VENDOR[urlPath]);
  for (const [prefix, dir] of Object.entries(VENDOR_DIRS)) {
    if (urlPath.startsWith(prefix)) {
      const p = path.join(ROOT, dir, urlPath.slice(prefix.length));
      return p.startsWith(path.join(ROOT, dir)) ? p : null;
    }
  }
  if (urlPath === '/') urlPath = '/index.html';
  if (urlPath.endsWith('/')) urlPath += 'index.html';
  const p = path.join(PUBLIC, path.normalize(urlPath));
  return p.startsWith(PUBLIC) ? p : null;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/health') { res.end('ok'); return; }
  if (url.pathname === '/api/info') { // IPs da rede local, para o QR não apontar para "localhost"
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ips: lanIps(), port: PORT }));
    return;
  }
  let file = resolvePath(decodeURIComponent(url.pathname));
  if (file && fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!file || !fs.existsSync(file)) { res.writeHead(404); res.end('404'); return; }
  res.writeHead(200, {
    'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
    'Cache-Control': 'no-cache',
    'Access-Control-Allow-Origin': '*',
  });
  fs.createReadStream(file).pipe(res);
});

// ---------------- Salas ----------------
const rooms = new Map(); // code -> { host, controllers: Map<id, ws> }
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
function newCode() {
  let c;
  do { c = Array.from({ length: 4 }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join(''); }
  while (rooms.has(c));
  return c;
}
let nextId = 1;
const send = (ws, obj) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj)); };

const wss = new WebSocketServer({ server, path: '/ws' });
wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  ws.on('message', (raw) => {
    let msg; try { msg = JSON.parse(raw); } catch { return; }

    // TV cria (ou recria) uma sala
    if (msg.t === 'host') {
      const code = (msg.code && !rooms.has(msg.code)) ? msg.code : newCode();
      rooms.set(code, { host: ws, controllers: new Map() });
      ws.role = 'host'; ws.room = code;
      send(ws, { t: 'hosted', code });
      return;
    }
    // Telemóvel entra numa sala
    if (msg.t === 'join') {
      const code = String(msg.code || '').toUpperCase().trim();
      const room = rooms.get(code);
      if (!room) { send(ws, { t: 'error', reason: 'Sala não encontrada' }); return; }
      if (room.controllers.size >= MAX_PLAYERS) { send(ws, { t: 'error', reason: 'Sala cheia (máx. 4)' }); return; }
      ws.role = 'ctrl'; ws.room = code; ws.id = 'p' + (nextId++);
      room.controllers.set(ws.id, ws);
      send(ws, { t: 'joined', id: ws.id, code });
      send(room.host, { t: 'join', id: ws.id, name: String(msg.name || 'Jogador').slice(0, 14), char: msg.char });
      return;
    }
    const room = rooms.get(ws.room);
    if (!room) return;
    if (ws.role === 'ctrl') {
      // comando -> TV (input, ping, escolha de personagem...)
      send(room.host, { ...msg, id: ws.id });
    } else if (ws.role === 'host') {
      // TV -> um comando (msg.to) ou todos
      if (msg.to) send(room.controllers.get(msg.to), msg);
      else for (const c of room.controllers.values()) send(c, msg);
    }
  });
  ws.on('close', () => {
    const room = rooms.get(ws.room);
    if (!room) return;
    if (ws.role === 'host') {
      for (const c of room.controllers.values()) send(c, { t: 'host-gone' });
      rooms.delete(ws.room);
    } else if (ws.role === 'ctrl') {
      room.controllers.delete(ws.id);
      send(room.host, { t: 'leave', id: ws.id });
    }
  });
});

setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false; ws.ping();
  }
}, 15000);

function lanIps() {
  return Object.values(os.networkInterfaces()).flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i.address);
}

server.listen(PORT, () => {
  const ips = lanIps();
  console.log(`\n  Ecos de Sagres a correr na porta ${PORT}`);
  console.log(`  TV:      http://localhost:${PORT}/tv/`);
  for (const ip of ips) console.log(`  Comando: http://${ip}:${PORT}/controller/`);
  console.log('');
});
