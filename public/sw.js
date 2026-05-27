// V4 cache key (was v3 in #362's "self-update on every PWA foreground").
// Bumping forces a fresh install + activate so iPhone PWAs sitting on the
// old v3 cache discard it and pull the latest bundle — the V2 root-cause
// investigation flagged stale-SW-cache as a leading suspect for the sync
// receipt not surviving PWA reopen.
const CACHE_NAME = 'ironpath-app-shell-v4';
const APP_SHELL = ['/', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Only cache successful responses. A 5xx / 404 / opaqueredirect must
        // not pin itself into the cache — otherwise the next offline open
        // would replay the bad response forever. The original V3 handler
        // cached unconditionally, which on flaky cellular looked exactly
        // like a "stale" bundle issue (because the bad response WAS the
        // cached one).
        if (response && response.ok && response.type !== 'opaqueredirect') {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match('/')))
  );
});
