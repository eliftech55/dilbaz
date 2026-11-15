import React from 'react';
import { CheckCircle2, AlertCircle, XCircle, Sparkles } from 'lucide-react';
import { LiveWordStatus } from '../utils/scoreCalculator';
import { RumiCorners } from './EbruBackground';

interface WordComparisonProps {
  originalWords: LiveWordStatus[];
  spokenTranscript?: string;
  isListening?: boolean;
  liveAccuracy?: number;
  categoryLabel?: string;
}

export const WordComparison: React.FC<WordComparisonProps> = ({
  originalWords,
  spokenTranscript = '',
  isListening = false,
  liveAccuracy = 0,
  categoryLabel = 'Canlı Telaffuz Kartı'
}) => {
  const correctCount = originalWords.filter((w) => w.status === 'correct').length;

  return (
    <div className="space-y-3.5">
      {/* Cloud Light (#EDF2F4) Rumi-Cornered Tekerleme Card */}
      <div className="relative ebru-cloud-card rounded-[26px] p-5 sm:p-6 overflow-hidden">
        {/* Subtle Ebru SVG Watermark */}
        <svg
          aria-hidden="true"
          className="absolute inset-0 w-full h-full opacity-[0.13] pointer-events-none"
          viewBox="0 0 400 260"
          fill="none"
          preserveAspectRatio="none"
        >
          <path
            d="M-20 40 C 90 -10, 180 120, 310 50 C 370 20, 410 70, 430 60 L 430 140 C 300 180, 180 70, 50 130 Z"
            fill="#3A86FF"
          />
          <path
            d="M-20 180 C 110 130, 230 240, 420 160 L 420 260 L -20 260 Z"
            fill="#FF006E"
          />
        </svg>

        {/* Selçuklu / Rumi Köşe Motifleri */}
        <RumiCorners />

        {/* Header Strip */}
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 mb-4">
          <span className="inline-flex items-center gap-1.5 bg-[#3A86FF]/15 text-[#1D4ED8] text-[11px] font-bold px-3 py-1 rounded-full">
            <Sparkles className="w-3 h-3" />
            <span>{categoryLabel}</span>
          </span>

          <div className="flex items-center gap-2.5 font-mono text-xs">
            {spokenTranscript.trim().length > 0 && (
              <span className="px-2.5 py-0.5 rounded-full bg-[#06D6A0]/20 text-[#065F46] border border-[#06D6A0]/40 font-bold">
                %{liveAccuracy} Doğruluk
              </span>
            )}
            <span className="text-[#475569] font-semibold">
              {correctCount} / {originalWords.length} kelime
            </span>
          </div>
        </div>

        {/* Interactive Word Grid with High-Contrast Green/Amber/Red Tracking */}
        <div className="relative z-10 flex flex-wrap gap-2 text-lg sm:text-2xl font-display font-bold leading-relaxed">
          {originalWords.map((item, idx) => {
            let style =
              'bg-white/85 text-[#14213D] border border-[#3A86FF]/20 shadow-xs';
            let icon = null;

            if (item.status === 'correct') {
              style =
                'bg-[#06D6A0]/25 text-[#065F46] border-2 border-[#06D6A0] shadow-sm shadow-[#06D6A0]/25 animate-word-pop';
              icon = (
                <CheckCircle2 className="w-4 h-4 text-[#059669] inline ml-1.5 shrink-0" />
              );
            } else if (item.status === 'imperfect') {
              style =
                'bg-[#FFBE0B]/30 text-[#92400E] border-2 border-[#F59E0B] shadow-sm';
              icon = (
                <AlertCircle className="w-4 h-4 text-[#D97706] inline ml-1.5 shrink-0" />
              );
            } else if (item.status === 'missed') {
              style =
                'bg-[#FF006E]/18 text-[#9F1239] border-2 border-[#FF006E]/70 shadow-sm';
              icon = (
                <XCircle className="w-4 h-4 text-[#E11D48] inline ml-1.5 shrink-0" />
              );
            } else if (item.status === 'current' && isListening) {
              style =
                'bg-[#3A86FF]/15 text-[#1E3A8A] border-2 border-[#3A86FF] shadow-md shadow-[#3A86FF]/20';
            }

            return (
              <span
                key={idx}
                className={`px-3 py-1 rounded-xl transition-all duration-200 inline-flex items-center ${style}`}
                title={item.recognizedAs ? `Algılanan: "${item.recognizedAs}"` : undefined}
              >
                {item.word}
                {icon}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
};
