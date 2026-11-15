import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  onSnapshot,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore';
import { db, auth } from './config';
import {
  EmailDirectoryEntry,
  Friendship,
  RoomInvite,
  RoomStatus
} from '../types/game';
import { OperationType, handleFirestoreError } from './errorHandler';

export interface InvitedRoomStatusInfo {
  exists: boolean;
  status?: RoomStatus;
  playerIds?: string[];
}

export function formatInviteDateTime(timestamp?: number): string {
  if (!timestamp) return '';
  try {
    return new Intl.DateTimeFormat('tr-TR', {
      day: '2-digit',
      month: 'long',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(timestamp));
  } catch {
    return new Date(timestamp).toLocaleString('tr-TR');
  }
}

export async function fetchInvitedRoomStatus(roomCode: string): Promise<InvitedRoomStatusInfo> {
  try {
    const snap = await getDoc(doc(db, 'rooms', roomCode.trim().toUpperCase()));
    if (!snap.exists()) return { exists: false };
    const data = snap.data() as { status?: RoomStatus; players?: { id: string }[] };
    return {
      exists: true,
      status: data.status,
      playerIds: Array.isArray(data.players) ? data.players.map((p) => p.id) : []
    };
  } catch {
    return { exists: true };
  }
}

export function subscribeToRoomStatus(
  roomCode: string,
  onChange: (info: InvitedRoomStatusInfo) => void
): () => void {
  const normalized = roomCode.trim().toUpperCase();
  return onSnapshot(
    doc(db, 'rooms', normalized),
    (snap) => {
      if (!snap.exists()) {
        onChange({ exists: false });
        return;
      }
      const data = snap.data() as { status?: RoomStatus; players?: { id: string }[] };
      onChange({
        exists: true,
        status: data.status,
        playerIds: Array.isArray(data.players) ? data.players.map((p) => p.id) : []
      });
    },
    () => {
      // ignore transient listener errors
    }
  );
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Pure JS SHA-256 fallback in case crypto.subtle is unavailable.
 */
function sha256FallbackHex(input: string): string {
  const utf8 = unescape(encodeURIComponent(input));
  const bytes: number[] = [];
  for (let i = 0; i < utf8.length; i++) {
    bytes.push(utf8.charCodeAt(i));
  }

  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];
  const H = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ];

  const bitLen = bytes.length * 8;
  bytes.push(0x80);
  while ((bytes.length % 64) !== 56) bytes.push(0);
  const hi = Math.floor(bitLen / 0x100000000);
  const lo = bitLen >>> 0;
  bytes.push((hi >>> 24) & 0xff, (hi >>> 16) & 0xff, (hi >>> 8) & 0xff, hi & 0xff);
  bytes.push((lo >>> 24) & 0xff, (lo >>> 16) & 0xff, (lo >>> 8) & 0xff, lo & 0xff);

  const rotr = (n: number, x: number) => (x >>> n) | (x << (32 - n));
  const w = new Array<number>(64);

  for (let i = 0; i < bytes.length; i += 64) {
    for (let t = 0; t < 16; t++) {
      const j = i + t * 4;
      w[t] = (bytes[j] << 24) | (bytes[j + 1] << 16) | (bytes[j + 2] << 8) | bytes[j + 3];
    }
    for (let t = 16; t < 64; t++) {
      const s0 = rotr(7, w[t - 15]) ^ rotr(18, w[t - 15]) ^ (w[t - 15] >>> 3);
      const s1 = rotr(17, w[t - 2]) ^ rotr(19, w[t - 2]) ^ (w[t - 2] >>> 10);
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0;
    }

    let [a, b, c, d, e, f, g, h] = H;
    for (let t = 0; t < 64; t++) {
      const S1 = rotr(6, e) ^ rotr(11, e) ^ rotr(25, e);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[t] + w[t]) | 0;
      const S0 = rotr(2, a) ^ rotr(13, a) ^ rotr(22, a);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) | 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }

    H[0] = (H[0] + a) | 0;
    H[1] = (H[1] + b) | 0;
    H[2] = (H[2] + c) | 0;
    H[3] = (H[3] + d) | 0;
    H[4] = (H[4] + e) | 0;
    H[5] = (H[5] + f) | 0;
    H[6] = (H[6] + g) | 0;
    H[7] = (H[7] + h) | 0;
  }

  return H.map((x) => (x >>> 0).toString(16).padStart(8, '0')).join('');
}

