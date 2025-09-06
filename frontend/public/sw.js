const APP_CACHE = 'breakout-app-v1';
const APP_ASSETS = [
  '/', '/index.html', '/manifest.webmanifest',
  '/src/main.jsx', '/src/App.jsx', '/src/index.css',
  '/icons/icon-192.png', '/icons/icon-512.png', '/icons/apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(APP_CACHE).then((cache) => cache.addAll(APP_ASSETS)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== APP_CACHE).map(k => caches.delete(k))))
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(
      fetch(e.request).then((res) => {
        const clone = res.clone();
        caches.open(APP_CACHE).then((c) => c.put(e.request, clone));
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }
  e.respondWith(caches.match(e.request).then((cached) => cached || fetch(e.request)));
});
