/* Physio Tracker service worker — push notifications only.
   Deliberately does no caching: the app is a static export served from a CDN,
   and a stale cache would be worse than a network round trip. */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: 'Physio Tracker', body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'Physio Tracker';
  const options = {
    body: payload.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    // Same tag replaces an earlier unread nudge instead of stacking them up.
    tag: payload.tag || 'physio',
    renotify: true,
    data: { url: payload.url || '/' },
    actions: [{ action: 'open', title: 'Open checklist' }],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      // Reuse an already-open tab where possible.
      for (const client of windows) {
        if ('focus' in client) {
          client.navigate(target).catch(() => {});
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
