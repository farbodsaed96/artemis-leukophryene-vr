// cache-first service worker: every file the page fetches is kept, so the tour works offline after one full visit
const CACHE = 'artemis-vr-v1';
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => fetch('data/files.json').then((r) => r.json()).then((l) => c.addAll(l.core))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.open(CACHE).then(async (c) => {
    const hit = await c.match(e.request, { ignoreSearch: true });
    if (hit) return hit;
    const res = await fetch(e.request);
    if (res.ok && new URL(e.request.url).origin === location.origin) c.put(e.request, res.clone());
    return res;
  }));
});
