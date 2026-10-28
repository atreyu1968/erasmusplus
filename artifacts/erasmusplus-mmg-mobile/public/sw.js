const scopeUrl = new URL(self.registration.scope);
const defaultTarget = new URL('./', scopeUrl).href;
const iconUrl = new URL('erasmus-favicon-192.png', scopeUrl).href;

self.addEventListener('push', event => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }

  let target = defaultTarget;
  if (typeof payload.url === 'string') {
    try {
      const candidate = new URL(payload.url, self.location.origin);
      if (candidate.origin === self.location.origin &&
          candidate.pathname.startsWith(scopeUrl.pathname)) {
        target = candidate.href;
      }
    } catch {
      target = defaultTarget;
    }
  }

  event.waitUntil(self.registration.showNotification('Nuevo mensaje · Erasmus+ MMG', {
    body: 'Tienes un mensaje nuevo en Erasmus+ MMG.',
    icon: iconUrl,
    badge: iconUrl,
    data: { url: target },
    renotify: false
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const candidate = event.notification.data?.url;
  let target = defaultTarget;
  try {
    const url = new URL(candidate || defaultTarget, self.location.origin);
    if (url.origin === self.location.origin && url.pathname.startsWith(scopeUrl.pathname)) {
      target = url.href;
    }
  } catch {
    target = defaultTarget;
  }

  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clients) {
      if (new URL(client.url).origin === self.location.origin &&
          new URL(client.url).pathname.startsWith(scopeUrl.pathname)) {
        await client.navigate(target);
        return client.focus();
      }
    }
    return self.clients.openWindow(target);
  })());
});
