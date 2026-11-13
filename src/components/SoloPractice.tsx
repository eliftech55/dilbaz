import React, { useState, useRef, useEffect } from 'react';
import { Tekerleme } from '../types/game';
import { INITIAL_TEKERLEMELER } from '../data/tekerlemeler';
import { SpeechEngine } from '../utils/speechEngine';
import { evaluateSpeech, alignLiveWords, EvaluationResult } from '../utils/scoreCalculator';
import { AudioVisualizer } from './AudioVisualizer';
import { WordComparison } from './WordComparison';
import { MascotDialogue } from './DilbazMascot';
import { triggerCelebration } from './FxCanvas';
import { playTone, playComboWordTone } from '../utils/soundEffects';
import { Mic, Square, Volume2, Shuffle, Zap } from 'lucide-react';

interface SoloPracticeProps {
  tekerlemeler: Tekerleme[];
  initialTekerlemeId?: string;
}

export const SoloPractice: React.FC<SoloPracticeProps> = ({
  tekerlemeler,
  initialTekerlemeId
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
  const [elapsed, setElapsed] = useState<number>(0);

  const speechEngineRef = useRef<SpeechEngine | null>(null);
  const timerRef = useRef<any>(null);
  const startTimeRef = useRef<number>(0);
  const transcriptRef = useRef<string>('');
  const prevCorrectCountRef = useRef<number>(0);
  const streakPlayedRef = useRef<boolean>(false);

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
    transcriptRef.current = '';
    setSpokenTranscript('');
    setMicError(null);
    prevCorrectCountRef.current = 0;
    streakPlayedRef.current = false;

    const start = Date.now();
    startTimeRef.current = start;
    setElapsed(0);

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setElapsed((Date.now() - start) / 1000);
    }, 100);

    if (!speechEngineRef.current) {
      speechEngineRef.current = new SpeechEngine();
    }

    const ok = await speechEngineRef.current.start({
      targetText: selectedTekerleme.text,
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

  const handleStopPractice = async (overrideTranscript?: string) => {
    const startMs = startTimeRef.current || Date.now() - 2000;
    const duration = Math.max(0.8, (Date.now() - startMs) / 1000);

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    setIsListening(false);

    let finalRecorded = '';
    if (speechEngineRef.current) {
      if (overrideTranscript !== undefined) {
        finalRecorded = speechEngineRef.current.stop();
      } else {
        finalRecorded = await speechEngineRef.current.stopAsync();
      }
    }

    const textToEvaluate =
      overrideTranscript !== undefined
        ? overrideTranscript
        : finalRecorded.length >= transcriptRef.current.length
        ? finalRecorded
        : transcriptRef.current;

    if (textToEvaluate) {
      transcriptRef.current = textToEvaluate;
      setSpokenTranscript(textToEvaluate);
    }

    const result = evaluateSpeech(selectedTekerleme, textToEvaluate, duration);
    setEvaluation(result);

    if (result.accuracy >= 75) {
      playTone('victory');
      triggerCelebration({ xRatio: 0.5, yRatio: 0.35, count: 36 });
    } else if (result.accuracy >= 45) {
      playTone('correct');
    } else {
      playTone('wrong');
    }
  };

  const handleSimulateFastRead = () => {
    if (!startTimeRef.current) {
      startTimeRef.current = Date.now() - Math.round(selectedTekerleme.benchmarkSeconds * 1000);
    }
    const perfectText = selectedTekerleme.text;
    transcriptRef.current = perfectText;
    setSpokenTranscript(perfectText);
    handleStopPractice(perfectText);
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

  return (
    <div className="max-w-2xl mx-auto space-y-5 animate-screen-in">
      {/* Header */}
      <div className="text-center space-y-1.5">
        <span className="inline-block text-[11px] font-display font-bold uppercase tracking-wider text-[#00F5D4] px-3 py-1 rounded-full bg-[#3A86FF]/20 border border-[#3A86FF]/40">
          ✦ Bireysel Çalışma Alanı
        </span>
        <h1 className="text-2xl sm:text-3xl font-bold text-white font-display">
          Bireysel Diksiyon & Hız Pratiği
        </h1>
        <p className="text-xs text-[#CBD5E1] max-w-md mx-auto">
          Oda yarışları öncesi tekerlemeleri çalışın, telaffuz doğruluğunuzu ve hızınızı geliştirin.
        </p>
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
            onClick={handleStartPractice}
            className="flex-1 py-4 rounded-[20px] btn-epic-pomegranate font-bold text-sm sm:text-base flex items-center justify-center gap-2 cursor-pointer"
          >
            <Mic className="w-5 h-5 fill-current" />
            <span>OKUMAYA BAŞLA (MİKROFONU AÇ)</span>
          </button>
        ) : (
          <button
            onClick={() => handleStopPractice()}
            className="flex-1 py-4 rounded-[20px] btn-epic-turquoise font-bold text-sm sm:text-base flex items-center justify-center gap-2 cursor-pointer"
          >
            <Square className="w-5 h-5 fill-current" />
            <span>OKUMAYI BİTİR ({elapsed.toFixed(1)} sn)</span>
          </button>
        )}

        <button
          onClick={handleSimulateFastRead}
          className="px-4 py-3.5 rounded-[18px] bg-white/10 hover:bg-white/15 text-white border border-white/15 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          title="Otomatik okuma simülasyonu"
        >
          <Zap className="w-4 h-4 text-[#FFBE0B]" />
          <span>Simüle Hızlı Oku</span>
        </button>
      </div>

      {/* Practice Results Card */}
      {evaluation && (
        <div className="p-5 sm:p-6 ebru-glass-card border-[1.5px] border-[#00F5D4]/45 rounded-[28px] space-y-4 animate-screen-in">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div>
              <span className="text-[11px] font-display uppercase tracking-wider text-[#00F5D4]">
                ✦ Pratik Karnesi
              </span>
              <h2 className="text-lg font-bold text-white font-display">
                {evaluation.badge || 'Tebrikler! Pratik Tamamlandı'}
              </h2>
            </div>
            <span className="text-[11px] px-2.5 py-1 rounded-full bg-white/10 text-[#93C5FD] border border-white/15 font-semibold">
              Performans: {evaluation.totalScore}
            </span>
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
