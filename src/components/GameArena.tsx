import React, { useState, useEffect, useRef } from 'react';
import { Tekerleme, PlayerScore } from '../types/game';
import { SpeechEngine } from '../utils/speechEngine';
import { evaluateSpeech, alignLiveWords, EvaluationResult } from '../utils/scoreCalculator';
import { AudioVisualizer } from './AudioVisualizer';
import { WordComparison } from './WordComparison';
import { MascotDialogue } from './DilbazMascot';
import { playTone, playComboWordTone } from '../utils/soundEffects';
import { recordPracticeOrRoundReward } from '../utils/phoenixProgression';
import { Volume2, Timer, Zap, Mic, LogOut, Radio } from 'lucide-react';

interface WordBurstEffect {
  id: string;
  x: number;
  y: number;
  points: number;
  streak: number;
  delayMs: number;
}

const SPARKLE_PARTICLES = [
  { tx: '-34px', ty: '-26px', rot: '-35deg', color: '#FFBE0B', size: 13 },
  { tx: '34px', ty: '-24px', rot: '35deg', color: '#00F5D4', size: 13 },
  { tx: '-20px', ty: '-40px', rot: '-18deg', color: '#06D6A0', size: 10 },
  { tx: '22px', ty: '-42px', rot: '22deg', color: '#FF006E', size: 10 },
  { tx: '-42px', ty: '4px', rot: '-55deg', color: '#3A86FF', size: 9 },
  { tx: '42px', ty: '2px', rot: '50deg', color: '#FFBE0B', size: 9 }
];

interface GameArenaProps {
  tekerleme: Tekerleme;
  currentRound: number;
  totalRounds: number;
  timeLimitSeconds: number;
  currentUser: { id: string; name: string; avatar: string };
  isHost?: boolean;
  phoenixLevel?: number;
  onFinishRound: (result: PlayerScore) => void;
  onLeaveRoom?: () => void;
  onPhoenixProgressUpdated?: () => void;
}

