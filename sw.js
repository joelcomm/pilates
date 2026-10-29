/* Offline cache for Mat Daily. Bump VERSION when files change. */
var VERSION = 'matdaily-v6';
var FILES = ['./', 'index.html', 'style.css', 'exercises.js', 'app.js', 'manifest.webmanifest',
  'fonts/fonts.css', 'fonts/bricolage-600.woff2', 'fonts/bricolage-800.woff2',
  'fonts/instrument-400.woff2', 'fonts/instrument-500.woff2', 'fonts/instrument-600.woff2',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(function (hit) {
    return hit || fetch(e.request).catch(function () { return caches.match('index.html'); });
  }));
});
