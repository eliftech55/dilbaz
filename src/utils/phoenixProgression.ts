import { UserProfile } from '../types/game';

export type RelicSlot = 'aura' | 'talisman' | 'crest';

export interface PhoenixStage {
  id: string;
  name: string;
  minLevel: number;
  accentColor: string;
  ringGradient: string;
  useEvolvedArt: boolean;
}

export interface PhoenixRelicItem {
  id: string;
  name: string;
  slot: RelicSlot;
  slotLabel: string;
  shortEffect: string;
  unlockLevel: number;
  unlockWins?: number;
  unlockCostSparks: number;
  upgradeBaseCost: number;
  maxRank: number;
  glowColor: string;
  badgeIcon: 'feather' | 'nazar' | 'flame' | 'crown' | 'bolt' | 'halo';
}

export interface LocalPhoenixProgress {
  soloXp: number;
  sparks: number;
  practicesCompleted: number;
  roundsCompleted: number;
  bestWpm: number;
  bestAccuracy: number;
  unlockedIds: string[];
  equipped: Record<RelicSlot, string>;
  itemRanks: Record<string, number>;
}

export interface PhoenixComputedState {
  level: number;
  totalXp: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  progressPercent: number;
  sparks: number;
  stage: PhoenixStage;
  nextStage: PhoenixStage | null;
  progress: LocalPhoenixProgress;
  relics: Array<
    PhoenixRelicItem & {
      unlocked: boolean;
      equipped: boolean;
      rank: number;
      nextUpgradeCost: number | null;
      canAffordUnlock: boolean;
      canAffordUpgrade: boolean;
    }
  >;
  activeAura: PhoenixRelicItem;
  activeTalisman: PhoenixRelicItem | null;
  activeCrest: PhoenixRelicItem | null;
}

const STORAGE_KEY = 'dilbaz_phoenix_progress_v1';

export const PHOENIX_STAGES: PhoenixStage[] = [
  {
    id: 'spark',
    name: 'Kıvılcım Kanat',
    minLevel: 1,
    accentColor: '#00F5D4',
    ringGradient: 'from-[#3A86FF] via-[#00F5D4] to-[#06D6A0]',
    useEvolvedArt: false
  },
  {
    id: 'ebru',
    name: 'Ebru Çırağı',
    minLevel: 3,
    accentColor: '#3A86FF',
    ringGradient: 'from-[#00F5D4] via-[#3A86FF] to-[#FF006E]',
    useEvolvedArt: false
  },
  {
    id: 'golden_crest',
    name: 'Altın İbik',
    minLevel: 5,
    accentColor: '#FFBE0B',
    ringGradient: 'from-[#FFBE0B] via-[#FF5400] to-[#FF006E]',
    useEvolvedArt: false
  },
  {
    id: 'sovereign',
    name: 'Söz Sultanı',
    minLevel: 8,
    accentColor: '#FF006E',
    ringGradient: 'from-[#FF006E] via-[#FFBE0B] to-[#00F5D4]',
    useEvolvedArt: true
  },
  {
    id: 'legendary',
    name: 'Efsanevi Zümrüdüanka',
    minLevel: 12,
    accentColor: '#FFBE0B',
    ringGradient: 'from-[#FFBE0B] via-[#00F5D4] to-[#FF006E]',
    useEvolvedArt: true
  }
];