export const GameArena: React.FC<GameArenaProps> = ({
  tekerleme,
  currentRound,
  totalRounds,
  timeLimitSeconds,
  currentUser,
  isHost = false,
  phoenixLevel,
  onFinishRound,
  onLeaveRoom,
  onPhoenixProgressUpdated
}) => {
  const [phase, setPhase] = useState<'countdown' | 'playing' | 'evaluating'>('countdown');
  const [countdownNum, setCountdownNum] = useState(3);
  const [timeLeft, setTimeLeft] = useState(timeLimitSeconds);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const [isListening, setIsListening] = useState(false);
  const [spokenTranscript, setSpokenTranscript] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);
  const [mascotMessage, setMascotMessage] = useState<string>('');
  const [wordBursts, setWordBursts] = useState<WordBurstEffect[]>([]);
  const [justMatchedIndices, setJustMatchedIndices] = useState<number[]>([]);
  const [liveWordScore, setLiveWordScore] = useState(0);
  const [scorePopKey, setScorePopKey] = useState(0);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [autoStopNote, setAutoStopNote] = useState<string>(
    'Okuma bitince, uzun sessizlikte veya süre dolunca otomatik sonlanır'
  );

  const speechEngineRef = useRef<SpeechEngine | null>(null);
  const timerIntervalRef = useRef<any>(null);
  const startTimeRef = useRef<number>(0);
  const speechStartedAtRef = useRef<number>(0);
  const lastSpeechActivityAtRef = useRef<number>(0);
  const transcriptRef = useRef<string>('');
  const hasSubmittedRef = useRef<boolean>(false);
  const prevCorrectCountRef = useRef<number>(0);
  const streakPlayedRef = useRef<boolean>(false);
  const arenaCardWrapperRef = useRef<HTMLDivElement | null>(null);
  const celebratedIndicesRef = useRef<Set<number>>(new Set());
  const comboStreakRef = useRef<number>(0);
  const effectTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearEffectTimers = () => {
    effectTimersRef.current.forEach((t) => clearTimeout(t));
    effectTimersRef.current = [];
  };

  // Primitive dependencies prevent Firestore snapshot updates from resetting the active countdown
  useEffect(() => {
    hasSubmittedRef.current = false;
    transcriptRef.current = '';
    prevCorrectCountRef.current = 0;
    streakPlayedRef.current = false;
    celebratedIndicesRef.current.clear();
    comboStreakRef.current = 0;
    clearEffectTimers();
    setWordBursts([]);
    setJustMatchedIndices([]);
    setLiveWordScore(0);
    setScorePopKey(0);
    setSpokenTranscript('');
    setMicError(null);
    setPhase('countdown');
    setMascotMessage(`Diksiyon İpucu: ${tekerleme.tip}`);

    let count = 3;
    setCountdownNum(3);
    playTone('countdown');

    const interval = setInterval(() => {
      count -= 1;
      if (count > 0) {
        setCountdownNum(count);
        playTone('countdown');
      } else if (count === 0) {
        setCountdownNum(0);
        playTone('round_start');
      } else {
        clearInterval(interval);
        setPhase('playing');
        startRound();
      }
    }, 850);

    return () => {
      clearInterval(interval);
      clearEffectTimers();
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      if (speechEngineRef.current) {
        speechEngineRef.current.stop();
      }
    };
  }, [currentRound, tekerleme.id]);

  const startRound = async () => {
    startTimeRef.current = Date.now();
    speechStartedAtRef.current = 0;
    lastSpeechActivityAtRef.current = 0;
    setAutoStopNote('Okuma bitince, uzun sessizlikte veya süre dolunca otomatik sonlanır');
    setTimeLeft(timeLimitSeconds);
    setElapsedSeconds(0);
    transcriptRef.current = '';
    prevCorrectCountRef.current = 0;
    streakPlayedRef.current = false;
    celebratedIndicesRef.current.clear();
    comboStreakRef.current = 0;
    clearEffectTimers();
    setWordBursts([]);
    setJustMatchedIndices([]);
    setLiveWordScore(0);
    setScorePopKey(0);
    setSpokenTranscript('');
    setMicError(null);

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }

    timerIntervalRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      setElapsedSeconds(elapsed);

      setTimeLeft((prev) => {
        const next = prev - 1;
        if (next > 0 && next <= 5) {
          playTone('timer_urgent');
        }
        if (prev <= 1) {
          if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
          }
          setAutoStopNote('Süre dolduğu için okuma otomatik tamamlandı.');
          handleRoundComplete();
          return 0;
        }
        return next;
      });
    }, 1000);

    await startListening();
  };

  const startListening = async () => {
    setMicError(null);
    if (!speechEngineRef.current) {
      speechEngineRef.current = new SpeechEngine();
    }

    const ok = await speechEngineRef.current.start({
      targetText: tekerleme.text,
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
    }
  };

  const handleRoundComplete = async (overrideTranscript?: string) => {
    if (hasSubmittedRef.current) return;
    hasSubmittedRef.current = true;

    const nowMs = Date.now();
    const rawStartMs = startTimeRef.current || nowMs - 2000;
    let duration = Math.max(0.8, (nowMs - rawStartMs) / 1000);
    if (overrideTranscript === undefined && speechEngineRef.current) {
      const bounds = speechEngineRef.current.getSpeakingBounds(rawStartMs, nowMs);
      duration = Math.max(0.8, (bounds.endMs - bounds.startMs) / 1000);
    }

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    setIsListening(false);
    setPhase('evaluating');

    let engineText = '';
    if (speechEngineRef.current) {
      if (overrideTranscript !== undefined) {
        engineText = speechEngineRef.current.stop();
      } else {
        engineText = await speechEngineRef.current.stopAsync();
      }
    }

    const candidateTranscript =
      overrideTranscript !== undefined
        ? overrideTranscript
        : engineText.length >= transcriptRef.current.length
        ? engineText
        : transcriptRef.current;

    if (candidateTranscript) {
      transcriptRef.current = candidateTranscript;
      setSpokenTranscript(candidateTranscript);
    }

    const evalResult: EvaluationResult = evaluateSpeech(
      tekerleme,
      candidateTranscript,
      duration
    );

    recordPracticeOrRoundReward({
      source: 'multiplayer',
      accuracy: evalResult.accuracy,
      wpm: evalResult.wpm,
      score: evalResult.totalScore
    });
    onPhoenixProgressUpdated?.();

    playTone(
      evalResult.accuracy >= 75
        ? 'victory'
        : evalResult.accuracy >= 45
        ? 'correct'
        : 'wrong'
    );

    const playerScore: PlayerScore = {
      playerId: currentUser.id,
      playerName: currentUser.name,
      avatar: currentUser.avatar,
      isHost,
      isCurrentUser: true,
      accuracy: evalResult.accuracy,
      durationSeconds: evalResult.durationSeconds,
      wpm: evalResult.wpm,
      speedScore: evalResult.speedScore,
      totalScore: evalResult.totalScore,
      badge: evalResult.badge,
      wordBreakdown: evalResult.wordBreakdown
    };

    setTimeout(() => {
      onFinishRound(playerScore);
    }, 450);
  };

  const handleSimulateFastRead = () => {
    const simulated = tekerleme.text;
    transcriptRef.current = simulated;
    setSpokenTranscript(simulated);
    handleRoundComplete(simulated);
  };

  const handleSpeakSample = () => {
    playTone('tap');
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(tekerleme.text);
      utterance.lang = 'tr-TR';
      utterance.rate = 0.95;
      window.speechSynthesis.speak(utterance);
    }
  };

  const { words: wordsForDisplay, liveAccuracy } = alignLiveWords(
    tekerleme.text,
    spokenTranscript
  );

  // Interactive competitive sounds & sparkle/score bursts as words are matched live
  useEffect(() => {
    if (phase !== 'playing') return;

    const newlyCorrect = wordsForDisplay
      .map((w, idx) => ({ w, idx }))
      .filter(({ w, idx }) => w.status === 'correct' && !celebratedIndicesRef.current.has(idx));

    if (newlyCorrect.length > 0) {
      const containerEl = arenaCardWrapperRef.current;
      const containerRect = containerEl?.getBoundingClientRect();
      const createdBursts: WordBurstEffect[] = [];
      const createdIndices: number[] = [];
      let totalPointsAdded = 0;

      newlyCorrect.forEach(({ idx }, i) => {
        celebratedIndicesRef.current.add(idx);
        createdIndices.push(idx);

        if (idx === 0 || wordsForDisplay[idx - 1]?.status === 'correct') {
          comboStreakRef.current += 1;
        } else {
          comboStreakRef.current = 1;
        }

        const currentStreak = comboStreakRef.current;
        const wordPoints = currentStreak >= 5 ? 20 : currentStreak >= 3 ? 15 : 10;
        totalPointsAdded += wordPoints;

        let x = containerRect ? containerRect.width / 2 : 160;
        let y = 52;

        if (containerEl && containerRect) {
          const wordEl = containerEl.querySelector(
            `[data-word-index="${idx}"]`
          ) as HTMLElement | null;
          if (wordEl) {
            const wRect = wordEl.getBoundingClientRect();
            x = Math.max(32, Math.min(containerRect.width - 32, wRect.left - containerRect.left + wRect.width / 2));
            y = Math.max(12, wRect.top - containerRect.top);
          }
        }

        createdBursts.push({
          id: `${currentRound}_${idx}_${Date.now()}_${i}`,
          x,
          y,
          points: wordPoints,
          streak: currentStreak,
          delayMs: i * 55
        });
      });

      setLiveWordScore((prev) => prev + totalPointsAdded);
      setScorePopKey((prev) => prev + 1);
      setWordBursts((prev) => [...prev.slice(-14), ...createdBursts]);
      setJustMatchedIndices((prev) => Array.from(new Set([...prev, ...createdIndices])));

      const burstIds = new Set(createdBursts.map((b) => b.id));
      const matchedSet = new Set(createdIndices);
      const maxDelay = (createdBursts.length - 1) * 55;

      const burstCleanupTimer = setTimeout(() => {
        setWordBursts((prev) => prev.filter((b) => !burstIds.has(b.id)));
      }, 940 + maxDelay);

      const glowCleanupTimer = setTimeout(() => {
        setJustMatchedIndices((prev) => prev.filter((idx) => !matchedSet.has(idx)));
      }, 480 + maxDelay);

      effectTimersRef.current.push(burstCleanupTimer, glowCleanupTimer);
    }

    const correctCount = wordsForDisplay.filter((w) => w.status === 'correct').length;
    if (correctCount > prevCorrectCountRef.current) {
      playComboWordTone(correctCount);
      prevCorrectCountRef.current = correctCount;
    }
    if (liveAccuracy >= 80 && !streakPlayedRef.current) {
      streakPlayedRef.current = true;
      const streakTimer = setTimeout(() => playTone('combo_streak'), 110);
      effectTimersRef.current.push(streakTimer);
    }
  }, [wordsForDisplay, liveAccuracy, phase, currentRound]);

  // Automatic round completion on full reading match, trailing silence, or initial long silence
  const wordsSnapshotRef = useRef(wordsForDisplay);
  wordsSnapshotRef.current = wordsForDisplay;
  const finishRoundRef = useRef(handleRoundComplete);
  finishRoundRef.current = handleRoundComplete;

  useEffect(() => {
    if (phase !== 'playing') return;

    const checker = setInterval(() => {
      if (hasSubmittedRef.current) return;
      const now = Date.now();
      const roundStart = startTimeRef.current;
      if (!roundStart) return;

      const words = wordsSnapshotRef.current;
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

      // 1) All words finished -> quick natural grace then auto-finish
      if (allOrFinalReached && lastActivityAt > 0 && now - lastActivityAt >= 750) {
        setAutoStopNote('Metin tamamlandı! Puanınız hesaplanıyor...');
        finishRoundRef.current();
        return;
      }

      // 2) Long silence after speaking started (2.8s)
      if (
        speechStartedAt > 0 &&
        lastActivityAt > 0 &&
        now - speechStartedAt >= 1200 &&
        now - lastActivityAt >= 2800
      ) {
        setAutoStopNote('Sessizlik algılandı, okuma otomatik sonlandırılıyor...');
        finishRoundRef.current();
        return;
      }

      // 3) User stayed silent from the start for 8 seconds
      if (speechStartedAt === 0 && now - roundStart >= 8000) {
        setAutoStopNote('Uzun süre ses algılanmadığı için tur otomatik sonlandırıldı.');
        finishRoundRef.current();
      }
    }, 250);

    return () => clearInterval(checker);
  }, [phase]);

  // COUNTDOWN OVERLAY
  if (phase === 'countdown') {
    return (
      <div className="min-h-[460px] flex flex-col items-center justify-center p-6 ebru-glass-card rounded-[28px] text-center space-y-6 animate-screen-in">
        <div className="text-xs font-display font-bold uppercase tracking-widest text-[#00F5D4] px-3 py-1 rounded-full bg-[#3A86FF]/20 border border-[#3A86FF]/40">
          ✦ Tur {currentRound} / {totalRounds} Hazırlığı
        </div>

        <div className="relative flex items-center justify-center">
          <div className="absolute w-40 h-40 rounded-full bg-gradient-to-tr from-[#3A86FF]/35 via-[#FF006E]/25 to-[#FFBE0B]/35 blur-xl animate-pulse-aura" />
          <div className="relative w-32 h-32 sm:w-36 sm:h-36 rounded-full bg-[#0d1629] border-4 border-[#FFBE0B] flex items-center justify-center shadow-2xl shadow-[#FF006E]/30">
            <span className="font-display text-5xl sm:text-6xl font-bold bg-gradient-to-b from-white via-[#FFBE0B] to-[#FF006E] bg-clip-text text-transparent animate-pulse">
              {countdownNum === 0 ? 'BAŞLA!' : countdownNum}
            </span>
          </div>
        </div>

        <div className="max-w-md space-y-2">
          <h2 className="text-xl font-bold text-white font-display">{tekerleme.title}</h2>
          <p className="text-xs text-[#CBD5E1]">
            Hedef Süre: <strong className="text-[#FFBE0B]">{tekerleme.benchmarkSeconds} sn</strong> · Hazırlanın ve mikrofon açıldığında hızlı, tane tane okuyun!
          </p>
        </div>

        {onLeaveRoom && (
          <button
            type="button"
            onClick={() => {
              playTone('tap');
              clearEffectTimers();
              if (speechEngineRef.current) {
                speechEngineRef.current.stop();
              }
              onLeaveRoom();
            }}
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-semibold text-[#CBD5E1] hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Odadan Çık</span>
          </button>
        )}
      </div>
    );
  }

  const timeProgressPercent = Math.max(4, Math.min(100, (timeLeft / timeLimitSeconds) * 100));
  const correctWordRatio = wordsForDisplay.length
    ? Math.round((wordsForDisplay.filter((w) => w.status === 'correct').length / wordsForDisplay.length) * 100)
    : 0;

  const mascotMood = liveAccuracy >= 75 ? 'excited' : micError ? 'sad' : 'happy';

  return (
    <div className="max-w-2xl mx-auto space-y-4 animate-screen-in">
      {/* Ebru Progress Track + Altın Zümrüdüanka Tüyü */}
      <div className="p-4 ebru-glass-card rounded-[24px] space-y-2.5">
        <div className="flex items-center justify-between gap-2 text-xs font-semibold">
          <span className="inline-flex items-center gap-1.5 text-[#00F5D4] font-display tracking-wide truncate">
            <span>✦ Tur {currentRound} / {totalRounds}: {tekerleme.title}</span>
          </span>

          <div className="flex items-center gap-3 font-mono shrink-0">
            {liveWordScore > 0 && (
              <span
                key={scorePopKey}
                className="text-[#FFBE0B] font-bold text-xs sm:text-sm tabular-nums animate-score-tick"
              >
                +{liveWordScore} Puan
              </span>
            )}
            <div className="flex items-center gap-1.5">
              <Timer className={`w-4 h-4 ${timeLeft <= 5 ? 'text-[#FF006E] animate-pulse' : 'text-[#FFBE0B]'}`} />
              <span className={`font-bold text-base tabular-nums ${timeLeft <= 5 ? 'text-[#FF006E]' : 'text-white'}`}>
                {timeLeft}s
              </span>
            </div>
          </div>
        </div>

        {/* Ebru Gradient Progress Bar with Moving Golden Feather */}
        <div className="relative h-2.5 bg-white/10 rounded-full border border-white/15 overflow-visible">
          <div
            className="h-full rounded-full transition-all duration-700 relative"
            style={{
              width: `${timeProgressPercent}%`,
              background: 'linear-gradient(90deg, #3A86FF 0%, #FF006E 55%, #FFBE0B 100%)',
              boxShadow: '0 0 12px rgba(255, 0, 110, 0.55)'
            }}
          >
            <svg
              className="absolute -right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 drop-shadow-[0_2px_6px_rgba(255,190,11,0.85)]"
              viewBox="0 0 32 32"
              fill="none"
            >
              <path d="M27 4C18 5 9 13 5 26C13 24 22 18 27 4Z" fill="url(#arenaFeatherGrad)" />
              <path d="M5 27L24 8" stroke="#FFFBEB" strokeWidth="1.8" strokeLinecap="round" />
              <defs>
                <linearGradient id="arenaFeatherGrad" x1="5" y1="26" x2="27" y2="4" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#FF006E" />
                  <stop offset="0.5" stopColor="#FFBE0B" />
                  <stop offset="1" stopColor="#00F5D4" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>
      </div>

      {/* Mascot Dialogue + Örnek Ses Butonu */}
      <div className="flex items-center gap-2.5">
        <div className="flex-1">
          <MascotDialogue
            mood={mascotMood}
            level={phoenixLevel}
            difficulty={tekerleme.difficulty}
            message={
              correctWordRatio >= 85
                ? 'Harikasın! Zümrüdüanka tüyleri parlıyor, bitirmeye çok yakınsın!'
                : mascotMessage
            }
            onMascotTap={() => {
              playTone('hint');
              setMascotMessage('Tüylerim seninle! Nefesini ayarla ve net telaffuz et!');
            }}
          />
        </div>
        <button
          onClick={handleSpeakSample}
          className="p-3 rounded-2xl bg-[#14213D]/90 hover:bg-[#3A86FF]/25 border border-[#3A86FF]/40 text-[#FFBE0B] shrink-0 transition-colors cursor-pointer shadow-md"
          title="Örnek Okumayı Dinle"
        >
          <Volume2 className="w-5 h-5" />
        </button>
      </div>

      {/* Main Cloud-Light Rumi Tekerleme Card with Per-Word Sparkle & Score Overlay */}
      <div ref={arenaCardWrapperRef} className="relative">
        <WordComparison
          originalWords={wordsForDisplay}
          spokenTranscript={spokenTranscript}
          isListening={isListening}
          audioLevel={audioLevel}
          liveAccuracy={liveAccuracy}
          categoryLabel={tekerleme.categoryLabel || 'Tekerleme Arenası'}
          justMatchedIndices={justMatchedIndices}
        />

        {/* Floating Sparkle Bursts & Score Popups */}
        <div
          className="pointer-events-none absolute inset-0 overflow-visible z-30"
          aria-hidden="true"
        >
          {wordBursts.map((burst) => {
            const isHotStreak = burst.streak >= 3;
            return (
              <div
                key={burst.id}
                className="absolute"
                style={{ left: `${burst.x}px`, top: `${burst.y}px` }}
              >
                {SPARKLE_PARTICLES.map((particle, pIdx) => (
                  <svg
                    key={pIdx}
                    width={particle.size}
                    height={particle.size}
                    viewBox="0 0 16 16"
                    fill="none"
                    className="absolute left-0 top-0 animate-sparkle-particle"
                    style={
                      {
                        '--tx': particle.tx,
                        '--ty': particle.ty,
                        '--rot': particle.rot,
                        animationDelay: `${burst.delayMs}ms`
                      } as React.CSSProperties
                    }
                  >
                    <path
                      d="M8 0L9.9 6.1L16 8L9.9 9.9L8 16L6.1 9.9L0 8L6.1 6.1L8 0Z"
                      fill={particle.color}
                    />
                  </svg>
                ))}

                <div
                  className={`absolute left-0 top-0 -translate-x-1/2 whitespace-nowrap rounded-lg px-2 py-0.5 text-xs sm:text-sm font-display font-bold tabular-nums animate-float-score ${
                    isHotStreak
                      ? 'bg-[#0d1629]/95 text-[#FFBE0B] border border-[#FFBE0B]/70 shadow-[0_6px_16px_rgba(255,190,11,0.38)]'
                      : 'bg-[#0d1629]/92 text-[#00F5D4] border border-[#00F5D4]/55 shadow-[0_6px_14px_rgba(13,22,41,0.35)]'
                  }`}
                  style={{ animationDelay: `${burst.delayMs}ms` }}
                >
                  +{burst.points}
                  {isHotStreak && (
                    <span className="ml-1 text-[10px] text-[#06D6A0]">
                      ✦ {burst.streak}x
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Live Ebru Audio Visualizer */}
      <AudioVisualizer isListening={isListening} audioLevel={audioLevel} />

      {/* Mic Alert */}
      {micError && (
        <div className="p-3 bg-[#FF006E]/15 border border-[#FF006E]/50 rounded-2xl text-xs text-rose-200 flex items-center justify-between gap-3">
          <span>{micError}</span>
          <button
            onClick={startListening}
            className="px-3 py-1.5 rounded-xl bg-[#FF006E]/30 hover:bg-[#FF006E]/45 font-semibold text-[11px] shrink-0 cursor-pointer flex items-center gap-1"
          >
            <Mic className="w-3 h-3" />
            Tekrar Dene
          </button>
        </div>
      )}

      {/* Automatic Voice Detection Status Bar (no manual stop button) */}
      <div className="p-3.5 ebru-glass-card rounded-[24px] flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="w-full sm:flex-1 flex items-center gap-3 px-2 py-1">
          <div
            className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${
              phase === 'evaluating'
                ? 'bg-[#FFBE0B]/20 border-[#FFBE0B]/50 text-[#FFBE0B]'
                : 'bg-[#06D6A0]/20 border-[#06D6A0]/50 text-[#06D6A0]'
            }`}
          >
            <Radio className={`w-5 h-5 ${phase === 'playing' ? 'animate-pulse' : ''}`} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
              <span>
                {phase === 'evaluating'
                  ? 'Okumanız Analiz Ediliyor...'
                  : 'Otomatik Ses Takibi Aktif'}
              </span>
              <span className="text-[11px] font-mono text-[#FFBE0B] tabular-nums">
                ({elapsedSeconds.toFixed(1)} sn)
              </span>
            </div>
            <p className="text-[11px] text-[#93C5FD] truncate">{autoStopNote}</p>
          </div>
        </div>

        <button
          onClick={handleSimulateFastRead}
          disabled={phase === 'evaluating'}
          className="w-full sm:w-auto px-4 py-3 rounded-[18px] bg-white/10 hover:bg-white/15 text-[#F8FAFC] border border-white/15 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 shrink-0"
          title="Mikrofonunuz yoksa otomatik hızlı okuma simülasyonu çalıştırın"
        >
          <Zap className="w-4 h-4 text-[#FFBE0B]" />
          <span>Simüle Hızlı Oku</span>
        </button>
      </div>

      {onLeaveRoom && (
        <div className="flex items-center justify-center">
          {!confirmLeave ? (
            <button
              type="button"
              onClick={() => {
                playTone('tap');
                setConfirmLeave(true);
              }}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-semibold text-[#CBD5E1] hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Odadan Çık</span>
            </button>
          ) : (
            <div className="p-2.5 rounded-2xl bg-[#0d1629]/90 border border-[#FF006E]/45 flex flex-wrap items-center justify-center gap-2 text-xs">
              <span className="text-[#FDE68A] font-medium">
                {isHost
                  ? 'Kurucu çıksa da oyun diğer oyuncular için otomatik devam eder. Çıkmak istiyor musun?'
                  : 'Odadan çıkarsan Aktif Odalar bölümünden tekrar katılabilirsin.'}
              </span>
              <button
                type="button"
                onClick={() => {
                  playTone('tap');
                  clearEffectTimers();
                  if (timerIntervalRef.current) {
                    clearInterval(timerIntervalRef.current);
                    timerIntervalRef.current = null;
                  }
                  if (speechEngineRef.current) {
                    speechEngineRef.current.stop();
                  }
                  onLeaveRoom();
                }}
                className="px-3 py-1.5 rounded-xl bg-[#FF006E] hover:bg-[#FF006E]/90 text-white font-bold cursor-pointer"
              >
                Evet, Çık
              </button>
              <button
                type="button"
                onClick={() => setConfirmLeave(false)}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-[#CBD5E1] font-semibold cursor-pointer"
              >
                Vazgeç
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
