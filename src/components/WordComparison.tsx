import React from 'react';
import { CheckCircle2, AlertCircle, XCircle } from 'lucide-react';
import { LiveWordStatus } from '../utils/scoreCalculator';
import { RumiCorners } from './EbruBackground';

interface WordComparisonProps {
  originalWords: LiveWordStatus[];
  spokenTranscript?: string;
  isListening?: boolean;
  audioLevel?: number;
  liveAccuracy?: number;
  categoryLabel?: string;
  justMatchedIndices?: number[];
}

export const WordComparison: React.FC<WordComparisonProps> = ({
  originalWords,
  spokenTranscript = '',
  isListening = false,
  audioLevel = 0,
  liveAccuracy = 0,
  categoryLabel = 'Canlı Telaffuz Kartı',
  justMatchedIndices = []
}) => {
  const correctCount = originalWords.filter((w) => w.status === 'correct').length;

  // Smoothly normalize live mic energy (0..1) so word blink/glow matches spoken voice cadence
  const voiceEnergy = isListening
    ? Math.max(0, Math.min(1, (audioLevel - 16) / 68))
    : 0;
  const isVoiceSpeaking = isListening && audioLevel >= 28;

  return (
    <div className="space-y-3">
      {/* Cohesive Deep Navy Ebru Glass Reading Card */}
      <div className="relative ebru-reading-card rounded-[26px] p-4 sm:p-6 overflow-hidden">
        {/* Subtle Ebru SVG Atmospheric Ribbons */}
        <svg
          aria-hidden="true"
          className="absolute inset-0 w-full h-full opacity-[0.18] pointer-events-none"
          viewBox="0 0 400 260"
          fill="none"
          preserveAspectRatio="none"
        >
          <path
            d="M-20 40 C 90 -10, 180 120, 310 50 C 370 20, 410 70, 430 60 L 430 140 C 300 180, 180 70, 50 130 Z"
            fill="#3A86FF"
          />
          <path
            d="M-20 185 C 110 130, 230 245, 420 160 L 420 260 L -20 260 Z"
            fill="#00F5D4"
            fillOpacity="0.45"
          />
        </svg>

        {/* Selçuklu / Rumi Köşe Motifleri */}
        <RumiCorners />

        {/* Clean Unboxed Header Strip + Live Voice Sync Meter */}
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 mb-3.5 px-1">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-xs sm:text-sm font-display font-bold tracking-wide text-[#00F5D4] truncate">
              ✦ {categoryLabel}
            </span>

            {isListening && (
              <span
                aria-label="Ses senkronizasyonu aktif"
                className="inline-flex items-end gap-[2.5px] h-3.5 shrink-0"
              >
                {[0.55, 1, 0.72].map((mult, barIdx) => {
                  const barH = Math.max(
                    28,
                    Math.round(28 + voiceEnergy * 72 * mult)
                  );
                  return (
                    <span
                      key={barIdx}
                      className="w-[3px] rounded-full transition-[height,background-color] duration-75"
                      style={{
                        height: `${barH}%`,
                        backgroundColor: isVoiceSpeaking ? '#FFBE0B' : '#3A86FF'
                      }}
                    />
                  );
                })}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs font-mono tabular-nums">
            {spokenTranscript.trim().length > 0 && (
              <>
                <span className="text-[#06D6A0] font-bold">
                  %{liveAccuracy} Doğruluk
                </span>
                <span className="text-white/30" aria-hidden="true">
                  ·
                </span>
              </>
            )}
            <span className="text-[#CBD5E1] font-semibold">
              {correctCount} / {originalWords.length} kelime
            </span>
          </div>
        </div>

        {/* Full-Visibility Reading Well: entire tekerleme text always visible, fluid clamp typography + GPU-only transitions so lines never shift */}
        <div className="ebru-reading-well relative z-10 rounded-2xl p-3.5 sm:p-5">
          <div className="word-fluid-text flex flex-wrap items-baseline gap-x-2 gap-y-2.5 sm:gap-x-2.5 sm:gap-y-3 font-display font-bold">
            {originalWords.map((item, idx) => {
              const isJustMatched = justMatchedIndices.includes(idx);
              const isCurrent = item.status === 'current' && isListening;

              let style =
                'bg-[#18294d]/90 text-[#F1F5F9] border-2 border-[#3A86FF]/28';
              let statusBadge: React.ReactNode = null;
              let dynamicStyle: React.CSSProperties | undefined;

              if (item.status === 'correct') {
                style = isJustMatched
                  ? 'bg-[#06D6A0]/28 text-[#ECFDF5] border-2 border-[#06D6A0] ring-2 ring-[#FFBE0B]/65 animate-word-pop'
                  : 'bg-[#06D6A0]/18 text-[#A7F3D0] border-2 border-[#06D6A0]/75 animate-word-pop';
                if (isJustMatched) {
                  dynamicStyle = {
                    boxShadow: `0 0 ${Math.round(12 + voiceEnergy * 18)}px rgba(6, 214, 160, ${(0.35 + voiceEnergy * 0.45).toFixed(2)})`
                  };
                }
                statusBadge = (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[#0d1629] border border-[#06D6A0]/60 shadow-xs flex items-center justify-center"
                  >
                    <CheckCircle2 className="w-3 h-3 text-[#06D6A0]" />
                  </span>
                );
              } else if (item.status === 'imperfect') {
                style =
                  'bg-[#FFBE0B]/20 text-[#FEF3C7] border-2 border-[#FFBE0B]/80';
                statusBadge = (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[#0d1629] border border-[#FFBE0B]/60 shadow-xs flex items-center justify-center"
                  >
                    <AlertCircle className="w-3 h-3 text-[#FFBE0B]" />
                  </span>
                );
              } else if (item.status === 'missed') {
                style =
                  'bg-[#FF006E]/22 text-[#FECDD3] border-2 border-[#FF006E]/75';
                statusBadge = (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[#0d1629] border border-[#FF006E]/60 shadow-xs flex items-center justify-center"
                  >
                    <XCircle className="w-3 h-3 text-[#FF006E]" />
                  </span>
                );
              } else if (isCurrent) {
                style = isVoiceSpeaking
                  ? 'bg-[#00F5D4]/22 text-white border-2 border-[#00F5D4]'
                  : 'bg-[#3A86FF]/24 text-white border-2 border-[#00F5D4]/85';
                // Voice-synchronized GPU transform, opacity & glow (never changes layout geometry!)
                dynamicStyle = {
                  transform: `translateZ(0) scale(${(1 + voiceEnergy * 0.032).toFixed(3)})`,
                  opacity: Number((0.84 + voiceEnergy * 0.16).toFixed(2)),
                  boxShadow: `0 0 ${Math.round(8 + voiceEnergy * 20)}px rgba(0, 245, 212, ${(0.22 + voiceEnergy * 0.56).toFixed(2)})`
                };
              }

              return (
                <span
                  key={idx}
                  data-word-index={idx}
                  style={dynamicStyle}
                  className={`word-chip-base relative px-3 py-1 rounded-xl ${style}`}
                  title={item.recognizedAs ? `Algılanan: "${item.recognizedAs}"` : undefined}
                >
                  <span>{item.word}</span>
                  {statusBadge}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
