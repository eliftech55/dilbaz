import {
  GoogleAuthProvider,
  EmailAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  linkWithCredential,
  signOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  writeBatch
} from 'firebase/firestore';
import { auth, db } from './config';
import { UserProfile, UserRole, UserNotification } from '../types/game';
import { KILIM_MOTIFS } from '../components/KilimAvatar';
import { OperationType, handleFirestoreError } from './errorHandler';
import { syncMyEmailDirectory } from './friendsFirestore';

export const ADMIN_EMAIL = 'elifgencosmanoglu@gmail.com';
export const POINTS_FOR_APPROVED_TEKERLEME = 100;
export const POINTS_PER_PLAYER_MULTIPLAYER_WIN = 20;

/**
 * Normalizes a custom username into a Firestore-safe document ID matching ^[a-zA-Z0-9_.\-@]+$
 */
export function normalizeUsernameKey(raw: string): string {
  const trMap: Record<string, string> = {
    ç: 'c',
    ğ: 'g',
    ı: 'i',
    i: 'i',
    ö: 'o',
    ş: 's',
    ü: 'u',
    Ç: 'c',
    Ğ: 'g',
    İ: 'i',
    I: 'i',
    Ö: 'o',
    Ş: 's',
    Ü: 'u'
  };
  const replaced = raw
    .trim()
    .split('')
    .map((ch) => trMap[ch] || ch)
    .join('')
    .toLowerCase();
  return replaced.replace(/[^a-z0-9_.\-@]/g, '_');
}

export async function checkIsAdmin(user: User | null): Promise<boolean> {
  if (!user) return false;
  if (user.email === ADMIN_EMAIL && user.emailVerified) {
    return true;
  }
  try {
    const adminSnap = await getDoc(doc(db, 'admins', user.uid));
    return adminSnap.exists();
  } catch {
    return false;
  }
}

export async function ensureBootstrapAdminRecord(user: User): Promise<void> {
  if (user.email !== ADMIN_EMAIL || !user.emailVerified) return;
  const now = Date.now();
  try {
    const adminRef = doc(db, 'admins', user.uid);
    const adminSnap = await getDoc(adminRef);
    if (!adminSnap.exists()) {
      await setDoc(adminRef, {
        uid: user.uid,
        promotedBy: user.uid,
        createdAt: now
      });
    }
    const profileRef = doc(db, 'publicProfiles', user.uid);
    const profileSnap = await getDoc(profileRef);
    if (profileSnap.exists() && profileSnap.data().role !== 'yonetici') {
      await updateDoc(profileRef, {
        role: 'yonetici',
        updatedAt: now
      });
    }
  } catch (err) {
    console.warn('Bootstrap admin sync warning:', err);
  }
}

export async function signInWithGoogle(): Promise<User | null> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    const cred = await signInWithPopup(auth, provider);
    await ensurePrivateUserRecord(cred.user, 'google.com');
    return cred.user;
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    const isInIframe = typeof window !== 'undefined' && window.self !== window.top;
    if (code === 'auth/popup-blocked' && !isInIframe) {
      await signInWithRedirect(auth, provider);
      return null;
    }
    throw err;
  }
}

export async function consumeGoogleRedirectResult(): Promise<User | null> {
  try {
    const cred = await getRedirectResult(auth);
    if (cred?.user) {
      await ensurePrivateUserRecord(cred.user, 'google.com');
      return cred.user;
    }
    return null;
  } catch (err) {
    console.warn('Google redirect result warning:', err);
    return null;
  }
}

export async function registerWithEmailAndPassword(email: string, password: string): Promise<User> {
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
  await ensurePrivateUserRecord(cred.user, 'password');
  return cred.user;
}

export async function loginWithEmailAndPassword(email: string, password: string): Promise<User> {
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  await ensurePrivateUserRecord(cred.user, 'password');
  return cred.user;
}

export async function attachPasswordToCurrentGoogleUser(password: string): Promise<void> {
  const user = auth.currentUser;
  if (!user || !user.email) {
    throw new Error('Şifre tanımlamak için önce Google hesabınızla giriş yapmalısınız.');
  }
  const credential = EmailAuthProvider.credential(user.email, password);
  await linkWithCredential(user, credential);
  await ensurePrivateUserRecord(user, 'google+password');
}

export async function logoutUser(): Promise<void> {
  await signOut(auth);
}

export function subscribeToAuth(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}

