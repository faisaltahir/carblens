// CarbLens service worker — offline app-shell caching.
// Bump CACHE when you ship a new index.html to force clients to update.
const CACHE = 'carblens-v2';

// App shell + fonts. The shell is what makes the app load offline.
const SHELL = [
  './',
  './index.html',
  'https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Syne:wght@400;600;700;800&display=swap'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.allSettled(SHELL.map(u => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return; // never touch POSTs (Gemini/Drive API calls)

  let url;
  try { url = new URL(req.url); } catch (_) { return; }

  // Never cache API / auth traffic — must always hit the network.
  const apiHosts = ['generativelanguage.googleapis.com', 'googleapis.com', 'accounts.google.com', 'gstatic.com'];
  if (apiHosts.some(h => url.hostname.endsWith(h) || url.hostname === h)) {
    return; // default browser handling
  }

  // Navigations / app shell → cache-first, falling back to network, then cache.
  const isShell =
    req.mode === 'navigate' ||
    url.origin === self.location.origin ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com');

  if (isShell) {
    e.respondWith(
      caches.match(req).then(cached => {
        const network = fetch(req).then(res => {
          if (res && res.ok && (url.origin === self.location.origin || url.hostname.includes('fonts.'))) {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(req, copy));
          }
          return res;
        }).catch(() => cached || caches.match('./index.html'));
        return cached || network;
      })
    );
  }
});
