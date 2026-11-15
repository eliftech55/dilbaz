import React, { useState } from 'react';
import { User } from 'firebase/auth';
import { UserProfile } from '../types/game';
import { PhoenixComputedState, PhoenixDifficultyInput, getPhoenixFlapSpeed } from '../utils/phoenixProgression';
import { KilimAvatar } from './KilimAvatar';
import { PhoenixWingPair } from './DilbazMascot';
import { PhoenixCharacterRelicOverlay, resolveEquippedVisuals } from './PhoenixEquippedVisuals';
import { playTone } from '../utils/soundEffects';
import { Sparkles, Flame, Shield, Crown, Zap, LogIn, Backpack, ChevronRight, Feather } from 'lucide-react';
import zumruduankaHeroImg from '../assets/images/zumruduanka_hero_1794737139184.jpg';
import zumruduankaEvolvedImg from '../assets/images/zumruduanka_evolved_1794737131544.jpg';
import zumruduankaRelicImg from '../assets/images/zumruduanka_relics_1794737130585.jpg';
import stageBackdropImg from '../assets/images/ebru_stage_backdrop_1794737129769.jpg';

const PHOENIX_QUIPS = [
  'Kanatlarım hazır, söz senin!',
  'Hızlı ve net telaffuzla parlayalım!',
  'Yeni tılsımlarla gücümü artır!',
  'Ebru rüzgarı arkamızda!'
];

interface PhoenixHeroHubProps {
  phoenix: PhoenixComputedState;
  authUser: User | null;
  userProfile: UserProfile | null;
  activeDifficulty?: PhoenixDifficultyInput | null;
  onOpenSanctuary: () => void;
  onOpenAuth?: () => void;
}