export const PHOENIX_RELICS: PhoenixRelicItem[] = [
  {
    id: 'aura_ebru_cyan',
    name: 'Ebru Turkuaz Hale',
    slot: 'aura',
    slotLabel: 'Kanat Aurası',
    shortEffect: 'Temel Ebru parıltısı',
    unlockLevel: 1,
    unlockCostSparks: 0,
    upgradeBaseCost: 45,
    maxRank: 3,
    glowColor: '#00F5D4',
    badgeIcon: 'feather'
  },
  {
    id: 'talisman_nazar',
    name: 'Nazar Tılsımı',
    slot: 'talisman',
    slotLabel: 'Tılsım',
    shortEffect: '+15% Pratik Kıvılcımı',
    unlockLevel: 2,
    unlockCostSparks: 60,
    upgradeBaseCost: 55,
    maxRank: 3,
    glowColor: '#3A86FF',
    badgeIcon: 'nazar'
  },
  {
    id: 'aura_pomegranate_flame',
    name: 'Nar Çiçeği Alevi',
    slot: 'aura',
    slotLabel: 'Kanat Aurası',
    shortEffect: 'Sıcak ateş halesi',
    unlockLevel: 3,
    unlockCostSparks: 110,
    upgradeBaseCost: 70,
    maxRank: 3,
    glowColor: '#FF006E',
    badgeIcon: 'flame'
  },
  {
    id: 'crest_golden_crown',
    name: 'Altın İbik Tacı',
    slot: 'crest',
    slotLabel: 'Taç & İbik',
    shortEffect: 'Usta nişanı parıltısı',
    unlockLevel: 4,
    unlockCostSparks: 150,
    upgradeBaseCost: 85,
    maxRank: 3,
    glowColor: '#FFBE0B',
    badgeIcon: 'crown'
  },
  {
    id: 'talisman_speed_bolt',
    name: 'Hız Yıldızı İzi',
    slot: 'talisman',
    slotLabel: 'Tılsım',
    shortEffect: '+25% Hız Kıvılcımı',
    unlockLevel: 5,
    unlockWins: 1,
    unlockCostSparks: 180,
    upgradeBaseCost: 95,
    maxRank: 3,
    glowColor: '#06D6A0',
    badgeIcon: 'bolt'
  },
  {
    id: 'crest_celestial_halo',
    name: 'Gök Sultanı Halesi',
    slot: 'crest',
    slotLabel: 'Taç & İbik',
    shortEffect: 'Efsanevi 3D aura',
    unlockLevel: 7,
    unlockCostSparks: 260,
    upgradeBaseCost: 120,
    maxRank: 3,
    glowColor: '#FFBE0B',
    badgeIcon: 'halo'
  }
];

const DEFAULT_PROGRESS: LocalPhoenixProgress = {
  soloXp: 0,
  sparks: 50,
  practicesCompleted: 0,
  roundsCompleted: 0,
  bestWpm: 0,
  bestAccuracy: 0,
  unlockedIds: ['aura_ebru_cyan'],
  equipped: {
    aura: 'aura_ebru_cyan',
    talisman: '',
    crest: ''
  },
  itemRanks: {
    aura_ebru_cyan: 1
  }
};

export function loadPhoenixProgress(): LocalPhoenixProgress {
  if (typeof window === 'undefined') return DEFAULT_PROGRESS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PROGRESS };
    const parsed = JSON.parse(raw) as Partial<LocalPhoenixProgress>;
    const unlockedSet = new Set<string>([
      'aura_ebru_cyan',
      ...(Array.isArray(parsed.unlockedIds) ? parsed.unlockedIds : [])
    ]);
    return {
      soloXp: typeof parsed.soloXp === 'number' ? Math.max(0, parsed.soloXp) : 0,
      sparks: typeof parsed.sparks === 'number' ? Math.max(0, parsed.sparks) : 50,
      practicesCompleted:
        typeof parsed.practicesCompleted === 'number' ? Math.max(0, parsed.practicesCompleted) : 0,
      roundsCompleted:
        typeof parsed.roundsCompleted === 'number' ? Math.max(0, parsed.roundsCompleted) : 0,
      bestWpm: typeof parsed.bestWpm === 'number' ? Math.max(0, parsed.bestWpm) : 0,
      bestAccuracy: typeof parsed.bestAccuracy === 'number' ? Math.max(0, parsed.bestAccuracy) : 0,
      unlockedIds: Array.from(unlockedSet),
      equipped: {
        aura: parsed.equipped?.aura || 'aura_ebru_cyan',
        talisman: parsed.equipped?.talisman || '',
        crest: parsed.equipped?.crest || ''
      },
      itemRanks: {
        aura_ebru_cyan: 1,
        ...(parsed.itemRanks || {})
      }
    };
  } catch {
    return { ...DEFAULT_PROGRESS };
  }
}

