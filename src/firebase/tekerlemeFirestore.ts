import {
  collection,
  doc,
  query,
  where,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  writeBatch
} from 'firebase/firestore';
import { db } from './config';
import { Tekerleme, UserProfile, UserNotification } from '../types/game';
import { OperationType, handleFirestoreError } from './errorHandler';
import { POINTS_FOR_APPROVED_TEKERLEME } from './authService';

export function normalizeTekerlemeText(text: string): string {
  return text
    .toLocaleLowerCase('tr-TR')
    .replace(/['’"“”`.,!?;:…\-—()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function syncUniqueSeedTekerlemeler(
  seedItems: Tekerleme[],
  adminUid: string,
  adminUsername: string
): Promise<{ added: number; skipped: number }> {
  const path = 'tekerlemeler';
  try {
    const existingSnap = await getDocs(collection(db, 'tekerlemeler'));
    const existingIds = new Set<string>();
    const existingNormalizedTexts = new Set<string>();

    existingSnap.forEach((docSnap) => {
      const data = docSnap.data() as Partial<Tekerleme>;
      existingIds.add(docSnap.id);
      if (data.text) {
        existingNormalizedTexts.add(normalizeTekerlemeText(data.text));
      }
    });

    const missingItems: Tekerleme[] = [];
    for (const item of seedItems) {
      const norm = normalizeTekerlemeText(item.text);
      if (!existingIds.has(item.id) && !existingNormalizedTexts.has(norm)) {
        existingNormalizedTexts.add(norm);
        existingIds.add(item.id);
        missingItems.push(item);
      }
    }

    if (missingItems.length === 0) {
      return { added: 0, skipped: seedItems.length };
    }

    const baseTime = Date.now();
    const safeAuthorName = (adminUsername || 'Yönetici').trim().slice(0, 80) || 'Yönetici';

    // Commit in chunks of 400 (well under Firestore 500 write limit)
    for (let i = 0; i < missingItems.length; i += 400) {
      const chunk = missingItems.slice(i, i + 400);
      const batch = writeBatch(db);
      chunk.forEach((item, idx) => {
        const docRef = doc(db, 'tekerlemeler', item.id);
        const payload: Tekerleme = {
          id: item.id,
          title: item.title.trim().slice(0, 120),
          text: item.text.trim().slice(0, 500),
          difficulty: item.difficulty,
          category: item.category,
          categoryLabel: item.categoryLabel || 'Genel',
          targetSounds: item.targetSounds || ['DİKSİYON'],
          benchmarkSeconds: Math.min(60, Math.max(1, Number(item.benchmarkSeconds) || 5)),
          tip: item.tip || 'Net ve akıcı telaffuza odaklanın.',
          authorId: adminUid,
          authorUsername: safeAuthorName,
          status: 'approved',
          rewardClaimed: false,
          createdAt: baseTime - idx,
          updatedAt: baseTime
        };
        batch.set(docRef, payload);
      });
      await batch.commit();
    }

    return {
      added: missingItems.length,
      skipped: seedItems.length - missingItems.length
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeToApprovedTekerlemeler(
  onUpdate: (items: Tekerleme[]) => void
): () => void {
  const q = query(collection(db, 'tekerlemeler'), where('status', '==', 'approved'));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => d.data() as Tekerleme);
      items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      onUpdate(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'tekerlemeler');
    }
  );
}

export function subscribeToMyContributions(
  uid: string,
  onUpdate: (items: Tekerleme[]) => void
): () => void {
  const q = query(collection(db, 'tekerlemeler'), where('authorId', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => d.data() as Tekerleme);
      items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      onUpdate(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'tekerlemeler');
    }
  );
}

export function subscribeToAllTekerlemelerForAdmin(
  onUpdate: (items: Tekerleme[]) => void
): () => void {
  return onSnapshot(
    collection(db, 'tekerlemeler'),
    (snap) => {
      const items = snap.docs.map((d) => d.data() as Tekerleme);
      items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      onUpdate(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'tekerlemeler');
    }
  );
}

export async function submitTekerlemeContribution(params: {
  tekerleme: Tekerleme;
  authorId: string;
  authorUsername: string;
  isAdmin: boolean;
}): Promise<Tekerleme> {
  const { tekerleme, authorId, authorUsername, isAdmin } = params;
  const now = Date.now();
  const id = tekerleme.id.startsWith('contrib-')
    ? tekerleme.id
    : `contrib-${now}-${Math.random().toString(36).slice(2, 6)}`;

  const payload: Tekerleme = {
    id,
    title: tekerleme.title.trim(),
    text: tekerleme.text.trim(),
    difficulty: tekerleme.difficulty,
    category: tekerleme.category,
    categoryLabel: tekerleme.categoryLabel || 'Katkı',
    targetSounds: tekerleme.targetSounds || ['DİKSİYON'],
    benchmarkSeconds: Number(tekerleme.benchmarkSeconds) || 4.5,
    tip: tekerleme.tip || 'Net ve akıcı telaffuza odaklanın.',
    authorId,
    authorUsername,
    status: isAdmin ? 'approved' : 'pending',
    rewardClaimed: false,
    createdAt: now,
    updatedAt: now
  };

  const path = `tekerlemeler/${id}`;
  try {
    await setDoc(doc(db, 'tekerlemeler', id), payload);
    return payload;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateTekerlemeContribution(tekerleme: Tekerleme): Promise<void> {
  const path = `tekerlemeler/${tekerleme.id}`;
  try {
    await updateDoc(doc(db, 'tekerlemeler', tekerleme.id), {
      title: tekerleme.title.trim(),
      text: tekerleme.text.trim(),
      difficulty: tekerleme.difficulty,
      category: tekerleme.category,
      categoryLabel: tekerleme.categoryLabel || 'Katkı',
      targetSounds: tekerleme.targetSounds || ['DİKSİYON'],
      benchmarkSeconds: Number(tekerleme.benchmarkSeconds) || 4.5,
      tip: tekerleme.tip || '',
      updatedAt: Date.now()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteTekerlemeContribution(id: string): Promise<void> {
  const path = `tekerlemeler/${id}`;
  try {
    await deleteDoc(doc(db, 'tekerlemeler', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Admin deletes a user-suggested or community tekerleme and notifies its proposer if applicable.
 */
export async function deleteTekerlemeContributionAsAdmin(
  item: Tekerleme,
  adminUid: string
): Promise<void> {
  const now = Date.now();
  const batch = writeBatch(db);
  batch.delete(doc(db, 'tekerlemeler', item.id));

  if (item.authorId && item.authorId !== adminUid) {
    const notifId = `notif_${now}_${Math.random().toString(36).slice(2, 7)}`;
    const notif: UserNotification = {
      id: notifId,
      recipientUid: item.authorId,
      type: 'tekerleme_deleted',
      title: 'Tekerleme Önerisi Silindi',
      message: `"${item.title}" başlıklı tekerleme öneriniz yönetici tarafından değerlendirilerek veritabanından kaldırıldı.`,
      tekerlemeTitle: item.title,
      read: false,
      createdAt: now
    };
    batch.set(doc(db, 'notifications', notifId), notif);
  }

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `tekerlemeler/${item.id}`);
  }
}

/**
 * Admin approves a pending tekerleme, awards +100 Leaderboard points to its author,
 * and sends a real-time notification so the proposer knows their contribution is live.
 */
export async function approveTekerlemeContribution(item: Tekerleme): Promise<void> {
  const tekRef = doc(db, 'tekerlemeler', item.id);
  const now = Date.now();
  const batch = writeBatch(db);

  const shouldReward = !item.rewardClaimed && Boolean(item.authorId);

  batch.update(tekRef, {
    status: 'approved',
    rewardClaimed: shouldReward ? true : Boolean(item.rewardClaimed),
    updatedAt: now
  });

  if (shouldReward && item.authorId) {
    const authorProfileRef = doc(db, 'publicProfiles', item.authorId);
    const authorSnap = await getDoc(authorProfileRef);
    if (authorSnap.exists()) {
      const profile = authorSnap.data() as UserProfile;
      batch.update(authorProfileRef, {
        points: (profile.points || 0) + POINTS_FOR_APPROVED_TEKERLEME,
        approvedTekerlemeCount: (profile.approvedTekerlemeCount || 0) + 1,
        updatedAt: now
      });
    }

    const notifId = `notif_${now}_${Math.random().toString(36).slice(2, 7)}`;
    const notif: UserNotification = {
      id: notifId,
      recipientUid: item.authorId,
      type: 'tekerleme_approved',
      title: `Tekerlemeniz Onaylandı (+${POINTS_FOR_APPROVED_TEKERLEME} Puan)!`,
      message: `"${item.title}" başlıklı tekerlemeniz yönetici tarafından onaylanarak Tekerleme Havuzuna eklendi ve hesabınıza +${POINTS_FOR_APPROVED_TEKERLEME} Puan işlendi.`,
      tekerlemeTitle: item.title,
      pointsAwarded: POINTS_FOR_APPROVED_TEKERLEME,
      read: false,
      createdAt: now
    };
    batch.set(doc(db, 'notifications', notifId), notif);
  }

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `tekerlemeler/${item.id}`);
  }
}

export async function rejectTekerlemeContribution(
  item: Tekerleme,
  adminNote?: string
): Promise<void> {
  const now = Date.now();
  const batch = writeBatch(db);
  batch.update(doc(db, 'tekerlemeler', item.id), {
    status: 'rejected',
    ...(adminNote ? { adminNote } : {}),
    updatedAt: now
  });

  if (item.authorId) {
    const notifId = `notif_${now}_${Math.random().toString(36).slice(2, 7)}`;
    const notif: UserNotification = {
      id: notifId,
      recipientUid: item.authorId,
      type: 'tekerleme_rejected',
      title: 'Tekerleme Önerisi Reddedildi',
      message: `"${item.title}" başlıklı tekerleme öneriniz yönetici tarafından onaylanmadı.`,
      tekerlemeTitle: item.title,
      read: false,
      createdAt: now
    };
    batch.set(doc(db, 'notifications', notifId), notif);
  }

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `tekerlemeler/${item.id}`);
  }
}
