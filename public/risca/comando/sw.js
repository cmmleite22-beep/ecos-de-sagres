// Service worker mínimo: permite instalar o comando como app no Android (PWA).
const C = 'risca-ctrl-v4';
const FILES = ['./', 'index.html', 'comando.css', 'comando.js', 'manifest.webmanifest', 'icon.svg', '../config.js', '../../shared/config.js', '../quadro.js', '../palavras.js', '../i18n.js', '../anfitriao.js', '../palavras/pt.js', '../palavras/pt-BR.js', '../palavras/en.js', '../palavras/es.js', '../palavras/fr.js', '../palavras/de.js', '../palavras/zh.js'];
self.addEventListener('install', (e) => e.waitUntil(caches.open(C).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});
