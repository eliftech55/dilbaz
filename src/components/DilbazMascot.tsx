import React, { useState } from 'react';
import { playTone } from '../utils/soundEffects';

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
  title = "Dilbaz'a dokun!"
}) => {
  const [bouncing, setBouncing] = useState(false);

  const handleTap = () => {
    playTone('tap');
    setBouncing(false);
    requestAnimationFrame(() => setBouncing(true));
    setTimeout(() => setBouncing(false), 680);
    onClick?.();
  };

  return (
    <button
      type="button"
      onClick={handleTap}
      title={title}
      className={`shrink-0 cursor-pointer transition-transform duration-300 hover:scale-105 hover:-rotate-3 focus:outline-none ${
        bouncing ? 'animate-mascot-bounce' : ''
      } ${className}`}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 120 120" width="100%" height="100%" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="dilbazParrotBody" x1="35" y1="20" x2="85" y2="95" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#3A86FF" />
            <stop offset="60%" stopColor="#1D4ED8" />
            <stop offset="100%" stopColor="#14213D" />
          </linearGradient>
          <linearGradient id="dilbazEbruWing" x1="30" y1="45" x2="75" y2="85" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FF006E" />
            <stop offset="50%" stopColor="#FFBE0B" />
            <stop offset="100%" stopColor="#00F5D4" />
          </linearGradient>
          <linearGradient id="dilbazBeakGold" x1="70" y1="38" x2="90" y2="52" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFBE0B" />
            <stop offset="100%" stopColor="#F59E0B" />
          </linearGradient>
        </defs>

        {/* Dalgalanan Ebru Kuyruk Tüyleri */}
        <path d="M42 82 C 24 94, 14 106, 18 114 C 28 110, 38 98, 48 86 Z" fill="#FF006E" />
        <path d="M48 85 C 34 99, 28 112, 34 117 C 42 111, 48 98, 54 87 Z" fill="#FFBE0B" />
        <path d="M54 86 C 46 101, 44 113, 50 116 C 56 109, 58 97, 60 86 Z" fill="#00F5D4" />

        {/* Zümrüdüanka Tacı (Tepe Tüyleri) */}
        <path d="M52 24 C 46 10, 34 10, 32 16 C 40 16, 46 21, 49 26 Z" fill="#FF006E" />
        <path d="M58 22 C 56 7, 45 5, 42 11 C 49 12, 53 18, 55 24 Z" fill="#FFBE0B" />
        <path d="M63 23 C 65 10, 56 6, 52 11 C 57 14, 60 19, 61 24 Z" fill="#00F5D4" />

        {/* Gövde */}
        <path d="M40 52 C 40 30, 74 26, 76 50 C 78 72, 66 90, 48 88 C 38 86, 38 68, 40 52 Z" fill="url(#dilbazParrotBody)" />

        {/* Ebru Desenli Parlak Kanat */}
        <path d="M36 54 C 30 68, 38 84, 56 80 C 64 78, 66 64, 56 54 C 49 48, 40 48, 36 54 Z" fill="url(#dilbazEbruWing)" />
        <path d="M40 62 C 46 58, 52 68, 58 63" stroke="#14213D" strokeWidth="2" strokeLinecap="round" opacity="0.55" />
        <path d="M39 70 C 46 66, 51 75, 57 71" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" opacity="0.7" />

        {/* Göz Çevresi Beyaz Maske */}
        <circle cx="60" cy="40" r="10" fill="#EDF2F4" />
        {mood === 'sad' ? (
          <path d="M56 38 L64 42 M64 38 L56 42" stroke="#14213D" strokeWidth="2.5" strokeLinecap="round" />
        ) : (
          <>
            <circle cx="60" cy="40" r="5" fill="#14213D" />
            <circle cx="61.8" cy="38.5" r="1.8" fill="#FFFFFF" />
          </>
        )}

        {/* Kıvrımlı Altın Gaga */}
        <path d="M72 38 C 86 38, 92 46, 86 54 C 83 49, 77 48, 72 48 Z" fill="url(#dilbazBeakGold)" />
        <path d="M72 48 C 78 48, 82 51, 80 55 C 76 55, 72 52, 72 48 Z" fill="#D97706" />

        {/* Boyunda Minik Nazar Boncuğu Madalyonu */}
        <circle cx="66" cy="62" r="5" fill="#1D4ED8" stroke="#FFBE0B" strokeWidth="1.5" />
        <circle cx="66" cy="62" r="2.2" fill="#00F5D4" />
        <circle cx="66" cy="62" r="1" fill="#14213D" />
      </svg>
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
  sender = 'Dilbaz Ebru Papağanı',
  onMascotTap
}) => {
  return (
    <div className="flex items-center gap-3">
      <DilbazMascot mood={mood} size={68} onClick={onMascotTap} />
      <div className="relative flex-1 bg-[#14213D]/90 border-[1.5px] border-[#3A86FF]/50 rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed text-[#F1F5F9] shadow-lg speech-bubble-tail">
        <span className="font-display text-[11px] font-bold text-[#FFBE0B] block mb-0.5">
          {sender}
        </span>
        <span>{message}</span>
      </div>
    </div>
  );
};