async function ensurePrivateUserRecord(user: User, provider: string): Promise<void> {
  const path = `usersPrivate/${user.uid}`;
  try {
    const ref = doc(db, 'usersPrivate', user.uid);
    const snap = await getDoc(ref);
    const now = Date.now();
    if (!snap.exists()) {
      await setDoc(ref, {
        uid: user.uid,
        email: user.email || '',
        authProvider: provider,
        createdAt: now,
        updatedAt: now
      });
    } else {
      await setDoc(
        ref,
        {
          uid: user.uid,
          email: user.email || snap.data().email || '',
          authProvider: provider,
          createdAt: snap.data().createdAt || now,
          updatedAt: now
        },
        { merge: true }
      );
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeToUserProfile(
  uid: string,
  onUpdate: (profile: UserProfile | null) => void
): () => void {
  const path = `publicProfiles/${uid}`;
  return onSnapshot(
    doc(db, 'publicProfiles', uid),
    (snap) => {
      onUpdate(snap.exists() ? (snap.data() as UserProfile) : null);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

export async function isUsernameAvailable(username: string, currentUid?: string): Promise<boolean> {
  const key = normalizeUsernameKey(username);
  if (!key || key.length < 2) return false;
  try {
    const snap = await getDoc(doc(db, 'usernames', key));
    if (!snap.exists()) return true;
    return currentUid ? snap.data().uid === currentUid : false;
  } catch {
    return false;
  }
}

export async function saveUserProfile(params: {
  user: User;
  useEmailAsUsername: boolean;
  customUsername: string;
  avatar: string;
}): Promise<UserProfile> {
  const { user, useEmailAsUsername, customUsername, avatar } = params;
  const chosenAvatar = avatar || KILIM_MOTIFS[0].id;
  const trimmedCustom = customUsername.trim();

  let finalUsername = '';
  if (useEmailAsUsername && user.email) {
    finalUsername = user.email;
  } else {
    if (trimmedCustom.length < 3) {
      throw new Error('Kullanıcı adı en az 3 karakter olmalıdır.');
    }
    finalUsername = trimmedCustom;
  }

  const profileRef = doc(db, 'publicProfiles', user.uid);
  const existingProfileSnap = await getDoc(profileRef);
  const existingProfile = existingProfileSnap.exists()
    ? (existingProfileSnap.data() as UserProfile)
    : null;

  const isEmailHandle = Boolean(user.email && finalUsername === user.email);
  const newKey = isEmailHandle ? null : normalizeUsernameKey(finalUsername);
  const oldIsEmail = Boolean(user.email && existingProfile?.username === user.email);
  const oldKey =
    existingProfile && !oldIsEmail ? normalizeUsernameKey(existingProfile.username) : null;

  if (newKey) {
    if (newKey.length < 3) {
      throw new Error('Kullanıcı adı en az 3 geçerli harf/rakam içermelidir.');
    }
    const existingClaim = await getDoc(doc(db, 'usernames', newKey));
    if (existingClaim.exists() && existingClaim.data().uid !== user.uid) {
      throw new Error(`"${finalUsername}" kullanıcı adı başka bir üye tarafından kullanılıyor. Lütfen farklı bir ad seçin.`);
    }
  }

  const now = Date.now();
  const batch = writeBatch(db);

  if (oldKey && oldKey !== newKey) {
    const oldClaimSnap = await getDoc(doc(db, 'usernames', oldKey));
    if (oldClaimSnap.exists() && oldClaimSnap.data().uid === user.uid) {
      batch.delete(doc(db, 'usernames', oldKey));
    }
  }

  if (newKey && newKey !== oldKey) {
    batch.set(doc(db, 'usernames', newKey), {
      uid: user.uid,
      username: finalUsername,
      createdAt: now
    });
  }

  const isBootstrapAdmin = user.email === ADMIN_EMAIL && user.emailVerified;
  const resolvedRole: UserRole = isBootstrapAdmin
    ? 'yonetici'
    : existingProfile?.role || 'uye';

  const profilePayload: UserProfile = {
    uid: user.uid,
    username: finalUsername,
    avatar: chosenAvatar,
    role: resolvedRole,
    points: existingProfile ? existingProfile.points : 0,
    approvedTekerlemeCount: existingProfile ? existingProfile.approvedTekerlemeCount : 0,
    multiplayerWins: existingProfile ? existingProfile.multiplayerWins : 0,
    ...(existingProfile?.lastClaimId ? { lastClaimId: existingProfile.lastClaimId } : {}),
    ...(existingProfile?.phoenixLevel ? { phoenixLevel: existingProfile.phoenixLevel } : {}),
    ...(existingProfile?.phoenixStageId ? { phoenixStageId: existingProfile.phoenixStageId } : {}),
    ...(existingProfile?.phoenixAuraId ? { phoenixAuraId: existingProfile.phoenixAuraId } : {}),
    ...(existingProfile?.phoenixTalismanId !== undefined
      ? { phoenixTalismanId: existingProfile.phoenixTalismanId }
      : {}),
    ...(existingProfile?.phoenixCrestId !== undefined
      ? { phoenixCrestId: existingProfile.phoenixCrestId }
      : {}),
    ...(existingProfile?.phoenixPaletteId ? { phoenixPaletteId: existingProfile.phoenixPaletteId } : {}),
    ...(existingProfile?.phoenixPatternId ? { phoenixPatternId: existingProfile.phoenixPatternId } : {}),
    createdAt: existingProfile ? existingProfile.createdAt : now,
    updatedAt: now
  };

  if (existingProfile) {
    batch.update(profileRef, {
      username: finalUsername,
      avatar: chosenAvatar,
      ...(isBootstrapAdmin ? { role: 'yonetici' } : {}),
      updatedAt: now
    });
  } else {
    batch.set(profileRef, profilePayload);
  }

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `publicProfiles/${user.uid}`);
  }

  await syncMyEmailDirectory({
    uid: user.uid,
    email: user.email,
    username: finalUsername,
    avatar: chosenAvatar
  });

  return profilePayload;
}

export async function claimMultiplayerWinReward(
  roomCode: string,
  uid: string,
  playerCount: number
): Promise<{ claimed: boolean; alreadyClaimed?: boolean; reason?: string; pointsAdded: number }> {
  if (playerCount <= 1) {
    return { claimed: false, reason: 'solo_left', pointsAdded: 0 };
  }

  const claimId = `${roomCode}_${uid}`;
  const claimRef = doc(db, 'winClaims', claimId);
  const profileRef = doc(db, 'publicProfiles', uid);
  const roomRef = doc(db, 'rooms', roomCode);

  try {
    const [claimSnap, profileSnap, roomSnap] = await Promise.all([
      getDoc(claimRef),
      getDoc(profileRef),
      getDoc(roomRef)
    ]);

    if (claimSnap.exists()) {
      const existingPoints =
        Number(claimSnap.data()?.pointsAwarded) ||
        Math.max(2, playerCount) * POINTS_PER_PLAYER_MULTIPLAYER_WIN;
      return { claimed: false, alreadyClaimed: true, pointsAdded: existingPoints };
    }
    if (!profileSnap.exists()) {
      return { claimed: false, reason: 'no_profile', pointsAdded: 0 };
    }

    const livePlayerCount = roomSnap.exists()
      ? (Array.isArray(roomSnap.data()?.players) ? roomSnap.data().players.length : playerCount)
      : playerCount;

    if (livePlayerCount <= 1) {
      return { claimed: false, reason: 'solo_left', pointsAdded: 0 };
    }

    const dynamicPoints = livePlayerCount * POINTS_PER_PLAYER_MULTIPLAYER_WIN;
    const currentProfile = profileSnap.data() as UserProfile;
    const now = Date.now();
    const batch = writeBatch(db);

    batch.set(claimRef, {
      uid,
      roomCode,
      pointsAwarded: dynamicPoints,
      createdAt: now
    });

    batch.update(profileRef, {
      points: (currentProfile.points || 0) + dynamicPoints,
      multiplayerWins: (currentProfile.multiplayerWins || 0) + 1,
      lastClaimId: claimId,
      updatedAt: now
    });

    await batch.commit();
    return { claimed: true, pointsAdded: dynamicPoints };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `winClaims/${claimId}`);
  }
}

export function subscribeToGlobalLeaderboard(
  onUpdate: (profiles: UserProfile[]) => void,
  onError?: (err: unknown) => void
): () => void {
  const q = query(collection(db, 'publicProfiles'), orderBy('points', 'desc'), limit(10));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => d.data() as UserProfile);
      onUpdate(list);
    },
    (error) => {
      console.warn('Global leaderboard warning:', error);
      onError?.(error);
    }
  );
}

