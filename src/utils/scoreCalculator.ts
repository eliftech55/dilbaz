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

const CORRECT_THRESHOLD = 0.76;
const IMPERFECT_THRESHOLD = 0.54;

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
 * Unified optimal monotonic DP alignment algorithm shared by live display and final evaluation.
 * Handles 1-to-1, 1-to-2, 1-to-3 (mobile split words), and 2-to-1 (merged words) without lookahead jumping/shifting.
 */
function alignWordsCore(originalText: string, spokenTranscript: string): AlignmentOutput {
  const rawTokens = originalText.split(/\s+/).filter(Boolean);
  const pairs = rawTokens
    .map((raw) => ({ raw, norm: normalizeSingleWord(raw) }))
    .filter((p) => p.norm.length > 0);

  const spokenNormWords = splitWords(spokenTranscript);
  const M = pairs.length;
  const N = spokenNormWords.length;

  if (M === 0) {
    return { items: [], accuracy: 0, lastMatchedOrigIdx: -1, spokenWordCount: 0 };
  }

  if (N === 0) {
    return {
      items: pairs.map((p) => ({ word: p.raw, status: 'pending' as const })),
      accuracy: 0,
      lastMatchedOrigIdx: -1,
      spokenWordCount: 0
    };
  }

  type OpType = 'none' | 'match11' | 'match12' | 'match13' | 'match21' | 'skipOrig' | 'skipSpoken';
  const NEG_INF = -1e9;
  const dp: number[][] = Array.from({ length: M + 1 }, () => Array(N + 1).fill(NEG_INF));
  const op: OpType[][] = Array.from({ length: M + 1 }, () => Array<OpType>(N + 1).fill('none'));
  const simStore: number[][] = Array.from({ length: M + 1 }, () => Array(N + 1).fill(0));

  const SKIP_ORIG_PENALTY = -0.45;
  const SKIP_SPOKEN_PENALTY = -0.09;

  dp[0][0] = 0;
  for (let i = 1; i <= M; i++) {
    dp[i][0] = dp[i - 1][0] + SKIP_ORIG_PENALTY;
    op[i][0] = 'skipOrig';
  }
  for (let s = 1; s <= N; s++) {
    dp[0][s] = dp[0][s - 1] + SKIP_SPOKEN_PENALTY;
    op[0][s] = 'skipSpoken';
  }

  for (let i = 1; i <= M; i++) {
    const origWord = pairs[i - 1].norm;
    for (let s = 1; s <= N; s++) {
      // Skip target word T[i-1]
      let bestScore = dp[i - 1][s] + SKIP_ORIG_PENALTY;
      let bestOp: OpType = 'skipOrig';
      let bestSim = 0;

      // Skip extra/noise spoken word S[s-1]
      const skipSpokenScore = dp[i][s - 1] + SKIP_SPOKEN_PENALTY;
      if (skipSpokenScore > bestScore) {
        bestScore = skipSpokenScore;
        bestOp = 'skipSpoken';
        bestSim = 0;
      }

      // 1-to-1 match: T[i-1] <-> S[s-1]
      const sim11 = wordSimilarity(origWord, spokenNormWords[s - 1]);
      if (sim11 >= IMPERFECT_THRESHOLD) {
        const reward11 = sim11 >= CORRECT_THRESHOLD ? 1.2 + sim11 : 0.45 + sim11;
        const candScore = dp[i - 1][s - 1] + reward11;
        if (candScore > bestScore) {
          bestScore = candScore;
          bestOp = 'match11';
          bestSim = sim11;
        }
      }

      // 1-to-2 match: T[i-1] <-> S[s-2] + S[s-1] (mobile splits compound words)
      if (s >= 2) {
        const mergedSpoken = spokenNormWords[s - 2] + spokenNormWords[s - 1];
        const sim12 = wordSimilarity(origWord, mergedSpoken);
        const singleBest = Math.max(
          wordSimilarity(origWord, spokenNormWords[s - 2]),
          sim11
        );
        if (sim12 >= IMPERFECT_THRESHOLD && sim12 > singleBest + 0.05) {
          const reward12 = sim12 >= CORRECT_THRESHOLD ? 1.2 + sim12 : 0.45 + sim12;
          const candScore = dp[i - 1][s - 2] + reward12;
          if (candScore > bestScore) {
            bestScore = candScore;
            bestOp = 'match12';
            bestSim = sim12;
          }
        }
      }

      // 1-to-3 match: T[i-1] <-> S[s-3] + S[s-2] + S[s-1] (mobile splits long agglutinative Turkish words)
      if (s >= 3) {
        const merged3 =
          spokenNormWords[s - 3] + spokenNormWords[s - 2] + spokenNormWords[s - 1];
        const sim13 = wordSimilarity(origWord, merged3);
        const subBest = Math.max(
          wordSimilarity(origWord, spokenNormWords[s - 3]),
          wordSimilarity(origWord, spokenNormWords[s - 2]),
          sim11
        );
        if (sim13 >= CORRECT_THRESHOLD && sim13 > subBest + 0.1) {
          const candScore = dp[i - 1][s - 3] + 1.25 + sim13;
          if (candScore > bestScore) {
            bestScore = candScore;
            bestOp = 'match13';
            bestSim = sim13;
          }
        }
      }

      // 2-to-1 match: T[i-2] + T[i-1] <-> S[s-1] (ASR merges two adjacent target words)
      if (i >= 2) {
        const mergedOrig = pairs[i - 2].norm + origWord;
        const sim21 = wordSimilarity(mergedOrig, spokenNormWords[s - 1]);
        if (sim21 >= CORRECT_THRESHOLD) {
          const reward21 = 2.3 + sim21;
          const candScore = dp[i - 2][s - 1] + reward21;
          if (candScore > bestScore) {
            bestScore = candScore;
            bestOp = 'match21';
            bestSim = sim21;
          }
        }
      }

      dp[i][s] = bestScore;
      op[i][s] = bestOp;
      simStore[i][s] = bestSim;
    }
  }

  // Semi-global right end: consume all spoken words N, choose target prefix bestI (0..M) maximizing score
  let bestI = 0;
  let bestFinalScore = dp[0][N];
  for (let i = 1; i <= M; i++) {
    if (dp[i][N] > bestFinalScore) {
      bestFinalScore = dp[i][N];
      bestI = i;
    }
  }

  const statuses: AlignmentOutput['items'] = pairs.map((p) => ({
    word: p.raw,
    status: 'pending'
  }));

  let curI = bestI;
  let curS = N;
  let lastMatchedOrigIdx = -1;
  let matchedPoints = 0;

  while (curI > 0 || curS > 0) {
    const action = op[curI][curS];
    const sim = simStore[curI][curS];

    if (action === 'match11') {
      const idx = curI - 1;
      const isCorrect = sim >= CORRECT_THRESHOLD;
      statuses[idx] = {
        word: pairs[idx].raw,
        status: isCorrect ? 'correct' : 'imperfect',
        recognizedAs: spokenNormWords[curS - 1]
      };
      matchedPoints += isCorrect ? 1.0 : sim;
      if (idx > lastMatchedOrigIdx) lastMatchedOrigIdx = idx;
      curI -= 1;
      curS -= 1;
    } else if (action === 'match12') {
      const idx = curI - 1;
      const isCorrect = sim >= CORRECT_THRESHOLD;
      statuses[idx] = {
        word: pairs[idx].raw,
        status: isCorrect ? 'correct' : 'imperfect',
        recognizedAs: `${spokenNormWords[curS - 2]} ${spokenNormWords[curS - 1]}`
      };
      matchedPoints += isCorrect ? 1.0 : sim;
      if (idx > lastMatchedOrigIdx) lastMatchedOrigIdx = idx;
      curI -= 1;
      curS -= 2;
    } else if (action === 'match13') {
      const idx = curI - 1;
      const isCorrect = sim >= CORRECT_THRESHOLD;
      statuses[idx] = {
        word: pairs[idx].raw,
        status: isCorrect ? 'correct' : 'imperfect',
        recognizedAs: `${spokenNormWords[curS - 3]} ${spokenNormWords[curS - 2]} ${spokenNormWords[curS - 1]}`
      };
      matchedPoints += isCorrect ? 1.0 : sim;
      if (idx > lastMatchedOrigIdx) lastMatchedOrigIdx = idx;
      curI -= 1;
      curS -= 3;
    } else if (action === 'match21') {
      const idx1 = curI - 2;
      const idx2 = curI - 1;
      const spokenText = spokenNormWords[curS - 1];
      statuses[idx1] = {
        word: pairs[idx1].raw,
        status: 'correct',
        recognizedAs: spokenText
      };
      statuses[idx2] = {
        word: pairs[idx2].raw,
        status: 'correct',
        recognizedAs: spokenText
      };
      matchedPoints += 2.0;
      if (idx2 > lastMatchedOrigIdx) lastMatchedOrigIdx = idx2;
      curI -= 2;
      curS -= 1;
    } else if (action === 'skipOrig') {
      curI -= 1;
    } else if (action === 'skipSpoken') {
      curS -= 1;
    } else {
      break;
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
