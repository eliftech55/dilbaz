import React, { useId } from 'react';
import { UserProfile } from '../types/game';
import {
  PHOENIX_STAGES,
  PhoenixComputedState,
  PhoenixWingPattern,
  getFeatherPalette,
  getWingPattern,
  loadPhoenixProgress
} from '../utils/phoenixProgression';

export interface ResolvedPhoenixVisuals {
  auraId: string;
  auraRank: number;
  talismanId: string;
  talismanRank: number;
  crestId: string;
  crestRank: number;
  featherPaletteId: string;
  wingPatternId: PhoenixWingPattern['id'];
  ringGradient: string;
  glowColor: string;
  isEvolved: boolean;
}

export function resolveEquippedVisuals(phoenix?: PhoenixComputedState): ResolvedPhoenixVisuals {
  if (phoenix) {
    const auraId = phoenix.activeAura?.id || 'aura_ebru_cyan';
    const auraRank = phoenix.relics.find((r) => r.id === auraId)?.rank || 1;
    const talismanId = phoenix.activeTalisman?.id || '';
    const talismanRank = talismanId
      ? phoenix.relics.find((r) => r.id === talismanId)?.rank || 1
      : 0;
    const crestId = phoenix.activeCrest?.id || '';
    const crestRank = crestId ? phoenix.relics.find((r) => r.id === crestId)?.rank || 1 : 0;
    const featherPaletteId = phoenix.activeFeatherPalette?.id || 'ebru_classic';
    const wingPatternId = phoenix.activeWingPattern?.id || 'ebru_wave';
    const palette = getFeatherPalette(featherPaletteId);

    const ringGradient =
      featherPaletteId !== 'ebru_classic'
        ? palette.ringGradient
        : auraId === 'aura_pomegranate_flame'
        ? 'from-[#FF006E] via-[#FF5400] to-[#FFBE0B]'
        : crestId === 'crest_celestial_halo'
        ? 'from-[#FFBE0B] via-[#00F5D4] to-[#FF006E]'
        : phoenix.stage.ringGradient;

    const glowColor =
      featherPaletteId !== 'ebru_classic'
        ? palette.primaryColor
        : auraId === 'aura_pomegranate_flame'
        ? '#FF006E'
        : crestId === 'crest_celestial_halo'
        ? '#FFBE0B'
        : phoenix.activeAura?.glowColor || '#00F5D4';

    return {
      auraId,
      auraRank,
      talismanId,
      talismanRank,
      crestId,
      crestRank,
      featherPaletteId,
      wingPatternId,
      ringGradient,
      glowColor,
      isEvolved: phoenix.stage.useEvolvedArt || crestId === 'crest_celestial_halo'
    };
  }

  const prog = loadPhoenixProgress();
  const auraId = prog.equipped.aura || 'aura_ebru_cyan';
  const auraRank = Math.max(1, prog.itemRanks[auraId] || 1);
  const talismanId = prog.equipped.talisman || '';
  const talismanRank = talismanId ? Math.max(1, prog.itemRanks[talismanId] || 1) : 0;
  const crestId = prog.equipped.crest || '';
  const crestRank = crestId ? Math.max(1, prog.itemRanks[crestId] || 1) : 0;
  const featherPaletteId = prog.featherPaletteId || 'ebru_classic';
  const wingPatternId = prog.wingPatternId || 'ebru_wave';
  const palette = getFeatherPalette(featherPaletteId);

  const ringGradient =
    featherPaletteId !== 'ebru_classic'
      ? palette.ringGradient
      : auraId === 'aura_pomegranate_flame'
      ? 'from-[#FF006E] via-[#FF5400] to-[#FFBE0B]'
      : crestId === 'crest_celestial_halo'
      ? 'from-[#FFBE0B] via-[#00F5D4] to-[#FF006E]'
      : 'from-[#00F5D4] via-[#3A86FF] to-[#FFBE0B]';

  const glowColor =
    featherPaletteId !== 'ebru_classic'
      ? palette.primaryColor
      : auraId === 'aura_pomegranate_flame'
      ? '#FF006E'
      : crestId === 'crest_celestial_halo'
      ? '#FFBE0B'
      : '#00F5D4';

  return {
    auraId,
    auraRank,
    talismanId,
    talismanRank,
    crestId,
    crestRank,
    featherPaletteId,
    wingPatternId,
    ringGradient,
    glowColor,
    isEvolved: crestId === 'crest_celestial_halo'
  };
}

