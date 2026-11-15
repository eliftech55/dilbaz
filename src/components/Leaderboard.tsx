import React, { useEffect, useState, useRef } from 'react';
import { Room } from '../types/game';
import { DilbazMascot } from './DilbazMascot';
import { KilimAvatar } from './KilimAvatar';
import { ComprehensiveStatsPanel } from './ComprehensiveStatsPanel';
import { triggerCelebration } from './FxCanvas';
import { claimMultiplayerWinReward, POINTS_PER_PLAYER_MULTIPLAYER_WIN } from '../firebase/authService';
import { playTone } from '../utils/soundEffects';
import { Trophy, RotateCcw, Star, Sparkles } from 'lucide-react';

interface LeaderboardProps {
  room: Room;
  currentUserId: string;
  authUid?: string | null;
  onRestartGame: () => void;
  onReturnToLobby: () => void;
  onOpenLeaderboard?: () => void;
}

export const Leaderboard: React.FC<LeaderboardProps> = ({
  room,
  currentUserId,
  authUid = null,
  onRestartGame,
  onReturnToLobby,
  onOpenLeaderboard
}) => {
  const sortedPlayers = [...room.players].sort((a, b) => b.totalPoints - a.totalPoints);
  const winner = sortedPlayers[0];
  const second = sortedPlayers[1];
  const third = sortedPlayers[2];

  const [winRewardMessage, setWinRewardMessage] = useState<string | null>(null);
  const [winRewardError, setWinRewardError] = useState<string | null>(null);
  const claimedRef = useRef<string | null>(null);

  useEffect(() => {
    playTone('fanfare');
    triggerCelebration({ xRatio: 0.3, yRatio: 0.3, count: 40 });
    setTimeout(() => triggerCelebration({ xRatio: 0.7, yRatio: 0.3, count: 40 }), 350);
  }, []);

  useEffect(() => {
    if (
      room.status !== 'game_over' ||
      room.players.length < 2 ||
      !authUid ||
      room.winnerId !== authUid
    ) {
      return;
    }

    const dynamicRewardPoints = Math.max(2, room.players.length) * POINTS_PER_PLAYER_MULTIPLAYER_WIN;
    const attemptKey = `${room.code}_${authUid}`;
    if (claimedRef.current === attemptKey) return;
    claimedRef.current = attemptKey;
    setWinRewardError(null);

    claimMultiplayerWinReward(room.code, authUid, room.players.length)
      .then((res) => {
        if (res.claimed) {
          setWinRewardMessage(
            `Tebrikler! Oda 1. liği ödülü olarak +${res.pointsAdded || dynamicRewardPoints} Dilbaz Liderlik Puanı hesabınıza eklendi!`
          );
        } else if (res.alreadyClaimed) {
          setWinRewardMessage(
            `Bu odanın 1. lik ödülü (+${res.pointsAdded || dynamicRewardPoints} Puan) hesabınıza eklendi.`
          );
        } else if (res.reason === 'solo_left') {
          setWinRewardError(
            'Odada tek başınıza kaldığınız için (diğer oyuncular ayrıldığı için) oda 1. liği puanı verilmemektedir.'
          );
        } else if (res.reason === 'no_profile') {
          setWinRewardError(
            'Ödül puanının kaydedilmesi için önce sağ üstteki profil menüsünden kullanıcı adı profilinizi tamamlayın.'
          );
        }
      })
      .catch((err: any) => {
        console.error('Win reward claim error:', err);
        setWinRewardError(
          '1. lik ödülü kaydedilirken bir bağlantı veya izin hatası oluştu. Sayfayı yenilemeden tekrar deneyebilirsiniz.'
        );
      });
  }, [room.code, room.status, room.players.length, room.winnerId, authUid]);

  const isWinnerGuest =
    room.players.length >= 2 && winner?.id === currentUserId && !authUid;

  return (
    <div className="max-w-3xl mx-auto space-y-5 animate-screen-in">
      {/* Victory Hero */}
      <div className="ebru-glass-card border-[1.5px] border-[#FFBE0B]/45 rounded-[28px] p-6 text-center space-y-2">
        <div className="flex justify-center mb-1">
          <DilbazMascot mood="excited" size={96} />
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFBE0B]/15 border border-[#FFBE0B]/40 text-[#FFBE0B] text-xs font-bold">
          <Trophy className="w-4 h-4" />
          <span>Turnuva Podyumu</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold font-display bg-gradient-to-r from-white via-[#FFBE0B] to-[#FF006E] bg-clip-text text-transparent">
          DİLBAZ ŞAMPİYONLARI
        </h1>
        <p className="text-xs text-[#CBD5E1]">
          {room.totalRounds} turluk tekerleme ve diksiyon düellosunun nihai sıralaması
        </p>

        {winRewardMessage && (
          <div className="mt-3 p-3 rounded-2xl bg-[#06D6A0]/20 border border-[#06D6A0]/50 text-emerald-100 text-xs font-bold flex items-center justify-center gap-2">
            <Sparkles className="w-4 h-4 text-[#FFBE0B] shrink-0" />
            <span>{winRewardMessage}</span>
          </div>
        )}

        {winRewardError && (
          <div className="mt-3 p-3 rounded-2xl bg-[#FF006E]/20 border border-[#FF006E]/50 text-rose-100 text-xs font-semibold">
            {winRewardError}
          </div>
        )}

        {isWinnerGuest && (
          <div className="mt-3 p-3 rounded-2xl bg-[#FFBE0B]/15 border border-[#FFBE0B]/40 text-[#FDE68A] text-xs">
            Bilgi: Oda 1. liklerinden +{Math.max(2, room.players.length) * POINTS_PER_PLAYER_MULTIPLAYER_WIN} Liderlik Puanı (Oyuncu Sayısı × {POINTS_PER_PLAYER_MULTIPLAYER_WIN}) kazanmak için yarışma öncesi giriş yapın.
          </div>
        )}
      </div>

      {/* Podium Display */}
      <div className="pt-6 pb-2 flex items-end justify-center gap-2 sm:gap-4 max-w-md mx-auto">
        {second && (
          <div className="flex-1 flex flex-col items-center">
            <div className="mb-1.5">
              <KilimAvatar avatar={second.avatar} size={44} />
            </div>
            <div className="text-xs font-bold text-[#CBD5E1] text-center truncate max-w-[90px]">
              {second.name}
            </div>
            <div className="text-[11px] font-mono text-[#94A3B8] mb-2">{second.totalPoints} p</div>
            <div className="w-full h-24 bg-gradient-to-t from-[#14213D] to-[#3A86FF]/40 rounded-t-2xl border-t-2 border-slate-300 flex flex-col items-center justify-center">
              <span className="font-display font-bold text-2xl text-slate-200">2</span>
              <span className="text-[10px] uppercase font-bold text-slate-300">Gümüş</span>
            </div>
          </div>
        )}

        {winner && (
          <div className="flex-1 flex flex-col items-center -mt-6">
            <div className="mb-1.5 animate-bounce">
              <KilimAvatar avatar={winner.avatar} size={56} />
            </div>
            <div className="text-xs sm:text-sm font-bold text-[#FFBE0B] text-center truncate max-w-[110px] flex items-center gap-1">
              <Star className="w-3.5 h-3.5 fill-[#FFBE0B] inline" />
              {winner.name}
            </div>
            <div className="text-xs font-mono font-bold text-[#FDE68A] mb-2">
              {winner.totalPoints} p
            </div>
            <div className="w-full h-36 bg-gradient-to-t from-[#FF006E]/55 via-[#FF5400]/45 to-[#FFBE0B]/60 rounded-t-2xl border-t-4 border-[#FFBE0B] flex flex-col items-center justify-center shadow-lg shadow-[#FFBE0B]/25">
              <span className="text-2xl">👑</span>
              <span className="font-display font-bold text-3xl text-white">1</span>
              <span className="text-[10px] uppercase font-bold text-[#FEF08A]">Söz Sultanı</span>
            </div>
          </div>
        )}

        {third && (
          <div className="flex-1 flex flex-col items-center">
            <div className="mb-1.5">
              <KilimAvatar avatar={third.avatar} size={44} />
            </div>
            <div className="text-xs font-bold text-amber-300 text-center truncate max-w-[90px]">
              {third.name}
            </div>
            <div className="text-[11px] font-mono text-[#94A3B8] mb-2">{third.totalPoints} p</div>
            <div className="w-full h-20 bg-gradient-to-t from-[#14213D] to-[#FF006E]/30 rounded-t-2xl border-t-2 border-amber-600 flex flex-col items-center justify-center">
              <span className="font-display font-bold text-2xl text-amber-400">3</span>
              <span className="text-[10px] uppercase font-bold text-amber-300">Bronz</span>
            </div>
          </div>
        )}
      </div>

      {/* Full Leaderboard Table */}
      <div className="ebru-glass-card rounded-[24px] p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#00F5D4] font-display">
            ✦ Nihai Turnuva Tablosu
          </h2>
          {onOpenLeaderboard && (
            <button
              type="button"
              onClick={() => {
                playTone('tap');
                onOpenLeaderboard();
              }}
              className="text-xs font-bold text-[#FFBE0B] hover:underline cursor-pointer"
            >
              Liderlik Panosunu Aç &rarr;
            </button>
          )}
        </div>

        <div className="space-y-2">
          {sortedPlayers.map((player, idx) => {
            const isMe = player.id === currentUserId;
            return (
              <div
                key={player.id}
                className={`p-3.5 rounded-2xl border flex items-center justify-between transition-all ${
                  isMe
                    ? 'bg-gradient-to-r from-[#3A86FF]/20 to-[#FF006E]/15 border-[#FFBE0B]/50 text-white'
                    : 'bg-white/5 border-white/10 text-[#CBD5E1]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-xl bg-white/10 font-bold font-mono text-xs flex items-center justify-center text-[#00F5D4]">
                    #{idx + 1}
                  </div>
                  <KilimAvatar avatar={player.avatar} size={36} />
                  <div className="text-sm font-bold flex items-center gap-1.5">
                    {player.name}
                    {isMe && <span className="text-[10px] font-mono text-[#FFBE0B]">(Sen)</span>}
                  </div>
                </div>

                <div className="text-base font-bold font-mono text-[#FFBE0B]">
                  {player.totalPoints} puan
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Comprehensive Performance Statistics & Bar Chart Panel */}
      <ComprehensiveStatsPanel room={room} currentUserId={currentUserId} />

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={() => {
            playTone('tap');
            onReturnToLobby();
          }}
          className="flex-1 py-3.5 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 text-white text-xs font-bold transition-colors cursor-pointer"
        >
          Odadan Çık (Lobiye Dön)
        </button>

        <button
          onClick={() => {
            playTone('tap');
            onRestartGame();
          }}
          className="flex-1 py-3.5 rounded-2xl btn-epic-pomegranate font-bold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
          <span>YENİDEN BAŞLAT</span>
        </button>
      </div>
    </div>
  );
};
