import React, { useState, useRef, useEffect } from 'react';
import { Difficulty, Tekerleme } from '../types/game';
import { INITIAL_TEKERLEMELER } from '../data/tekerlemeler';
import { SpeechEngine } from '../utils/speechEngine';
import { evaluateSpeech, alignLiveWords, EvaluationResult } from '../utils/scoreCalculator';
import { AudioVisualizer } from './AudioVisualizer';
import { WordComparison } from './WordComparison';
import { MascotDialogue } from './DilbazMascot';
import { triggerCelebration } from './FxCanvas';
import { playTone, playComboWordTone } from '../utils/soundEffects';
import { recordPracticeOrRoundReward } from '../utils/phoenixProgression';
import { Mic, Volume2, Shuffle, Sparkles, Radio, Timer } from 'lucide-react';

interface SoloPracticeProps {
  tekerlemeler: Tekerleme[];
  initialTekerlemeId?: string;
  phoenixLevel?: number;
  onDifficultyChange?: (difficulty: Difficulty) => void;
  onPhoenixProgressUpdated?: () => void;
}

export const SoloPractice: React.FC<SoloPracticeProps> = ({
  tekerlemeler,
  initialTekerlemeId,
  phoenixLevel,
  onDifficultyChange,
  onPhoenixProgressUpdated
}) => {
  const [selectedTekerleme, setSelectedTekerleme] = useState<Tekerleme>(() => {
    if (initialTekerlemeId) {
      const match = tekerlemeler.find((t) => t.id === initialTekerlemeId);
      if (match) return match;
    }
    return tekerlemeler[0] || INITIAL_TEKERLEMELER[0];
  });
  const [isListening, setIsListening] = useState(false);
  const [spokenTranscript, setSpokenTranscript] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [practiceReward, setPracticeReward] = useState<{ xpEarned: number; sparksEarned: number } | null>(null);
  const [elapsed, setElapsed] = useState<number>(0);
  const [autoStopStatus, setAutoStopStatus] = useState<string | null>(null);

  const speechEngineRef = useRef<SpeechEngine | null>(null);
  const timerRef = useRef<any>(null);
  const startTimeRef = useRef<number>(0);
  const speechStartedAtRef = useRef<number>(0);
  const lastSpeechActivityAtRef = useRef<number>(0);
  const hasStoppedRef = useRef<boolean>(false);
  const transcriptRef = useRef<string>('');
  const prevCorrectCountRef = useRef<number>(0);
  const streakPlayedRef = useRef<boolean>(false);

  const maxReadingSeconds = Math.max(15, Math.ceil(selectedTekerleme.benchmarkSeconds * 2.5));

  useEffect(() => {
    onDifficultyChange?.(selectedTekerleme.difficulty);
  }, [selectedTekerleme.difficulty, onDifficultyChange]);

  useEffect(() => {
    if (initialTekerlemeId) {
      const found = tekerlemeler.find((t) => t.id === initialTekerlemeId);
      if (found) {
        setSelectedTekerleme(found);
        setEvaluation(null);
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

  const handleStartPractice = async () => {
    playTone('round_start');
    setEvaluation(null);
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

    const reward = recordPracticeOrRoundReward({
      source: 'solo',
      accuracy: result.accuracy,
      wpm: result.wpm,
      score: result.totalScore
    });
    setPracticeReward({ xpEarned: reward.xpEarned, sparksEarned: reward.sparksEarned });
    onPhoenixProgressUpdated?.();

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

  const handlePickRandom = () => {
    playTone('hint');
    if (tekerlemeler.length === 0) return;
    const randomIdx = Math.floor(Math.random() * tekerlemeler.length);
    setSelectedTekerleme(tekerlemeler[randomIdx]);
    setEvaluation(null);
    transcriptRef.current = '';
    setSpokenTranscript('');
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
    <div className="max-w-2xl mx-auto space-y-4 animate-screen-in">
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

      {/* Tekerleme Selector Strip */}
      <div className="p-4 ebru-glass-card rounded-[24px] flex flex-wrap items-center justify-between gap-3">
        <div className="flex-1 min-w-[200px]">
          <label className="text-[11px] font-semibold text-[#93C5FD] block mb-1">
            Çalışmak İstediğiniz Tekerleme
          </label>
          <select
            value={selectedTekerleme.id}
            onChange={(e) => {
              const found = tekerlemeler.find((t) => t.id === e.target.value);
              if (found) {
                playTone('tap');
                setSelectedTekerleme(found);
                setEvaluation(null);
                transcriptRef.current = '';
                setSpokenTranscript('');
              }
            }}
            className="w-full px-3 py-2.5 bg-[#0d1629]/90 border border-white/15 rounded-xl text-white text-xs sm:text-sm focus:border-[#FFBE0B] focus:outline-none"
          >
            {tekerlemeler.map((t) => (
              <option key={t.id} value={t.id}>
                [{t.difficulty.toUpperCase()}] {t.title}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={handlePickRandom}
          className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-[#3A86FF]/25 text-xs font-semibold text-white border border-white/15 transition-colors cursor-pointer self-end"
        >
          <Shuffle className="w-3.5 h-3.5 text-[#FFBE0B]" />
          <span>Rastgele</span>
        </button>
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

      {/* Action Controls (no manual stop button — auto-completes on finish, silence, or timeout) */}
      <div className="flex flex-col sm:flex-row gap-3">
        {!isListening ? (
          <button
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
        </div>
      )}
    </div>
  );
};
