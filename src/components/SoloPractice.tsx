import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Difficulty, PracticeAttempt, Tekerleme } from '../types/game';
import { INITIAL_TEKERLEMELER } from '../data/tekerlemeler';
import { SpeechEngine } from '../utils/speechEngine';
import { evaluateSpeech, alignLiveWords, EvaluationResult } from '../utils/scoreCalculator';
import { AudioVisualizer } from './AudioVisualizer';
import { WordComparison } from './WordComparison';
import { MascotDialogue } from './DilbazMascot';
import { triggerCelebration } from './FxCanvas';
import { playTone, playComboWordTone } from '../utils/soundEffects';
import { recordPracticeOrRoundReward } from '../utils/phoenixProgression';
import {
  clearPracticeHistory,
  deletePracticeAttempt,
  loadLocalPracticeHistory,
  mergePracticeHistories,
  recordPracticeAttempt,
  saveLocalPracticeHistory,
  subscribeToPracticeHistory
} from '../firebase/practiceFirestore';
import { PracticeProgressPanel } from './PracticeProgressPanel';
import { Mic, Volume2, Shuffle, Sparkles, Radio, Timer, RotateCcw } from 'lucide-react';

interface SoloPracticeProps {
  tekerlemeler: Tekerleme[];
  initialTekerlemeId?: string;
  phoenixLevel?: number;
  authUid?: string | null;
  onDifficultyChange?: (difficulty: Difficulty) => void;
  onPhoenixProgressUpdated?: () => void;
}

const DIFFICULTY_OPTIONS: Array<{
  id: Difficulty;
  label: string;
  activeClass: string;
}> = [
  {
    id: 'kolay',
    label: 'Kolay',
    activeClass: 'bg-[#06D6A0] text-[#0d1629] border-[#06D6A0] shadow-sm'
  },
  {
    id: 'orta',
    label: 'Orta',
    activeClass: 'bg-[#3A86FF] text-white border-[#3A86FF] shadow-sm'
  },
  {
    id: 'zor',
    label: 'Zor',
    activeClass: 'bg-[#FFBE0B] text-[#0d1629] border-[#FFBE0B] shadow-sm'
  },
  {
    id: 'efsane',
    label: 'Efsane',
    activeClass: 'bg-[#FF006E] text-white border-[#FF006E] shadow-sm'
  }
];

function pickRandomFromPool(pool: Tekerleme[], excludeId?: string): Tekerleme | null {
  if (pool.length === 0) return null;
  const candidates =
    pool.length > 1 && excludeId ? pool.filter((t) => t.id !== excludeId) : pool;
  const targetPool = candidates.length > 0 ? candidates : pool;
  const idx = Math.floor(Math.random() * targetPool.length);
  return targetPool[idx] || pool[0];
}

