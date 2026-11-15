import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { playDilbazNotificationSound } from './soundEffects';

export interface MobilePushPayload {
  title: string;
  body: string;
  tag?: string;
  roomCode?: string;
  tab?: 'room' | 'friends' | 'library' | 'leaderboard';
}

export interface RemotePushDispatchPayload extends MobilePushPayload {
  recipientUid: string;
  badgeCount?: number;
  idToken: string;
  delayMs?: number;
}

const BASE_URL = import.meta.env.BASE_URL || '/';

let registeredSwPromise: Promise<ServiceWorkerRegistration | null> | null = null;

export function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return Promise.resolve(null);
  }
  if (!registeredSwPromise) {
    registeredSwPromise = navigator.serviceWorker
      .register(`${BASE_URL}sw.js`, { scope: BASE_URL })
      .then((reg) => {
        reg.update().catch(() => undefined);
        return reg;
      })
      .catch((err) => {
        console.warn('Service worker registration skipped:', err);
        return null;
      });
  }
  return registeredSwPromise;
}

export function getNotificationSupportState(): {
  supported: boolean;
  pushSupported: boolean;
  permission: NotificationPermission | 'unsupported';
  isStandalone: boolean;
} {
  if (typeof window === 'undefined') {
    return {
      supported: false,
      pushSupported: false,
      permission: 'unsupported',
      isStandalone: false
    };
  }
  const isStandalone =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (window.navigator as { standalone?: boolean }).standalone === true;

  const pushSupported = 'serviceWorker' in navigator && 'PushManager' in window;

  if (!('Notification' in window)) {
    return { supported: false, pushSupported, permission: 'unsupported', isStandalone };
  }
  return {
    supported: true,
    pushSupported,
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

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function uint8ArrayToUrlBase64(bytes: ArrayBuffer): string {
  const arr = new Uint8Array(bytes);
  let bin = '';
  for (let i = 0; i < arr.length; i++) {
    bin += String.fromCharCode(arr[i]);
  }
  return window
    .btoa(bin)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function simpleEndpointHash(endpoint: string): string {
  let h = 5381;
  for (let i = 0; i < endpoint.length; i++) {
    h = ((h << 5) + h) ^ endpoint.charCodeAt(i);
  }
  return (h >>> 0).toString(36);
}

/**
 * Registers or refreshes W3C Web Push (VAPID) subscription so notifications wake up
 * the Service Worker even when the PWA / Android APK is completely closed.
 */
export async function ensureWebPushSubscribed(
  uid: string,
  idToken: string
): Promise<{ subscribed: boolean; registeredDevices: number; reason?: string }> {
  if (typeof window === 'undefined' || !uid || !idToken) {
    return { subscribed: false, registeredDevices: 0, reason: 'missing_auth' };
  }
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { subscribed: false, registeredDevices: 0, reason: 'push_unsupported' };
  }
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return { subscribed: false, registeredDevices: 0, reason: 'permission_required' };
  }

  try {
    const reg =
      (await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000))
      ])) || (await registerServiceWorker());

    if (!reg || !reg.pushManager) {
      return { subscribed: false, registeredDevices: 0, reason: 'sw_unavailable' };
    }

    const keyResp = await fetch(`${BASE_URL}api/push/vapid-public-key`);
    if (!keyResp.ok) {
      return { subscribed: false, registeredDevices: 0, reason: 'server_unavailable' };
    }
    const { publicKey } = (await keyResp.json()) as { publicKey?: string };
    if (!publicKey) {
      return { subscribed: false, registeredDevices: 0, reason: 'vapid_missing' };
    }

    let sub = await reg.pushManager.getSubscription();
    if (sub && sub.options?.applicationServerKey) {
      const currentKey = uint8ArrayToUrlBase64(sub.options.applicationServerKey);
      if (currentKey !== publicKey) {
        await sub.unsubscribe().catch(() => undefined);
        sub = null;
      }
    }

    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      });
    }

    const subJson = sub.toJSON();
    const saveResp = await fetch(`${BASE_URL}api/push/subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`
      },
      body: JSON.stringify({
        subscription: subJson,
        userAgent: navigator.userAgent.slice(0, 180)
      })
    });

    const saveData = saveResp.ok
      ? ((await saveResp.json()) as { ok?: boolean; registeredDevices?: number })
      : { ok: false, registeredDevices: 0 };

    // Record device metadata in Firestore under owner-only pushSubscriptions
    if (sub.endpoint) {
      const subId = `${uid}_${simpleEndpointHash(sub.endpoint)}`.slice(0, 120);
      await setDoc(doc(db, 'pushSubscriptions', subId), {
        id: subId,
        uid,
        endpoint: sub.endpoint.slice(0, 1024),
        userAgent: navigator.userAgent.slice(0, 200),
        updatedAt: Date.now()
      }).catch(() => undefined);
    }

    return {
      subscribed: Boolean(saveData.ok),
      registeredDevices: saveData.registeredDevices || 1
    };
  } catch (err) {
    console.warn('Web Push subscription warning:', err);
    return {
      subscribed: false,
      registeredDevices: 0,
      reason: err instanceof Error ? err.message : 'subscribe_failed'
    };
  }
}

