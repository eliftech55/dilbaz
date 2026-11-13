import { normalizeSingleWord, splitWords, wordSimilarity } from './turkishNorm';
import { Tekerleme, PlayerScore } from '../types/game';

export interface LiveWordStatus {
  word: string;
  status: 'correct' | 'imperfect' | 'missed' | 'current' | 'pending';
  recognizedAs?: string;
}

export interface EvaluationResult {
  accuracy: number;
  speedScore: number;
  totalScore: number;
  wpm: number;
  durationSeconds: number;
  badge?: string;
  wordBreakdown: {
    word: string;
    status: 'correct' | 'imperfect' | 'missed';
    recognizedAs?: string;
  }[];
}

const CORRECT_THRESHOLD = 0.78;
const IMPERFECT_THRESHOLD = 0.55;

interface AlignmentOutput {
  items: {
    word: string;
    status: 'correct' | 'imperfect' | 'missed' | 'pending';
    recognizedAs?: string;
  }[];
  accuracy: number;
  lastMatchedOrigIdx: number;
  spokenWordCount: number;
}

/**
 * Unified alignment algorithm shared by live display and final evaluation
 * so mobile and desktop browsers yield identical accuracy for the same speech.
 */
function alignWordsCore(originalText: string, spokenTranscript: string): AlignmentOutput {
  const rawTokens = originalText.split(/\s+/).filter(Boolean);
  const pairs = rawTokens
    .map((raw) => ({ raw, norm: normalizeSingleWord(raw) }))
    .filter((p) => p.norm.length > 0);

  const spokenNormWords = splitWords(spokenTranscript);

  if (pairs.length === 0) {
    return { items: [], accuracy: 0, lastMatchedOrigIdx: -1, spokenWordCount: 0 };
  }

  if (spokenNormWords.length === 0) {
    return {
      items: pairs.map((p) => ({ word: p.raw, status: 'pending' as const })),
      accuracy: 0,
      lastMatchedOrigIdx: -1,
      spokenWordCount: 0
    };
  }

  const statuses: AlignmentOutput['items'] = pairs.map((p) => ({
    word: p.raw,
    status: 'pending'
  }));

  let spokenIdx = 0;
  let lastMatchedOrigIdx = -1;
  let matchedPoints = 0;

  for (let i = 0; i < pairs.length; i++) {
    if (spokenIdx >= spokenNormWords.length) break;

    const origWord = pairs[i].norm;
    let bestSim = 0;
    let bestSpokenText = '';
    let nextSpokenPos = spokenIdx;
    let matchedTwoOrigWords = false;

    const searchLimit = Math.min(spokenNormWords.length, spokenIdx + 5);

    for (let s = spokenIdx; s < searchLimit; s++) {
      // 1) Direct 1-to-1 comparison
      const sim1 = wordSimilarity(origWord, spokenNormWords[s]);
      if (sim1 > bestSim) {
        bestSim = sim1;
        bestSpokenText = spokenNormWords[s];
        nextSpokenPos = s + 1;
        matchedTwoOrigWords = false;
      }

      // 2) Two adjacent spoken words merged (e.g. mobile splits "elalem" -> "el alem")
      if (s + 1 < searchLimit) {
        const mergedSpoken = spokenNormWords[s] + spokenNormWords[s + 1];
        const simMerged = wordSimilarity(origWord, mergedSpoken);
        if (simMerged > bestSim + 0.05) {
          bestSim = simMerged;
          bestSpokenText = `${spokenNormWords[s]} ${spokenNormWords[s + 1]}`;
          nextSpokenPos = s + 2;
          matchedTwoOrigWords = false;
        }
      }

      // 3) Two adjacent target words merged in ASR (e.g. "bir berber" -> "birberber")
      if (i + 1 < pairs.length) {
        const mergedOrig = origWord + pairs[i + 1].norm;
        const simDoubleOrig = wordSimilarity(mergedOrig, spokenNormWords[s]);
        if (simDoubleOrig >= CORRECT_THRESHOLD && simDoubleOrig > bestSim) {
          bestSim = simDoubleOrig;
          bestSpokenText = spokenNormWords[s];
          nextSpokenPos = s + 1;
          matchedTwoOrigWords = true;
        }
      }
    }

    if (bestSim >= CORRECT_THRESHOLD) {
      statuses[i] = {
        word: pairs[i].raw,
        status: 'correct',
        recognizedAs: bestSpokenText
      };
      matchedPoints += 1.0;
      lastMatchedOrigIdx = i;

      if (matchedTwoOrigWords && i + 1 < pairs.length) {
        statuses[i + 1] = {
          word: pairs[i + 1].raw,
          status: 'correct',
          recognizedAs: bestSpokenText
        };
        matchedPoints += 1.0;
        lastMatchedOrigIdx = i + 1;
        i += 1;
      }

      spokenIdx = nextSpokenPos;
    } else if (bestSim >= IMPERFECT_THRESHOLD) {
      statuses[i] = {
        word: pairs[i].raw,
        status: 'imperfect',
        recognizedAs: bestSpokenText
      };
      matchedPoints += bestSim;
      lastMatchedOrigIdx = i;
      spokenIdx = nextSpokenPos;
    } else {
      // Do NOT advance spokenIdx aggressively here: check if word i was genuinely skipped
      // (only mark as missed if a later target word clearly matches right at spokenIdx).
      let skippedToLater = false;
      for (let lookOrig = i + 1; lookOrig < Math.min(pairs.length, i + 3); lookOrig++) {
        if (wordSimilarity(pairs[lookOrig].norm, spokenNormWords[spokenIdx]) >= CORRECT_THRESHOLD) {
          skippedToLater = true;
          break;
        }
      }
      if (skippedToLater) {
        statuses[i] = {
          word: pairs[i].raw,
          status: 'missed',
          recognizedAs: spokenNormWords[spokenIdx]
        };
      }
    }
  }

  // Mark any pending words strictly before the last matched word as missed
  for (let i = 0; i < lastMatchedOrigIdx; i++) {
    if (statuses[i].status === 'pending') {
      statuses[i].status = 'missed';
    }
  }

  const accuracy =
    pairs.length > 0
      ? Math.round(Math.min(100, (matchedPoints / pairs.length) * 100))
      : 0;

  return {
    items: statuses,
    accuracy,
    lastMatchedOrigIdx,
    spokenWordCount: spokenNormWords.length
  };
}