export const PhoenixHeroHub: React.FC<PhoenixHeroHubProps> = ({
  phoenix,
  authUser,
  userProfile,
  activeDifficulty = 'kolay',
  onOpenSanctuary,
  onOpenAuth
}) => {
  const [tapCount, setTapCount] = useState(0);
  const [quipText, setQuipText] = useState<string | null>(null);
  const [bgFailed, setBgFailed] = useState(false);
  const [heroFailed, setHeroFailed] = useState(false);
  const [relicFailed, setRelicFailed] = useState(false);

  const visuals = resolveEquippedVisuals(phoenix);
  const isEvolved = visuals.isEvolved;
  const characterImg = isEvolved ? zumruduankaEvolvedImg : zumruduankaHeroImg;

  const handlePhoenixTap = () => {
    playTone('hint');
    const nextCount = tapCount + 1;
    setTapCount(nextCount);
    setQuipText(PHOENIX_QUIPS[nextCount % PHOENIX_QUIPS.length]);
    setTimeout(() => {
      setQuipText((curr) =>
        curr === PHOENIX_QUIPS[nextCount % PHOENIX_QUIPS.length] ? null : curr
      );
    }, 2600);
  };

  const auraGlow = visuals.glowColor;
  const flapInfo = getPhoenixFlapSpeed({
    level: phoenix.level,
    difficulty: activeDifficulty
  });

  const renderEquippedSlotIcon = (
    badge: 'feather' | 'nazar' | 'flame' | 'crown' | 'bolt' | 'halo'
  ) => {
    switch (badge) {
      case 'nazar':
        return <Shield className="w-3.5 h-3.5 text-[#3A86FF]" />;
      case 'flame':
        return <Flame className="w-3.5 h-3.5 text-[#FF006E]" />;
      case 'crown':
      case 'halo':
        return <Crown className="w-3.5 h-3.5 text-[#FFBE0B]" />;
      case 'bolt':
        return <Zap className="w-3.5 h-3.5 text-[#06D6A0]" />;
      default:
        return <Sparkles className="w-3.5 h-3.5 text-[#00F5D4]" />;
    }
  };

  return (
    <section className="relative overflow-hidden rounded-[30px] game-card-3d border border-white/15">
      {/* Sanctuary 3D Atmospheric Backdrop */}
      <div className="absolute inset-0 pointer-events-none">
        {!bgFailed && (
          <img
            src={stageBackdropImg}
            alt=""
            aria-hidden="true"
            referrerPolicy="no-referrer"
            onError={() => setBgFailed(true)}
            className="w-full h-full object-cover object-center opacity-50 scale-105"
          />
        )}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(13,22,41,0.45) 0%, rgba(13,22,41,0.78) 65%, rgba(13,22,41,0.96) 100%)'
          }}
        />
      </div>

      <div className="relative z-10 p-4 sm:p-5 space-y-4">
        {/* Compact Top Bar: Player Identity + Sparks Balance */}
        <div className="flex items-center justify-between gap-2">
          {authUser && userProfile ? (
            <button
              type="button"
              onClick={() => {
                playTone('tap');
                onOpenAuth?.();
              }}
              className="min-h-[40px] flex items-center gap-2 pr-3 pl-1.5 py-1 rounded-2xl bg-[#0d1629]/80 hover:bg-[#14213D] border border-white/12 transition-colors cursor-pointer min-w-0"
            >
              <KilimAvatar avatar={userProfile.avatar} size={28} />
              <span className="text-xs font-bold text-white truncate max-w-[130px]">
                {userProfile.username}
              </span>
              <span className="text-[11px] font-mono font-bold text-[#FFBE0B] tabular-nums">
                · {userProfile.points}p
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                playTone('tap');
                onOpenAuth?.();
              }}
              className="min-h-[40px] flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-[#0d1629]/80 hover:bg-[#3A86FF]/25 border border-[#00F5D4]/35 text-xs font-bold text-[#00F5D4] transition-colors cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Giriş Yap</span>
            </button>
          )}

          {/* Kıvılcım Currency + Level */}
          <div className="flex items-center gap-3 text-xs font-display font-bold bg-[#0d1629]/80 px-3 py-1.5 rounded-2xl border border-white/12 shrink-0">
            <span className="flex items-center gap-1 text-[#FFBE0B] tabular-nums" title="Kıvılcım">
              <Sparkles className="w-3.5 h-3.5" />
              {phoenix.sparks} Kıvılcım
            </span>
          </div>
        </div>

        {/* Centerpiece: Zümrüdüanka Hero Stage */}
        <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-5">
          {/* Interactive 3D Character Pedestal */}
          <div className={`relative flex flex-col items-center shrink-0 ${visuals.crestId ? 'pt-5' : 'pt-1'}`}>
            {quipText && (
              <div className="absolute -top-3 z-30 px-3 py-1 rounded-xl bg-[#0d1629]/95 border border-[#FFBE0B]/65 text-[11px] font-bold text-[#FFBE0B] whitespace-nowrap shadow-xl animate-screen-in">
                {quipText}
              </div>
            )}

            <button
              type="button"
              onClick={handlePhoenixTap}
              aria-label="Zümrüdüanka Karakteri"
              className="relative group focus:outline-none cursor-pointer mx-7 sm:mx-8"
              style={
                {
                  '--phoenix-flap-duration': `${flapInfo.durationSeconds}s`
                } as React.CSSProperties
              }
            >
              {/* Soft reactive aura behind Zümrüdüanka */}
              <div
                className="absolute -inset-3 rounded-full blur-xl opacity-70 group-hover:opacity-95 transition-opacity animate-pulse-aura pointer-events-none"
                style={{
                  background: `radial-gradient(circle, ${auraGlow}99 0%, rgba(255,0,110,0.4) 55%, transparent 76%)`
                }}
              />

              {/* Dynamic Speed Feathered Wings (Aura & Talisman themed) */}
              <PhoenixWingPair
                auraId={visuals.auraId}
                auraRank={visuals.auraRank}
                talismanId={visuals.talismanId}
              />

              <div
                key={tapCount}
                className={`relative z-10 w-32 h-32 sm:w-36 sm:h-36 rounded-full p-[3.5px] bg-gradient-to-tr ${visuals.ringGradient} shadow-2xl animate-phoenix-bird-flap`}
                style={{
                  boxShadow: `0 14px 28px rgba(0,0,0,0.55), 0 0 28px ${auraGlow}66`
                }}
              >
                <PhoenixCharacterRelicOverlay visuals={visuals} />

                <div className="relative z-10 w-full h-full rounded-full overflow-hidden bg-[#0d1629] flex items-center justify-center">
                  {!heroFailed ? (
                    <img
                      src={characterImg}
                      alt={`Zümrüdüanka — ${phoenix.stage.name}`}
                      referrerPolicy="no-referrer"
                      onError={() => setHeroFailed(true)}
                      className="w-full h-full object-cover scale-105 group-hover:scale-110 transition-transform duration-300"
                    />
                  ) : (
                    <Sparkles className="w-12 h-12 text-[#FFBE0B]" />
                  )}
                </div>

                {/* Floating Level Badge */}
                <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 z-20 px-2.5 py-0.5 rounded-xl bg-[#0d1629] border-2 border-[#FFBE0B] text-[11px] font-display font-bold text-[#FFBE0B] whitespace-nowrap shadow-lg tabular-nums">
                  Sv. {phoenix.level}
                </div>
              </div>
            </button>
          </div>

          {/* Progression & Equipped Inventory Strip */}
          <div className="flex-1 w-full space-y-3 text-center sm:text-left">
            <div className="space-y-1">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#00F5D4]">
                DİLBAZ · ZÜMRÜDÜANKA
              </div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-white leading-tight">
                {phoenix.stage.name}
              </h1>
              <div className="text-xs text-[#CBD5E1] font-medium tabular-nums flex flex-wrap items-center justify-center sm:justify-start gap-x-2 gap-y-0.5">
                <span>
                  {phoenix.xpIntoLevel} / {phoenix.xpForNextLevel} XP · {phoenix.progress.bestWpm > 0 ? `Rekor ${phoenix.progress.bestWpm} K/Dk` : 'Söz Arenasına Hazır'}
                </span>
                <span className="inline-flex items-center gap-1 text-[#00F5D4] font-semibold">
                  <Feather className="w-3 h-3" />
                  {flapInfo.tempoLabel} ({flapInfo.durationSeconds}s)
                </span>
              </div>
            </div>

            {/* Smooth Gradient XP Bar */}
            <div className="space-y-1">
              <div className="h-3 w-full rounded-full bg-[#0d1629]/90 border border-white/12 p-0.5 overflow-hidden">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${phoenix.stage.ringGradient} transition-all duration-500`}
                  style={{ width: `${phoenix.progressPercent}%` }}
                />
              </div>
              {phoenix.nextStage && (
                <div className="text-[11px] text-[#94A3B8] text-right tabular-nums">
                  Sonraki Evre: <span className="text-[#FFBE0B] font-semibold">{phoenix.nextStage.name}</span> (Sv. {phoenix.nextStage.minLevel})
                </div>
              )}
            </div>

            {/* Compact Inventory & Upgrade Trigger Dock */}
            <div className="flex items-center gap-2 pt-0.5">
              <button
                type="button"
                onClick={() => {
                  playTone('tap');
                  onOpenSanctuary();
                }}
                className="flex-1 min-h-[46px] px-3.5 py-2 rounded-2xl bg-gradient-to-r from-[#1e325c] to-[#14213D] hover:from-[#264075] hover:to-[#1a2b4f] border border-[#FFBE0B]/40 flex items-center justify-between gap-2.5 game-tile-3d cursor-pointer"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl overflow-hidden bg-[#0d1629] border border-[#FFBE0B]/40 shrink-0 flex items-center justify-center">
                    {!relicFailed ? (
                      <img
                        src={zumruduankaRelicImg}
                        alt=""
                        referrerPolicy="no-referrer"
                        onError={() => setRelicFailed(true)}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Backpack className="w-4 h-4 text-[#FFBE0B]" />
                    )}
                  </div>
                  <div className="text-left min-w-0">
                    <div className="text-xs font-display font-bold text-white truncate flex items-center gap-1.5">
                      <span>Yuva & Envanter</span>
                      {renderEquippedSlotIcon(phoenix.activeAura.badgeIcon)}
                      {phoenix.activeTalisman &&
                        renderEquippedSlotIcon(phoenix.activeTalisman.badgeIcon)}
                      {phoenix.activeCrest &&
                        renderEquippedSlotIcon(phoenix.activeCrest.badgeIcon)}
                    </div>
                    <div className="text-[10.5px] text-[#93C5FD] truncate">
                      {phoenix.activeAura.name} · Sv.{phoenix.relics.find((r) => r.id === phoenix.activeAura.id)?.rank || 1}
                    </div>
                  </div>
                </div>
                <span className="text-xs font-bold text-[#FFBE0B] flex items-center gap-0.5 shrink-0">
                  <span>Yükselt</span>
                  <ChevronRight className="w-4 h-4" />
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
