import React, { useState, useEffect, useRef } from 'react';
import { Tekerleme, PlayerScore } from '../types/game';
import { SpeechEngine } from '../utils/speechEngine';
import { evaluateSpeech, alignLiveWords, EvaluationResult } from '../utils/scoreCalculator';
import { AudioVisualizer } from './AudioVisualizer';
import { WordComparison } from './WordComparison';
import { MascotDialogue } from './DilbazMascot';
import { playTone, playComboWordTone } from '../utils/soundEffects';
import { Square, Volume2, Timer, Zap, Mic } from 'lucide-react';

interface GameArenaProps {
  tekerleme: Tekerleme;
  currentRound: number;
  totalRounds: number;
  timeLimitSeconds: number;
  currentUser: { id: string; name: string; avatar: string };
  isHost?: boolean;
  onFinishRound: (result: PlayerScore) => void;
}

export const GameArena: React.FC<GameArenaProps> = ({
  tekerleme,
  currentRound,
  totalRounds,
  timeLimitSeconds,
  currentUser,
  isHost = false,
  onFinishRound
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

  const speechEngineRef = useRef<SpeechEngine | null>(null);
  const timerIntervalRef = useRef<any>(null);
  const startTimeRef = useRef<number>(0);
  const transcriptRef = useRef<string>('');
  const hasSubmittedRef = useRef<boolean>(false);
  const prevCorrectCountRef = useRef<number>(0);
  const streakPlayedRef = useRef<boolean>(false);

  // Primitive dependencies prevent Firestore snapshot updates from resetting the active countdown
  useEffect(() => {
    hasSubmittedRef.current = false;
    transcriptRef.current = '';
    prevCorrectCountRef.current = 0;
    streakPlayedRef.current = false;
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
    setTimeLeft(timeLimitSeconds);
    setElapsedSeconds(0);
    transcriptRef.current = '';
    prevCorrectCountRef.current = 0;
    streakPlayedRef.current = false;
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

    const duration = Math.max(0.8, (Date.now() - startTimeRef.current) / 1000);

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

  // Interactive competitive sounds as words are matched live
  useEffect(() => {
    if (phase !== 'playing') return;
    const correctCount = wordsForDisplay.filter((w) => w.status === 'correct').length;
    if (correctCount > prevCorrectCountRef.current) {
      playComboWordTone(correctCount);
      prevCorrectCountRef.current = correctCount;
    }
    if (liveAccuracy >= 80 && !streakPlayedRef.current) {
      streakPlayedRef.current = true;
      setTimeout(() => playTone('combo_streak'), 110);
    }
  }, [wordsForDisplay, liveAccuracy, phase]);

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
        <div className="flex items-center justify-between text-xs font-semibold">
          <span className="inline-flex items-center gap-1.5 text-[#00F5D4] font-display tracking-wide">
            <span>✦ Tur {currentRound} / {totalRounds}: {tekerleme.title}</span>
          </span>

          <div className="flex items-center gap-2 font-mono">
            <Timer className={`w-4 h-4 ${timeLeft <= 5 ? 'text-[#FF006E] animate-pulse' : 'text-[#FFBE0B]'}`} />
            <span className={`font-bold text-base tabular-nums ${timeLeft <= 5 ? 'text-[#FF006E]' : 'text-white'}`}>
              {timeLeft}s
            </span>
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

      {/* Main Cloud-Light Rumi Tekerleme Card */}
      <WordComparison
        originalWords={wordsForDisplay}
        spokenTranscript={spokenTranscript}
        isListening={isListening}
        liveAccuracy={liveAccuracy}
        categoryLabel={tekerleme.categoryLabel || 'Tekerleme Arenası'}
      />

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

      {/* Action Bar */}
      <div className="p-3.5 ebru-glass-card rounded-[24px] flex flex-col sm:flex-row items-center gap-3">
        <button
          onClick={() => handleRoundComplete()}
          disabled={phase === 'evaluating'}
          className="w-full sm:flex-1 py-4 px-6 rounded-[20px] btn-epic-turquoise font-bold text-base flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
        >
          <Square className="w-5 h-5 fill-current" />
          <span>
            {phase === 'evaluating'
              ? 'Analiz Ediliyor...'
              : `Tekerlemeyi Bitirdim! (${elapsedSeconds.toFixed(1)} sn)`}
          </span>
        </button>

        <button
          onClick={handleSimulateFastRead}
          disabled={phase === 'evaluating'}
          className="w-full sm:w-auto px-4 py-3.5 rounded-[18px] bg-white/10 hover:bg-white/15 text-[#F8FAFC] border border-white/15 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
          title="Mikrofonunuz yoksa otomatik hızlı okuma simülasyonu çalıştırın"
        >
          <Zap className="w-4 h-4 text-[#FFBE0B]" />
          <span>Simüle Hızlı Oku</span>
        </button>
      </div>
    </div>
  );
};
