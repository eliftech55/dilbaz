import express from 'express';
import { createServer as createViteServer } from 'vite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const webpush = require('web-push') as typeof import('web-push');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '256kb' }));

// CORS for iframe, PWA, and multi-device support
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization'
  );
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
});

// ---------------------------------------------------------------------------
// Firebase ID Token verification via Identity Toolkit REST API
// ---------------------------------------------------------------------------
function loadFirebaseApiKey(): string {
  if (process.env.FIREBASE_API_KEY) return process.env.FIREBASE_API_KEY;
  try {
    const cfgPath = path.join(__dirname, 'firebase-applet-config.json');
    if (fs.existsSync(cfgPath)) {
      const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf-8')) as { apiKey?: string };
      if (cfg.apiKey) return cfg.apiKey;
    }
  } catch {
    // ignore
  }
  return '';
}

const FIREBASE_API_KEY = loadFirebaseApiKey();

async function verifyFirebaseIdToken(idToken: string): Promise<string | null> {
  if (!idToken || !FIREBASE_API_KEY) return null;
  try {
    const resp = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(FIREBASE_API_KEY)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken })
      }
    );
    if (!resp.ok) return null;
    const data = (await resp.json()) as { users?: { localId?: string }[] };
    const uid = data.users?.[0]?.localId;
    return typeof uid === 'string' && uid.length > 0 ? uid : null;
  } catch {
    return null;
  }
}

function extractBearerToken(req: express.Request): string {
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  if (typeof req.body?.idToken === 'string') {
    return req.body.idToken.trim();
  }
  return '';
}

// ---------------------------------------------------------------------------
// VAPID Keys & Persistent Web Push Subscriptions Store
// ---------------------------------------------------------------------------
interface StoredPushSub {
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
  userAgent?: string;
  updatedAt: number;
}

const VAPID_FILE = path.join(__dirname, '.dilbaz-vapid.json');
const SUBS_FILE = path.join(__dirname, '.dilbaz-push-subs.json');

function loadOrCreateVapidKeys(): { publicKey: string; privateKey: string; subject: string } {
  const subject = process.env.VAPID_SUBJECT || 'mailto:destek@dilbaz.app';
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    return {
      publicKey: process.env.VAPID_PUBLIC_KEY.trim(),
      privateKey: process.env.VAPID_PRIVATE_KEY.trim(),
      subject
    };
  }

  try {
    if (fs.existsSync(VAPID_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(VAPID_FILE, 'utf-8')) as {
        publicKey?: string;
        privateKey?: string;
      };
      if (parsed.publicKey && parsed.privateKey) {
        return { publicKey: parsed.publicKey, privateKey: parsed.privateKey, subject };
      }
    }
  } catch {
    // regenerate if corrupt
  }

  const generated = webpush.generateVAPIDKeys();
  try {
    fs.writeFileSync(
      VAPID_FILE,
      JSON.stringify({ publicKey: generated.publicKey, privateKey: generated.privateKey }, null, 2)
    );
  } catch {
    // read-only filesystem fallback still works in-memory
  }
  return { publicKey: generated.publicKey, privateKey: generated.privateKey, subject };
}

const vapidConfig = loadOrCreateVapidKeys();
webpush.setVapidDetails(vapidConfig.subject, vapidConfig.publicKey, vapidConfig.privateKey);

const subscriptionsByUid = new Map<string, StoredPushSub[]>();

function loadSubscriptionsFromDisk(): void {
  try {
    if (!fs.existsSync(SUBS_FILE)) return;
    const raw = JSON.parse(fs.readFileSync(SUBS_FILE, 'utf-8')) as Record<string, StoredPushSub[]>;
    for (const [uid, list] of Object.entries(raw)) {
      if (Array.isArray(list)) {
        subscriptionsByUid.set(uid, list);
      }
    }
  } catch {
    // ignore corrupt cache
  }
}

function saveSubscriptionsToDisk(): void {
  try {
    const obj: Record<string, StoredPushSub[]> = {};
    for (const [uid, list] of subscriptionsByUid.entries()) {
      if (list.length > 0) obj[uid] = list;
    }
    fs.writeFileSync(SUBS_FILE, JSON.stringify(obj, null, 2));
  } catch {
    // ignore read-only fs errors
  }
}

loadSubscriptionsFromDisk();

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, app: 'dilbaz' });
});

// Digital Asset Links for Android TWA / PWABuilder APK verification (optional via env)
app.get('/.well-known/assetlinks.json', (_req, res) => {
  if (process.env.ANDROID_ASSETLINKS_JSON) {
    try {
      res.json(JSON.parse(process.env.ANDROID_ASSETLINKS_JSON));
      return;
    } catch {
      // fall through
    }
  }
  const pkg = (process.env.ANDROID_PACKAGE_NAME || '').trim();
  const fp = (process.env.ANDROID_SHA256_FINGERPRINT || '').trim();
  if (pkg && fp) {
    res.json([
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: pkg,
          sha256_cert_fingerprints: fp.split(',').map((s) => s.trim()).filter(Boolean)
        }
      }
    ]);
    return;
  }
  res.json([]);
});

// Public VAPID key endpoint for Web Push subscription
app.get('/api/push/vapid-public-key', (_req, res) => {
  res.json({ publicKey: vapidConfig.publicKey });
});

// Check current user's registered background push devices
app.get('/api/push/status', async (req, res) => {
  const token = extractBearerToken(req);
  const uid = await verifyFirebaseIdToken(token);
  if (!uid) {
    res.status(401).json({ ok: false, error: 'Unauthorized' });
    return;
  }
  const subs = subscriptionsByUid.get(uid) || [];
  res.json({ ok: true, registeredDevices: subs.length });
});