export const SoloPractice: React.FC<SoloPracticeProps> = ({
  tekerlemeler,
  initialTekerlemeId,
  phoenixLevel,
  authUid,
  onDifficultyChange,
  onPhoenixProgressUpdated
}) => {
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>(() => {
    if (initialTekerlemeId) {
      const match = tekerlemeler.find((t) => t.id === initialTekerlemeId);
      if (match) return match.difficulty;
    }
    return 'kolay';
  });

  const [selectedTekerleme, setSelectedTekerleme] = useState<Tekerleme>(() => {
    if (initialTekerlemeId) {
      const match = tekerlemeler.find((t) => t.id === initialTekerlemeId);
      if (match) return match;
    }
    const easyPool = tekerlemeler.filter((t) => t.difficulty === 'kolay');
    return (
      pickRandomFromPool(easyPool) ||
      pickRandomFromPool(tekerlemeler) ||
      INITIAL_TEKERLEMELER[0]
    );
  });

  const [isListening, setIsListening] = useState(false);
  const [spokenTranscript, setSpokenTranscript] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [practiceReward, setPracticeReward] = useState<{
    xpEarned: number;
    sparksEarned: number;
  } | null>(null);
  const [previousComparison, setPreviousComparison] = useState<{
    accuracyDelta: number;
    wpmDelta: number;
    comparedWithSame: boolean;
  } | null>(null);
  const [elapsed, setElapsed] = useState<number>(0);
  const [autoStopStatus, setAutoStopStatus] = useState<string | null>(null);

  const [practiceHistory, setPracticeHistory] = useState<PracticeAttempt[]>(() =>
    loadLocalPracticeHistory(authUid)
  );

  const stageTopRef = useRef<HTMLDivElement | null>(null);
  const speechEngineRef = useRef<SpeechEngine | null>(null);
  const timerRef = useRef<any>(null);
  const startTimeRef = useRef<number>(0);
  const speechStartedAtRef = useRef<number>(0);
  const lastSpeechActivityAtRef = useRef<number>(0);
  const hasStoppedRef = useRef<boolean>(false);
  const transcriptRef = useRef<string>('');
  const prevCorrectCountRef = useRef<number>(0);
  const streakPlayedRef = useRef<boolean>(false);
  const historyRef = useRef<PracticeAttempt[]>(practiceHistory);
  historyRef.current = practiceHistory;

  const filteredPool = useMemo(() => {
    const byDiff = tekerlemeler.filter((t) => t.difficulty === selectedDifficulty);
    return byDiff.length > 0 ? byDiff : tekerlemeler;
  }, [tekerlemeler, selectedDifficulty]);

  const difficultyCounts = useMemo(() => {
    const counts: Record<Difficulty, number> = {
      kolay: 0,
      orta: 0,
      zor: 0,
      efsane: 0
    };
    for (const item of tekerlemeler) {
      counts[item.difficulty] = (counts[item.difficulty] || 0) + 1;
    }
    return counts;
  }, [tekerlemeler]);

  const maxReadingSeconds = Math.max(
    15,
    Math.ceil(selectedTekerleme.benchmarkSeconds * 2.5)
  );

  useEffect(() => {
    onDifficultyChange?.(selectedTekerleme.difficulty);
  }, [selectedTekerleme.difficulty, onDifficultyChange]);

  // Load local + Firestore practice history for current user scope
  useEffect(() => {
    const localInitial = loadLocalPracticeHistory(authUid);
    setPracticeHistory(localInitial);

    if (!authUid) return;

    const unsubscribe = subscribeToPracticeHistory(authUid, (remoteAttempts) => {
      const merged = mergePracticeHistories(remoteAttempts, loadLocalPracticeHistory(authUid));
      saveLocalPracticeHistory(merged, authUid);
      setPracticeHistory(merged);
    });

    return () => {
      unsubscribe();
    };
  }, [authUid]);

  useEffect(() => {
    if (initialTekerlemeId) {
      const found = tekerlemeler.find((t) => t.id === initialTekerlemeId);
      if (found) {
        setSelectedDifficulty(found.difficulty);
        setSelectedTekerleme(found);
        setEvaluation(null);
        setPracticeReward(null);
        setPreviousComparison(null);
        setAutoStopStatus(null);
        transcriptRef.current = '';
        setSpokenTranscript('');
      }
    }
  }, [initialTekerlemeId, tekerlemeler]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (speechEngineRef.current) speechEngineRef.current.stop();
    };
  }, []);

  const resetActiveAttemptState = () => {
    hasStoppedRef.current = true;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (isListening && speechEngineRef.current) {
      speechEngineRef.current.stop();
    }
    setIsListening(false);
    setEvaluation(null);
    setPracticeReward(null);
    setPreviousComparison(null);
    setAutoStopStatus(null);
    setMicError(null);
    transcriptRef.current = '';
    setSpokenTranscript('');
    setElapsed(0);
  };

  const handleSelectDifficulty = (difficulty: Difficulty) => {
    playTone('tap');
    resetActiveAttemptState();
    setSelectedDifficulty(difficulty);
    const pool = tekerlemeler.filter((t) => t.difficulty === difficulty);
    const picked = pickRandomFromPool(pool.length > 0 ? pool : tekerlemeler, selectedTekerleme.id);
    if (picked) {
      setSelectedTekerleme(picked);
    }
  };

  const handlePickRandom = () => {
    playTone('hint');
    resetActiveAttemptState();
    const picked = pickRandomFromPool(filteredPool, selectedTekerleme.id);
    if (picked) {
      setSelectedTekerleme(picked);
    }
  };

  const handleReplayFromHistory = (tekerlemeId: string, difficulty: Difficulty) => {
    resetActiveAttemptState();
    const exactMatch = tekerlemeler.find((t) => t.id === tekerlemeId);
    if (exactMatch) {
      setSelectedDifficulty(exactMatch.difficulty);
      setSelectedTekerleme(exactMatch);
    } else {
      setSelectedDifficulty(difficulty);
      const fallbackPool = tekerlemeler.filter((t) => t.difficulty === difficulty);
      const picked = pickRandomFromPool(fallbackPool.length > 0 ? fallbackPool : tekerlemeler);
      if (picked) setSelectedTekerleme(picked);
    }
    stageTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleStartPractice = async () => {
    playTone('round_start');
    setEvaluation(null);
    setPracticeReward(null);
    setPreviousComparison(null);
    setAutoStopStatus(null);
    transcriptRef.current = '';
    setSpokenTranscript('');
    setMicError(null);
    prevCorrectCountRef.current = 0;
    streakPlayedRef.current = false;
    hasStoppedRef.current = false;
    speechStartedAtRef.current = 0;
    lastSpeechActivityAtRef.current = 0;

    const start = Date.now();
    startTimeRef.current = start;
    setElapsed(0);

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      const nextElapsed = (Date.now() - start) / 1000;
      setElapsed(nextElapsed);
      if (nextElapsed >= maxReadingSeconds && !hasStoppedRef.current) {
        setAutoStopStatus('Okuma süresi dolduğu için otomatik tamamlandı.');
        handleStopPractice();
      }
    }, 100);

    if (!speechEngineRef.current) {
      speechEngineRef.current = new SpeechEngine();
    }

    const ok = await speechEngineRef.current.start({
      targetText: selectedTekerleme.text,
      onTranscriptChange: (text) => {
        if (text.trim()) {
          const now = Date.now();
          if (!speechStartedAtRef.current) {
            speechStartedAtRef.current = now;
          }
          if (text !== transcriptRef.current) {
            lastSpeechActivityAtRef.current = now;
          }
        }
        transcriptRef.current = text;
        setSpokenTranscript(text);
      },
      onAudioLevelChange: (level) => {
        setAudioLevel(level);
      },
      onError: (err) => {
        setMicError(err);
      }
    });

    if (ok) {
      setIsListening(true);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleStopPractice = async () => {
    if (hasStoppedRef.current) return;
    hasStoppedRef.current = true;

    const nowMs = Date.now();
    const rawStartMs = startTimeRef.current || nowMs - 2000;
    let duration = Math.max(0.8, (nowMs - rawStartMs) / 1000);
    if (speechEngineRef.current) {
      const bounds = speechEngineRef.current.getSpeakingBounds(rawStartMs, nowMs);
      duration = Math.max(0.8, (bounds.endMs - bounds.startMs) / 1000);
    }

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    setIsListening(false);

    let finalRecorded = '';
    if (speechEngineRef.current) {
      finalRecorded = await speechEngineRef.current.stopAsync();
    }

    const textToEvaluate =
      finalRecorded.length >= transcriptRef.current.length
        ? finalRecorded
        : transcriptRef.current;

    if (textToEvaluate) {
      transcriptRef.current = textToEvaluate;
      setSpokenTranscript(textToEvaluate);
    }

    const result = evaluateSpeech(selectedTekerleme, textToEvaluate, duration);
    setEvaluation(result);

    // Compare against prior attempt (prefer same tekerleme, else latest attempt overall)
    const priorHistory = historyRef.current;
    const samePrevious = priorHistory.find((a) => a.tekerlemeId === selectedTekerleme.id);
    const baseline = samePrevious || priorHistory[0] || null;
    if (baseline) {
      setPreviousComparison({
        accuracyDelta: result.accuracy - baseline.accuracy,
        wpmDelta: result.wpm - baseline.wpm,
        comparedWithSame: Boolean(samePrevious)
      });
    } else {
      setPreviousComparison(null);
    }

    const reward = recordPracticeOrRoundReward({
      source: 'solo',
      accuracy: result.accuracy,
      wpm: result.wpm,
      score: result.totalScore
    });
    setPracticeReward({ xpEarned: reward.xpEarned, sparksEarned: reward.sparksEarned });
    onPhoenixProgressUpdated?.();

    // Persist attempt to local + Firestore history
    try {
      const savedAttempt = await recordPracticeAttempt({
        uid: authUid,
        tekerlemeId: selectedTekerleme.id,
        tekerlemeTitle: selectedTekerleme.title,
        difficulty: selectedTekerleme.difficulty,
        accuracy: result.accuracy,
        wpm: result.wpm,
        durationSeconds: result.durationSeconds,
        speedScore: result.speedScore,
        totalScore: result.totalScore,
        xpEarned: reward.xpEarned,
        sparksEarned: reward.sparksEarned
      });
      setPracticeHistory((prev) => mergePracticeHistories([savedAttempt], prev));
    } catch (err) {
      console.error('Prova geçmişi kaydedilemedi:', err);
    }

    if (result.accuracy >= 75) {
      playTone('victory');
      triggerCelebration({ xRatio: 0.5, yRatio: 0.35, count: 36 });
    } else if (result.accuracy >= 45) {
      playTone('correct');
    } else {
      playTone('wrong');
    }
  };

  const handlePlayAudioHint = () => {
    playTone('tap');
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(selectedTekerleme.text);
      utterance.lang = 'tr-TR';
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleDeleteAttempt = async (attemptId: string) => {
    setPracticeHistory((prev) => prev.filter((item) => item.id !== attemptId));
    try {
      await deletePracticeAttempt({ attemptId, uid: authUid });
    } catch (err) {
      console.error('Prova silinemedi:', err);
    }
  };

  const handleClearHistory = async () => {
    const currentList = [...practiceHistory];
    setPracticeHistory([]);
    try {
      await clearPracticeHistory({ attempts: currentList, uid: authUid });
    } catch (err) {
      console.error('Prova geçmişi temizlenemedi:', err);
    }
  };

  const { words: wordsForDisplay, liveAccuracy } = alignLiveWords(
    selectedTekerleme.text,
    spokenTranscript
  );

  // Interactive rising word-match chimes during live practice
  useEffect(() => {
    if (!isListening) return;
    const correctCount = wordsForDisplay.filter((w) => w.status === 'correct').length;
    if (correctCount > prevCorrectCountRef.current) {
      playComboWordTone(correctCount);
      prevCorrectCountRef.current = correctCount;
    }
    if (liveAccuracy >= 80 && !streakPlayedRef.current) {
      streakPlayedRef.current = true;
      setTimeout(() => playTone('combo_streak'), 110);
    }
  }, [wordsForDisplay, liveAccuracy, isListening]);

  // Automatic completion when all words are read, speaker pauses too long, or initial silence lasts 8s
  const soloWordsRef = useRef(wordsForDisplay);
  soloWordsRef.current = wordsForDisplay;
  const stopPracticeRef = useRef(handleStopPractice);
  stopPracticeRef.current = handleStopPractice;

  useEffect(() => {
    if (!isListening) return;

    const checker = setInterval(() => {
      if (hasStoppedRef.current) return;
      const now = Date.now();
      const startedAt = startTimeRef.current;
      if (!startedAt) return;

      const words = soloWordsRef.current;
      const matchedCount = words.filter(
        (w) => w.status === 'correct' || w.status === 'imperfect'
      ).length;
      const lastWordMatched =
        words.length > 0 &&
        (words[words.length - 1].status === 'correct' ||
          words[words.length - 1].status === 'imperfect');
      const allOrFinalReached =
        words.length > 0 &&
        (matchedCount === words.length ||
          (lastWordMatched && matchedCount / words.length >= 0.8));

      const speechStartedAt = speechStartedAtRef.current;
      const lastActivityAt = lastSpeechActivityAtRef.current;

      if (allOrFinalReached && lastActivityAt > 0 && now - lastActivityAt >= 750) {
        setAutoStopStatus('Metin tamamlandı! Pratik karnesi hazırlanıyor...');
        stopPracticeRef.current();
        return;
      }

      if (
        speechStartedAt > 0 &&
        lastActivityAt > 0 &&
        now - speechStartedAt >= 1200 &&
        now - lastActivityAt >= 2800
      ) {
        setAutoStopStatus('Sessizlik algılandı, okuma otomatik sonlandırıldı.');
        stopPracticeRef.current();
        return;
      }

      if (speechStartedAt === 0 && now - startedAt >= 8000) {
        setAutoStopStatus('Uzun süre ses algılanmadığı için pratik otomatik sonlandırıldı.');
        stopPracticeRef.current();
      }
    }, 250);

    return () => clearInterval(checker);
  }, [isListening]);

  return (
    <div ref={stageTopRef} className="max-w-3xl mx-auto space-y-5 animate-screen-in">
      {/* Compact Visual Header */}
      <div className="flex items-center justify-between gap-3 px-1">
        <div>
          <div className="text-[11px] font-display font-bold uppercase tracking-wider text-[#00F5D4]">
            Zümrüdüanka Antrenmanı
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white font-display">
            Bireysel Pratik
          </h1>
        </div>
        <div className="text-right text-[11px] text-[#FFBE0B] font-semibold">
          Her pratikte +XP & Kıvılcım
        </div>
      </div>

      {/* Difficulty Picker + Random Tekerleme Pool */}
      <div className="p-4 sm:p-5 ebru-glass-card rounded-[24px] space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div>
            <div className="text-xs font-semibold text-white">
              Zorluk Seviyesi Seçin
            </div>
            <div className="text-[11px] text-[#94A3B8]">
              Seçtiğiniz seviyeden rastgele tekerleme gelir · {filteredPool.length} tekerleme hazır
            </div>
          </div>

          <div
            role="group"
            aria-label="Tekerleme zorluk seviyesi"
            className="grid grid-cols-4 gap-1.5 p-1 rounded-2xl bg-[#0d1629]/90 border border-white/10"
          >
            {DIFFICULTY_OPTIONS.map((opt) => {
              const active = selectedDifficulty === opt.id;
              const count = difficultyCounts[opt.id] || 0;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleSelectDifficulty(opt.id)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer border flex items-center justify-center gap-1 ${
                    active
                      ? opt.activeClass
                      : 'border-transparent text-[#CBD5E1] hover:text-white hover:bg-white/5'
                  }`}
                >
                  <span>{opt.label}</span>
                  <span className={`text-[10px] font-mono tabular-nums ${active ? 'opacity-80' : 'text-[#64748B]'}`}>
                    ({count})
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/10">
          <div className="flex-1 min-w-[200px]">
            <label
              htmlFor="solo-tekerleme-select"
              className="text-[11px] font-semibold text-[#93C5FD] block mb-1"
            >
              Aktif Tekerleme ({DIFFICULTY_OPTIONS.find((d) => d.id === selectedDifficulty)?.label} Havuzu)
            </label>
            <select
              id="solo-tekerleme-select"
              value={selectedTekerleme.id}
              onChange={(e) => {
                const found = filteredPool.find((t) => t.id === e.target.value);
                if (found) {
                  playTone('tap');
                  resetActiveAttemptState();
                  setSelectedTekerleme(found);
                }
              }}
              className="w-full px-3 py-2.5 bg-[#0d1629]/90 border border-white/15 rounded-xl text-white text-xs sm:text-sm focus:border-[#FFBE0B] focus:outline-none"
            >
              {filteredPool.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={handlePickRandom}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-[#3A86FF]/25 text-xs font-semibold text-white border border-white/15 transition-colors cursor-pointer self-end whitespace-nowrap"
          >
            <Shuffle className="w-3.5 h-3.5 text-[#FFBE0B]" />
            <span>Yeni Rastgele Tekerleme</span>
          </button>
        </div>
      </div>

      {/* Mascot Dialogue Tip + Listen Button */}
      <div className="flex items-center gap-2.5">
        <div className="flex-1">
          <MascotDialogue
            mood={evaluation ? (evaluation.accuracy >= 65 ? 'excited' : 'sad') : 'happy'}
            level={phoenixLevel}
            difficulty={selectedTekerleme.difficulty}
            message={`Hedef Sesler (${selectedTekerleme.targetSounds.join(', ')}): ${selectedTekerleme.tip}`}
          />
        </div>
        <button
          type="button"
          onClick={handlePlayAudioHint}
          className="p-3 rounded-2xl bg-[#14213D]/90 hover:bg-[#3A86FF]/25 border border-[#3A86FF]/40 text-[#FFBE0B] shrink-0 transition-colors cursor-pointer"
          title="Sesli Dinle"
        >
          <Volume2 className="w-5 h-5" />
        </button>
      </div>

      {/* Cloud Light Tekerleme Card */}
      <WordComparison
        originalWords={wordsForDisplay}
        spokenTranscript={spokenTranscript}
        isListening={isListening}
        audioLevel={audioLevel}
        liveAccuracy={liveAccuracy}
        categoryLabel={selectedTekerleme.categoryLabel || selectedTekerleme.title}
      />

      {/* Audio Visualizer */}
      <AudioVisualizer isListening={isListening} audioLevel={audioLevel} />

      {/* Mic Alert */}
      {micError && (
        <div className="p-3 bg-[#FF006E]/20 border border-[#FF006E]/50 rounded-2xl text-xs text-rose-200">
          {micError}
        </div>
      )}

      {/* Action Controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        {!isListening ? (
          <button
            type="button"
            onClick={handleStartPractice}
            className="flex-1 min-h-[52px] py-4 rounded-[20px] btn-epic-pomegranate font-bold text-sm sm:text-base flex items-center justify-center gap-2 cursor-pointer"
          >
            <Mic className="w-5 h-5 fill-current" />
            <span>OKUMAYA BAŞLA (MİKROFONU AÇ)</span>
          </button>
        ) : (
          <div className="flex-1 p-4 rounded-[22px] ebru-glass-card border border-[#06D6A0]/45 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <Radio className="w-5 h-5 text-[#06D6A0] animate-pulse shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs sm:text-sm font-bold text-white">
                    Dinleniyor · Otomatik Bitiş Aktif
                  </div>
                  <div className="text-[11px] text-[#93C5FD] truncate">
                    Metin bittiğinde, uzun sessizlikte veya {maxReadingSeconds} sn dolunca otomatik tamamlanır.
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 font-mono text-sm font-bold text-[#FFBE0B] shrink-0 tabular-nums">
                <Timer className="w-4 h-4" />
                <span>{Math.max(0, Math.ceil(maxReadingSeconds - elapsed))}s</span>
              </div>
            </div>
            <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-150"
                style={{
                  width: `${Math.max(5, Math.min(100, ((maxReadingSeconds - elapsed) / maxReadingSeconds) * 100))}%`,
                  background: 'linear-gradient(90deg, #06D6A0 0%, #3A86FF 60%, #FFBE0B 100%)'
                }}
              />
            </div>
          </div>
        )}
      </div>

      {autoStopStatus && !isListening && (
        <div className="px-3.5 py-2 rounded-xl bg-[#3A86FF]/15 border border-[#3A86FF]/35 text-[11px] text-[#93C5FD] text-center">
          {autoStopStatus}
        </div>
      )}

      {/* Practice Results Card */}
      {evaluation && (
        <div className="p-5 sm:p-6 game-card-3d border-[1.5px] border-[#00F5D4]/45 rounded-[28px] space-y-4 animate-screen-in">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div>
              <span className="text-[11px] font-display uppercase tracking-wider text-[#00F5D4]">
                Pratik Karnesi
              </span>
              <h2 className="text-lg font-bold text-white font-display">
                {evaluation.badge || 'Pratik Tamamlandı'}
              </h2>
              {previousComparison && (
                <div className="text-[11px] text-[#CBD5E1] font-mono tabular-nums mt-0.5">
                  {previousComparison.comparedWithSame ? 'Bu tekerlemedeki son denemeye göre: ' : 'Önceki provaya göre: '}
                  <span className={previousComparison.accuracyDelta >= 0 ? 'text-[#06D6A0]' : 'text-[#FF006E]'}>
                    {previousComparison.accuracyDelta >= 0 ? `+${previousComparison.accuracyDelta}` : previousComparison.accuracyDelta}% doğruluk
                  </span>
                  {' · '}
                  <span className={previousComparison.wpmDelta >= 0 ? 'text-[#00F5D4]' : 'text-[#FFBE0B]'}>
                    {previousComparison.wpmDelta >= 0 ? `+${previousComparison.wpmDelta}` : previousComparison.wpmDelta} WPM
                  </span>
                </div>
              )}
            </div>
            <div className="text-right">
              <div className="text-sm font-display font-bold text-[#FFBE0B] tabular-nums">
                {evaluation.totalScore} Puan
              </div>
              {practiceReward && (
                <div className="text-[11px] font-bold text-[#06D6A0] flex items-center justify-end gap-1 tabular-nums">
                  <Sparkles className="w-3 h-3" />
                  <span>+{practiceReward.xpEarned} XP · +{practiceReward.sparksEarned} Kıvılcım</span>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-3 bg-white/5 rounded-2xl border border-white/10">
              <div className="text-xs text-[#94A3B8]">Doğruluk</div>
              <div className="text-xl font-bold text-[#06D6A0] font-display tabular-nums">
                %{evaluation.accuracy}
              </div>
            </div>

            <div className="p-3 bg-white/5 rounded-2xl border border-white/10">
              <div className="text-xs text-[#94A3B8]">Süre</div>
              <div className="text-xl font-bold text-[#FFBE0B] font-display tabular-nums">
                {evaluation.durationSeconds}s
              </div>
              <div className="text-[10px] text-[#94A3B8]">Hedef: {selectedTekerleme.benchmarkSeconds}s</div>
            </div>

            <div className="p-3 bg-white/5 rounded-2xl border border-white/10">
              <div className="text-xs text-[#94A3B8]">Hız (WPM)</div>
              <div className="text-xl font-bold text-[#3A86FF] font-display tabular-nums">
                {evaluation.wpm}
              </div>
              <div className="text-[10px] text-[#94A3B8]">Kelime/Dk</div>
            </div>
          </div>

          {evaluation.wordBreakdown && (
            <div className="space-y-2">
              <span className="text-xs font-semibold text-[#CBD5E1]">Kelime Analizi:</span>
              <div className="flex flex-wrap gap-1.5 text-xs">
                {evaluation.wordBreakdown.map((wb, i) => (
                  <span
                    key={i}
                    className={`px-2.5 py-1 rounded-xl border ${
                      wb.status === 'correct'
                        ? 'bg-[#06D6A0]/20 text-[#6EE7B7] border-[#06D6A0]/40'
                        : wb.status === 'imperfect'
                        ? 'bg-[#FFBE0B]/20 text-[#FDE68A] border-[#FFBE0B]/40'
                        : 'bg-[#FF006E]/20 text-rose-200 line-through border-[#FF006E]/40'
                    }`}
                  >
                    {wb.word}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-white/10">
            <button
              type="button"
              onClick={handleStartPractice}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white border border-white/15 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-[#06D6A0]" />
              <span>Aynı Tekerlemeyi Tekrarla</span>
            </button>
            <button
              type="button"
              onClick={handlePickRandom}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#3A86FF] hover:bg-[#3A86FF]/90 text-xs font-semibold text-white transition-colors cursor-pointer"
            >
              <Shuffle className="w-3.5 h-3.5 text-[#FFBE0B]" />
              <span>Sonraki Rastgele Tekerleme</span>
            </button>
          </div>
        </div>
      )}

      {/* Progress Tracking & Rehearsal History */}
      <PracticeProgressPanel
        attempts={practiceHistory}
        onReplayTekerleme={handleReplayFromHistory}
        onDeleteAttempt={handleDeleteAttempt}
        onClearHistory={handleClearHistory}
      />
    </div>
  );
};