export async function hashEmailForDirectory(email: string): Promise<string> {
  const normalized = normalizeEmail(email);
  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    const buf = await window.crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(normalized)
    );
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  return sha256FallbackHex(normalized);
}

/**
 * Syncs a privacy-preserving SHA-256 email index so friends can find this member by email.
 */
export async function syncMyEmailDirectory(params: {
  uid: string;
  email?: string | null;
  username: string;
  avatar: string;
}): Promise<void> {
  if (!params.email || !params.uid) return;
  const trimmedName = params.username.trim();
  if (trimmedName.length < 2) return;

  const emailHash = await hashEmailForDirectory(params.email);
  const ref = doc(db, 'emailDirectory', emailHash);
  const payload: EmailDirectoryEntry = {
    uid: params.uid,
    username: trimmedName.slice(0, 80),
    avatar: params.avatar || 'elibelinde',
    updatedAt: Date.now()
  };

  try {
    await setDoc(ref, payload);
  } catch (err) {
    console.warn('Email directory sync skipped:', err);
  }
}

export async function lookupUserByEmail(
  email: string
): Promise<EmailDirectoryEntry | null> {
  const emailHash = await hashEmailForDirectory(email);
  const path = `emailDirectory/${emailHash}`;
  try {
    const snap = await getDoc(doc(db, 'emailDirectory', emailHash));
    if (!snap.exists()) return null;
    return snap.data() as EmailDirectoryEntry;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function sendFriendRequestByEmail(params: {
  targetEmail: string;
  requesterUid: string;
  requesterName: string;
  requesterAvatar: string;
  myEmail?: string | null;
}): Promise<EmailDirectoryEntry> {
  const cleanEmail = normalizeEmail(params.targetEmail);
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new Error('Lütfen geçerli bir e-posta adresi girin.');
  }
  if (params.myEmail && normalizeEmail(params.myEmail) === cleanEmail) {
    throw new Error('Kendi e-posta adresinize arkadaşlık teklifi gönderemezsiniz.');
  }

  const target = await lookupUserByEmail(cleanEmail);
  if (!target) {
    throw new Error(
      'Bu e-posta adresiyle kayıtlı bir Dilbaz üyesi bulunamadı. Arkadaşınızın önce sisteme giriş yapıp profilini oluşturması gerekir.'
    );
  }

  if (target.uid === params.requesterUid) {
    throw new Error('Kendinize arkadaşlık teklifi gönderemezsiniz.');
  }

  const sortedUids = [params.requesterUid, target.uid].sort() as [string, string];
  const friendshipId = `${sortedUids[0]}__${sortedUids[1]}`;
  const ref = doc(db, 'friendships', friendshipId);
  const path = `friendships/${friendshipId}`;

  try {
    const existing = await getDoc(ref);
    if (existing.exists()) {
      const data = existing.data() as Friendship;
      if (data.status === 'accepted') {
        throw new Error(`${target.username} ile zaten arkadaşsınız.`);
      }
      if (data.requesterUid === params.requesterUid) {
        throw new Error(`${target.username} kullanıcısına zaten bekleyen bir arkadaşlık teklifi gönderdiniz.`);
      }
      throw new Error(
        `${target.username} size zaten arkadaşlık teklifi göndermiş! Gelen teklifler bölümünden kabul edebilirsiniz.`
      );
    }

    const now = Date.now();
    const payload: Friendship = {
      id: friendshipId,
      users: sortedUids,
      requesterUid: params.requesterUid,
      requesterName: params.requesterName.trim().slice(0, 80) || 'Üye',
      requesterAvatar: params.requesterAvatar || 'elibelinde',
      recipientUid: target.uid,
      recipientName: target.username,
      recipientAvatar: target.avatar,
      status: 'pending',
      createdAt: now,
      updatedAt: now
    };

    await setDoc(ref, payload);
    return target;
  } catch (error) {
    if (error instanceof Error && !error.message.includes('Firebase') && !error.message.includes('permission')) {
      throw error;
    }
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeToMyFriendships(
  uid: string,
  onUpdate: (friendships: Friendship[]) => void
): () => void {
  const q = query(collection(db, 'friendships'), where('users', 'array-contains', uid));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => d.data() as Friendship);
      list.sort((a, b) => b.updatedAt - a.updatedAt);
      onUpdate(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'friendships');
    }
  );
}

