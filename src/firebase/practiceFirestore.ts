import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  setDoc,
  where,
  writeBatch
} from 'firebase/firestore';
import { db } from './config';
import { OperationType, handleFirestoreError } from './errorHandler';
import { Difficulty, PracticeAttempt } from '../types/game';
import { safeLocalGet, safeLocalSet } from '../utils/safeStorage';

const MAX_HISTORY_ITEMS = 100;

function getStorageKey(uid?: string | null): string {
  return `dilbaz_practice_history_v1_${uid || 'guest'}`;
}

export function loadLocalPracticeHistory(uid?: string | null): PracticeAttempt[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = safeLocalGet(getStorageKey(uid));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is PracticeAttempt => Boolean(item && item.id && item.tekerlemeId))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .slice(0, MAX_HISTORY_ITEMS);
  } catch {
    return [];
  }
}

export function saveLocalPracticeHistory(
  attempts: PracticeAttempt[],
  uid?: string | null
): PracticeAttempt[] {
  const normalized = [...attempts]
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, MAX_HISTORY_ITEMS);
  safeLocalSet(getStorageKey(uid), JSON.stringify(normalized));
  return normalized;
}

export function mergePracticeHistories(
  primary: PracticeAttempt[],
  secondary: PracticeAttempt[]
): PracticeAttempt[] {
  const byId = new Map<string, PracticeAttempt>();
  for (const item of [...secondary, ...primary]) {
    if (item?.id) {
      byId.set(item.id, item);
    }
  }
  return Array.from(byId.values())
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, MAX_HISTORY_ITEMS);
}

export function subscribeToPracticeHistory(
  uid: string,
  onUpdate: (attempts: PracticeAttempt[]) => void
): () => void {
  const q = query(collection(db, 'practiceAttempts'), where('uid', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs
        .map((d) => d.data() as PracticeAttempt)
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
        .slice(0, MAX_HISTORY_ITEMS);
      onUpdate(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'practiceAttempts');
    }
  );
}

export async function recordPracticeAttempt(params: {
  uid?: string | null;
  tekerlemeId: string;
  tekerlemeTitle: string;
  difficulty: Difficulty;
  accuracy: number;
  wpm: number;
  durationSeconds: number;
  speedScore: number;
  totalScore: number;
  xpEarned: number;
  sparksEarned: number;
}): Promise<PracticeAttempt> {
  const now = Date.now();
  const attemptId = `pra_${now}_${Math.random().toString(36).slice(2, 8)}`;

  const cleanTitle =
    params.tekerlemeTitle.trim().slice(0, 120) || 'Tekerleme Pratiği';
  const cleanTekerlemeId = params.tekerlemeId.trim().slice(0, 128) || 'unknown';

  const attempt: PracticeAttempt = {
    id: attemptId,
    ...(params.uid ? { uid: params.uid } : {}),
    tekerlemeId: cleanTekerlemeId,
    tekerlemeTitle: cleanTitle,
    difficulty: params.difficulty,
    accuracy: Math.max(0, Math.min(100, Math.round(params.accuracy))),
    wpm: Math.max(0, Math.min(500, Math.round(params.wpm))),
    durationSeconds: Math.max(0, Math.min(600, Math.round(params.durationSeconds * 10) / 10)),
    speedScore: Math.max(0, Math.min(100, Math.round(params.speedScore))),
    totalScore: Math.max(0, Math.min(10000, Math.round(params.totalScore))),
    xpEarned: Math.max(0, Math.min(1000, Math.round(params.xpEarned))),
    sparksEarned: Math.max(0, Math.min(1000, Math.round(params.sparksEarned))),
    createdAt: now
  };

  // Save locally immediately for zero-latency feedback
  const existingLocal = loadLocalPracticeHistory(params.uid);
  saveLocalPracticeHistory([attempt, ...existingLocal], params.uid);

  if (params.uid) {
    const path = `practiceAttempts/${attemptId}`;
    try {
      await setDoc(doc(db, 'practiceAttempts', attemptId), {
        ...attempt,
        uid: params.uid
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  }

  return attempt;
}

export async function deletePracticeAttempt(params: {
  attemptId: string;
  uid?: string | null;
}): Promise<void> {
  const existingLocal = loadLocalPracticeHistory(params.uid);
  saveLocalPracticeHistory(
    existingLocal.filter((item) => item.id !== params.attemptId),
    params.uid
  );

  if (params.uid) {
    const path = `practiceAttempts/${params.attemptId}`;
    try {
      await deleteDoc(doc(db, 'practiceAttempts', params.attemptId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }
}

export async function clearPracticeHistory(params: {
  attempts: PracticeAttempt[];
  uid?: string | null;
}): Promise<void> {
  saveLocalPracticeHistory([], params.uid);

  if (params.uid && params.attempts.length > 0) {
    const remoteItems = params.attempts.filter((a) => a.uid === params.uid);
    try {
      for (let i = 0; i < remoteItems.length; i += 400) {
        const chunk = remoteItems.slice(i, i + 400);
        const batch = writeBatch(db);
        chunk.forEach((item) => {
          batch.delete(doc(db, 'practiceAttempts', item.id));
        });
        await batch.commit();
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'practiceAttempts');
    }
  }
}
