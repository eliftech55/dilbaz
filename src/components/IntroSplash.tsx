import React, { useRef, useState } from 'react';
import { Volume2, VolumeX, Play, Sparkles } from 'lucide-react';
import { playTone } from '../utils/soundEffects';

interface IntroSplashProps {
  onComplete: () => void;
}

export const IntroSplash: React.FC<IntroSplashProps> = ({ onComplete }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isVideoMuted, setIsVideoMuted] = useState(true);
  const [videoFailed, setVideoFailed] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  const handleFinish = () => {
    if (isExiting) return;
    playTone('tap');
    setIsExiting(true);
    setTimeout(() => {
      onComplete();
    }, 320);
  };

  const toggleVideoSound = () => {
    const nextMuted = !isVideoMuted;
    setIsVideoMuted(nextMuted);
    if (videoRef.current) {
      videoRef.current.muted = nextMuted;
      if (!nextMuted && videoRef.current.paused) {
        videoRef.current.play().catch(() => {});
      }
    }
  };

  return (
    <div
      className={`fixed inset-0 z-[70] flex items-center justify-center p-4 bg-[#090e1a]/95 backdrop-blur-xl transition-opacity duration-300 ${
        isExiting ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Ambient Ebru Glow */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(circle at 30% 25%, rgba(58, 134, 255, 0.25), transparent 50%), radial-gradient(circle at 75% 75%, rgba(255, 0, 110, 0.22), transparent 50%), radial-gradient(circle at 50% 50%, rgba(255, 190, 11, 0.14), transparent 60%)',
        }}
      />

      <div className="relative w-full max-w-2xl rounded-[32px] border border-white/15 bg-[#14213D]/90 shadow-2xl overflow-hidden animate-screen-in">
        {/* Top Bar with Logo + Sound Toggle */}
        <div className="px-5 py-3.5 flex items-center justify-between border-b border-white/10 bg-[#0d1629]/80">
          <div className="flex items-center gap-3">
            <img
              src={`${import.meta.env.BASE_URL}assets/aistudio/logo_785c16ab.png`}
              alt="Dilbaz Logo"
              className="w-10 h-10 rounded-full object-cover ring-2 ring-[#FFBE0B]/60 shadow-md"
            />
            <div>
              <div className="font-display text-lg font-bold tracking-wide bg-gradient-to-r from-white via-[#FFBE0B] to-[#FF006E] bg-clip-text text-transparent">
                DİLBAZ
              </div>
              <div className="text-[11px] text-[#93C5FD] font-medium">
                Telaffuz ve Diksiyon Oyunları
              </div>
            </div>
          </div>

          {!videoFailed && (
            <button
              type="button"
              onClick={toggleVideoSound}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-semibold text-white transition-colors cursor-pointer"
            >
              {isVideoMuted ? (
                <>
                  <VolumeX className="w-3.5 h-3.5 text-[#FFBE0B]" />
                  <span>Sesi Aç</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-3.5 h-3.5 text-[#00F5D4]" />
                  <span>Ses Açık</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Video Showcase or Logo Fallback */}
        <div className="relative bg-[#090e1a] aspect-video flex items-center justify-center overflow-hidden">
          {!videoFailed ? (
            <video
              ref={videoRef}
              src={`${import.meta.env.BASE_URL}assets/aistudio/dilbaz_video_618a6127.mp4`}
              className="w-full h-full object-cover"
              autoPlay
              playsInline
              muted={isVideoMuted}
              onEnded={handleFinish}
              onError={() => setVideoFailed(true)}
            />
          ) : (
            <div className="flex flex-col items-center justify-center p-8 text-center space-y-4">
              <div className="relative">
                <div className="absolute -inset-4 rounded-full bg-gradient-to-tr from-[#3A86FF]/40 via-[#FF006E]/30 to-[#FFBE0B]/40 blur-xl animate-pulse-aura" />
                <img
                  src={`${import.meta.env.BASE_URL}assets/aistudio/logo_785c16ab.png`}
                  alt="Dilbaz Ebru Zümrüdüanka"
                  className="relative w-36 h-36 rounded-full object-cover ring-4 ring-[#FFBE0B]/70 shadow-2xl"
                />
              </div>
              <p className="text-sm text-[#CBD5E1] max-w-md">
                Türkçenin tekerlemelerini hız ve kusursuz telaffuzla fethetmeye hazır mısın?
              </p>
            </div>
          )}

          {/* Subtle bottom gradient overlay */}
          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#14213D] to-transparent pointer-events-none" />
        </div>

        {/* Footer CTA */}
        <div className="p-5 flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#14213D]">
          <div className="flex items-center gap-2 text-xs text-[#CBD5E1]">
            <Sparkles className="w-4 h-4 text-[#00F5D4] shrink-0" />
            <span>Canlı odalarda aynı tekerleme ile hız ve telaffuz yarışı</span>
          </div>

          <button
            type="button"
            onClick={handleFinish}
            className="w-full sm:w-auto px-7 py-3 rounded-2xl btn-epic-pomegranate font-bold text-sm tracking-wide flex items-center justify-center gap-2 cursor-pointer"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>ARENAYA GİR</span>
          </button>
        </div>
      </div>
    </div>
  );
};
