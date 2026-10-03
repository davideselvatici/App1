/* Dove Spendo: tiene in memoria i file dell'app per aprirla anche senza connessione.
   Cambia VERSION quando aggiorni font, icone o altri file. */
const VERSION = 'dove-spendo-v7';
const FILES = [
  './', './index.html', './manifest.webmanifest',
  './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png', './favicon-32.png',
  './bricolage-grotesque.woff2', './plex-sans-400.woff2', './plex-sans-500.woff2', './plex-sans-600.woff2',
  './plex-mono-400.woff2', './plex-mono-500.woff2', './xlsx.full.min.js'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(VERSION).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    // Pagina: prima la rete, così gli aggiornamenti arrivano; senza rete, la copia salvata.
    event.respondWith(
      fetch(req)
        .then(res => { const copy = res.clone(); caches.open(VERSION).then(c => c.put('./index.html', copy)); return res; })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }
  event.respondWith(caches.match(req).then(hit => hit || fetch(req)));
});