export function savePhoenixProgress(next: LocalPhoenixProgress): LocalPhoenixProgress {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore storage quota errors
    }
  }
  return next;
}

export function xpThresholdForLevel(level: number): number {
  return Math.max(100, 90 + (level - 1) * 45);
}

export function computeLevelFromXp(totalXp: number): {
  level: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  progressPercent: number;
} {
  let level = 1;
  let remaining = Math.max(0, Math.round(totalXp));
  while (remaining >= xpThresholdForLevel(level) && level < 50) {
    remaining -= xpThresholdForLevel(level);
    level += 1;
  }
  const xpForNextLevel = xpThresholdForLevel(level);
  const progressPercent = Math.min(100, Math.max(4, Math.round((remaining / xpForNextLevel) * 100)));
  return {
    level,
    xpIntoLevel: remaining,
    xpForNextLevel,
    progressPercent
  };
}

export function getPhoenixState(
  userProfile: UserProfile | null | undefined,
  rawProgress?: LocalPhoenixProgress
): PhoenixComputedState {
  const progress = rawProgress || loadPhoenixProgress();

  const profileXp = userProfile
    ? userProfile.points * 1.2 +
      userProfile.multiplayerWins * 70 +
      userProfile.approvedTekerlemeCount * 45
    : 0;

  const totalXp = Math.round(progress.soloXp + profileXp);
  const { level, xpIntoLevel, xpForNextLevel, progressPercent } = computeLevelFromXp(totalXp);

  let stage = PHOENIX_STAGES[0];
  let nextStage: PhoenixStage | null = null;
  for (let i = 0; i < PHOENIX_STAGES.length; i += 1) {
    if (level >= PHOENIX_STAGES[i].minLevel) {
      stage = PHOENIX_STAGES[i];
      nextStage = PHOENIX_STAGES[i + 1] || null;
    }
  }

  const wins = userProfile?.multiplayerWins ?? 0;

  const relics = PHOENIX_RELICS.map((item) => {
    const unlockedByRecord = progress.unlockedIds.includes(item.id);
    const unlocked = unlockedByRecord || item.unlockCostSparks === 0;
    const rank = unlocked ? Math.max(1, Math.min(item.maxRank, progress.itemRanks[item.id] || 1)) : 0;
    const equipped = progress.equipped[item.slot] === item.id;
    const nextUpgradeCost =
      unlocked && rank < item.maxRank ? item.upgradeBaseCost * rank : null;
    const meetsLevel = level >= item.unlockLevel && (!item.unlockWins || wins >= item.unlockWins);
    const canAffordUnlock = !unlocked && meetsLevel && progress.sparks >= item.unlockCostSparks;
    const canAffordUpgrade = Boolean(
      unlocked && nextUpgradeCost !== null && progress.sparks >= nextUpgradeCost
    );

    return {
      ...item,
      unlocked,
      equipped,
      rank,
      nextUpgradeCost,
      canAffordUnlock,
      canAffordUpgrade
    };
  });

  const activeAura =
    relics.find((r) => r.slot === 'aura' && r.equipped && r.unlocked) || relics[0];
  const activeTalisman =
    relics.find((r) => r.slot === 'talisman' && r.equipped && r.unlocked) || null;
  const activeCrest =
    relics.find((r) => r.slot === 'crest' && r.equipped && r.unlocked) || null;

  return {
    level,
    totalXp,
    xpIntoLevel,
    xpForNextLevel,
    progressPercent,
    sparks: progress.sparks,
    stage,
    nextStage,
    progress,
    relics,
    activeAura,
    activeTalisman,
    activeCrest
  };
}

