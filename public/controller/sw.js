// Service worker mínimo: permite instalar o comando como app no Android (PWA).
const C = 'ecos-ctrl-v1';
const FILES = ['./', 'index.html', 'controller.css', 'controller.js', 'manifest.webmanifest', 'icon.svg', '../shared/config.js', '../shared/protocol.js'];
self.addEventListener('install', (e) => e.waitUntil(caches.open(C).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});
