/* McNabb · service worker
   Réseau d'abord (les mises à jour GitHub apparaissent tout de suite), cache en secours hors ligne,
   et affichage des notifications envoyées par le Worker Cloudflare.
   Changez CACHE si vous voulez forcer un nettoyage complet. */
const CACHE = 'mcnabb-v3';
const ASSETS = ['./', './index.html', './schedule.js', './manifest.webmanifest', './icons/apple-touch-icon.png', './icons/icon-192.png', './icons/icon-512.png', './icons/favicon-32.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE)
    .then(c => Promise.all(ASSETS.map(u => c.add(u).catch(() => null))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return; // météo et notifications : toujours en direct
  e.respondWith(
    fetch(req).then(res => {
      if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req)
      .then(r => r || (req.mode === 'navigate' ? caches.match('./index.html') : null))
      .then(r => r || Response.error()))
  );
});

/* Notifications : chaque message reçu doit s'afficher (exigence d'Apple et des navigateurs). */
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'McNabb', {
    body: d.body || '',
    tag: d.tag || 'mcnabb',
    icon: 'icons/icon-192.png',
    data: { url: d.url || './', tab: d.tab || 'today' }
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const data = e.notification.data || {};
  const target = new URL(data.url || './', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) {
      if ('focus' in c) { c.postMessage({ tab: data.tab }); return c.focus(); }
    }
    return self.clients.openWindow ? self.clients.openWindow(target) : null;
  }));
});
