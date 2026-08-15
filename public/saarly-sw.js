self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open('saarly-app-v1');
    const root = await fetch('/', { cache: 'reload' });
    await cache.put('/', root.clone());
    const html = await root.text();
    const generatedAssets = [...html.matchAll(/(?:src|href)=["'](\/[^"']+)["']/g)].map((match) => match[1]);
    const assets = [...new Set(['/manifest.json', '/saarly-icon-192.png', '/saarly-icon-512.png', '/apple-touch-icon.png', ...generatedAssets])];
    await Promise.allSettled(assets.map((asset) => cache.add(asset)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith('saarly-app-') && name !== 'saarly-app-v1').map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open('saarly-app-v1');
    if (event.request.mode === 'navigate') {
      try {
        const response = await fetch(event.request);
        await cache.put('/', response.clone());
        return response;
      } catch { return (await cache.match('/')) || Response.error(); }
    }
    const cached = await cache.match(event.request);
    if (cached) return cached;
    try {
      const response = await fetch(event.request);
      if (response.ok) await cache.put(event.request, response.clone());
      return response;
    } catch { return Response.error(); }
  })());
});

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
