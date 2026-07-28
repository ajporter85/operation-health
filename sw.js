/* sw.js — Operation: Health
   Minimal offline shell. Deliberately light in Phase 1 — installability and
   reminders are a later phase. Bump CACHE when shell files change. */
'use strict';

var CACHE = 'operation-health-v4';
var SHELL = [
  './',
  './index.html',
  './styles.css',
  './logic.js',
  './storage.js',
  './cookbook-meals.js',
  './app.js',
  './manifest.webmanifest',
  './apple-touch-icon.png',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }));
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== CACHE) return caches.delete(k);
      }));
    })
  );
  self.clients.claim();
});

// Cache-first for the shell; fall back to network for anything else.
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(function (hit) {
      return hit || fetch(e.request);
    })
  );
});
