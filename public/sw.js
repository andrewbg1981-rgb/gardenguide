// Service worker: lets GardenGuide open without a network connection.
// A service worker is a small script the browser keeps beside the page and
// runs for every request the page makes — like a cache controller sitting
// between the app and the network.
//
// Strategy:
//   - The page itself: network first (so updates arrive), cached copy if offline.
//   - Everything else (scripts, styles, fonts, icons): cached copy first; their
//     file names change whenever their content does, so a cached copy is never stale.

const CACHE = 'gardenguide-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => { putInCache(req, res.clone()); return res; })
        .catch(() => caches.match(req).then((hit) => hit || caches.match('./'))),
    );
    return;
  }
  event.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => { putInCache(req, res.clone()); return res; })),
  );
});

function putInCache(req, res) {
  if (res.ok) caches.open(CACHE).then((c) => c.put(req, res));
}