// Register or refresh a device's Web Push subscription
app.post('/api/push/subscribe', async (req, res) => {
  const token = extractBearerToken(req);
  const uid = await verifyFirebaseIdToken(token);
  if (!uid) {
    res.status(401).json({ ok: false, error: 'Unauthorized' });
    return;
  }

  const sub = req.body?.subscription as StoredPushSub | undefined;
  if (
    !sub ||
    typeof sub.endpoint !== 'string' ||
    !sub.endpoint.startsWith('https://') ||
    !sub.keys?.p256dh ||
    !sub.keys?.auth
  ) {
    res.status(400).json({ ok: false, error: 'Invalid push subscription' });
    return;
  }

  const userAgent =
    typeof req.body?.userAgent === 'string'
      ? req.body.userAgent.slice(0, 200)
      : String(req.headers['user-agent'] || '').slice(0, 200);

  const existing = subscriptionsByUid.get(uid) || [];
  const filtered = existing.filter((s) => s.endpoint !== sub.endpoint);
  filtered.push({
    endpoint: sub.endpoint,
    expirationTime: sub.expirationTime ?? null,
    keys: {
      p256dh: String(sub.keys.p256dh),
      auth: String(sub.keys.auth)
    },
    userAgent,
    updatedAt: Date.now()
  });

  // Keep up to 8 most recent devices per account
  subscriptionsByUid.set(uid, filtered.slice(-8));
  saveSubscriptionsToDisk();
  res.json({ ok: true, registeredDevices: subscriptionsByUid.get(uid)?.length || 1 });
});

// Remove a device's Web Push subscription
app.post('/api/push/unsubscribe', async (req, res) => {
  const token = extractBearerToken(req);
  const uid = await verifyFirebaseIdToken(token);
  if (!uid) {
    res.status(401).json({ ok: false, error: 'Unauthorized' });
    return;
  }
  const endpoint = typeof req.body?.endpoint === 'string' ? req.body.endpoint : '';
  const existing = subscriptionsByUid.get(uid) || [];
  const remaining = endpoint ? existing.filter((s) => s.endpoint !== endpoint) : [];
  subscriptionsByUid.set(uid, remaining);
  saveSubscriptionsToDisk();
  res.json({ ok: true, registeredDevices: remaining.length });
});

// Dispatch a Web Push notification to a target user (wakes up closed PWA/APK via SW)
app.post('/api/push/notify', async (req, res) => {
  const token = extractBearerToken(req);
  const senderUid = await verifyFirebaseIdToken(token);
  if (!senderUid) {
    res.status(401).json({ ok: false, error: 'Unauthorized' });
    return;
  }

  const recipientUid = typeof req.body?.recipientUid === 'string' ? req.body.recipientUid.trim() : '';
  const title = typeof req.body?.title === 'string' ? req.body.title.trim().slice(0, 120) : '';
  const body = typeof req.body?.body === 'string' ? req.body.body.trim().slice(0, 400) : '';
  const roomCode = typeof req.body?.roomCode === 'string' ? req.body.roomCode.trim().slice(0, 32) : undefined;
  const tab = typeof req.body?.tab === 'string' ? req.body.tab.trim().slice(0, 24) : 'friends';
  const tag = typeof req.body?.tag === 'string' ? req.body.tag.trim().slice(0, 120) : `dilbaz_${Date.now()}`;
  const badgeCount = typeof req.body?.badgeCount === 'number' ? req.body.badgeCount : undefined;
  const delayMs =
    typeof req.body?.delayMs === 'number'
      ? Math.max(0, Math.min(10000, Math.floor(req.body.delayMs)))
      : 0;

  if (!recipientUid || !title || !body) {
    res.status(400).json({ ok: false, error: 'Missing recipientUid, title, or body' });
    return;
  }

  const subs = subscriptionsByUid.get(recipientUid) || [];
  if (subs.length === 0) {
    res.json({ ok: true, sent: 0, failed: 0, totalDevices: 0 });
    return;
  }

  const dispatchAll = async () => {
    const currentSubs = subscriptionsByUid.get(recipientUid) || [];
    const payloadStr = JSON.stringify({
      title,
      body,
      roomCode,
      tab,
      tag,
      badgeCount
    });

    let sent = 0;
    let failed = 0;
    const expiredEndpoints = new Set<string>();

    await Promise.all(
      currentSubs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              expirationTime: sub.expirationTime ?? null,
              keys: sub.keys
            },
            payloadStr,
            {
              TTL: 86400,
              urgency: 'high'
            }
          );
          sent += 1;
        } catch (err: unknown) {
          failed += 1;
          const statusCode =
            typeof err === 'object' && err !== null && 'statusCode' in err
              ? Number((err as { statusCode?: number }).statusCode)
              : 0;
          if (statusCode === 404 || statusCode === 410) {
            expiredEndpoints.add(sub.endpoint);
          }
        }
      })
    );

    if (expiredEndpoints.size > 0) {
      subscriptionsByUid.set(
        recipientUid,
        currentSubs.filter((s) => !expiredEndpoints.has(s.endpoint))
      );
      saveSubscriptionsToDisk();
    }
    return { sent, failed, totalDevices: currentSubs.length };
  };

  if (delayMs > 0) {
    setTimeout(() => {
      dispatchAll().catch(() => undefined);
    }, delayMs);
    res.json({ ok: true, scheduled: true, delayMs, totalDevices: subs.length });
    return;
  }

  const result = await dispatchAll();
  res.json({ ok: true, ...result });
});

async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Dilbaz Server] Running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
