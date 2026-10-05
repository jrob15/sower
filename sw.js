/* Sower: keeps a copy of the app so it opens, and keeps working, without a signal.
   Build ec73a31a00. A new build has a new cache name, so nothing stale is ever served after an update. */
const CACHE = 'sower-ec73a31a00';
const SHELL = [
 "./",
 "manifest.webmanifest",
 "icons/icon-192.png",
 "icons/icon-512.png",
 "icons/icon-maskable-192.png",
 "icons/icon-maskable-512.png",
 "icons/apple-touch-icon.png",
 "icons/favicon-32.png",
 "fonts/vollkorn-greek-wght-normal.woff2",
 "fonts/vollkorn-latin-ext-wght-normal.woff2",
 "fonts/vollkorn-latin-wght-normal.woff2",
 "fonts/vollkorn-greek-wght-italic.woff2",
 "fonts/vollkorn-latin-ext-wght-italic.woff2",
 "fonts/vollkorn-latin-wght-italic.woff2",
 "fonts/barlow-latin-400-normal.woff2",
 "fonts/barlow-latin-500-normal.woff2",
 "fonts/barlow-latin-600-normal.woff2",
 "fonts/barlow-latin-ext-400-normal.woff2",
 "fonts/barlow-latin-ext-500-normal.woff2",
 "fonts/barlow-latin-ext-600-normal.woff2",
 "fonts/barlow-semi-condensed-latin-500-normal.woff2",
 "fonts/barlow-semi-condensed-latin-600-normal.woff2",
 "fonts/barlow-semi-condensed-latin-700-normal.woff2",
 "fonts/barlow-semi-condensed-latin-ext-500-normal.woff2",
 "fonts/barlow-semi-condensed-latin-ext-600-normal.woff2",
 "fonts/barlow-semi-condensed-latin-ext-700-normal.woff2"
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('sower-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    // the page itself: the newest copy when there is a connection, the kept one when there is not
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put('./', copy)); }
          return res;
        })
        .catch(() => caches.open(CACHE).then((c) => c.match('./')))
    );
    return;
  }
  // everything else (text, pictures, fonts): the kept copy first, the network otherwise, and keep what was fetched
  e.respondWith(
    caches.open(CACHE).then((c) =>
      c.match(req, { ignoreSearch: true }).then((hit) =>
        hit || fetch(req).then((res) => {
          if (res.ok && res.type === 'basic') c.put(req, res.clone());
          return res;
        })
      )
    )
  );
});

// the page asks, once it has settled, for the rest to be fetched quietly: pictures, commentary, then the Bible text
self.addEventListener('message', (e) => {
  if (!e.data) return;
  if (e.data.type === 'warm' && Array.isArray(e.data.urls)) e.waitUntil(warm(e.data.urls, e.source));
  if (e.data.type === 'version' && e.source) e.source.postMessage({ type: 'version', build: 'ec73a31a00' });
});

async function warm(urls, client) {
  const c = await caches.open(CACHE);
  let have = 0;
  for (const u of urls) {
    try {
      if (await c.match(u)) { have++; continue; }
      const res = await fetch(u);
      if (res.ok) { await c.put(u, res); have++; }
    } catch (err) { /* no connection just now: what is missing is fetched when it is asked for */ }
  }
  if (client && client.postMessage) client.postMessage({ type: 'warmed', have: have, of: urls.length });
}
