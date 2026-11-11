// service worker v9: pages, code and data = network first (always the newest when online, cached copy offline);
// panoramas, models and images = cache first (large, they never change under the same name)
const CACHE = 'artemis-vr-v9';
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => fetch('data/files.json', { cache: 'no-store' }).then((r) => r.json()).then((l) => c.addAll(l.core))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  const heavy = /\.(jpg|png|glb)$/i.test(url.pathname);
  e.respondWith(caches.open(CACHE).then(async (c) => {
    if (heavy) {
      const hit = await c.match(e.request, { ignoreSearch: true });
      if (hit) return hit;
      const res = await fetch(e.request); if (res.ok) c.put(e.request, res.clone()); return res;
    }
    try {
      const res = await fetch(e.request, { cache: 'no-cache' }); if (res.ok) c.put(e.request, res.clone()); return res;
    } catch (err) {
      const hit = await c.match(e.request, { ignoreSearch: true }); if (hit) return hit; throw err;
    }
  }));
});
