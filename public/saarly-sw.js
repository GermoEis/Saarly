self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { payload = { body: event.data?.text() }; }
  const notification = payload.notification || payload;
  event.waitUntil(self.registration.showNotification(notification.title || 'Saarly', {
    body: notification.body || 'Sul on uus teavitus.',
    icon: '/saarly-icon-192.png',
    badge: '/saarly-icon-192.png',
    tag: notification.tag || 'saarly-update',
    data: { url: notification.url || notification.navigate || '/notifications' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/notifications', self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    const existing = clients.find((client) => client.url.startsWith(self.location.origin));
    if (existing) { existing.navigate(target); return existing.focus(); }
    return self.clients.openWindow(target);
  }));
});
