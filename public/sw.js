// Dilbaz Service Worker — Offline shell, Web Push (when app/APK is closed), monochrome badge & sound
const CACHE_NAME = 'dilbaz-shell-v3';
const PRECACHE_ASSETS = [
  './',
  './pwa-192x192.png',
  './pwa-badge-96x96.png',
  './sounds/dilbaz-bildirim.wav'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      const urls = PRECACHE_ASSETS.map((p) => new URL(p, self.registration.scope).href);
      return Promise.all(
        urls.map((u) => cache.add(u).catch(() => undefined))
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/.well-known/')) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => undefined);
          }
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(req);
          if (cached) return cached;
          const fallback = await caches.match(new URL('./', self.registration.scope).href);
          return fallback || Response.error();
        })
    );
  }
});

// Background Web Push handler — wakes up even when PWA/Android APK is closed!
self.addEventListener('push', (event) => {
  let payload = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      payload = { body: event.data.text() };
    }
  }

  const title = payload.title || 'Dilbaz Düellosu Başlıyor! ⚔️';
  const body =
    payload.body ||
    'Arkadaşın seni Dilbazda düelloya davet ediyor, acele et!';
  const roomCode = payload.roomCode || undefined;
  const tab = payload.tab || (roomCode ? 'room' : 'friends');
  const tag = payload.tag || `dilbaz_push_${Date.now()}`;
  const badgeCount = typeof payload.badgeCount === 'number' ? payload.badgeCount : undefined;

  const iconUrl = new URL('./pwa-192x192.png', self.registration.scope).href;
  const badgeUrl = new URL('./pwa-badge-96x96.png', self.registration.scope).href;
  const soundUrl = new URL('./sounds/dilbaz-bildirim.wav', self.registration.scope).href;
  const targetUrl = roomCode
    ? new URL(`?oda=${encodeURIComponent(roomCode)}`, self.registration.scope).href
    : new URL('./', self.registration.scope).href;

  event.waitUntil(
    (async () => {
      try {
        if (typeof badgeCount === 'number' && self.navigator && typeof self.navigator.setAppBadge === 'function') {
          if (badgeCount > 0) {
            await self.navigator.setAppBadge(badgeCount).catch(() => undefined);
          }
        } else if (self.navigator && typeof self.navigator.setAppBadge === 'function') {
          await self.navigator.setAppBadge(1).catch(() => undefined);
        }
      } catch {
        // ignore unsupported badge API
      }

      // Ask any visible open clients to chime Dilbaz custom notification sound
      const clientList = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true
      });
      let hasVisibleClient = false;
      for (const client of clientList) {
        if (client.visibilityState === 'visible') {
          hasVisibleClient = true;
          client.postMessage({
            type: 'DILBAZ_PUSH_RECEIVED',
            payload: { title, body, roomCode, tab, tag }
          });
        }
      }

      await self.registration.showNotification(title, {
        body,
        icon: iconUrl,
        badge: badgeUrl,
        sound: soundUrl,
        tag,
        renotify: !hasVisibleClient,
        requireInteraction: true,
        vibrate: [200, 90, 240, 90, 200],
        data: {
          roomCode,
          tab,
          url: targetUrl
        }
      });
    })()
  );
});

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const res = await fetch(new URL('./api/push/vapid-public-key', self.registration.scope).href);
        if (!res.ok) return;
        const { publicKey } = await res.json();
        if (!publicKey) return;
        const padding = '='.repeat((4 - (publicKey.length % 4)) % 4);
        const base64 = (publicKey + padding).replace(/-/g, '+').replace(/_/g, '/');
        const rawData = atob(base64);
        const keyArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) keyArray[i] = rawData.charCodeAt(i);
        const newSub = await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: keyArray
        });
        const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (const client of clients) {
          client.postMessage({
            type: 'DILBAZ_PUSH_SUB_CHANGED',
            subscription: newSub.toJSON()
          });
        }
      } catch {
        // ignore silent background refresh failures
      }
    })()
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const relativeTarget = data.roomCode ? `?oda=${encodeURIComponent(data.roomCode)}` : './';
  const targetUrl = new URL(relativeTarget, self.registration.scope).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          client.postMessage({
            type: 'DILBAZ_NOTIFICATION_CLICK',
            roomCode: data.roomCode || null,
            tab: data.tab || 'friends'
          });
          return;
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
