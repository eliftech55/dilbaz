import React, { useEffect } from 'react';
import { PlayerScore } from '../types/game';
import { DilbazMascot } from './DilbazMascot';
import { KilimAvatar } from './KilimAvatar';
import { triggerCelebration } from './FxCanvas';
import { playTone } from '../utils/soundEffects';
import { Trophy, CheckCircle2, AlertCircle, XCircle, ChevronRight } from 'lucide-react';

interface RoundResultsProps {
  currentUserScore: PlayerScore;
  allPlayerScores: PlayerScore[];
  currentRound: number;
  totalRounds: number;
  totalPlayersCount?: number;
  isWaitingForOthers?: boolean;
  isHost?: boolean;
  onForceFinishRound?: () => void;
  onNextRound: () => void;
}

export const RoundResults: React.FC<RoundResultsProps> = ({
  currentUserScore,
  allPlayerScores,
  currentRound,
  totalRounds,
  totalPlayersCount = 1,
  isWaitingForOthers = false,
  isHost = true,
  onForceFinishRound,
  onNextRound
}) => {
  const sortedScores = [...allPlayerScores].sort((a, b) => b.totalScore - a.totalScore);
  const myRank = Math.max(1, sortedScores.findIndex((s) => s.playerId === currentUserScore.playerId) + 1);

  useEffect(() => {
    if (!isWaitingForOthers && (myRank === 1 || currentUserScore.accuracy >= 70)) {
      playTone('victory');
      triggerCelebration({ xRatio: 0.5, yRatio: 0.25, count: 48 });
    }
  }, [myRank, isWaitingForOthers, currentUserScore.accuracy]);

  const isFinalRound = currentRound >= totalRounds;

  return (
    <div className="max-w-2xl mx-auto space-y-5 animate-screen-in">
      {/* Victory Card */}
      <div className="ebru-glass-card border-[1.5px] border-[#FFBE0B]/45 rounded-[28px] p-5 sm:p-6 text-center space-y-4">
        <div className="flex justify-center">
          <DilbazMascot mood={currentUserScore.accuracy >= 50 ? 'excited' : 'sad'} size={90} />
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
            <div className="font-display text-xl sm:text-2xl font-bold text-[#06D6A0]">
              %{currentUserScore.accuracy}
            </div>
            <div className="text-[11px] text-[#94A3B8]">Doğruluk</div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
            <div className="font-display text-xl sm:text-2xl font-bold text-[#3A86FF]">
              {currentUserScore.durationSeconds}s
            </div>
            <div className="text-[11px] text-[#94A3B8]">{currentUserScore.wpm} Kelime/Dk</div>
          </div>

          <div className="bg-[#FFBE0B]/15 border border-[#FFBE0B]/40 rounded-2xl p-3">
            <div className="font-display text-xl sm:text-2xl font-bold text-[#FFBE0B]">
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

                <div className="flex items-center gap-3 sm:gap-4 text-xs">
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
          {isHost && onForceFinishRound && (
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
      ) : isHost ? (
        <button
          onClick={() => {
            playTone('tap');
            onNextRound();
          }}
          className="w-full py-4 rounded-[22px] btn-epic-pomegranate font-bold text-sm sm:text-base flex items-center justify-center gap-2 cursor-pointer"
        >
          <span>{isFinalRound ? '🏆 Turnuva Podyumu ve Final Tablosu' : `SONRAKİ TUR (${currentRound + 1}/${totalRounds})`}</span>
          <ChevronRight className="w-5 h-5" />
        </button>
      ) : (
        <div className="p-4 ebru-glass-card rounded-[22px] text-center text-xs text-[#CBD5E1] font-medium">
          ⏳ Oda kurucusunun {isFinalRound ? 'final podyumunu' : 'sonraki turu'} başlatması bekleniyor...
        </div>
      )}
    </div>
  );
};