export function recordPracticeOrRoundReward(params: {
  source: 'solo' | 'multiplayer';
  accuracy: number;
  wpm: number;
  score: number;
}): {
  xpEarned: number;
  sparksEarned: number;
  nextProgress: LocalPhoenixProgress;
} {
  const prev = loadPhoenixProgress();
  const baseXp = params.source === 'multiplayer' ? 35 : 22;
  const perfXp = Math.round((params.accuracy * 0.45) + Math.min(35, params.wpm * 0.2));
  const xpEarned = Math.max(12, baseXp + perfXp);

  let sparkMultiplier = 1;
  if (prev.equipped.talisman === 'talisman_nazar') {
    const rank = prev.itemRanks.talisman_nazar || 1;
    sparkMultiplier += 0.15 * rank;
  } else if (prev.equipped.talisman === 'talisman_speed_bolt' && params.wpm >= 90) {
    const rank = prev.itemRanks.talisman_speed_bolt || 1;
    sparkMultiplier += 0.25 * rank;
  }

  const rawSparks =
    (params.source === 'multiplayer' ? 24 : 14) +
    Math.round(params.accuracy / 6) +
    (params.accuracy >= 85 ? 10 : 0);
  const sparksEarned = Math.max(8, Math.round(rawSparks * sparkMultiplier));

  const nextProgress = savePhoenixProgress({
    ...prev,
    soloXp: prev.soloXp + xpEarned,
    sparks: prev.sparks + sparksEarned,
    practicesCompleted: prev.practicesCompleted + (params.source === 'solo' ? 1 : 0),
    roundsCompleted: prev.roundsCompleted + (params.source === 'multiplayer' ? 1 : 0),
    bestWpm: Math.max(prev.bestWpm, params.wpm),
    bestAccuracy: Math.max(prev.bestAccuracy, params.accuracy)
  });

  return { xpEarned, sparksEarned, nextProgress };
}

export function unlockOrEquipRelic(
  relicId: string,
  userProfile: UserProfile | null | undefined
): { ok: boolean; reason?: string; nextProgress: LocalPhoenixProgress } {
  const current = loadPhoenixProgress();
  const computed = getPhoenixState(userProfile, current);
  const target = computed.relics.find((r) => r.id === relicId);
  if (!target) {
    return { ok: false, reason: 'Öğe bulunamadı', nextProgress: current };
  }

  if (target.unlocked) {
    const nextEquipped = { ...current.equipped };
    nextEquipped[target.slot] = target.equipped && target.slot !== 'aura' ? '' : target.id;
    const saved = savePhoenixProgress({ ...current, equipped: nextEquipped });
    return { ok: true, nextProgress: saved };
  }

  const wins = userProfile?.multiplayerWins ?? 0;
  if (computed.level < target.unlockLevel) {
    return {
      ok: false,
      reason: `Seviye ${target.unlockLevel} gerekli`,
      nextProgress: current
    };
  }
  if (target.unlockWins && wins < target.unlockWins) {
    return {
      ok: false,
      reason: `${target.unlockWins} oda galibiyeti gerekli`,
      nextProgress: current
    };
  }
  if (current.sparks < target.unlockCostSparks) {
    return {
      ok: false,
      reason: `${target.unlockCostSparks} Kıvılcım gerekli`,
      nextProgress: current
    };
  }

  const nextProgress = savePhoenixProgress({
    ...current,
    sparks: current.sparks - target.unlockCostSparks,
    unlockedIds: Array.from(new Set([...current.unlockedIds, target.id])),
    itemRanks: { ...current.itemRanks, [target.id]: 1 },
    equipped: { ...current.equipped, [target.slot]: target.id }
  });

  return { ok: true, nextProgress };
}

export function upgradeRelicRank(
  relicId: string,
  userProfile: UserProfile | null | undefined
): { ok: boolean; reason?: string; nextProgress: LocalPhoenixProgress } {
  const current = loadPhoenixProgress();
  const computed = getPhoenixState(userProfile, current);
  const target = computed.relics.find((r) => r.id === relicId);
  if (!target || !target.unlocked || target.nextUpgradeCost === null) {
    return { ok: false, reason: 'Yükseltilemez', nextProgress: current };
  }
  if (current.sparks < target.nextUpgradeCost) {
    return {
      ok: false,
      reason: `${target.nextUpgradeCost} Kıvılcım gerekli`,
      nextProgress: current
    };
  }

  const nextProgress = savePhoenixProgress({
    ...current,
    sparks: current.sparks - target.nextUpgradeCost,
    itemRanks: {
      ...current.itemRanks,
      [target.id]: Math.min(target.maxRank, target.rank + 1)
    }
  });

  return { ok: true, nextProgress };
}
