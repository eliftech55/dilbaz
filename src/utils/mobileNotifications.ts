export interface MobilePushPayload {
  title: string;
  body: string;
  tag?: string;
  roomCode?: string;
  tab?: 'room' | 'friends' | 'library' | 'leaderboard';
}

let registeredSwPromise: Promise<ServiceWorkerRegistration | null> | null = null;

export function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return Promise.resolve(null);
  }
  if (!registeredSwPromise) {
    registeredSwPromise = navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((reg) => reg)
      .catch((err) => {
        console.warn('Service worker registration skipped:', err);
        return null;
      });
  }
  return registeredSwPromise;
}

export function getNotificationSupportState(): {
  supported: boolean;
  permission: NotificationPermission | 'unsupported';
  isStandalone: boolean;
} {
  if (typeof window === 'undefined') {
    return { supported: false, permission: 'unsupported', isStandalone: false };
  }
  const isStandalone =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (window.navigator as { standalone?: boolean }).standalone === true;

  if (!('Notification' in window)) {
    return { supported: false, permission: 'unsupported', isStandalone };
  }
  return {
    supported: true,
    permission: Notification.permission,
    isStandalone
  };
}

export async function requestMobileNotificationPermission(): Promise<
  NotificationPermission | 'unsupported'
> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  try {
    await registerServiceWorker();
    const result = await Notification.requestPermission();
    return result;
  } catch (err) {
    console.warn('Notification permission request failed:', err);
    return Notification.permission;
  }
}

export function vibrateMobileDevice(pattern: number | number[] = [180, 80, 220]): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern);
    }
  } catch {
    // ignore unsupported vibration environments
  }
}

export async function sendMobilePushNotification(
  payload: MobilePushPayload
): Promise<boolean> {
  vibrateMobileDevice([180, 80, 220]);

  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }
  if (Notification.permission !== 'granted') {
    return false;
  }

  const targetUrl = payload.roomCode
    ? `/?oda=${encodeURIComponent(payload.roomCode)}`
    : '/';

  const notifOptions: NotificationOptions & {
    renotify?: boolean;
    vibrate?: number[];
  } = {
    body: payload.body,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: payload.tag || `dilbaz_${Date.now()}`,
    renotify: true,
    vibrate: [180, 80, 220],
    data: {
      roomCode: payload.roomCode,
      tab: payload.tab || 'friends',
      url: targetUrl
    }
  };

  try {
    const reg =
      (await Promise.race([
        navigator.serviceWorker?.ready,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 1200))
      ])) || (await registerServiceWorker());

    if (reg && typeof reg.showNotification === 'function') {
      await reg.showNotification(payload.title, notifOptions);
      return true;
    }
  } catch (err) {
    console.warn('ServiceWorker showNotification fallback:', err);
  }

  // Fallback for desktop browsers when SW is not active yet
  try {
    const n = new Notification(payload.title, {
      body: payload.body,
      icon: '/pwa-192x192.png',
      tag: notifOptions.tag
    });
    n.onclick = () => {
      window.focus();
      if (payload.roomCode) {
        window.dispatchEvent(
          new CustomEvent('dilbaz-notification-click', {
            detail: { roomCode: payload.roomCode, tab: payload.tab || 'room' }
          })
        );
      }
      n.close();
    };
    return true;
  } catch {
    // Android Chrome throws Illegal constructor on direct new Notification; ignored safely
    return false;
  }
}

export function subscribeToNotificationClicks(
  callback: (detail: { roomCode?: string; tab?: string }) => void
): () => void {
  if (typeof window === 'undefined') return () => undefined;

  const onSwMessage = (event: MessageEvent) => {
    if (event.data?.type === 'DILBAZ_NOTIFICATION_CLICK') {
      callback({
        roomCode: event.data.roomCode,
        tab: event.data.tab
      });
    }
  };

  const onCustomClick = (event: Event) => {
    const detail = (event as CustomEvent<{ roomCode?: string; tab?: string }>).detail;
    if (detail) callback(detail);
  };

  navigator.serviceWorker?.addEventListener('message', onSwMessage);
  window.addEventListener('dilbaz-notification-click', onCustomClick);

  return () => {
    navigator.serviceWorker?.removeEventListener('message', onSwMessage);
    window.removeEventListener('dilbaz-notification-click', onCustomClick);
  };
}
