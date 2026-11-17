import React, { useId, useState } from 'react';
import { playTone } from '../utils/soundEffects';
import {
  PhoenixDifficultyInput,
  PhoenixWingPattern,
  computeLevelFromXp,
  getFeatherPalette,
  getPhoenixFlapSpeed,
  loadPhoenixProgress
} from '../utils/phoenixProgression';
import {
  PhoenixCharacterRelicOverlay,
  ResolvedPhoenixVisuals,
  resolveEquippedVisuals
} from './PhoenixEquippedVisuals';
import zumruduankaHeroImg from '../assets/images/zumruduanka_hero_1794737139184.jpg';
import zumruduankaEvolvedImg from '../assets/images/zumruduanka_evolved_1794737131544.jpg';

export type MascotMood = 'happy' | 'sad' | 'excited';

interface PhoenixWingPairProps {
  compact?: boolean;
  auraId?: string;
  auraRank?: number;
  talismanId?: string;
  featherPaletteId?: string;
  wingPatternId?: PhoenixWingPattern['id'];
}

export const PhoenixWingPair: React.FC<PhoenixWingPairProps> = ({
  compact = false,
  auraId,
  auraRank,
  talismanId,
  featherPaletteId,
  wingPatternId
}) => {
  const uid = useId().replace(/:/g, '');
  const leftGradId = `phoenixWingL_${uid}`;
  const rightGradId = `phoenixWingR_${uid}`;

  const resolved = resolveEquippedVisuals();
  const activeAuraId = auraId ?? resolved.auraId;
  const activeAuraRank = auraRank ?? resolved.auraRank;
  const activeTalismanId = talismanId ?? resolved.talismanId;
  const activePaletteId = featherPaletteId ?? resolved.featherPaletteId;
  const activePatternId = wingPatternId ?? resolved.wingPatternId;

  const isFlame = activeAuraId === 'aura_pomegranate_flame';
  const hasSpeedTrail = activeTalismanId === 'talisman_speed_bolt';
  const palette = getFeatherPalette(activePaletteId);

  const sideOffset = compact ? '-left-[30%]' : '-left-[42%]';
  const rightOffset = compact ? '-right-[30%]' : '-right-[42%]';
  const wingWidthClass = compact ? 'w-[62%] h-[78%]' : 'w-[70%] h-[86%]';

  const stop0 =
    activePaletteId !== 'ebru_classic'
      ? palette.primaryColor
      : isFlame
      ? '#FF006E'
      : '#00F5D4';
  const stop1 =
    activePaletteId !== 'ebru_classic'
      ? palette.secondaryColor
      : isFlame
      ? '#FF5400'
      : '#3A86FF';
  const stop2 =
    activePaletteId !== 'ebru_classic'
      ? palette.accentColor
      : isFlame
      ? '#FFBE0B'
      : '#06D6A0';
  const covertFill =
    activePaletteId !== 'ebru_classic'
      ? palette.secondaryColor
      : isFlame
      ? '#FFBE0B'
      : '#3A86FF';
  const ribStroke = palette.accentColor || '#FFFBEB';

  const renderPatternAccents = (side: 'left' | 'right') => {
    const isLeft = side === 'left';
    if (activePatternId === 'peacock_eye') {
      return (
        <>
          <circle cx={isLeft ? 16 : 48} cy="16" r="3.4" fill={palette.accentColor} opacity="0.9" />
          <circle cx={isLeft ? 16 : 48} cy="16" r="1.7" fill="#0d1629" />
          <circle cx={isLeft ? 26 : 38} cy="28" r="2.6" fill={palette.primaryColor} opacity="0.9" />
          <circle cx={isLeft ? 26 : 38} cy="28" r="1.2" fill="#0d1629" />
        </>
      );
    }
    if (activePatternId === 'royal_filigree') {
      return (
        <path
          d={
            isLeft
              ? 'M52 29 C 38 22, 24 14, 10 12 M48 37 C 34 34, 22 33, 12 31'
              : 'M12 29 C 26 22, 40 14, 54 12 M16 37 C 30 34, 42 33, 52 31'
          }
          stroke="#FFBE0B"
          strokeWidth="1.5"
          strokeDasharray="3 2.5"
          strokeLinecap="round"
          opacity="0.9"
        />
      );
    }
    if (activePatternId === 'flame_streak') {
      return (
        <path
          d={
            isLeft
              ? 'M42 22 L 16 11 M44 31 L 14 27'
              : 'M22 22 L 48 11 M20 31 L 50 27'
          }
          stroke="#FFBE0B"
          strokeWidth="1.8"
          strokeLinecap="round"
          opacity="0.88"
        />
      );
    }
    if (activePatternId === 'star_bolt') {
      return (
        <path
          d={
            isLeft
              ? 'M20 14 L 22 18 L 26 19 L 22 21 L 20 25 L 18 21 L 14 19 L 18 18 Z'
              : 'M44 14 L 46 18 L 50 19 L 46 21 L 44 25 L 42 21 L 38 19 L 42 18 Z'
          }
          fill="#FFFBEB"
          opacity="0.92"
        />
      );
    }
    return null;
  };

  return (
    <>
      {/* Left Animated Wing */}
      <span
        aria-hidden="true"
        className={`pointer-events-none select-none absolute top-1/2 -translate-y-[54%] ${sideOffset} ${wingWidthClass} z-0 flex items-center justify-end`}
      >
        <svg
          viewBox="0 0 64 56"
          className="w-full h-full animate-phoenix-wing-left overflow-visible"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id={leftGradId} x1="4" y1="10" x2="62" y2="48" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor={stop0} />
              <stop offset="48%" stopColor={stop1} />
              <stop offset="100%" stopColor={stop2} />
            </linearGradient>
          </defs>
          {/* Upper primary feather */}
          <path
            d="M59 32 C 42 18, 22 6, 4 10 C 12 20, 26 28, 56 35 Z"
            fill={`url(#${leftGradId})`}
            opacity={0.92 + Math.min(0.08, activeAuraRank * 0.025)}
          />
          {/* Middle secondary feather */}
          <path
            d="M58 35 C 40 28, 22 23, 8 27 C 18 34, 34 39, 57 38 Z"
            fill={`url(#${leftGradId})`}
            opacity="0.84"
          />
          {/* Lower covert feather */}
          <path
            d="M58 38 C 44 38, 30 39, 17 44 C 27 47, 42 46, 57 41 Z"
            fill={covertFill}
            opacity="0.78"
          />
          <path
            d="M55 34 C 38 25, 22 17, 10 14"
            stroke={ribStroke}
            strokeWidth={activeAuraRank >= 2 ? '1.8' : '1.4'}
            strokeLinecap="round"
            opacity="0.78"
          />
          {renderPatternAccents('left')}
          {hasSpeedTrail && (
            <path
              d="M36 10 C 22 6, 10 4, 2 6"
              stroke="#06D6A0"
              strokeWidth="1.6"
              strokeLinecap="round"
              opacity="0.85"
            />
          )}
        </svg>
      </span>

      {/* Right Animated Wing */}
      <span
        aria-hidden="true"
        className={`pointer-events-none select-none absolute top-1/2 -translate-y-[54%] ${rightOffset} ${wingWidthClass} z-0 flex items-center justify-start`}
      >
        <svg
          viewBox="0 0 64 56"
          className="w-full h-full animate-phoenix-wing-right overflow-visible"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id={rightGradId} x1="60" y1="10" x2="2" y2="48" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor={stop0} />
              <stop offset="48%" stopColor={stop1} />
              <stop offset="100%" stopColor={stop2} />
            </linearGradient>
          </defs>
          {/* Upper primary feather */}
          <path
            d="M5 32 C 22 18, 42 6, 60 10 C 52 20, 38 28, 8 35 Z"
            fill={`url(#${rightGradId})`}
            opacity={0.92 + Math.min(0.08, activeAuraRank * 0.025)}
          />
          {/* Middle secondary feather */}
          <path
            d="M6 35 C 24 28, 42 23, 56 27 C 46 34, 30 39, 7 38 Z"
            fill={`url(#${rightGradId})`}
            opacity="0.84"
          />
          {/* Lower covert feather */}
          <path
            d="M6 38 C 20 38, 34 39, 47 44 C 37 47, 22 46, 7 41 Z"
            fill={covertFill}
            opacity="0.78"
          />
          <path
            d="M9 34 C 26 25, 42 17, 54 14"
            stroke={ribStroke}
            strokeWidth={activeAuraRank >= 2 ? '1.8' : '1.4'}
            strokeLinecap="round"
            opacity="0.78"
          />
          {renderPatternAccents('right')}
          {hasSpeedTrail && (
            <path
              d="M28 10 C 42 6, 54 4, 62 6"
              stroke="#06D6A0"
              strokeWidth="1.6"
              strokeLinecap="round"
              opacity="0.85"
            />
          )}
        </svg>
      </span>
    </>
  );
};

