/* Service Worker - لوحة دورة المطاعم v1 */
const CACHE_NAME = 'farouk-res-admin-v1';
const SHELL = [
  './admin-res.html',
  './manifest-res.webmanifest',
  './icon-res-192.png',
  './icon-res-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(SHELL).catch(() => {})));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (
    url.hostname.includes('workers.dev') ||
    url.hostname.includes('script.google.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('googleusercontent.com')
  ) return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((res) => {
          if (res && res.status === 200 && event.request.method === 'GET') {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(event.request, clone)).catch(() => {});
          }
          return res;
        })
        .catch(() => cached || caches.match('./admin-res.html'));
    })
  );
});

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'SHOW_NOTIFICATION') {
    event.waitUntil(
      self.registration.showNotification(data.title || 'تذكير — دورة المطاعم', {
        body: data.body || '',
        icon: './icon-res-192.png',
        badge: './icon-res-192.png',
        tag: data.tag || 'res-reminder',
        requireInteraction: true,
        vibrate: [200, 100, 200],
        data: { url: './admin-res.html' }
      })
    );
  }
  if (data.type === 'SCHEDULE_APPS' && Array.isArray(data.appointments)) {
    event.waitUntil(scheduleFutureNotifications(data.appointments));
  }
});

async function scheduleFutureNotifications(apps) {
  const now = Date.now();
  for (const a of apps) {
    if (!a.date || !a.time || !a.id) continue;
    try {
      const ts = new Date(a.date + 'T' + a.time + ':00').getTime();
      if (isNaN(ts) || ts <= now) continue;
      const opts = {
        body: a.title + (a.time ? ' — الساعة ' + a.time : ''),
        icon: './icon-res-192.png',
        badge: './icon-res-192.png',
        tag: 'app-' + a.id,
        requireInteraction: true,
        data: { url: './admin-res.html', appId: a.id }
      };
      if (typeof TimestampTrigger !== 'undefined') {
        opts.showTrigger = new TimestampTrigger(ts);
        await self.registration.showNotification('موعد قادم — دورة المطاعم', opts);
      }
    } catch (e) {}
  }
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || './admin-res.html';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.indexOf('admin-res') !== -1 && 'focus' in c) return c.focus();
      }
      if (clients.openWindow) return clients.openWindow(target);
    })
  );
});