/**
 * Admin: Stream all registered members ordered by creation time.
 */
export function subscribeToAllMembers(
  onUpdate: (profiles: UserProfile[]) => void,
  onError?: (err: unknown) => void
): () => void {
  const q = query(collection(db, 'publicProfiles'), orderBy('createdAt', 'desc'), limit(200));
  return onSnapshot(
    q,
    (snap) => {
      onUpdate(snap.docs.map((d) => d.data() as UserProfile));
    },
    (error) => {
      console.warn('Admin members stream warning:', error);
      onError?.(error);
    }
  );
}

/**
 * Admin: Promote a member to 'yonetici' or demote back to 'uye'.
 */
export async function setMemberRoleAsAdmin(
  targetUid: string,
  newRole: UserRole,
  currentAdminUid: string
): Promise<void> {
  const now = Date.now();
  const batch = writeBatch(db);
  const profileRef = doc(db, 'publicProfiles', targetUid);
  const adminRef = doc(db, 'admins', targetUid);

  batch.update(profileRef, {
    role: newRole,
    updatedAt: now
  });

  if (newRole === 'yonetici') {
    batch.set(adminRef, {
      uid: targetUid,
      promotedBy: currentAdminUid,
      createdAt: now
    });
  } else {
    const adminSnap = await getDoc(adminRef);
    if (adminSnap.exists()) {
      batch.delete(adminRef);
    }
  }

  const notifId = `notif_${now}_${Math.random().toString(36).slice(2, 7)}`;
  const notif: UserNotification = {
    id: notifId,
    recipientUid: targetUid,
    type: 'role_updated',
    title: newRole === 'yonetici' ? 'Yönetici Yetkisi Verildi' : 'Üyelik Rolü Güncellendi',
    message:
      newRole === 'yonetici'
        ? 'Tebrikler! Yönetici tarafından hesabınıza Yönetici yetkisi tanımlandı.'
        : 'Hesap rolünüz Üye olarak güncellendi.',
    read: false,
    createdAt: now
  };
  batch.set(doc(db, 'notifications', notifId), notif);

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `publicProfiles/${targetUid}`);
  }
}

