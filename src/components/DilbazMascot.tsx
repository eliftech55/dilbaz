import React, { useState } from 'react';
import { playTone } from '../utils/soundEffects';
import zumruduankaHeroImg from '../assets/images/zumruduanka_hero_1794737139184.jpg';

export type MascotMood = 'happy' | 'sad' | 'excited';

interface DilbazMascotProps {
  mood?: MascotMood;
  size?: number;
  className?: string;
  onClick?: () => void;
  title?: string;
}

export const DilbazMascot: React.FC<DilbazMascotProps> = ({
  mood = 'happy',
  size = 72,
  className = '',
  onClick,
  title = "Zümrüdüanka'ya dokun!"
}) => {
  const [bouncing, setBouncing] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  const handleTap = () => {
    playTone('tap');
    setBouncing(false);
    requestAnimationFrame(() => setBouncing(true));
    setTimeout(() => setBouncing(false), 680);
    onClick?.();
  };

  const auraRing =
    mood === 'excited'
      ? 'from-[#FFBE0B] via-[#FF006E] to-[#00F5D4] shadow-[0_0_18px_rgba(255,190,11,0.55)]'
      : mood === 'sad'
      ? 'from-[#3A86FF] via-[#64748B] to-[#FF006E] shadow-[0_0_12px_rgba(58,134,255,0.35)]'
      : 'from-[#00F5D4] via-[#3A86FF] to-[#FFBE0B] shadow-[0_0_15px_rgba(0,245,212,0.45)]';

  return (
    <button
      type="button"
      onClick={handleTap}
      title={title}
      className={`relative shrink-0 cursor-pointer transition-transform duration-300 hover:scale-105 hover:-rotate-2 focus:outline-none rounded-full p-[2.5px] bg-gradient-to-tr ${auraRing} ${
        bouncing ? 'animate-mascot-bounce' : ''
      } ${className}`}
      style={{ width: size, height: size }}
    >
      <div className="w-full h-full rounded-full overflow-hidden bg-[#0d1629] flex items-center justify-center">
        {!imgFailed ? (
          <img
            src={zumruduankaHeroImg}
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
    </button>
  );
};

interface MascotDialogueProps {
  message: string;
  mood?: MascotMood;
  sender?: string;
  onMascotTap?: () => void;
}

export const MascotDialogue: React.FC<MascotDialogueProps> = ({
  message,
  mood = 'happy',
  sender = 'Zümrüdüanka',
  onMascotTap
}) => {
  return (
    <div className="flex items-center gap-3">
      <DilbazMascot mood={mood} size={60} onClick={onMascotTap} />
      <div className="relative flex-1 bg-gradient-to-r from-[#14213D]/95 to-[#1b2c4e]/90 border-[1.5px] border-[#3A86FF]/45 rounded-2xl px-3.5 py-2.5 text-xs leading-snug text-[#F1F5F9] shadow-lg speech-bubble-tail">
        <span className="font-display text-[11px] font-bold text-[#FFBE0B] block mb-0.5">
          {sender}
        </span>
        <span>{message}</span>
      </div>
    </div>
  );
};
