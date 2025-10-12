// sw.js
const CACHE = 'sales-board-v2';

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    try {
      await cache.addAll([
        '/', '/index.html',
        '/css/styles.css',
        '/js/app.js',
        '/manifest.json',
        '/assets/icon.png'
      ]);
    } catch (_) {}
  })());
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
  })());
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // ВАЖНО: не перехватываем API и негет-запросы
  if (url.pathname.startsWith('/api/') || e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then(res => res || fetch(e.request)));
});
