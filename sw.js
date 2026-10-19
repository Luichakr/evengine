// EV ENGINE (UA) — offline app shell. Bump CACHE_VERSION on every release.
const CACHE_VERSION = 'ev-ua-2';
const SHELL = [
  './', 'index.html', 'app.css', 'manifest.webmanifest', 'icon.svg',
  'js/app.js', 'js/i18n.js', 'js/engines.js', 'js/logo.js', 'js/intro.js', 'js/safety.js',
  'js/drivetrain.js', 'js/speed.js', 'js/gauges.js', 'js/fx.js',
  'js/synth-dsp.js', 'js/engine-worklet.js', 'js/synth-audio.js', 'js/synth-audio-eq.js', 'js/audio-out.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Network-first: always try the network (so edits/updates arrive on the next load), fall back to the
// cache only when offline. Keeps the app usable without coverage without ever serving stale code.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (url.pathname.endsWith('/e')) return;                 // stats: network-only
  if (url.origin !== self.location.origin) return;         // let fonts etc. go to network
  e.respondWith(
    fetch(e.request).then(r => {
      if (r.ok) { const copy = r.clone(); caches.open(CACHE_VERSION).then(c => c.put(e.request, copy)); }
      return r;
    }).catch(() => caches.match(e.request).then(r => r || (e.request.mode === 'navigate' ? caches.match('index.html') : r)))
  );
});
