import React from 'react';

interface AudioVisualizerProps {
  isListening: boolean;
  audioLevel?: number;
  barCount?: number;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  isListening,
  audioLevel = 0,
  barCount = 20
}) => {
  return (
    <div className="flex items-center justify-center gap-1.5 h-12 px-4 py-2 bg-[#0d1629]/80 rounded-2xl border border-white/12 shadow-inner">
      {Array.from({ length: barCount }).map((_, index) => {
        let heightPercent = 16;
        if (isListening) {
          const middleDistance = Math.abs(index - barCount / 2) / (barCount / 2);
          const factor = Math.max(0.25, 1 - middleDistance * 0.65);
          const dynamicBoost = (audioLevel / 100) * 85 * factor;
          const randomJitter = Math.sin((index + Date.now() / 180) * 0.8) * 12;
          heightPercent = Math.min(100, Math.max(18, dynamicBoost + randomJitter + 22));
        }

        let barColor = 'bg-slate-700/70';
        if (isListening) {
          if (heightPercent > 75) {
            barColor = 'bg-[#FF006E] shadow-sm shadow-[#FF006E]/60';
          } else if (heightPercent > 50) {
            barColor = 'bg-[#FFBE0B] shadow-sm shadow-[#FFBE0B]/50';
          } else if (index % 2 === 0) {
            barColor = 'bg-[#00F5D4] shadow-sm shadow-[#00F5D4]/40';
          } else {
            barColor = 'bg-[#3A86FF] shadow-sm shadow-[#3A86FF]/40';
          }
        }

        return (
          <div
            key={index}
            className={`w-1.5 rounded-full transition-all duration-75 ${barColor}`}
            style={{
              height: `${heightPercent}%`,
              minHeight: '4px'
            }}
          />
        );
      })}
    </div>
  );
};