/**
 * Aligns spoken transcript against target tongue twister in real-time
 * so words light up green (correct), amber (close), or red (skipped) as you read.
 */
export function alignLiveWords(
  originalText: string,
  spokenTranscript: string
): { words: LiveWordStatus[]; liveAccuracy: number } {
  const { items, accuracy } = alignWordsCore(originalText, spokenTranscript);

  const words: LiveWordStatus[] = items.map((item) => ({ ...item }));
  const nextPendingIdx = words.findIndex((w) => w.status === 'pending');
  if (nextPendingIdx >= 0) {
    words[nextPendingIdx].status = 'current';
  }

  return { words, liveAccuracy: accuracy };
}

export function evaluateSpeech(
  originalTekerleme: Tekerleme,
  spokenTranscript: string,
  durationSeconds: number
): EvaluationResult {
  const { items, accuracy, spokenWordCount } = alignWordsCore(
    originalTekerleme.text,
    spokenTranscript
  );

  const wordBreakdown: {
    word: string;
    status: 'correct' | 'imperfect' | 'missed';
    recognizedAs?: string;
  }[] = items.map((item) => ({
    word: item.word,
    status: item.status === 'pending' ? 'missed' : item.status,
    ...(item.recognizedAs ? { recognizedAs: item.recognizedAs } : {})
  }));

  // Words per minute (WPM)
  const safeDuration = Math.max(0.8, durationSeconds);
  const wordCount = spokenWordCount > 0 ? spokenWordCount : items.length;
  const wpm = Math.round((wordCount / safeDuration) * 60);

  // Speed Score (0 - 100) based on benchmark comparison
  const benchmark = originalTekerleme.benchmarkSeconds;
  let speedScore = 50;
  if (safeDuration <= benchmark * 0.75) {
    speedScore = 100;
  } else if (safeDuration <= benchmark) {
    speedScore = Math.round(85 + (15 * (benchmark - safeDuration)) / (benchmark * 0.25));
  } else if (safeDuration <= benchmark * 1.5) {
    speedScore = Math.round(60 + (25 * (benchmark * 1.5 - safeDuration)) / (benchmark * 0.5));
  } else if (safeDuration <= benchmark * 2.5) {
    speedScore = Math.round(30 + (30 * (benchmark * 2.5 - safeDuration)) / benchmark);
  } else {
    speedScore = Math.max(10, Math.round(30 - (safeDuration - benchmark * 2.5) * 5));
  }

  // Penalty if accuracy is very low so rushing/skipping words doesn't inflate speed
  if (accuracy < 30) {
    speedScore = Math.round(speedScore * 0.3);
  } else if (accuracy < 55) {
    speedScore = Math.round(speedScore * 0.7);
  }

  // Bonus points
  let bonus = 0;
  let badge: string | undefined = undefined;

  if (accuracy >= 95 && speedScore >= 85) {
    bonus = 250;
    badge = '👑 Efsane Dilbaz';
  } else if (accuracy >= 95) {
    bonus = 150;
    badge = '💎 Kusursuz Telaffuz';
  } else if (speedScore >= 90 && accuracy >= 75) {
    bonus = 120;
    badge = '⚡ Rüzgar Çeneli';
  } else if (accuracy >= 80) {
    bonus = 60;
    badge = '🎯 Diksiyon Ustası';
  }

  const totalScore = Math.round(accuracy * 10 + speedScore * 5 + bonus);

  return {
    accuracy,
    speedScore,
    totalScore,
    wpm,
    durationSeconds: Number(safeDuration.toFixed(1)),
    badge,
    wordBreakdown
  };
}

