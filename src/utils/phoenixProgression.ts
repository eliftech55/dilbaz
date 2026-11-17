import { Difficulty, UserProfile } from '../types/game';
import { safeLocalGet, safeLocalSet } from './safeStorage';

export type PhoenixDifficultyInput = 'karisik' | Difficulty;

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

export interface PhoenixFeatherPalette {
  id: string;
  name: string;
  primaryColor: string;
  secondaryColor: string;
  bodyBaseColor: string;
  accentColor: string;
  swirlColors: [string, string, string, string];
  ringGradient: string;
  requiredRelicIds?: string[];
  unlockHint: string;
}

export interface PhoenixWingPattern {
  id: 'ebru_wave' | 'peacock_eye' | 'flame_streak' | 'royal_filigree' | 'star_bolt';
  name: string;
  shortLabel: string;
  requiredRelicIds?: string[];
  unlockHint: string;
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
  featherPaletteId: string;
  wingPatternId: PhoenixWingPattern['id'];
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
  featherPalettes: Array<
    PhoenixFeatherPalette & {
      unlocked: boolean;
      selected: boolean;
    }
  >;
  wingPatterns: Array<
    PhoenixWingPattern & {
      unlocked: boolean;
      selected: boolean;
    }
  >;
  activeAura: PhoenixRelicItem;
  activeTalisman: PhoenixRelicItem | null;
  activeCrest: PhoenixRelicItem | null;
  activeFeatherPalette: PhoenixFeatherPalette;
  activeWingPattern: PhoenixWingPattern;
  flapDurationSeconds: number;
  flapLabel: string;
}

export interface PhoenixFlapSpeedInfo {
  durationSeconds: number;
  wingBpm: number;
  tempoLabel: string;
}

