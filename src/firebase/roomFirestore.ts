import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  onSnapshot,
  collection,
  query,
  where,
  runTransaction
} from 'firebase/firestore';
import { db } from './config';
import {
  Room,
  RoomStatus,
  Tekerleme,
  PlayerScore,
  Difficulty,
  PhonemeCategory,
  RoomProgressionMode
} from '../types/game';
import { INITIAL_TEKERLEMELER } from '../data/tekerlemeler';
import { generateBotScore } from '../utils/scoreCalculator';

/**
 * Deep cleans an object before writing to Firestore.
 * Firestore strictly forbids `undefined` anywhere in documents.
 */
export function deepCleanForFirestore(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (Array.isArray(obj)) {
    return obj.map(deepCleanForFirestore);
  }
  if (typeof obj === 'object') {
    const res: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        res[key] = deepCleanForFirestore(value);
      }
    }
    return res;
  }
  return obj;
}

export function getRandomTekerleme(
  difficulty: 'karisik' | Difficulty,
  category: PhonemeCategory,
  excludeId?: string,
  customPool?: Tekerleme[]
): Tekerleme {
  let pool = customPool && customPool.length > 0 ? [...customPool] : [...INITIAL_TEKERLEMELER];
  if (difficulty && difficulty !== 'karisik') {
    const diffFiltered = pool.filter(t => t.difficulty === difficulty);
    if (diffFiltered.length > 0) pool = diffFiltered;
  }
  if (category && category !== 'tum') {
    const catFiltered = pool.filter(t => t.category === category);
    if (catFiltered.length > 0) pool = catFiltered;
  }
  if (excludeId) {
    const withoutExcluded = pool.filter(t => t.id !== excludeId);
    if (withoutExcluded.length > 0) pool = withoutExcluded;
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

export class RoomFirestore {
  /**
   * Create a new room in Cloud Firestore
   */
  public static async createRoom(params: {
    hostId: string;
    hostName: string;
    avatar: string;
    roundCount: number;
    difficulty: 'karisik' | Difficulty;
    category: PhonemeCategory;
    progressionMode?: RoomProgressionMode;
  }): Promise<Room> {
    const code = `DLBZ-${Math.floor(1000 + Math.random() * 9000)}`;
    const roomRef = doc(db, 'rooms', code);
    const now = Date.now();
    const progressionMode: RoomProgressionMode = params.progressionMode || 'host';

    const newRoom: Room = {
      code,
      title: `${params.hostName}'in Tekerleme Odası`,
      hostId: params.hostId,
      originalHostId: params.hostId,
      hostName: params.hostName,
      hostLeftAutoMode: false,
      status: 'waiting',
      currentRound: 1,
      totalRounds: Number(params.roundCount) || 3,
      settings: {
        roundCount: Number(params.roundCount) || 3,
        timeLimitSeconds: 15,
        difficulty: params.difficulty,
        category: params.category,
        progressionMode
      },
      participantIds: [params.hostId],
      updatedAt: now,
      players: [
        {
          id: params.hostId,
          name: params.hostName,
          avatar: params.avatar || 'kilim-elibelinde',
          isHost: true,
          isReady: true,
          totalPoints: 0
        }
      ],
      roundScores: {}
    };

    const cleanPayload = deepCleanForFirestore(newRoom);
    await setDoc(roomRef, cleanPayload);
    return newRoom;
  }

  /**
   * Join an existing room via PIN code (supports mid-game rejoin for players & original host)
   */
  public static async joinRoom(
    code: string,
    player: { id: string; name: string; avatar: string }
  ): Promise<Room> {
    const normalizedCode = code.trim().toUpperCase();
    const roomRef = doc(db, 'rooms', normalizedCode);

    return runTransaction(db, async (tx) => {
      const snap = await tx.get(roomRef);

      if (!snap.exists()) {
        throw new Error(`"${normalizedCode}" kodlu oda bulunamadı. Lütfen kodu kontrol edin.`);
      }

      const roomData = snap.data() as Room & {
        departedPlayers?: Record<string, { totalPoints: number; name: string; avatar: string }>;
      };

      if (roomData.status === 'closed') {
        throw new Error('Bu oda kurucusu tarafından kapatıldı (oda kaldırıldı).');
      }

      const players = (roomData.players || []).map((p) => {
        const cleanP: any = {
          id: p.id,
          name: p.name,
          avatar: p.avatar || 'kilim-kocboynuzu',
          isHost: Boolean(p.isHost),
          isReady: Boolean(p.isReady),
          totalPoints: Number(p.totalPoints) || 0
        };
        if (p.currentRoundScore) cleanP.currentRoundScore = p.currentRoundScore;
        return cleanP;
      });

      const originalHostId = roomData.originalHostId || roomData.hostId;
      const isOriginalHost = originalHostId === player.id;
      const existingIndex = players.findIndex((p) => p.id === player.id);
      const departedInfo = roomData.departedPlayers?.[player.id];
      const hasRoundHistory = Boolean(
        roomData.roundScores &&
          Object.values(roomData.roundScores).some(
            (scores) => Array.isArray(scores) && scores.some((s) => s.playerId === player.id)
          )
      );
      const canRejoinMidGame =
        existingIndex >= 0 || Boolean(departedInfo) || hasRoundHistory || isOriginalHost;

      if (roomData.status === 'game_over' && existingIndex < 0) {
        throw new Error('Bu odadaki oyun sona erdi.');
      }

      if (roomData.status !== 'waiting' && !canRejoinMidGame) {
        throw new Error('Bu odada yarışma başladı. Lobiye yeni katılımcı kabul edilmiyor.');
      }

      if (existingIndex >= 0) {
        players[existingIndex].name = player.name || players[existingIndex].name;
        players[existingIndex].avatar = player.avatar || players[existingIndex].avatar;
        players[existingIndex].isReady = true;
      } else {
        let finalName = player.name;
        const countSameName = players.filter((p) => p.name === player.name).length;
        if (countSameName > 0) {
          finalName = `${player.name} (${countSameName + 1})`;
        }

        let restoredPoints = Number(departedInfo?.totalPoints) || 0;
        if (!restoredPoints && roomData.roundScores) {
          for (const scores of Object.values(roomData.roundScores)) {
            if (Array.isArray(scores)) {
              const match = scores.find((s) => s.playerId === player.id);
              if (match) restoredPoints += Number(match.totalScore) || 0;
            }
          }
        }

        const currentRoundScores = roomData.roundScores?.[roomData.currentRound] || [];
        const currentRoundMatch = currentRoundScores.find((s) => s.playerId === player.id);

        const newPlayer: any = {
          id: player.id,
          name: finalName,
          avatar: player.avatar || 'kilim-kocboynuzu',
          isHost: players.length === 0 || isOriginalHost,
          isReady: true,
          totalPoints: restoredPoints
        };
        if (currentRoundMatch) {
          newPlayer.currentRoundScore = currentRoundMatch;
        }

        players.push(newPlayer);
      }

      let nextHostId = roomData.hostId;
      let nextHostName = roomData.hostName;
      let nextHostLeftAutoMode = Boolean(roomData.hostLeftAutoMode);

      if (isOriginalHost) {
        nextHostId = player.id;
        nextHostName = player.name || roomData.hostName;
        nextHostLeftAutoMode = false;
        players.forEach((p) => {
          p.isHost = p.id === player.id;
        });
      } else if (!players.some((p) => p.isHost) && players.length > 0) {
        const firstHuman = players.find((p) => !p.id.startsWith('bot-')) || players[0];
        nextHostId = firstHuman.id;
        nextHostName = firstHuman.name;
        firstHuman.isHost = true;
      }

      const participantIds = Array.from(
        new Set([
          ...(roomData.participantIds || []),
          ...players.filter((p) => !p.id.startsWith('bot-')).map((p) => p.id),
          player.id
        ])
      ).slice(0, 50);

      const now = Date.now();
      const cleanPayload = deepCleanForFirestore({
        players,
        hostId: nextHostId,
        originalHostId,
        hostName: nextHostName,
        hostLeftAutoMode: nextHostLeftAutoMode,
        participantIds,
        updatedAt: now
      });

      tx.update(roomRef, cleanPayload);

      return {
        ...roomData,
        players,
        hostId: nextHostId,
        originalHostId,
        hostName: nextHostName,
        hostLeftAutoMode: nextHostLeftAutoMode,
        participantIds,
        updatedAt: now
      };
    });
  }

  /**
   * Subscribe to active rooms where the player (or host) is a participant so they can rejoin anytime
   */
  public static subscribeToActiveRooms(
    playerId: string,
    onUpdate: (rooms: Room[]) => void,
    onError?: (error: any) => void
  ): () => void {
    if (!playerId) {
      onUpdate([]);
      return () => undefined;
    }

    const q = query(
      collection(db, 'rooms'),
      where('participantIds', 'array-contains', playerId)
    );

    return onSnapshot(
      q,
      (snap) => {
        const maxAgeCutoff = Date.now() - 12 * 60 * 60 * 1000;
        const active = snap.docs
          .map((d) => d.data() as Room)
          .filter(
            (r) =>
              r.status !== 'closed' &&
              r.status !== 'game_over' &&
              (!r.updatedAt || r.updatedAt >= maxAgeCutoff)
          )
          .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        onUpdate(active);
      },
      (err) => {
        console.warn('Active rooms listener warning:', err);
        onError?.(err);
      }
    );
  }

  /**
   * Realtime Firestore listener for live multiplayer synchronization
   */
  public static subscribeToRoom(
    code: string,
    onUpdate: (room: Room) => void,
    onError?: (error: any) => void
  ): () => void {
    const normalizedCode = code.trim().toUpperCase();
    const roomRef = doc(db, 'rooms', normalizedCode);

    const unsubscribe = onSnapshot(
      roomRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as Room;
          onUpdate(data);
        }
      },
      (err) => {
        console.warn('Firestore onSnapshot error:', err);
        onError?.(err);
      }
    );

    return unsubscribe;
  }

  /**
   * Host starts the game: sets round 1, synchronized tekerleme
   */
  public static async startGame(
    code: string,
    hostId: string,
    customPool?: Tekerleme[]
  ): Promise<void> {
    const normalizedCode = code.trim().toUpperCase();
    const roomRef = doc(db, 'rooms', normalizedCode);
    const snap = await getDoc(roomRef);
    if (!snap.exists()) throw new Error('Oda bulunamadı');

    const roomData = snap.data() as Room;
    const isAuthorizedHost =
      roomData.hostId === hostId ||
      roomData.originalHostId === hostId ||
      roomData.players.find((p) => p.id === hostId)?.isHost ||
      roomData.players[0]?.id === hostId;

    if (!isAuthorizedHost) {
      throw new Error('Yalnızca oda kurucusu yarışmayı başlatabilir.');
    }

    if ((roomData.players || []).length < 2) {
      throw new Error('Yarışmayı başlatmak için en az 2 oyuncu (veya test botu) gerekiyor!');
    }

    const firstTekerleme = getRandomTekerleme(
      roomData.settings.difficulty,
      roomData.settings.category,
      undefined,
      customPool
    );

    const cleanTekerleme = {
      id: firstTekerleme.id,
      title: firstTekerleme.title,
      text: firstTekerleme.text,
      difficulty: firstTekerleme.difficulty,
      category: firstTekerleme.category,
      categoryLabel: firstTekerleme.categoryLabel || '',
      targetSounds: firstTekerleme.targetSounds || [],
      benchmarkSeconds: firstTekerleme.benchmarkSeconds || 4,
      tip: firstTekerleme.tip || ''
    };

    const players = (roomData.players || []).map((p) => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      isHost: Boolean(p.isHost),
      isReady: Boolean(p.isReady),
      totalPoints: Number(p.totalPoints) || 0
    }));

    const participantIds = Array.from(
      new Set([
        ...(roomData.participantIds || []),
        ...players.filter((p) => !p.id.startsWith('bot-')).map((p) => p.id)
      ])
    ).slice(0, 50);

    const cleanPayload = deepCleanForFirestore({
      status: 'in_round',
      currentRound: 1,
      currentTekerleme: cleanTekerleme,
      hostLeftAutoMode: false,
      originalHostId: roomData.originalHostId || roomData.hostId,
      participantIds,
      players,
      [`roundScores.1`]: [],
      updatedAt: Date.now()
    });

    await updateDoc(roomRef, cleanPayload);
  }

  /**
   * Student or Host submits their round score atomically
   */
  public static async submitScore(code: string, score: PlayerScore): Promise<void> {
    const normalizedCode = code.trim().toUpperCase();
    const roomRef = doc(db, 'rooms', normalizedCode);

    await runTransaction(db, async (tx) => {
      const snap = await tx.get(roomRef);
      if (!snap.exists()) return;

      const roomData = snap.data() as Room;
      if (roomData.status !== 'in_round') return;

      const roundNum = roomData.currentRound || 1;
      const existingScores: PlayerScore[] = [...(roomData.roundScores?.[roundNum] || [])];

      const cleanScore: any = {
        playerId: score.playerId,
        playerName: score.playerName,
        avatar: score.avatar,
        isHost: Boolean(score.isHost),
        isCurrentUser: Boolean(score.isCurrentUser),
        accuracy: Number(score.accuracy) || 0,
        durationSeconds: Number(score.durationSeconds) || 0,
        wpm: Number(score.wpm) || 0,
        speedScore: Number(score.speedScore) || 0,
        totalScore: Number(score.totalScore) || 0
      };
      if (score.badge) cleanScore.badge = score.badge;
      if (score.wordBreakdown) cleanScore.wordBreakdown = score.wordBreakdown;

      const existingIdx = existingScores.findIndex((s) => s.playerId === score.playerId);
      const previousScoreForThisRound = existingIdx >= 0 ? existingScores[existingIdx].totalScore : 0;

      if (existingIdx >= 0) {
        existingScores[existingIdx] = cleanScore;
      } else {
        existingScores.push(cleanScore);
      }

      // Auto-submit simulated scores for any bot players in the room if not yet scored this round
      const botSkills: ('pro' | 'mid' | 'novice')[] = ['pro', 'mid', 'novice'];
      if (roomData.currentTekerleme) {
        (roomData.players || []).forEach((p, idx) => {
          if (p.id.startsWith('bot-') && !existingScores.some((s) => s.playerId === p.id)) {
            const botResult = generateBotScore(
              roomData.currentTekerleme!,
              p.name,
              p.avatar,
              botSkills[idx % botSkills.length]
            );
            botResult.playerId = p.id;
            existingScores.push(botResult);
          }
        });
      }

      const players = (roomData.players || []).map((p) => {
        const roundEntry = existingScores.find((s) => s.playerId === p.id);
        if (p.id === score.playerId) {
          const prevTotal = Number(p.totalPoints) || 0;
          const delta = cleanScore.totalScore - previousScoreForThisRound;
          return {
            id: p.id,
            name: p.name,
            avatar: p.avatar,
            isHost: Boolean(p.isHost),
            isReady: Boolean(p.isReady),
            currentRoundScore: cleanScore,
            totalPoints: prevTotal + delta
          };
        }
        if (p.id.startsWith('bot-') && roundEntry && !p.currentRoundScore) {
          return {
            id: p.id,
            name: p.name,
            avatar: p.avatar,
            isHost: false,
            isReady: true,
            currentRoundScore: roundEntry,
            totalPoints: (Number(p.totalPoints) || 0) + roundEntry.totalScore
          };
        }
        return {
          id: p.id,
          name: p.name,
          avatar: p.avatar,
          isHost: Boolean(p.isHost),
          isReady: Boolean(p.isReady),
          totalPoints: Number(p.totalPoints) || 0,
          ...(p.currentRoundScore ? { currentRoundScore: p.currentRoundScore } : {})
        };
      });

      let nextStatus: RoomStatus = roomData.status;
      if (players.every((p) => existingScores.some((s) => s.playerId === p.id))) {
        nextStatus = 'round_result';
      }

      const cleanPayload = deepCleanForFirestore({
        players,
        status: nextStatus,
        [`roundScores.${roundNum}`]: existingScores,
        updatedAt: Date.now()
      });

      tx.update(roomRef, cleanPayload);
    });
  }

  /**
   * Forces current round to show results (authorized for host or when room is in auto progression)
   */
  public static async finishRoundNow(
    code: string,
    actorId: string,
    expectedRound?: number
  ): Promise<void> {
    const normalizedCode = code.trim().toUpperCase();
    const roomRef = doc(db, 'rooms', normalizedCode);

    await runTransaction(db, async (tx) => {
      const snap = await tx.get(roomRef);
      if (!snap.exists()) return;

      const roomData = snap.data() as Room;
      if (roomData.status !== 'in_round') return;
      if (expectedRound !== undefined && roomData.currentRound !== expectedRound) return;

      const isAuto =
        roomData.settings?.progressionMode === 'auto' || Boolean(roomData.hostLeftAutoMode);
      const isHost = roomData.hostId === actorId || roomData.originalHostId === actorId;
      if (!isHost && !isAuto) return;

      tx.update(
        roomRef,
        deepCleanForFirestore({
          status: 'round_result',
          updatedAt: Date.now()
        })
      );
    });
  }

  /**
   * Advances to the next round or finishes tournament atomically (host or auto mode)
   */
  public static async nextRound(
    code: string,
    actorId: string,
    customPool?: Tekerleme[],
    expectedRound?: number
  ): Promise<void> {
    const normalizedCode = code.trim().toUpperCase();
    const roomRef = doc(db, 'rooms', normalizedCode);

    await runTransaction(db, async (tx) => {
      const snap = await tx.get(roomRef);
      if (!snap.exists()) return;

      const roomData = snap.data() as Room;
      if (roomData.status !== 'round_result') return;
      if (expectedRound !== undefined && roomData.currentRound !== expectedRound) return;

      const isAuto =
        roomData.settings?.progressionMode === 'auto' || Boolean(roomData.hostLeftAutoMode);
      const isHost = roomData.hostId === actorId || roomData.originalHostId === actorId;
      if (!isHost && !isAuto) return;

      if (roomData.currentRound >= roomData.totalRounds) {
        const sorted = [...(roomData.players || [])].sort(
          (a, b) => (b.totalPoints || 0) - (a.totalPoints || 0)
        );
        const topWinnerId = sorted[0]?.id || '';
        tx.update(
          roomRef,
          deepCleanForFirestore({
            status: 'game_over',
            winnerId: topWinnerId,
            updatedAt: Date.now()
          })
        );
      } else {
        const nextRoundNum = roomData.currentRound + 1;
        const nextTekerleme = getRandomTekerleme(
          roomData.settings.difficulty,
          roomData.settings.category,
          roomData.currentTekerleme?.id,
          customPool
        );

        const cleanTekerleme = {
          id: nextTekerleme.id,
          title: nextTekerleme.title,
          text: nextTekerleme.text,
          difficulty: nextTekerleme.difficulty,
          category: nextTekerleme.category,
          categoryLabel: nextTekerleme.categoryLabel || '',
          targetSounds: nextTekerleme.targetSounds || [],
          benchmarkSeconds: nextTekerleme.benchmarkSeconds || 4,
          tip: nextTekerleme.tip || ''
        };

        const players = (roomData.players || []).map((p) => ({
          id: p.id,
          name: p.name,
          avatar: p.avatar,
          isHost: Boolean(p.isHost),
          isReady: Boolean(p.isReady),
          totalPoints: Number(p.totalPoints) || 0
        }));

        tx.update(
          roomRef,
          deepCleanForFirestore({
            currentRound: nextRoundNum,
            currentTekerleme: cleanTekerleme,
            status: 'in_round',
            players,
            [`roundScores.${nextRoundNum}`]: [],
            updatedAt: Date.now()
          })
        );
      }
    });
  }

  /**
   * Host restarts the game
   */
  public static async restartGame(
    code: string,
    hostId: string,
    customPool?: Tekerleme[]
  ): Promise<void> {
    const normalizedCode = code.trim().toUpperCase();
    const roomRef = doc(db, 'rooms', normalizedCode);
    const snap = await getDoc(roomRef);
    if (!snap.exists()) return;

    const roomData = snap.data() as Room;

    const firstTekerleme = getRandomTekerleme(
      roomData.settings.difficulty,
      roomData.settings.category,
      undefined,
      customPool
    );

    const cleanTekerleme = {
      id: firstTekerleme.id,
      title: firstTekerleme.title,
      text: firstTekerleme.text,
      difficulty: firstTekerleme.difficulty,
      category: firstTekerleme.category,
      categoryLabel: firstTekerleme.categoryLabel || '',
      targetSounds: firstTekerleme.targetSounds || [],
      benchmarkSeconds: firstTekerleme.benchmarkSeconds || 4,
      tip: firstTekerleme.tip || ''
    };

    const players = (roomData.players || []).map((p) => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      isHost: Boolean(p.isHost),
      isReady: Boolean(p.isReady),
      totalPoints: 0
    }));

    await updateDoc(
      roomRef,
      deepCleanForFirestore({
        currentRound: 1,
        currentTekerleme: cleanTekerleme,
        status: 'in_round',
        winnerId: '',
        hostLeftAutoMode: false,
        players,
        roundScores: { 1: [] },
        updatedAt: Date.now()
      })
    );
  }

  /**
   * Toggle ready status
   */
  public static async toggleReady(code: string, playerId: string): Promise<void> {
    const normalizedCode = code.trim().toUpperCase();
    const roomRef = doc(db, 'rooms', normalizedCode);
    const snap = await getDoc(roomRef);
    if (!snap.exists()) return;

    const roomData = snap.data() as Room;
    const players = (roomData.players || []).map((p) => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      isHost: Boolean(p.isHost),
      isReady: p.id === playerId ? !p.isReady : Boolean(p.isReady),
      totalPoints: Number(p.totalPoints) || 0,
      ...(p.currentRoundScore ? { currentRoundScore: p.currentRoundScore } : {})
    }));

    await updateDoc(
      roomRef,
      deepCleanForFirestore({
        players,
        updatedAt: Date.now()
      })
    );
  }

  /**
   * Leave room gracefully: keeps active mid-game rooms running automatically even if host leaves,
   * and preserves departed player state + participantIds so they can rejoin via Aktif Odalar.
   */
  public static async leaveRoom(code: string, playerId: string): Promise<void> {
    const normalizedCode = code.trim().toUpperCase();
    const roomRef = doc(db, 'rooms', normalizedCode);

    await runTransaction(db, async (tx) => {
      const snap = await tx.get(roomRef);
      if (!snap.exists()) return;

      const roomData = snap.data() as Room & {
        departedPlayers?: Record<string, { totalPoints: number; name: string; avatar: string }>;
      };
      if (roomData.status === 'game_over' || roomData.status === 'closed') {
        return;
      }
      const leavingPlayer = (roomData.players || []).find((p) => p.id === playerId);
      const players = (roomData.players || []).filter((p) => p.id !== playerId);
      const remainingHumans = players.filter((p) => !p.id.startsWith('bot-'));

      const departedPlayers = { ...(roomData.departedPlayers || {}) };
      if (leavingPlayer && !leavingPlayer.id.startsWith('bot-')) {
        departedPlayers[playerId] = {
          totalPoints: Number(leavingPlayer.totalPoints) || 0,
          name: leavingPlayer.name,
          avatar: leavingPlayer.avatar
        };
      }

      if (remainingHumans.length === 0) {
        tx.update(
          roomRef,
          deepCleanForFirestore({
            players: [],
            status: 'closed',
            departedPlayers,
            updatedAt: Date.now()
          })
        );
        return;
      }

      const originalHostId = roomData.originalHostId || roomData.hostId;
      let hostId = roomData.hostId;
      let hostName = roomData.hostName;
      let hostLeftAutoMode = Boolean(roomData.hostLeftAutoMode);

      if (hostId === playerId || originalHostId === playerId) {
        const nextHost = remainingHumans[0];
        hostId = nextHost.id;
        hostName = nextHost.name;
        players.forEach((p) => {
          p.isHost = p.id === nextHost.id;
        });
        if (roomData.status === 'in_round' || roomData.status === 'round_result') {
          hostLeftAutoMode = true;
        }
      }

      let nextStatus = roomData.status;
      if (roomData.status === 'in_round') {
        const roundScores = roomData.roundScores?.[roomData.currentRound] || [];
        const allRemainingScored = players.every((p) =>
          roundScores.some((s) => s.playerId === p.id)
        );
        if (allRemainingScored) {
          nextStatus = 'round_result';
        }
      }

      const participantIds = Array.from(
        new Set([
          ...(roomData.participantIds || []),
          originalHostId,
          ...remainingHumans.map((p) => p.id),
          playerId
        ])
      )
        .filter((id) => Boolean(id) && !id.startsWith('bot-'))
        .slice(0, 50);

      tx.update(
        roomRef,
        deepCleanForFirestore({
          players,
          hostId,
          originalHostId,
          hostName,
          hostLeftAutoMode,
          status: nextStatus,
          departedPlayers,
          participantIds,
          updatedAt: Date.now()
        })
      );
    });
  }

  /**
   * Host explicitly closes/removes the room so invited friends see it is closed
   */
  public static async closeRoom(code: string, hostId: string): Promise<void> {
    const normalizedCode = code.trim().toUpperCase();
    const roomRef = doc(db, 'rooms', normalizedCode);
    const snap = await getDoc(roomRef);
    if (!snap.exists()) return;

    const roomData = snap.data() as Room;
    if (roomData.hostId !== hostId && roomData.originalHostId !== hostId) return;

    await updateDoc(
      roomRef,
      deepCleanForFirestore({
        status: 'closed',
        players: [],
        updatedAt: Date.now()
      })
    );
  }

  /**
   * Add optional test bot
   */
  public static async addTestBot(code: string): Promise<void> {
    const normalizedCode = code.trim().toUpperCase();
    const roomRef = doc(db, 'rooms', normalizedCode);
    const snap = await getDoc(roomRef);
    if (!snap.exists()) return;

    const roomData = snap.data() as Room;
    const botMotifs = [
      { name: 'Koçboynuzu', avatar: 'kilim-kocboynuzu' },
      { name: 'Hayat Ağacı', avatar: 'kilim-hayatagaci' },
      { name: 'Yıldız', avatar: 'kilim-yildiz' },
      { name: 'Su Yolu', avatar: 'kilim-suyolu' },
      { name: 'Turna Kuşu', avatar: 'kilim-kus' }
    ];
    const botCount = (roomData.players || []).filter((p) => p.id.startsWith('bot-')).length;
    const chosen = botMotifs[botCount % botMotifs.length];
    const name = `${chosen.name} (Test Botu)`;
    const avatar = chosen.avatar;
    const botId = `bot-${Date.now()}`;

    const players = [
      ...(roomData.players || []),
      {
        id: botId,
        name,
        avatar,
        isHost: false,
        isReady: true,
        totalPoints: 0
      }
    ];

    await updateDoc(
      roomRef,
      deepCleanForFirestore({
        players,
        updatedAt: Date.now()
      })
    );
  }
}