export function resolveVisualsFromPublicProfile(
  profile?: Partial<UserProfile> | null
): ResolvedPhoenixVisuals {
  const auraId = profile?.phoenixAuraId || 'aura_ebru_cyan';
  const talismanId = profile?.phoenixTalismanId || '';
  const crestId = profile?.phoenixCrestId || '';
  const featherPaletteId = profile?.phoenixPaletteId || 'ebru_classic';
  const wingPatternId = getWingPattern(profile?.phoenixPatternId).id;
  const palette = getFeatherPalette(featherPaletteId);
  const level = profile?.phoenixLevel ?? 1;
  const stage =
    PHOENIX_STAGES.find((s) => s.id === profile?.phoenixStageId) ||
    PHOENIX_STAGES.filter((s) => level >= s.minLevel).slice(-1)[0] ||
    PHOENIX_STAGES[0];

  const ringGradient =
    featherPaletteId !== 'ebru_classic'
      ? palette.ringGradient
      : auraId === 'aura_pomegranate_flame'
      ? 'from-[#FF006E] via-[#FF5400] to-[#FFBE0B]'
      : crestId === 'crest_celestial_halo'
      ? 'from-[#FFBE0B] via-[#00F5D4] to-[#FF006E]'
      : stage.ringGradient;

  const glowColor =
    featherPaletteId !== 'ebru_classic'
      ? palette.primaryColor
      : auraId === 'aura_pomegranate_flame'
      ? '#FF006E'
      : crestId === 'crest_celestial_halo'
      ? '#FFBE0B'
      : '#00F5D4';

  return {
    auraId,
    auraRank: 1,
    talismanId,
    talismanRank: talismanId ? 1 : 0,
    crestId,
    crestRank: crestId ? 1 : 0,
    featherPaletteId,
    wingPatternId,
    ringGradient,
    glowColor,
    isEvolved: stage.useEvolvedArt || crestId === 'crest_celestial_halo' || level >= 8
  };
}

interface PhoenixCharacterRelicOverlayProps {
  visuals: ResolvedPhoenixVisuals;
  compact?: boolean;
}