export function getPhoenixFlapSpeed(params?: {
  level?: number;
  difficulty?: PhoenixDifficultyInput | null;
}): PhoenixFlapSpeedInfo {
  const level = Math.max(1, Math.round(params?.level ?? 1));
  const difficulty = params?.difficulty ?? 'kolay';

  const difficultyBoostMap: Record<PhoenixDifficultyInput, number> = {
    kolay: 0,
    karisik: 0.35,
    orta: 0.7,
    zor: 1.15,
    efsane: 1.55
  };

  const difficultyReduction = difficultyBoostMap[difficulty] ?? 0;
  const levelReduction = Math.min(1.1, (level - 1) * 0.09);
  const rawDuration = 4.4 - difficultyReduction - levelReduction;
  const durationSeconds = Math.max(1.65, Math.min(4.6, Number(rawDuration.toFixed(2))));
  const wingBpm = Math.round(60 / durationSeconds);

  let tempoLabel = 'Meltem Süzülüşü';
  if (durationSeconds < 2.15) {
    tempoLabel = 'Canlı Rüzgar';
  } else if (durationSeconds < 2.85) {
    tempoLabel = 'Dinamik Esinti';
  } else if (durationSeconds < 3.55) {
    tempoLabel = 'Yumuşak Kanat';
  } else if (durationSeconds < 4.05) {
    tempoLabel = 'Hafif Esinti';
  }

  return { durationSeconds, wingBpm, tempoLabel };
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

export const PHOENIX_FEATHER_PALETTES: PhoenixFeatherPalette[] = [
  {
    id: 'ebru_classic',
    name: 'Ebru Klasiği',
    primaryColor: '#00F5D4',
    secondaryColor: '#FF006E',
    bodyBaseColor: '#1E3A8A',
    accentColor: '#FFBE0B',
    swirlColors: ['#00F5D4', '#FF006E', '#3A86FF', '#FFBE0B'],
    ringGradient: 'from-[#00F5D4] via-[#3A86FF] to-[#FF006E]',
    unlockHint: 'Başlangıç paleti'
  },
  {
    id: 'nazar_sapphire',
    name: 'Nazar Safiri',
    primaryColor: '#38BDF8',
    secondaryColor: '#1D4ED8',
    bodyBaseColor: '#0F2A6B',
    accentColor: '#00F5D4',
    swirlColors: ['#38BDF8', '#1D4ED8', '#00F5D4', '#FFFBEB'],
    ringGradient: 'from-[#38BDF8] via-[#1D4ED8] to-[#00F5D4]',
    requiredRelicIds: ['talisman_nazar'],
    unlockHint: 'Nazar Tılsımı ile açılır'
  },
  {
    id: 'pomegranate_flame',
    name: 'Nar Çiçeği Alevi',
    primaryColor: '#FF006E',
    secondaryColor: '#FF5400',
    bodyBaseColor: '#4A0D2E',
    accentColor: '#FFBE0B',
    swirlColors: ['#FF006E', '#FF5400', '#FFBE0B', '#BE123C'],
    ringGradient: 'from-[#FF006E] via-[#FF5400] to-[#FFBE0B]',
    requiredRelicIds: ['aura_pomegranate_flame'],
    unlockHint: 'Nar Çiçeği Alevi ile açılır'
  },
  {
    id: 'imperial_gold',
    name: 'Altın İbik',
    primaryColor: '#FFBE0B',
    secondaryColor: '#FB8500',
    bodyBaseColor: '#3B2305',
    accentColor: '#FFF3B0',
    swirlColors: ['#FFBE0B', '#F59E0B', '#FFF3B0', '#FF5400'],
    ringGradient: 'from-[#FFBE0B] via-[#FB8500] to-[#FFF3B0]',
    requiredRelicIds: ['crest_golden_crown'],
    unlockHint: 'Altın İbik Tacı ile açılır'
  },
  {
    id: 'emerald_bolt',
    name: 'Zümrüt Yıldızı',
    primaryColor: '#06D6A0',
    secondaryColor: '#00F5D4',
    bodyBaseColor: '#064E3B',
    accentColor: '#FFBE0B',
    swirlColors: ['#06D6A0', '#00F5D4', '#FFBE0B', '#3A86FF'],
    ringGradient: 'from-[#06D6A0] via-[#00F5D4] to-[#FFBE0B]',
    requiredRelicIds: ['talisman_speed_bolt'],
    unlockHint: 'Hız Yıldızı İzi ile açılır'
  },
  {
    id: 'celestial_sovereign',
    name: 'Gök Sultanı',
    primaryColor: '#00F5D4',
    secondaryColor: '#A855F7',
    bodyBaseColor: '#1E1B4B',
    accentColor: '#FFBE0B',
    swirlColors: ['#FFBE0B', '#00F5D4', '#EC4899', '#8B5CF6'],
    ringGradient: 'from-[#FFBE0B] via-[#00F5D4] to-[#A855F7]',
    requiredRelicIds: ['crest_celestial_halo'],
    unlockHint: 'Gök Sultanı Halesi ile açılır'
  }
];

export const PHOENIX_WING_PATTERNS: PhoenixWingPattern[] = [
  {
    id: 'ebru_wave',
    name: 'Ebru Dalgası',
    shortLabel: 'Ebru',
    unlockHint: 'Logo özgün deseni'
  },
  {
    id: 'peacock_eye',
    name: 'Tavus Gözü',
    shortLabel: 'Tavus',
    requiredRelicIds: ['talisman_nazar'],
    unlockHint: 'Nazar Tılsımı ile açılır'
  },
  {
    id: 'flame_streak',
    name: 'Alev Şeridi',
    shortLabel: 'Alev',
    requiredRelicIds: ['aura_pomegranate_flame'],
    unlockHint: 'Nar Çiçeği Alevi ile açılır'
  },
  {
    id: 'royal_filigree',
    name: 'Selçuklu Nakışı',
    shortLabel: 'Nakış',
    requiredRelicIds: ['crest_golden_crown'],
    unlockHint: 'Altın İbik Tacı ile açılır'
  },
  {
    id: 'star_bolt',
    name: 'Yıldız Kıvılcımı',
    shortLabel: 'Yıldız',
    requiredRelicIds: ['talisman_speed_bolt', 'crest_celestial_halo'],
    unlockHint: 'Hız Yıldızı veya Gök Halesi ile açılır'
  }
];

export function getFeatherPalette(paletteId?: string | null): PhoenixFeatherPalette {
  return (
    PHOENIX_FEATHER_PALETTES.find((p) => p.id === paletteId) || PHOENIX_FEATHER_PALETTES[0]
  );
}

export function getWingPattern(patternId?: string | null): PhoenixWingPattern {
  return (
    PHOENIX_WING_PATTERNS.find((p) => p.id === patternId) || PHOENIX_WING_PATTERNS[0]
  );
}

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
  },
  featherPaletteId: 'ebru_classic',
  wingPatternId: 'ebru_wave'
};

export function loadPhoenixProgress(): LocalPhoenixProgress {
  if (typeof window === 'undefined') return DEFAULT_PROGRESS;
  try {
    const raw = safeLocalGet(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PROGRESS };
    const parsed = JSON.parse(raw) as Partial<LocalPhoenixProgress>;
    const unlockedSet = new Set<string>([
      'aura_ebru_cyan',
      ...(Array.isArray(parsed.unlockedIds) ? parsed.unlockedIds : [])
    ]);
    const paletteValid = PHOENIX_FEATHER_PALETTES.some((p) => p.id === parsed.featherPaletteId);
    const patternValid = PHOENIX_WING_PATTERNS.some((p) => p.id === parsed.wingPatternId);

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
      },
      featherPaletteId: paletteValid ? (parsed.featherPaletteId as string) : 'ebru_classic',
      wingPatternId: patternValid
        ? (parsed.wingPatternId as PhoenixWingPattern['id'])
        : 'ebru_wave'
    };
  } catch {
    return { ...DEFAULT_PROGRESS };
  }
}