/**
 * Generate simulated peer scores for a competitive room feel
 */
export function generateBotScore(
  originalTekerleme: Tekerleme,
  botName: string,
  avatar: string,
  botSkill: 'pro' | 'mid' | 'novice' = 'mid'
): PlayerScore {
  const benchmark = originalTekerleme.benchmarkSeconds;
  let baseDuration = benchmark;
  let baseAccuracy = 80;

  if (botSkill === 'pro') {
    baseDuration = benchmark * (0.8 + Math.random() * 0.25);
    baseAccuracy = 88 + Math.floor(Math.random() * 12);
  } else if (botSkill === 'mid') {
    baseDuration = benchmark * (0.95 + Math.random() * 0.4);
    baseAccuracy = 72 + Math.floor(Math.random() * 20);
  } else {
    baseDuration = benchmark * (1.2 + Math.random() * 0.6);
    baseAccuracy = 55 + Math.floor(Math.random() * 25);
  }

  const safeDuration = Number(baseDuration.toFixed(1));
  const wordCount = originalTekerleme.text.split(' ').length;
  const wpm = Math.round((wordCount / safeDuration) * 60);

  const speedScore = Math.max(
    30,
    Math.min(100, Math.round(100 - (safeDuration - benchmark * 0.7) * 12))
  );
  let bonus = 0;
  let badge: string | undefined;

  if (baseAccuracy >= 95 && speedScore >= 85) {
    bonus = 250;
    badge = '👑 Efsane Dilbaz';
  } else if (baseAccuracy >= 90) {
    bonus = 150;
    badge = '💎 Kusursuz Telaffuz';
  } else if (speedScore >= 85) {
    bonus = 100;
    badge = '⚡ Rüzgar Çeneli';
  }

  const totalScore = Math.round(baseAccuracy * 10 + speedScore * 5 + bonus);

  return {
    playerId: `bot-${botName.toLowerCase().replace(/\s+/g, '-')}`,
    playerName: botName,
    avatar,
    isHost: false,
    isCurrentUser: false,
    accuracy: baseAccuracy,
    durationSeconds: safeDuration,
    wpm,
    speedScore,
    totalScore,
    badge
  };
}