export async function fetchWebPushStatus(
  idToken: string
): Promise<{ ok: boolean; registeredDevices: number }> {
  if (typeof window === 'undefined' || !idToken) {
    return { ok: false, registeredDevices: 0 };
  }
  try {
    const resp = await fetch(`${BASE_URL}api/push/status`, {
      headers: { Authorization: `Bearer ${idToken}` }
    });
    if (!resp.ok) return { ok: false, registeredDevices: 0 };
    const data = (await resp.json()) as { ok?: boolean; registeredDevices?: number };
    return { ok: Boolean(data.ok), registeredDevices: data.registeredDevices || 0 };
  } catch {
    return { ok: false, registeredDevices: 0 };
  }
}

export async function triggerRemotePushNotification(
  payload: RemotePushDispatchPayload
): Promise<{ ok: boolean; sent: number; totalDevices: number; scheduled?: boolean }> {
  if (typeof window === 'undefined' || !payload.idToken || !payload.recipientUid) {
    return { ok: false, sent: 0, totalDevices: 0 };
  }
  try {
    const resp = await fetch(`${BASE_URL}api/push/notify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${payload.idToken}`
      },
      body: JSON.stringify({
        recipientUid: payload.recipientUid,
        title: payload.title,
        body: payload.body,
        tag: payload.tag,
        roomCode: payload.roomCode,
        tab: payload.tab,
        badgeCount: payload.badgeCount,
        delayMs: payload.delayMs
      })
    });
    if (!resp.ok) return { ok: false, sent: 0, totalDevices: 0 };
    const data = (await resp.json()) as {
      ok?: boolean;
      sent?: number;
      totalDevices?: number;
      scheduled?: boolean;
    };
    return {
      ok: Boolean(data.ok),
      sent: data.sent || 0,
      totalDevices: data.totalDevices || 0,
      scheduled: Boolean(data.scheduled)
    };
  } catch {
    return { ok: false, sent: 0, totalDevices: 0 };
  }
}

export async function sendMobilePushNotification(
  payload: MobilePushPayload
): Promise<boolean> {
  vibrateMobileDevice([180, 80, 220]);
  playDilbazNotificationSound();

  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }
  if (Notification.permission !== 'granted') {
    return false;
  }

  const targetUrl = payload.roomCode
    ? `${BASE_URL}?oda=${encodeURIComponent(payload.roomCode)}`
    : BASE_URL;

  const origin = window.location.origin;
  const absoluteIconUrl = `${origin}${BASE_URL}pwa-192x192.png`;
  // Android requires a transparent monochrome white silhouette PNG for `badge`,
  // otherwise it falls back to a solid circle or Chrome's browser logo.
  const absoluteBadgeUrl = `${origin}${BASE_URL}pwa-badge-96x96.png`;
  const absoluteSoundUrl = `${origin}${BASE_URL}sounds/dilbaz-bildirim.wav`;

  const notifOptions: NotificationOptions & {
    renotify?: boolean;
    vibrate?: number[];
    sound?: string;
  } = {
    body: payload.body,
    icon: absoluteIconUrl,
    badge: absoluteBadgeUrl,
    sound: absoluteSoundUrl,
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
      icon: absoluteIconUrl,
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
    } else if (event.data?.type === 'DILBAZ_PUSH_RECEIVED') {
      playDilbazNotificationSound();
      vibrateMobileDevice([180, 80, 220]);
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

export function setAppBadgeCount(count: number): void {
  try {
    if (typeof navigator !== 'undefined') {
      const nav = navigator as Navigator & {
        setAppBadge?: (count?: number) => Promise<void>;
        clearAppBadge?: () => Promise<void>;
      };
      if (count > 0 && typeof nav.setAppBadge === 'function') {
        nav.setAppBadge(count).catch(() => {});
      } else if (typeof nav.clearAppBadge === 'function') {
        nav.clearAppBadge().catch(() => {});
      }
    }
  } catch {
    // ignore
  }
}