/**
 * Admin: Delete a member profile, private record, admin grant, and custom username reservation.
 */
export async function deleteMemberAsAdmin(targetProfile: UserProfile): Promise<void> {
  const batch = writeBatch(db);
  batch.delete(doc(db, 'publicProfiles', targetProfile.uid));
  batch.delete(doc(db, 'usersPrivate', targetProfile.uid));

  const adminSnap = await getDoc(doc(db, 'admins', targetProfile.uid));
  if (adminSnap.exists()) {
    batch.delete(doc(db, 'admins', targetProfile.uid));
  }

  if (!targetProfile.username.includes('@')) {
    const key = normalizeUsernameKey(targetProfile.username);
    if (key) {
      const claimSnap = await getDoc(doc(db, 'usernames', key));
      if (claimSnap.exists() && claimSnap.data().uid === targetProfile.uid) {
        batch.delete(doc(db, 'usernames', key));
      }
    }
  }

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `publicProfiles/${targetProfile.uid}`);
  }
}

/**
 * Notifications stream for current signed-in user.
 */
export function subscribeToMyNotifications(
  uid: string,
  onUpdate: (notifications: UserNotification[]) => void
): () => void {
  const q = query(collection(db, 'notifications'), where('recipientUid', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => d.data() as UserNotification);
      list.sort((a, b) => b.createdAt - a.createdAt);
      onUpdate(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'notifications');
    }
  );
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'notifications', notificationId), { read: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `notifications/${notificationId}`);
  }
}

export async function deleteNotification(notificationId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'notifications', notificationId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `notifications/${notificationId}`);
  }
}

export async function syncPhoenixAppearanceToProfile(
  uid: string,
  appearance: {
    phoenixLevel: number;
    phoenixStageId: string;
    phoenixAuraId: string;
    phoenixTalismanId: string;
    phoenixCrestId: string;
    phoenixPaletteId: string;
    phoenixPatternId: string;
  }
): Promise<void> {
  try {
    const clampStr = (val: string) => String(val || '').slice(0, 40);
    await updateDoc(doc(db, 'publicProfiles', uid), {
      phoenixLevel: Math.max(1, Math.min(100, Math.round(appearance.phoenixLevel || 1))),
      phoenixStageId: clampStr(appearance.phoenixStageId || 'spark'),
      phoenixAuraId: clampStr(appearance.phoenixAuraId || 'aura_ebru_cyan'),
      phoenixTalismanId: clampStr(appearance.phoenixTalismanId || ''),
      phoenixCrestId: clampStr(appearance.phoenixCrestId || ''),
      phoenixPaletteId: clampStr(appearance.phoenixPaletteId || 'ebru_classic'),
      phoenixPatternId: clampStr(appearance.phoenixPatternId || 'ebru_wave'),
      updatedAt: Date.now()
    });
  } catch (err) {
    console.warn('Phoenix appearance sync warning:', err);
  }
}

export async function fetchPublicProfilesMap(
  uids: string[]
): Promise<Record<string, UserProfile>> {
  const unique = Array.from(new Set(uids.filter(Boolean))).slice(0, 40);
  if (unique.length === 0) return {};
  const result: Record<string, UserProfile> = {};
  await Promise.all(
    unique.map(async (uid) => {
      try {
        const snap = await getDoc(doc(db, 'publicProfiles', uid));
        if (snap.exists()) {
          result[uid] = snap.data() as UserProfile;
        }
      } catch {
        // ignore missing or transient read failures
      }
    })
  );
  return result;
}
