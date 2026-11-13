import React from 'react';

export const EbruBackground: React.FC = () => {
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-0 pointer-events-none overflow-hidden"
      style={{
        background:
          'radial-gradient(circle at 85% 15%, rgba(255, 0, 110, 0.16) 0%, transparent 45%), radial-gradient(circle at 15% 45%, rgba(58, 134, 255, 0.20) 0%, transparent 50%), radial-gradient(circle at 75% 85%, rgba(255, 190, 11, 0.12) 0%, transparent 45%), linear-gradient(170deg, #14213D 0%, #0d1629 100%)',
      }}
    >
      <svg
        className="absolute -inset-[10%] w-[120%] h-[120%] opacity-25 animate-ebru-float"
        viewBox="0 0 1200 900"
        fill="none"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="ebruWaveGrad1" x1="0" y1="0" x2="1200" y2="900" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#3A86FF" stopOpacity="0.55" />
            <stop offset="50%" stopColor="#FF006E" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#FFBE0B" stopOpacity="0.45" />
          </linearGradient>
          <linearGradient id="ebruWaveGrad2" x1="1200" y1="0" x2="0" y2="900" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#00F5D4" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#3A86FF" stopOpacity="0.2" />
          </linearGradient>
        </defs>
        <path
          d="M-120 140 C 200 30, 480 290, 820 150 C 1020 70, 1160 240, 1320 180 L 1320 330 C 1000 410, 640 190, 260 310 C 40 380, -60 290, -120 270 Z"
          fill="url(#ebruWaveGrad1)"
        />
        <path
          d="M-100 500 C 250 380, 520 620, 880 460 C 1060 380, 1180 530, 1320 500 L 1320 650 C 960 730, 580 510, 210 640 C 30 700, -40 610, -100 590 Z"
          fill="url(#ebruWaveGrad2)"
        />
        <circle cx="960" cy="210" r="68" stroke="#FFBE0B" strokeWidth="2" strokeOpacity="0.35" />
        <circle cx="960" cy="210" r="46" stroke="#FF006E" strokeWidth="1.5" strokeOpacity="0.35" />
        <circle cx="210" cy="700" r="85" stroke="#00F5D4" strokeWidth="2" strokeOpacity="0.3" />
      </svg>
    </div>
  );
};

export const RumiCorners: React.FC = () => {
  return (
    <>
      <svg className="absolute top-2 left-2 w-7 h-7 opacity-65 pointer-events-none" viewBox="0 0 32 32" fill="none">
        <path d="M2 24V8C2 4.686 4.686 2 8 2H24M2 14C7 14 14 7 14 2M6 6L11 11" stroke="#3A86FF" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <svg className="absolute top-2 right-2 w-7 h-7 opacity-65 pointer-events-none -scale-x-100" viewBox="0 0 32 32" fill="none">
        <path d="M2 24V8C2 4.686 4.686 2 8 2H24M2 14C7 14 14 7 14 2M6 6L11 11" stroke="#3A86FF" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <svg className="absolute bottom-2 left-2 w-7 h-7 opacity-65 pointer-events-none -scale-y-100" viewBox="0 0 32 32" fill="none">
        <path d="M2 24V8C2 4.686 4.686 2 8 2H24M2 14C7 14 14 7 14 2M6 6L11 11" stroke="#FF006E" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <svg className="absolute bottom-2 right-2 w-7 h-7 opacity-65 pointer-events-none -scale-100" viewBox="0 0 32 32" fill="none">
        <path d="M2 24V8C2 4.686 4.686 2 8 2H24M2 14C7 14 14 7 14 2M6 6L11 11" stroke="#FF006E" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </>
  );
};