export async function acceptFriendRequest(
  friendshipId: string,
  recipientName: string,
  recipientAvatar: string
): Promise<void> {
  const path = `friendships/${friendshipId}`;
  try {
    await updateDoc(doc(db, 'friendships', friendshipId), {
      status: 'accepted',
      recipientName: recipientName.trim().slice(0, 80) || 'Üye',
      recipientAvatar: recipientAvatar || 'elibelinde',
      updatedAt: Date.now()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function declineOrRemoveFriend(friendshipId: string): Promise<void> {
  const path = `friendships/${friendshipId}`;
  try {
    await deleteDoc(doc(db, 'friendships', friendshipId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function sendRoomInviteToFriend(params: {
  roomCode: string;
  roomTitle: string;
  senderUid: string;
  senderName: string;
  senderAvatar: string;
  recipientUid: string;
}): Promise<void> {
  const inviteId = `${params.roomCode}_${params.recipientUid}`;
  const ref = doc(db, 'roomInvites', inviteId);
  const path = `roomInvites/${inviteId}`;
  const now = Date.now();

  try {
    const existingSnap = await getDoc(ref);
    if (existingSnap.exists()) {
      await updateDoc(ref, {
        roomTitle: params.roomTitle.trim().slice(0, 120) || `Oda ${params.roomCode}`,
        senderName: params.senderName.trim().slice(0, 80) || 'Üye',
        senderAvatar: params.senderAvatar || 'elibelinde',
        status: 'pending',
        updatedAt: now
      });
    } else {
      const payload: RoomInvite = {
        id: inviteId,
        roomCode: params.roomCode,
        roomTitle: params.roomTitle.trim().slice(0, 120) || `Oda ${params.roomCode}`,
        senderUid: params.senderUid,
        senderName: params.senderName.trim().slice(0, 80) || 'Üye',
        senderAvatar: params.senderAvatar || 'elibelinde',
        recipientUid: params.recipientUid,
        status: 'pending',
        createdAt: now,
        updatedAt: now
      };
      await setDoc(ref, payload);
    }

    await updateDoc(doc(db, 'rooms', params.roomCode), {
      invitedUids: arrayUnion(params.recipientUid),
      updatedAt: now
    }).catch(() => undefined);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeToMyRoomInvites(
  uid: string,
  onUpdate: (invites: RoomInvite[]) => void
): () => void {
  const q = query(collection(db, 'roomInvites'), where('recipientUid', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => d.data() as RoomInvite);
      list.sort((a, b) => b.updatedAt - a.updatedAt);
      onUpdate(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'roomInvites');
    }
  );
}

export async function respondToRoomInvite(
  inviteId: string,
  status: 'accepted' | 'dismissed',
  roomCode?: string
): Promise<void> {
  const path = `roomInvites/${inviteId}`;
  try {
    await updateDoc(doc(db, 'roomInvites', inviteId), {
      status,
      updatedAt: Date.now()
    });
    if (status === 'dismissed' && roomCode && auth.currentUser?.uid) {
      await updateDoc(doc(db, 'rooms', roomCode.trim().toUpperCase()), {
        invitedUids: arrayRemove(auth.currentUser.uid)
      }).catch(() => undefined);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export function subscribeToSentRoomInvites(
  uid: string,
  onUpdate: (invites: RoomInvite[]) => void
): () => void {
  const q = query(collection(db, 'roomInvites'), where('senderUid', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => d.data() as RoomInvite);
      list.sort((a, b) => b.updatedAt - a.updatedAt);
      onUpdate(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'roomInvites');
    }
  );
}
