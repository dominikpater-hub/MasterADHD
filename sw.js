/* ============================================================
   MasterADHD — Service Worker (offline-first shell)
   ------------------------------------------------------------
   Strategia: cache-first na powłokę aplikacji (jeden ekran, statyczne
   moduły), z aktualizacją w tle. Żądania cross-origin (proxy AI,
   Google, Anthropic) NIE są przechwytywane — mają iść siecią.
   Nawigacja offline dostaje z cache index.html, więc „Max działa
   offline" przestaje być obietnicą bez pokrycia (audyt A-8).
   Wersję bumpujemy przy każdej zmianie powłoki, żeby wyczyścić stary cache.
   ============================================================ */
const CACHE = 'masteradhd-shell-v17';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/styles.css',
  './js/01-core.js',
  './js/02-safety.js',
  './js/03-ai.js',
  './js/04-now.js',
  './js/05-profile.js',
  './js/06-emotions.js',
  './js/07-goals.js',
  './js/08-auth.js',
  './js/09-tasks.js',
  './js/10-sensors.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon.svg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;                 // tylko odczyty
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;  // proxy/API/Google idą siecią, nie z cache

  e.respondWith(
    caches.match(req).then((hit) => {
      if (hit) {
        /* Aktualizacja w tle — użytkownik dostaje cache od razu, świeże na następny raz. */
        e.waitUntil(
          fetch(req).then((res) => {
            const copy = res.clone();
            return caches.open(CACHE).then((c) => c.put(req, copy));
          }).catch(() => {})
        );
        return hit;
      }
      return fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => {
        if (req.mode === 'navigate') return caches.match('./index.html');
        return new Response('', { status: 504, statusText: 'offline' });
      });
    })
  );
});