export function savePhoenixProgress(next: LocalPhoenixProgress): LocalPhoenixProgress {
  if (typeof window !== 'undefined') {
    safeLocalSet(STORAGE_KEY, JSON.stringify(next));
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

  const unlockedRelicIds = new Set(relics.filter((r) => r.unlocked).map((r) => r.id));

  const featherPalettes = PHOENIX_FEATHER_PALETTES.map((pal) => {
    const unlocked =
      !pal.requiredRelicIds ||
      pal.requiredRelicIds.some((reqId) => unlockedRelicIds.has(reqId));
    return {
      ...pal,
      unlocked,
      selected: false
    };
  });

  const resolvedPalette =
    featherPalettes.find((p) => p.id === progress.featherPaletteId && p.unlocked) ||
    featherPalettes[0];
  featherPalettes.forEach((p) => {
    p.selected = p.id === resolvedPalette.id;
  });

  const wingPatterns = PHOENIX_WING_PATTERNS.map((pat) => {
    const unlocked =
      !pat.requiredRelicIds ||
      pat.requiredRelicIds.some((reqId) => unlockedRelicIds.has(reqId));
    return {
      ...pat,
      unlocked,
      selected: false
    };
  });

  const resolvedPattern =
    wingPatterns.find((p) => p.id === progress.wingPatternId && p.unlocked) || wingPatterns[0];
  wingPatterns.forEach((p) => {
    p.selected = p.id === resolvedPattern.id;
  });

  const activeAura =
    relics.find((r) => r.slot === 'aura' && r.equipped && r.unlocked) || relics[0];
  const activeTalisman =
    relics.find((r) => r.slot === 'talisman' && r.equipped && r.unlocked) || null;
  const activeCrest =
    relics.find((r) => r.slot === 'crest' && r.equipped && r.unlocked) || null;
  const flapInfo = getPhoenixFlapSpeed({ level, difficulty: 'kolay' });

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
    featherPalettes,
    wingPatterns,
    activeAura,
    activeTalisman,
    activeCrest,
    activeFeatherPalette: resolvedPalette,
    activeWingPattern: resolvedPattern,
    flapDurationSeconds: flapInfo.durationSeconds,
    flapLabel: flapInfo.tempoLabel
  };
}

export function updatePhoenixCustomization(
  updates: {
    featherPaletteId?: string;
    wingPatternId?: PhoenixWingPattern['id'];
  },
  userProfile: UserProfile | null | undefined
): { ok: boolean; reason?: string; nextProgress: LocalPhoenixProgress } {
  const current = loadPhoenixProgress();
  const computed = getPhoenixState(userProfile, current);

  let nextPaletteId = current.featherPaletteId;
  let nextPatternId = current.wingPatternId;

  if (updates.featherPaletteId !== undefined) {
    const target = computed.featherPalettes.find((p) => p.id === updates.featherPaletteId);
    if (!target) {
      return { ok: false, reason: 'Palet bulunamadı', nextProgress: current };
    }
    if (!target.unlocked) {
      return { ok: false, reason: target.unlockHint, nextProgress: current };
    }
    nextPaletteId = target.id;
  }

  if (updates.wingPatternId !== undefined) {
    const target = computed.wingPatterns.find((p) => p.id === updates.wingPatternId);
    if (!target) {
      return { ok: false, reason: 'Desen bulunamadı', nextProgress: current };
    }
    if (!target.unlocked) {
      return { ok: false, reason: target.unlockHint, nextProgress: current };
    }
    nextPatternId = target.id;
  }

  const nextProgress = savePhoenixProgress({
    ...current,
    featherPaletteId: nextPaletteId,
    wingPatternId: nextPatternId
  });
  return { ok: true, nextProgress };
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

  const autoPalette = PHOENIX_FEATHER_PALETTES.find((p) =>
    p.requiredRelicIds?.includes(target.id)
  );
  const autoPattern = PHOENIX_WING_PATTERNS.find((p) =>
    p.requiredRelicIds?.includes(target.id)
  );

  const nextProgress = savePhoenixProgress({
    ...current,
    sparks: current.sparks - target.unlockCostSparks,
    unlockedIds: Array.from(new Set([...current.unlockedIds, target.id])),
    itemRanks: { ...current.itemRanks, [target.id]: 1 },
    equipped: { ...current.equipped, [target.slot]: target.id },
    featherPaletteId: autoPalette ? autoPalette.id : current.featherPaletteId,
    wingPatternId: autoPattern ? autoPattern.id : current.wingPatternId
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
