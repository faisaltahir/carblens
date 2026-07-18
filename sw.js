// CarbLens service worker — app-shell caching + one-tap update support.
// BUMP CACHE_VERSION whenever index.html changes so clients detect the update.
const CACHE_VERSION = 'carblens-v2026-07-18-1800'
const APP_SHELL = ['./', './index.html']

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_VERSION).then(c => c.addAll(APP_SHELL)).catch(() => {})
  )
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

// Page sends 'SKIP_WAITING' when the user taps "Update now"
self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url)
  // Never cache API calls — Gemini, Google auth, Drive
  if (url.hostname.includes('googleapis.com') || url.hostname.includes('accounts.google.com')) return
  if (e.request.method !== 'GET') return
  // Network-first for the app shell so new uploads are picked up promptly;
  // fall back to cache when offline.
  e.respondWith(
    fetch(e.request).then(resp => {
      if (resp.ok && (url.pathname.endsWith('/') || url.pathname.endsWith('index.html'))) {
        const copy = resp.clone()
        caches.open(CACHE_VERSION).then(c => c.put(e.request, copy)).catch(() => {})
      }
      return resp
    }).catch(() => caches.match(e.request))
  )
})
