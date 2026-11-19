// Dilbaz Service Worker — Resilient mobile PWA shell, offline recovery, Web Push, app icon badge & sound
const CACHE_NAME = 'dilbaz-shell-v6';
const PRECACHE_ASSETS = [
  './',
  './manifest.webmanifest',
  './pwa-192x192.png',
  './pwa-512x512.png',
  './pwa-badge-96x96.png',
  './sounds/dilbaz-bildirim.wav'
];

let lastSwBadgeCount = 0;

async function syncServiceWorkerBadge(count) {
  const safeCount = Math.max(0, Math.floor(Number.isFinite(count) ? count : 0));
  lastSwBadgeCount = safeCount;
  try {
    const nav = self.navigator;
    if (!nav) return false;
    if (safeCount > 0 && typeof nav.setAppBadge === 'function') {
      try {
        await nav.setAppBadge(safeCount);
      } catch {
        await nav.setAppBadge().catch(() => undefined);
      }
      return true;
    }
    if (safeCount === 0 && typeof nav.clearAppBadge === 'function') {
      await nav.clearAppBadge().catch(() => undefined);
      return true;
    }
  } catch {
    // ignore unsupported badge API
  }
  return false;
}

function fetchWithTimeout(request, timeoutMs) {
  const controller = new AbortController();
  const timerId = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(request, { signal: controller.signal }).finally(() => clearTimeout(timerId));
}

function createOfflineRecoveryHtml() {
  return new Response(
    '<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Dilbaz</title><style>body{margin:0;min-height:100dvh;display:flex;align-items:center;justify-content:center;background:#0d1629;color:#f8fafc;font-family:system-ui,-apple-system,sans-serif;padding:24px;text-align:center}.card{max-width:360px;background:#14213d;border:1px solid rgba(255,190,11,.35);border-radius:24px;padding:28px 22px;box-shadow:0 20px 50px rgba(0,0,0,.5)}h1{margin:0 0 8px;font-size:20px;color:#ffbe0b}p{margin:0 0 18px;font-size:14px;line-height:1.5;color:#cbd5e1}button{width:100%;border:0;border-radius:14px;padding:12px 16px;font-weight:700;font-size:14px;background:linear-gradient(135deg,#ff006e,#ffbe0b);color:#fff;cursor:pointer}</style></head><body><div class="card"><h1>Dilbaz Bağlantı Bekliyor</h1><p>Uygulama kabuğu şu an ağa erişemiyor. İnternet bağlantınızı kontrol edip yeniden deneyin.</p><button onclick="window.location.reload()">Tekrar Dene</button></div></body></html>',
    {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    }
  );
}

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
  if (req.headers.has('range')) return;

  const scopeRootUrl = new URL('./', self.registration.scope).href;

  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const res = await fetchWithTimeout(req, 4500);
          if (res && res.ok) {
            const ct = res.headers.get('content-type') || '';
            if (ct.includes('text/html')) {
              const cache = await caches.open(CACHE_NAME);
              await Promise.all([
                cache.put(req, res.clone()).catch(() => undefined),
                cache.put(scopeRootUrl, res.clone()).catch(() => undefined)
              ]);
            }
            return res;
          }
          if (res && res.status < 500) {
            return res;
          }
        } catch {
          // Network offline or stalled: fall back to cache below
        }

        const cachedExact = await caches.match(req);
        if (cachedExact) return cachedExact;
        const cachedRoot = await caches.match(scopeRootUrl);
        if (cachedRoot) return cachedRoot;
        return createOfflineRecoveryHtml();
      })()
    );
    return;
  }

  // Cache hashed build assets (/assets/*.js, /assets/*.css, images) safely without ever caching HTML error responses
  if (
    url.pathname.startsWith('/assets/') &&
    !/\.(mp4|webm)$/i.test(url.pathname)
  ) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(req);
        if (cached) return cached;
        try {
          const res = await fetch(req);
          if (res && res.ok) {
            const ct = res.headers.get('content-type') || '';
            if (!ct.includes('text/html')) {
              const cache = await caches.open(CACHE_NAME);
              cache.put(req, res.clone()).catch(() => undefined);
            }
          }
          return res;
        } catch {
          return cached || Response.error();
        }
      })()
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
  const rawBadgeCount = typeof payload.badgeCount === 'number' ? payload.badgeCount : undefined;

  const iconUrl = new URL('./pwa-192x192.png', self.registration.scope).href;
  const badgeUrl = new URL('./pwa-badge-96x96.png', self.registration.scope).href;
  const soundUrl = new URL('./sounds/dilbaz-bildirim.wav', self.registration.scope).href;
  const targetUrl = roomCode
    ? new URL(`?oda=${encodeURIComponent(roomCode)}`, self.registration.scope).href
    : new URL('./', self.registration.scope).href;

  event.waitUntil(
    (async () => {
      const existingNotifs = await self.registration.getNotifications().catch(() => []);
      const sameTagExists = existingNotifs.some((n) => n.tag && n.tag === tag);
      const nextActiveCount = existingNotifs.length + (sameTagExists ? 0 : 1);
      const resolvedBadgeCount =
        rawBadgeCount === 0
          ? 0
          : Math.max(
              typeof rawBadgeCount === 'number' ? rawBadgeCount : 1,
              nextActiveCount,
              lastSwBadgeCount > 0 ? lastSwBadgeCount + (sameTagExists ? 0 : 1) : 1
            );

      await syncServiceWorkerBadge(resolvedBadgeCount);

      // Ask any open clients to chime Dilbaz custom notification sound & sync badge state
      const clientList = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true
      });
      let hasVisibleClient = false;
      for (const client of clientList) {
        if (client.visibilityState === 'visible') {
          hasVisibleClient = true;
        }
        client.postMessage({
          type: 'DILBAZ_PUSH_RECEIVED',
          payload: {
            title,
            body,
            roomCode,
            tab,
            tag,
            badgeCount: resolvedBadgeCount
          }
        });
      }

      await self.registration.showNotification(title, {
        body,
        icon: iconUrl,
        badge: badgeUrl,
        sound: soundUrl,
        tag,
        renotify: true,
        requireInteraction: true,
        vibrate: [200, 90, 240, 90, 200],
        data: {
          roomCode,
          tab,
          url: targetUrl,
          hasVisibleClient,
          badgeCount: resolvedBadgeCount
        }
      });
    })()
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'DILBAZ_SET_BADGE') {
    const count =
      typeof event.data.count === 'number' ? Math.max(0, Math.floor(event.data.count)) : 0;
    event.waitUntil(syncServiceWorkerBadge(count));
  }
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

self.addEventListener('notificationclose', (event) => {
  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      if (clients.length > 0) return;
      const remaining = await self.registration.getNotifications().catch(() => []);
      if (remaining.length === 0) {
        await syncServiceWorkerBadge(0);
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
