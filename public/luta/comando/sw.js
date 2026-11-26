// Service worker mínimo: permite instalar o comando como app no Android (PWA).
const C = 'furia-ctrl-v1';
const FILES = ['./', 'index.html', 'comando.css', 'comando.js', 'manifest.webmanifest', 'icon.svg', '../config.js', '../../shared/config.js', '../tv/jogo/desenho.js', '../tv/jogo/lutadores.js'];
self.addEventListener('install', (e) => e.waitUntil(caches.open(C).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});