interface DilbazMascotProps {
  mood?: MascotMood;
  size?: number;
  className?: string;
  onClick?: () => void;
  title?: string;
  level?: number;
  difficulty?: PhoenixDifficultyInput | null;
  showWings?: boolean;
  useEvolvedArt?: boolean;
  visualsOverride?: ResolvedPhoenixVisuals;
}

export const DilbazMascot: React.FC<DilbazMascotProps> = ({
  mood = 'happy',
  size = 72,
  className = '',
  onClick,
  title = "Zümrüdüanka'ya dokun!",
  level,
  difficulty,
  showWings = true,
  useEvolvedArt,
  visualsOverride
}) => {
  const [bouncing, setBouncing] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  const visuals = visualsOverride || resolveEquippedVisuals();

  const handleTap = () => {
    playTone('tap');
    setBouncing(false);
    requestAnimationFrame(() => setBouncing(true));
    setTimeout(() => setBouncing(false), 680);
    onClick?.();
  };

  const auraRing =
    visuals.featherPaletteId !== 'ebru_classic'
      ? `${visuals.ringGradient} shadow-[0_0_16px_${visuals.glowColor}80]`
      : visuals.auraId === 'aura_pomegranate_flame'
      ? 'from-[#FF006E] via-[#FF5400] to-[#FFBE0B] shadow-[0_0_20px_rgba(255,0,110,0.6)]'
      : mood === 'excited'
      ? 'from-[#FFBE0B] via-[#FF006E] to-[#00F5D4] shadow-[0_0_18px_rgba(255,190,11,0.55)]'
      : mood === 'sad'
      ? 'from-[#3A86FF] via-[#64748B] to-[#FF006E] shadow-[0_0_12px_rgba(58,134,255,0.35)]'
      : `${visuals.ringGradient} shadow-[0_0_15px_rgba(0,245,212,0.45)]`;

  const hasExplicitTempo = level !== undefined || difficulty !== undefined;
  const resolvedLevel =
    level ?? computeLevelFromXp(loadPhoenixProgress().soloXp).level;
  const flapStyle = hasExplicitTempo
    ? ({
        '--phoenix-flap-duration': `${getPhoenixFlapSpeed({ level: resolvedLevel, difficulty }).durationSeconds}s`
      } as React.CSSProperties)
    : undefined;

  const isEvolved = useEvolvedArt ?? (visuals.isEvolved || resolvedLevel >= 8);
  const birdSrc = isEvolved ? zumruduankaEvolvedImg : zumruduankaHeroImg;

  return (
    <button
      type="button"
      onClick={handleTap}
      title={title}
      className={`relative shrink-0 cursor-pointer transition-transform duration-300 hover:scale-105 focus:outline-none ${
        showWings ? 'mx-3 mt-1.5' : ''
      } ${bouncing ? 'animate-mascot-bounce' : ''} ${className}`}
      style={{ width: size, height: size, ...flapStyle }}
    >
      {showWings && (
        <PhoenixWingPair
          auraId={visuals.auraId}
          auraRank={visuals.auraRank}
          talismanId={visuals.talismanId}
          featherPaletteId={visuals.featherPaletteId}
          wingPatternId={visuals.wingPatternId}
        />
      )}

      <div
        className={`relative z-10 w-full h-full rounded-full p-[2.5px] bg-gradient-to-tr ${auraRing} animate-phoenix-bird-flap`}
      >
        <PhoenixCharacterRelicOverlay visuals={visuals} compact />
        <div className="w-full h-full rounded-full overflow-hidden bg-[#0d1629] flex items-center justify-center relative z-10">
          {!imgFailed ? (
            <img
              src={birdSrc}
              alt="Dilbaz Zümrüdüanka"
              referrerPolicy="no-referrer"
              onError={() => setImgFailed(true)}
              className="w-full h-full object-cover scale-110"
            />
          ) : (
            <svg viewBox="0 0 120 120" width="100%" height="100%" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M52 24 C 46 10, 34 10, 32 16 C 40 16, 46 21, 49 26 Z" fill="#FF006E" />
              <path d="M58 22 C 56 7, 45 5, 42 11 C 49 12, 53 18, 55 24 Z" fill="#FFBE0B" />
              <path d="M63 23 C 65 10, 56 6, 52 11 C 57 14, 60 19, 61 24 Z" fill="#00F5D4" />
              <path d="M40 52 C 40 30, 74 26, 76 50 C 78 72, 66 90, 48 88 C 38 86, 38 68, 40 52 Z" fill="#3A86FF" />
              <circle cx="60" cy="40" r="10" fill="#EDF2F4" />
              <circle cx="60" cy="40" r="5" fill="#14213D" />
              <path d="M72 38 C 86 38, 92 46, 86 54 C 83 49, 77 48, 72 48 Z" fill="#FFBE0B" />
              <circle cx="66" cy="62" r="5" fill="#1D4ED8" stroke="#FFBE0B" strokeWidth="1.5" />
              <circle cx="66" cy="62" r="2.2" fill="#00F5D4" />
            </svg>
          )}
        </div>
      </div>
    </button>
  );
};

interface MascotDialogueProps {
  message: string;
  mood?: MascotMood;
  sender?: string;
  onMascotTap?: () => void;
  level?: number;
  difficulty?: PhoenixDifficultyInput | null;
}

export const MascotDialogue: React.FC<MascotDialogueProps> = ({
  message,
  mood = 'happy',
  sender = 'Zümrüdüanka',
  onMascotTap,
  level,
  difficulty
}) => {
  return (
    <div className="flex items-center gap-3.5">
      <DilbazMascot
        mood={mood}
        size={58}
        onClick={onMascotTap}
        level={level}
        difficulty={difficulty}
      />
      <div className="relative flex-1 bg-gradient-to-r from-[#14213D]/95 to-[#1b2c4e]/90 border-[1.5px] border-[#3A86FF]/45 rounded-2xl px-3.5 py-2.5 text-xs leading-snug text-[#F1F5F9] shadow-lg speech-bubble-tail">
        <span className="font-display text-[11px] font-bold text-[#FFBE0B] block mb-0.5">
          {sender}
        </span>
        <span>{message}</span>
      </div>
    </div>
  );
};
