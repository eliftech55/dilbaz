import React, { useEffect, useState, useRef } from 'react';
import { PlayerScore, RoomProgressionMode } from '../types/game';
import { DilbazMascot } from './DilbazMascot';
import { KilimAvatar } from './KilimAvatar';
import { triggerCelebration } from './FxCanvas';
import { playTone } from '../utils/soundEffects';
import { PhoenixDifficultyInput } from '../utils/phoenixProgression';
import {
  Trophy,
  CheckCircle2,
  AlertCircle,
  XCircle,
  ChevronRight,
  Zap,
  LogOut
} from 'lucide-react';

interface RoundResultsProps {
  currentUserScore: PlayerScore;
  allPlayerScores: PlayerScore[];
  currentRound: number;
  totalRounds: number;
  totalPlayersCount?: number;
  isWaitingForOthers?: boolean;
  isHost?: boolean;
  progressionMode?: RoomProgressionMode;
  hostLeftAutoMode?: boolean;
  timeLimitSeconds?: number;
  phoenixLevel?: number;
  difficulty?: PhoenixDifficultyInput | null;
  onForceFinishRound?: () => void;
  onNextRound: () => void;
  onLeaveRoom?: () => void;
}

export const RoundResults: React.FC<RoundResultsProps> = ({
  currentUserScore,
  allPlayerScores,
  currentRound,
  totalRounds,
  totalPlayersCount = 1,
  isWaitingForOthers = false,
  isHost = true,
  progressionMode = 'host',
  hostLeftAutoMode = false,
  timeLimitSeconds = 15,
  phoenixLevel,
  difficulty,
  onForceFinishRound,
  onNextRound,
  onLeaveRoom
}) => {
  const sortedScores = [...allPlayerScores].sort((a, b) => b.totalScore - a.totalScore);
  const myRank = Math.max(
    1,
    sortedScores.findIndex((s) => s.playerId === currentUserScore.playerId) + 1
  );

  const isAutoMode = progressionMode === 'auto' || Boolean(hostLeftAutoMode);
  const [autoAdvanceLeft, setAutoAdvanceLeft] = useState(5);
  const [waitSafetyLeft, setWaitSafetyLeft] = useState(Math.max(10, timeLimitSeconds + 6));
  const [confirmLeave, setConfirmLeave] = useState(false);

  const autoTriggeredRef = useRef<number | null>(null);
  const waitSafetyTriggeredRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isWaitingForOthers && (myRank === 1 || currentUserScore.accuracy >= 70)) {
      playTone('victory');
      triggerCelebration({ xRatio: 0.5, yRatio: 0.25, count: 48 });
    }
  }, [myRank, isWaitingForOthers, currentUserScore.accuracy]);

  // Reset per-round automation guards
  useEffect(() => {
    autoTriggeredRef.current = null;
    waitSafetyTriggeredRef.current = null;
    setAutoAdvanceLeft(5);
    setWaitSafetyLeft(Math.max(10, timeLimitSeconds + 6));
  }, [currentRound, timeLimitSeconds]);

  // Automatic progression countdown once round results are ready
  useEffect(() => {
    if (isWaitingForOthers || !isAutoMode) return;

    setAutoAdvanceLeft(5);
    const interval = setInterval(() => {
      setAutoAdvanceLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          if (autoTriggeredRef.current !== currentRound) {
            autoTriggeredRef.current = currentRound;
            onNextRound();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isWaitingForOthers, isAutoMode, currentRound, onNextRound]);

  // Safety auto-finish timer when waiting in auto mode (or after host left) if another player dropped offline
  useEffect(() => {
    if (!isWaitingForOthers || !isAutoMode || !onForceFinishRound) return;

    const initialWait = Math.max(10, timeLimitSeconds + 6);
    setWaitSafetyLeft(initialWait);
    const interval = setInterval(() => {
      setWaitSafetyLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          if (waitSafetyTriggeredRef.current !== currentRound) {
            waitSafetyTriggeredRef.current = currentRound;
            onForceFinishRound();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isWaitingForOthers, isAutoMode, currentRound, timeLimitSeconds, onForceFinishRound]);

  const isFinalRound = currentRound >= totalRounds;

  return (
    <div className="max-w-2xl mx-auto space-y-5 animate-screen-in">
      {hostLeftAutoMode && (
        <div className="p-3 rounded-2xl bg-[#3A86FF]/20 border border-[#00F5D4]/45 text-xs text-[#E0F2FE] font-semibold flex items-center justify-center gap-2 text-center">
          <Zap className="w-4 h-4 text-[#00F5D4] shrink-0" />
          <span>
            Oda kurucusu ayrıldığı için oyun otomatik ilerleme modunda devam ediyor. Kurucu isterse odaya tekrar katılabilir.
          </span>
        </div>
      )}

      {/* Victory Card */}
      <div className="ebru-glass-card border-[1.5px] border-[#FFBE0B]/45 rounded-[28px] p-5 sm:p-6 text-center space-y-4">
        <div className="flex justify-center">
          <DilbazMascot
            mood={currentUserScore.accuracy >= 50 ? 'excited' : 'sad'}
            size={90}
            level={phoenixLevel}
            difficulty={difficulty}
          />
        </div>

        <div className="space-y-1.5">
          <span className="inline-block text-[11px] font-display font-bold tracking-widest uppercase text-[#00F5D4] px-3 py-1 bg-[#3A86FF]/20 border border-[#3A86FF]/40 rounded-full">
            ✦ Tur {currentRound} / {totalRounds} Sonuçları
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#FFBE0B] font-display">
            {myRank === 1 ? 'TEBRİKLER SÖZ USTASI!' : `${myRank}. SIRADAN TAMAMLADIN`}
          </h1>
          <p className="text-xs text-[#CBD5E1]">
            Bu turdaki doğruluk ve okuma hızı performansınız kaydedildi.
          </p>
          {currentUserScore.badge && (
            <div className="inline-block mt-1 text-xs font-bold text-[#FFBE0B] bg-[#FFBE0B]/15 border border-[#FFBE0B]/40 px-3 py-1 rounded-full">
              {currentUserScore.badge}
            </div>
          )}
        </div>

        {/* 3 Metric Boxes */}
        <div className="grid grid-cols-3 gap-2.5 pt-1">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
            <div className="font-display text-xl sm:text-2xl font-bold text-[#06D6A0] tabular-nums">
              %{currentUserScore.accuracy}
            </div>
            <div className="text-[11px] text-[#94A3B8]">Doğruluk</div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
            <div className="font-display text-xl sm:text-2xl font-bold text-[#3A86FF] tabular-nums">
              {currentUserScore.durationSeconds}s
            </div>
            <div className="text-[11px] text-[#94A3B8]">{currentUserScore.wpm} Kelime/Dk</div>
          </div>

          <div className="bg-[#FFBE0B]/15 border border-[#FFBE0B]/40 rounded-2xl p-3">
            <div className="font-display text-xl sm:text-2xl font-bold text-[#FFBE0B] tabular-nums">
              +{currentUserScore.totalScore}
            </div>
            <div className="text-[11px] text-[#FDE68A]">Oda Tur Puanı</div>
          </div>
        </div>
      </div>

      {/* Word Breakdown Card */}
      {currentUserScore.wordBreakdown && currentUserScore.wordBreakdown.length > 0 && (
        <div className="bg-[#0f1930]/85 border border-white/14 rounded-[24px] p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-display text-sm font-semibold text-[#00F5D4]">
              ✦ Diksiyon & Telaffuz Detay Analizi
            </span>
            <div className="flex items-center gap-3 text-[11px] text-[#CBD5E1]">
              <span className="flex items-center gap-1 text-[#06D6A0]">
                <CheckCircle2 className="w-3.5 h-3.5" /> Doğru
              </span>
              <span className="flex items-center gap-1 text-[#FFBE0B]">
                <AlertCircle className="w-3.5 h-3.5" /> Yakın
              </span>
              <span className="flex items-center gap-1 text-[#FF006E]">
                <XCircle className="w-3.5 h-3.5" /> Kaçan
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 text-sm">
            {currentUserScore.wordBreakdown.map((item, idx) => {
              let cls = 'bg-white/5 text-[#CBD5E1] border-white/10';
              if (item.status === 'correct') {
                cls = 'bg-[#06D6A0]/20 text-[#6EE7B7] border-[#06D6A0]/45';
              } else if (item.status === 'imperfect') {
                cls = 'bg-[#FFBE0B]/20 text-[#FDE68A] border-[#FFBE0B]/45';
              } else {
                cls = 'bg-[#FF006E]/20 text-rose-200 line-through border-[#FF006E]/45';
              }

              return (
                <span
                  key={idx}
                  className={`px-3 py-1 rounded-xl border text-xs sm:text-sm font-medium ${cls}`}
                  title={item.recognizedAs ? `Algılanan: "${item.recognizedAs}"` : undefined}
                >
                  {item.word}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Room Leaderboard for this round */}
      <div className="ebru-glass-card rounded-[24px] p-5 space-y-3">
        <h2 className="text-sm font-bold text-white font-display flex items-center gap-2">
          <Trophy className="w-4 h-4 text-[#FFBE0B]" />
          <span>Tur Sıralaması</span>
        </h2>

        <div className="space-y-2">
          {sortedScores.map((score, index) => {
            const isMe = score.playerId === currentUserScore.playerId;
            return (
              <div
                key={score.playerId}
                className={`p-3 rounded-2xl border flex items-center justify-between text-xs sm:text-sm ${
                  isMe
                    ? 'bg-gradient-to-r from-[#3A86FF]/20 to-[#FF006E]/15 border-[#FFBE0B]/50 text-white font-semibold'
                    : 'bg-white/5 border-white/10 text-[#CBD5E1]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center font-display font-bold text-xs ${
                      index === 0
                        ? 'bg-[#FFBE0B] text-[#14213D]'
                        : index === 1
                        ? 'bg-slate-200 text-[#14213D]'
                        : index === 2
                        ? 'bg-amber-700 text-white'
                        : 'bg-white/10 text-[#94A3B8]'
                    }`}
                  >
                    {index + 1}
                  </div>
                  <KilimAvatar avatar={score.avatar} size={34} />
                  <div>
                    <span className="font-bold">{score.playerName}</span>
                    {isMe && <span className="text-[10px] text-[#FFBE0B] ml-1.5">(Sen)</span>}
                  </div>
                </div>

                <div className="flex items-center gap-3 sm:gap-4 text-xs tabular-nums">
                  <span className="text-[#06D6A0] font-semibold">%{score.accuracy}</span>
                  <span className="text-[#94A3B8] font-mono">{score.durationSeconds}s</span>
                  <span className="text-[#FFBE0B] font-bold font-mono">+{score.totalScore} p</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Waiting / Next Action */}
      {isWaitingForOthers ? (
        <div className="p-4 ebru-glass-card border-[#FFBE0B]/40 rounded-[22px] space-y-3 text-center">
          <div className="text-xs text-[#FDE68A] font-semibold">
            ⏳ Diğer yarışmacılar okumasını tamamlıyor ({allPlayerScores.length} / {totalPlayersCount} tamamlandı)
          </div>
          {isAutoMode && (
            <div className="text-[11px] text-[#93C5FD]">
              Otomatik ilerleme aktif · En geç <strong className="text-[#00F5D4] tabular-nums">{waitSafetyLeft} sn</strong> sonra sonuçlar açılacak.
            </div>
          )}
          {(isHost || isAutoMode) && onForceFinishRound && (
            <button
              onClick={() => {
                playTone('tap');
                onForceFinishRound();
              }}
              className="w-full py-3 rounded-2xl btn-epic-pomegranate font-bold text-xs cursor-pointer"
            >
              Beklemeyi Bitir ve Tur Sonuçlarını Aç
            </button>
          )}
        </div>
      ) : isAutoMode ? (
        <div className="p-4 ebru-glass-card border-[#00F5D4]/45 rounded-[22px] space-y-3 text-center">
          <div className="text-xs font-semibold text-[#00F5D4] flex items-center justify-center gap-2">
            <Zap className="w-4 h-4 text-[#FFBE0B]" />
            <span>
              {isFinalRound
                ? `Turnuva podyumu ${autoAdvanceLeft} sn içinde otomatik açılıyor...`
                : `Sonraki tur (${currentRound + 1}/${totalRounds}) ${autoAdvanceLeft} sn içinde otomatik başlıyor...`}
            </span>
          </div>
          <button
            onClick={() => {
              playTone('tap');
              if (autoTriggeredRef.current !== currentRound) {
                autoTriggeredRef.current = currentRound;
                onNextRound();
              }
            }}
            className="w-full py-3.5 rounded-[20px] btn-epic-turquoise font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>
              {isFinalRound ? '🏆 Final Podyumunu Hemen Aç' : `Hemen Sonraki Tura Geç (${currentRound + 1}/${totalRounds})`}
            </span>
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      ) : isHost ? (
        <button
          onClick={() => {
            playTone('tap');
            onNextRound();
          }}
          className="w-full py-4 rounded-[22px] btn-epic-pomegranate font-bold text-sm sm:text-base flex items-center justify-center gap-2 cursor-pointer"
        >
          <span>
            {isFinalRound
              ? '🏆 Turnuva Podyumu ve Final Tablosu'
              : `SONRAKİ TUR (${currentRound + 1}/${totalRounds})`}
          </span>
          <ChevronRight className="w-5 h-5" />
        </button>
      ) : (
        <div className="p-4 ebru-glass-card rounded-[22px] text-center text-xs text-[#CBD5E1] font-medium">
          ⏳ Oda kurucusunun {isFinalRound ? 'final podyumunu' : 'sonraki turu'} başlatması bekleniyor...
        </div>
      )}

      {/* Leave Room Option (Allows Host or Players to exit & rejoin via Aktif Odalar) */}
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
                  ? 'Kurucu çıksa da oyun otomatik devam eder ve Aktif Odalar üzerinden geri dönebilirsin.'
                  : 'Odadan çıkmak istediğine emin misin?'}
              </span>
              <button
                type="button"
                onClick={() => {
                  playTone('tap');
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