export const PhoenixCharacterRelicOverlay: React.FC<PhoenixCharacterRelicOverlayProps> = ({
  visuals,
  compact = false
}) => {
  const uid = useId().replace(/:/g, '');
  const { auraId, auraRank, talismanId, talismanRank, crestId, crestRank } = visuals;
  const isFlameAura = auraId === 'aura_pomegranate_flame';

  const talismanSizeClass = compact ? 'w-[34%] h-[34%]' : 'w-[30%] h-[30%]';
  const crownSizeClass = compact ? 'w-[60%] -top-[20%]' : 'w-[54%] -top-[21%]';

  return (
    <>
      {/* 1. Celestial Halo Sunburst Ring (behind character frame) */}
      {crestId === 'crest_celestial_halo' && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-[16%] z-[5] flex items-center justify-center"
        >
          <svg
            viewBox="0 0 120 120"
            className="w-full h-full animate-relic-halo"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id={`haloRay_${uid}`} x1="0" y1="0" x2="120" y2="120" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#FFBE0B" />
                <stop offset="50%" stopColor="#00F5D4" />
                <stop offset="100%" stopColor="#FF006E" />
              </linearGradient>
            </defs>
            <circle
              cx="60"
              cy="60"
              r="52"
              stroke={`url(#haloRay_${uid})`}
              strokeWidth={crestRank >= 2 ? '2.4' : '1.6'}
              strokeDasharray="6 5"
              opacity={0.75 + crestRank * 0.08}
            />
            {Array.from({ length: 12 }).map((_, idx) => {
              const angle = (idx * 30 * Math.PI) / 180;
              const x1 = 60 + Math.cos(angle) * 47;
              const y1 = 60 + Math.sin(angle) * 47;
              const x2 = 60 + Math.cos(angle) * (idx % 2 === 0 ? 58 : 54);
              const y2 = 60 + Math.sin(angle) * (idx % 2 === 0 ? 58 : 54);
              return (
                <line
                  key={idx}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={idx % 2 === 0 ? '#FFBE0B' : '#00F5D4'}
                  strokeWidth={idx % 2 === 0 ? '2' : '1.3'}
                  strokeLinecap="round"
                  opacity="0.85"
                />
              );
            })}
          </svg>
        </div>
      )}

      {/* 2. Equipped Aura Visual (Flame Wisps OR Ebru Turquoise Stardust) */}
      {isFlameAura ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-[10%] z-[14]"
        >
          {/* Radiant crimson-amber corona ring */}
          <div
            className="absolute inset-0 rounded-full border-2 border-[#FF5400]/75 animate-pulse"
            style={{
              boxShadow: `0 0 ${14 + auraRank * 6}px rgba(255, 0, 110, ${0.45 + auraRank * 0.12}), inset 0 0 ${10 + auraRank * 4}px rgba(255, 190, 11, 0.45)`
            }}
          />
          {/* Floating Flame Plumes */}
          <svg
            viewBox="0 0 32 40"
            className="w-[22%] h-[26%] absolute -bottom-[2%] -left-[2%] animate-relic-ember drop-shadow-[0_0_8px_rgba(255,0,110,0.9)]"
            fill="none"
          >
            <path
              d="M16 3C18 11 27 16 27 25C27 32 22 37 16 37C10 37 5 32 5 25C5 18 11 13 16 3Z"
              fill="#FF006E"
            />
            <path
              d="M16 14C18 19 22 22 22 27C22 31 19 34 16 34C13 34 10 31 10 27C10 22 13 18 16 14Z"
              fill="#FFBE0B"
            />
          </svg>
          <svg
            viewBox="0 0 32 40"
            className="w-[20%] h-[24%] absolute top-[12%] -right-[5%] animate-relic-ember drop-shadow-[0_0_8px_rgba(255,84,0,0.9)]"
            style={{ animationDelay: '0.8s' }}
            fill="none"
          >
            <path
              d="M16 3C18 11 27 16 27 25C27 32 22 37 16 37C10 37 5 32 5 25C5 18 11 13 16 3Z"
              fill="#FF5400"
            />
            <path
              d="M16 15C18 19 21 22 21 27C21 31 19 33 16 33C13 33 11 31 11 27C11 22 13 19 16 15Z"
              fill="#FFBE0B"
            />
          </svg>
          {auraRank >= 2 && (
            <svg
              viewBox="0 0 32 40"
              className="w-[18%] h-[22%] absolute top-[8%] -left-[5%] animate-relic-ember drop-shadow-[0_0_8px_rgba(255,190,11,0.9)]"
              style={{ animationDelay: '1.4s' }}
              fill="none"
            >
              <path
                d="M16 3C18 11 27 16 27 25C27 32 22 37 16 37C10 37 5 32 5 25C5 18 11 13 16 3Z"
                fill="#FF006E"
              />
              <path
                d="M16 16C18 20 21 23 21 27C21 30 19 33 16 33C13 33 11 30 11 27C11 23 13 20 16 16Z"
                fill="#FFFBEB"
              />
            </svg>
          )}
        </div>
      ) : (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-[8%] z-[14]"
        >
          <div
            className="absolute inset-0 rounded-full border border-[#00F5D4]/60"
            style={{
              boxShadow: `0 0 ${10 + auraRank * 5}px rgba(0, 245, 212, ${0.35 + auraRank * 0.1})`
            }}
          />
          {/* Turquoise Ebru Sparkles */}
          <svg
            viewBox="0 0 24 24"
            className="w-[16%] h-[16%] absolute top-[6%] -left-[3%] animate-relic-ember"
            fill="none"
          >
            <path d="M12 1L14.6 9.4L23 12L14.6 14.6L12 23L9.4 14.6L1 12L9.4 9.4L12 1Z" fill="#00F5D4" />
          </svg>
          {auraRank >= 2 && (
            <svg
              viewBox="0 0 24 24"
              className="w-[15%] h-[15%] absolute bottom-[12%] -left-[5%] animate-relic-ember"
              style={{ animationDelay: '1s' }}
              fill="none"
            >
              <path d="M12 1L14.6 9.4L23 12L14.6 14.6L12 23L9.4 14.6L1 12L9.4 9.4L12 1Z" fill="#3A86FF" />
            </svg>
          )}
          {auraRank >= 3 && (
            <svg
              viewBox="0 0 24 24"
              className="w-[14%] h-[14%] absolute top-[18%] -right-[5%] animate-relic-ember"
              style={{ animationDelay: '1.6s' }}
              fill="none"
            >
              <path d="M12 1L14.6 9.4L23 12L14.6 14.6L12 23L9.4 14.6L1 12L9.4 9.4L12 1Z" fill="#FFBE0B" />
            </svg>
          )}
        </div>
      )}

      {/* 3. Equipped Crest (Perched Clearly on Top of Head) */}
      {crestId === 'crest_golden_crown' && (
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute ${crownSizeClass} left-1/2 -translate-x-1/2 z-20 drop-shadow-[0_4px_10px_rgba(255,190,11,0.85)]`}
        >
          <svg viewBox="0 0 80 42" className="w-full h-auto" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id={`crownGold_${uid}`} x1="10" y1="6" x2="70" y2="38" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#FFF3B0" />
                <stop offset="45%" stopColor="#FFBE0B" />
                <stop offset="100%" stopColor="#FF5400" />
              </linearGradient>
            </defs>
            <path
              d="M12 35 L8 15 L25 24 L40 6 L55 24 L72 15 L68 35 C52 39 28 39 12 35 Z"
              fill={`url(#crownGold_${uid})`}
              stroke="#FFFBEB"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
            {/* Center & Side Gems */}
            <circle cx="40" cy="24" r="4.2" fill="#FF006E" stroke="#FFFBEB" strokeWidth="1.2" />
            <circle cx="23" cy="28" r="2.8" fill="#00F5D4" stroke="#FFFBEB" strokeWidth="1" />
            <circle cx="57" cy="28" r="2.8" fill="#00F5D4" stroke="#FFFBEB" strokeWidth="1" />
            {crestRank >= 2 && (
              <>
                <circle cx="40" cy="5.5" r="2.6" fill="#00F5D4" />
                <circle cx="8" cy="14" r="2" fill="#FFBE0B" />
                <circle cx="72" cy="14" r="2" fill="#FFBE0B" />
              </>
            )}
          </svg>
        </div>
      )}

      {crestId === 'crest_celestial_halo' && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-[21%] left-1/2 -translate-x-1/2 w-[66%] z-20 drop-shadow-[0_0_12px_rgba(255,190,11,0.95)]"
        >
          <svg viewBox="0 0 96 34" className="w-full h-auto" fill="none" xmlns="http://www.w3.org/2000/svg">
            <ellipse
              cx="48"
              cy="19"
              rx="38"
              ry="9.5"
              stroke="#FFBE0B"
              strokeWidth={crestRank >= 2 ? '4.2' : '3.2'}
            />
            <ellipse
              cx="48"
              cy="19"
              rx="38"
              ry="9.5"
              stroke="#FFFBEB"
              strokeWidth="1.2"
              opacity="0.9"
            />
            <path d="M48 2 L50.8 10.5 L59 13 L50.8 15.5 L48 24 L45.2 15.5 L37 13 L45.2 10.5 Z" fill="#00F5D4" />
          </svg>
        </div>
      )}

      {/* 4. Equipped Talisman (Prominent Medallion on Lower-Right Edge) */}
      {talismanId === 'talisman_nazar' && (
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute -bottom-[4%] -right-[4%] ${talismanSizeClass} z-20 animate-relic-talisman`}
        >
          <svg viewBox="0 0 48 48" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="24" cy="24" r="21" fill="#0d1629" stroke="#FFBE0B" strokeWidth={talismanRank >= 2 ? '3.5' : '2.4'} />
            <circle cx="24" cy="24" r="17" fill="#1D4ED8" />
            <circle cx="24" cy="24" r="11.5" fill="#F8FAFC" />
            <circle cx="24" cy="24" r="7.5" fill="#00F5D4" />
            <circle cx="24" cy="24" r="3.8" fill="#090e1a" />
            <circle cx="21.5" cy="21.5" r="1.7" fill="#FFFFFF" />
          </svg>
        </div>
      )}

      {talismanId === 'talisman_speed_bolt' && (
        <>
          {/* Emerald-Gold Lightning Star Medallion */}
          <div
            aria-hidden="true"
            className={`pointer-events-none absolute -bottom-[4%] -right-[4%] ${talismanSizeClass} z-20 animate-relic-talisman`}
          >
            <svg viewBox="0 0 48 48" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="24" cy="24" r="21" fill="#0d1629" stroke="#06D6A0" strokeWidth={talismanRank >= 2 ? '3.5' : '2.4'} />
              <path
                d="M27 8 L14 26 H24 L21 40 L34 22 H24 L27 8 Z"
                fill="#FFBE0B"
                stroke="#FFFBEB"
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          {/* Kinetic Speed-Streak Arcs around portrait */}
          <svg
            aria-hidden="true"
            viewBox="0 0 120 120"
            className="pointer-events-none absolute -inset-[12%] z-[15]"
            fill="none"
          >
            <path
              d="M16 42 C 22 22, 42 12, 62 12"
              stroke="#06D6A0"
              strokeWidth="2.4"
              strokeLinecap="round"
              opacity="0.85"
            />
            <path
              d="M104 76 C 98 96, 78 108, 56 108"
              stroke="#FFBE0B"
              strokeWidth="2.4"
              strokeLinecap="round"
              opacity="0.85"
            />
          </svg>
        </>
      )}
    </>
  );
};
