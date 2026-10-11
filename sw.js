// Tagesform Service Worker: App offline verfügbar halten (Netz zuerst, sonst Cache)
const VERSION = '1.0.0-202610092040';
const CACHE = 'tf-' + VERSION;
const SHELL = ['./', './index.html', './app.css', './config.js', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png', ...["./js/c-AM3CJMBL.js","./js/c-GOJD2GXO.js","./js/c-LN6RNOMN.js","./js/c-OOPXXTS2.js","./js/c-Z6SMJ3PX.js","./js/main.js"]];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.all(SHELL.map((u) => c.add(new Request(u, { cache: 'reload' })).catch(() => null))))
      .then(() => self.skipWaiting()),
  );
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('tf-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  e.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      try {
        const res = req.mode === 'navigate' ? await fetch(req) : await fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' });
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      } catch (err) {
        const hit = (await cache.match(req, { ignoreSearch: true })) || (req.mode === 'navigate' ? await cache.match('./index.html') : null);
        if (hit) return hit;
        throw err;
      }
    })(),
  );
});
