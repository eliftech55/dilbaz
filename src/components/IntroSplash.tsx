import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Volume2, VolumeX, Play, Pause, RotateCcw, SkipForward, Sparkles } from 'lucide-react';
import { playTone } from '../utils/soundEffects';
import { PhoenixWingPair } from './DilbazMascot';
import { RumiCorners } from './EbruBackground';
import { triggerCelebration } from './FxCanvas';
import heroPosterImg from '../assets/images/zumruduanka_hero_1794737139184.jpg';
import ebruStageImg from '../assets/images/ebru_stage_backdrop_1794737129769.jpg';

interface IntroSplashProps {
  onComplete: () => void;
}

interface NarrativeBeat {
  id: number;
  startRatio: number;
  eyebrow: string;
  title: string;
  subtitle: string;
  accentColor: string;
}

const NARRATIVE_BEATS: NarrativeBeat[] = [
  {
    id: 0,
    startRatio: 0,
    eyebrow: 'EBRU SULARINDAN DOĞAN EFSANE',
    title: 'Kelimelerin Ritmi Uyanıyor',
    subtitle: 'Zümrüdüanka sahneye süzülürken nefesini topla.',
    accentColor: '#3A86FF',
  },
  {
    id: 1,
    startRatio: 0.25,
    eyebrow: 'DİKSİYON · HIZ · KUSURSUZ TELAFFUZ',
    title: 'Anadolu’nun En Çetin Tekerlemeleri',
    subtitle: 'Gerçek zamanlı ses takibiyle her hecede ustalaş.',
    accentColor: '#00F5D4',
  },
  {
    id: 2,
    startRatio: 0.56,
    eyebrow: 'CANLI ARENA VE SOLO ANTRENMAN',
    title: 'Zümrüdüanka’nı Zirveye Taşı',
    subtitle: 'Canlı odalarda düello yap, liderlik kürsüsüne yüksel.',
    accentColor: '#FF006E',
  },
  {
    id: 3,
    startRatio: 0.84,
    eyebrow: 'SAHNE HAZIR · SÖZ SENİN',
    title: 'Meydan Okumaya Başla',
    subtitle: 'Tek dokunuşla arenaya adım at.',
    accentColor: '#FFBE0B',
  },
];

const FALLBACK_DURATION_SEC = 14;
const AUTO_CONTINUE_SECONDS = 3;

function formatTimecode(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export const IntroSplash: React.FC<IntroSplashProps> = ({ onComplete }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const emberCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const progressTrackRef = useRef<HTMLDivElement | null>(null);

  const [isVideoMuted, setIsVideoMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isBuffering, setIsBuffering] = useState(true);
  const [videoFailed, setVideoFailed] = useState(false);
  const [hasEnded, setHasEnded] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(FALLBACK_DURATION_SEC);
  const [autoEnterCountdown, setAutoEnterCountdown] = useState<number | null>(null);

  const progress = useMemo(() => {
    if (!duration || duration <= 0) return 0;
    return Math.min(1, Math.max(0, currentTime / duration));
  }, [currentTime, duration]);

  const activeBeat = useMemo(() => {
    let matched = NARRATIVE_BEATS[0];
    for (const beat of NARRATIVE_BEATS) {
      if (progress >= beat.startRatio) {
        matched = beat;
      }
    }
    return matched;
  }, [progress]);

  const isFinaleHighlight = progress >= 0.82 || hasEnded;

  const handleFinish = useCallback(() => {
    if (isExiting) return;
    try {
      playTone('fanfare');
      triggerCelebration({ xRatio: 0.5, yRatio: 0.52, count: 28 });
    } catch {
      // ignore audio/fx errors on restricted mobile webviews
    }
    setIsExiting(true);
    window.setTimeout(() => {
      onComplete();
    }, 320);
  }, [isExiting, onComplete]);

  const toggleVideoSound = useCallback(() => {
    const nextMuted = !isVideoMuted;
    setIsVideoMuted(nextMuted);
    if (!nextMuted) {
      playTone('tap');
    }
    if (videoRef.current) {
      videoRef.current.muted = nextMuted;
      if (!nextMuted && videoRef.current.paused && !hasEnded) {
        videoRef.current
          .play()
          .then(() => setIsPlaying(true))
          .catch(() => setIsPlaying(false));
      }
    }
  }, [hasEnded, isVideoMuted]);

  const handleReplay = useCallback(() => {
    playTone('tap');
    setHasEnded(false);
    setAutoEnterCountdown(null);
    setCurrentTime(0);
    setIsPlaying(true);
    if (!videoFailed && videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => setIsPlaying(false));
    }
  }, [videoFailed]);

  const togglePlayPause = useCallback(() => {
    if (hasEnded) {
      handleReplay();
      return;
    }
    setAutoEnterCountdown(null);
    if (videoFailed) {
      setIsPlaying((prev) => !prev);
      return;
    }
    const vid = videoRef.current;
    if (!vid) return;

    if (vid.paused) {
      vid
        .play()
        .then(() => {
          setIsBuffering(false);
          setIsPlaying(true);
        })
        .catch(() => setIsPlaying(false));
    } else {
      vid.pause();
      setIsPlaying(false);
    }
  }, [handleReplay, hasEnded, videoFailed]);

  const handleSeek = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const track = progressTrackRef.current;
      if (!track || duration <= 0) return;
      const rect = track.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
      const targetTime = ratio * duration;
      setCurrentTime(targetTime);
      setHasEnded(false);
      setAutoEnterCountdown(null);
      if (!videoFailed && videoRef.current) {
        videoRef.current.currentTime = targetTime;
      }
    },
    [duration, videoFailed]
  );

  // Never leave mobile users stuck on a buffering spinner if autoplay is deferred/throttled
  useEffect(() => {
    if (videoFailed) {
      setIsBuffering(false);
      return;
    }
    const vid = videoRef.current;
    if (vid) {
      if (vid.readyState >= 2) {
        setIsBuffering(false);
      }
      const playPromise = vid.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {
          setIsBuffering(false);
          setIsPlaying(false);
        });
      }
    }
    const safetyTimer = window.setTimeout(() => {
      setIsBuffering(false);
    }, 1500);
    return () => window.clearTimeout(safetyTimer);
  }, [videoFailed]);

  // Fallback motion-poster timeline if video cannot load
  useEffect(() => {
    if (!videoFailed || !isPlaying || hasEnded) return;
    const timer = window.setInterval(() => {
      setCurrentTime((prev) => {
        const next = prev + 0.1;
        if (next >= FALLBACK_DURATION_SEC) {
          setHasEnded(true);
          setIsPlaying(false);
          setAutoEnterCountdown(AUTO_CONTINUE_SECONDS);
          return FALLBACK_DURATION_SEC;
        }
        return next;
      });
    }, 100);
    return () => window.clearInterval(timer);
  }, [hasEnded, isPlaying, videoFailed]);

  // Smooth auto-continue countdown after video finishes
  useEffect(() => {
    if (autoEnterCountdown === null || isExiting) return;
    if (autoEnterCountdown <= 0) {
      handleFinish();
      return;
    }
    const timer = window.setTimeout(() => {
      setAutoEnterCountdown((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [autoEnterCountdown, handleFinish, isExiting]);

  // Keyboard shortcuts: Escape / Enter -> skip/enter, Space -> play/pause, M -> mute
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        e.preventDefault();
        handleFinish();
      } else if (e.key === ' ' || e.key.toLowerCase() === 'k') {
        e.preventDefault();
        togglePlayPause();
      } else if (e.key.toLowerCase() === 'm') {
        e.preventDefault();
        toggleVideoSound();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleFinish, togglePlayPause, toggleVideoSound]);

  // Lightweight GPU-friendly Ebru & Gold Ember Canvas Atmosphere (no shadowBlur for mobile smoothness)
  useEffect(() => {
    const canvas = emberCanvasRef.current;
    if (!canvas) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const palette = ['#FFBE0B', '#00F5D4', '#FF006E', '#3A86FF', '#FDE68A'];
    interface Ember {
      x: number;
      y: number;
      vy: number;
      vx: number;
      size: number;
      alpha: number;
      color: string;
      phase: number;
    }

    const count = window.innerWidth < 640 ? 16 : 32;
    const embers: Ember[] = Array.from({ length: count }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vy: -(0.35 + Math.random() * 0.85),
      vx: (Math.random() - 0.5) * 0.3,
      size: 1.5 + Math.random() * 2.4,
      alpha: 0.25 + Math.random() * 0.55,
      color: palette[Math.floor(Math.random() * palette.length)],
      phase: Math.random() * Math.PI * 2,
    }));

    let rafId = 0;
    const tick = (now: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const t = now * 0.001;

      for (const e of embers) {
        e.y += e.vy;
        e.x += e.vx + Math.sin(t + e.phase) * 0.2;

        if (e.y < -12) {
          e.y = canvas.height + 12;
          e.x = Math.random() * canvas.width;
        }
        if (e.x < -12) e.x = canvas.width + 12;
        if (e.x > canvas.width + 12) e.x = -12;

        const pulse = 0.65 + 0.35 * Math.sin(t * 2.2 + e.phase);
        ctx.globalAlpha = e.alpha * pulse;
        ctx.fillStyle = e.color;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <div
      className={`fixed inset-0 z-[70] flex flex-col justify-between overflow-y-auto overflow-x-hidden bg-[#050914] text-white transition-opacity duration-300 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] ${
        isExiting ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      role="dialog"
      aria-modal="true"
      aria-label="Dilbaz Açılış Gösterimi"
    >
      {/* Lightweight Ebru Cinema Backlight (single-video mobile-safe) */}
      <div aria-hidden="true" className="fixed inset-0 overflow-hidden pointer-events-none">
        <img
          src={ebruStageImg}
          alt=""
          className="w-full h-full object-cover scale-105 opacity-30 saturate-150 animate-cinema-ken-burns"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 22% 20%, rgba(58, 134, 255, 0.26), transparent 46%), radial-gradient(circle at 80% 76%, rgba(255, 0, 110, 0.24), transparent 48%), radial-gradient(circle at 50% 48%, rgba(255, 190, 11, 0.16), transparent 58%), linear-gradient(180deg, rgba(5, 9, 20, 0.88) 0%, rgba(7, 12, 26, 0.5) 50%, rgba(5, 9, 20, 0.95) 100%)',
          }}
        />
      </div>

      {/* Floating Ebru & Phoenix Ember Particles */}
      <canvas
        ref={emberCanvasRef}
        aria-hidden="true"
        className="fixed inset-0 w-full h-full pointer-events-none z-[1]"
      />

      {/* Top Theatrical Bar */}
      <header className="relative z-10 w-full max-w-6xl mx-auto px-4 sm:px-8 pt-3 sm:pt-5 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative w-9 h-9 sm:w-11 sm:h-11 shrink-0 mx-1">
            <PhoenixWingPair compact />
            <img
              src={`${import.meta.env.BASE_URL}assets/aistudio/logo_785c16ab.png`}
              alt="Dilbaz Logo"
              className="relative z-10 w-full h-full rounded-full object-cover ring-2 ring-[#FFBE0B]/75 shadow-lg animate-phoenix-bird-flap"
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-display text-lg sm:text-xl font-bold tracking-wide bg-gradient-to-r from-white via-[#FFBE0B] to-[#FF006E] bg-clip-text text-transparent">
                DİLBAZ
              </span>
              <span className="hidden sm:inline text-white/25">·</span>
              <span className="hidden sm:inline text-[11px] uppercase tracking-[0.18em] text-[#00F5D4]/90 font-semibold">
                Açılış Sahnesi
              </span>
            </div>
            <p className="text-[11px] text-[#94A3B8] font-medium truncate">
              Telaffuz, Ritim ve Diksiyon Arenası
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!videoFailed && (
            <button
              type="button"
              onClick={toggleVideoSound}
              className={`min-h-[38px] flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                isVideoMuted
                  ? 'bg-[#FFBE0B]/15 hover:bg-[#FFBE0B]/25 border-[#FFBE0B]/45 text-[#FDE68A]'
                  : 'bg-[#00F5D4]/15 hover:bg-[#00F5D4]/25 border-[#00F5D4]/45 text-[#00F5D4]'
              }`}
            >
              {isVideoMuted ? (
                <>
                  <VolumeX className="w-4 h-4 text-[#FFBE0B]" />
                  <span>Sesi Aç</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-4 h-4 text-[#00F5D4]" />
                  <span>Ses Açık</span>
                </>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={handleFinish}
            className="min-h-[38px] flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/18 border border-white/15 text-xs font-semibold text-slate-200 transition-colors cursor-pointer"
          >
            <span>Atla</span>
            <SkipForward className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Center Widescreen Theatrical Stage */}
      <main className="relative z-10 flex-1 min-h-0 w-full max-w-5xl mx-auto px-3 sm:px-8 py-2 sm:py-3 flex flex-col justify-center gap-3">
        <div
          className={`relative w-full mx-auto aspect-video max-h-[54dvh] sm:max-h-[calc(100dvh-210px)] rounded-2xl sm:rounded-[28px] overflow-hidden border transition-all duration-700 animate-cinema-curtain ${
            isFinaleHighlight
              ? 'border-[#FFBE0B]/60 shadow-[0_24px_80px_rgba(255,190,11,0.22),0_0_48px_rgba(255,0,110,0.22)]'
              : 'border-white/18 shadow-[0_28px_80px_rgba(0,0,0,0.75)]'
          } bg-[#070c18]`}
        >
          {/* Decorative Selçuklu Corner Flourishes */}
          <div className="absolute inset-0 z-20 pointer-events-none">
            <RumiCorners />
          </div>

          {/* Subtle Light Sweep Border Accent */}
          <div
            aria-hidden="true"
            className="hidden sm:block absolute inset-y-0 w-1/3 z-20 pointer-events-none bg-gradient-to-r from-transparent via-white/8 to-transparent animate-cinema-shimmer"
          />

          {/* Poster Underlay while Video Buffers */}
          {!videoFailed && isBuffering && (
            <div className="absolute inset-0 z-[5] flex items-center justify-center bg-[#070c18] pointer-events-none">
              <img
                src={heroPosterImg}
                alt="Dilbaz Sahnesi Yükleniyor"
                className="w-full h-full object-cover opacity-75"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#070c18] via-[#070c18]/35 to-transparent" />
              <div className="relative z-10 flex flex-col items-center gap-2.5">
                <div className="w-9 h-9 rounded-full border-2 border-[#FFBE0B]/30 border-t-[#FFBE0B] animate-spin" />
                <span className="text-[11px] font-semibold tracking-[0.2em] uppercase text-[#FFBE0B]/90">
                  Sahne Hazırlanıyor
                </span>
              </div>
            </div>
          )}

          {/* Main Video or Motion-Poster Fallback */}
          {!videoFailed ? (
            <video
              ref={videoRef}
              src={`${import.meta.env.BASE_URL}assets/aistudio/dilbaz_video_618a6127.mp4`}
              poster={heroPosterImg}
              preload="auto"
              className="w-full h-full object-cover cursor-pointer"
              autoPlay
              playsInline
              muted={isVideoMuted}
              onClick={togglePlayPause}
              onLoadedMetadata={(e) => {
                const dur = e.currentTarget.duration;
                if (Number.isFinite(dur) && dur > 0) {
                  setDuration(dur);
                }
              }}
              onLoadedData={() => setIsBuffering(false)}
              onCanPlay={() => setIsBuffering(false)}
              onPlaying={() => {
                setIsBuffering(false);
                setIsPlaying(true);
              }}
              onPause={() => setIsPlaying(false)}
              onTimeUpdate={(e) => {
                setCurrentTime(e.currentTarget.currentTime);
              }}
              onEnded={() => {
                setIsPlaying(false);
                setHasEnded(true);
                setCurrentTime(duration);
                setAutoEnterCountdown(AUTO_CONTINUE_SECONDS);
              }}
              onError={() => {
                setIsBuffering(false);
                setVideoFailed(true);
                setDuration(FALLBACK_DURATION_SEC);
              }}
            />
          ) : (
            <div
              onClick={togglePlayPause}
              className="relative w-full h-full flex flex-col items-center justify-center p-5 text-center cursor-pointer overflow-hidden"
            >
              <img
                src={heroPosterImg}
                alt="Dilbaz Ebru Zümrüdüanka"
                className="absolute inset-0 w-full h-full object-cover opacity-50 animate-cinema-ken-burns"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#070c18] via-[#0d1629]/55 to-[#070c18]/70" />
              <div className="relative z-10 flex flex-col items-center gap-3">
                <div className="relative mx-8">
                  <div className="absolute -inset-6 rounded-full bg-gradient-to-tr from-[#3A86FF]/45 via-[#FF006E]/35 to-[#FFBE0B]/45 blur-2xl animate-pulse-aura" />
                  <PhoenixWingPair />
                  <img
                    src={`${import.meta.env.BASE_URL}assets/aistudio/logo_785c16ab.png`}
                    alt="Dilbaz Zümrüdüanka"
                    className="relative z-10 w-24 h-24 sm:w-36 sm:h-36 rounded-full object-cover ring-4 ring-[#FFBE0B]/80 shadow-2xl animate-phoenix-bird-flap"
                  />
                </div>
                <p className="hidden sm:block text-sm text-slate-200 max-w-md font-medium drop-shadow">
                  Türkçenin en zorlu tekerlemelerini hız, nefes ve kusursuz diksiyonla fethet.
                </p>
              </div>
            </div>
          )}

          {/* Top & Bottom Cinema Vignette Scrim */}
          <div
            aria-hidden="true"
            className="hidden sm:block absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-[#050914]/70 to-transparent pointer-events-none z-10"
          />
          <div
            aria-hidden="true"
            className="hidden sm:block absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-[#050914]/95 via-[#050914]/65 to-transparent pointer-events-none z-10"
          />

          {/* Center Paused / Replay Overlay */}
          {(!isPlaying || hasEnded) && !isBuffering && (
            <button
              type="button"
              onClick={hasEnded ? handleReplay : togglePlayPause}
              aria-label={hasEnded ? 'Açılış videosunu tekrar izle' : 'Videoyu oynat'}
              className="absolute inset-0 z-20 flex items-center justify-center bg-black/25 hover:bg-black/15 transition-colors cursor-pointer group"
            >
              <span className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[#0d1629]/85 border border-white/25 backdrop-blur-md flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform">
                {hasEnded ? (
                  <RotateCcw className="w-6 h-6 text-[#FFBE0B]" />
                ) : (
                  <Play className="w-6 h-6 text-white fill-white ml-0.5" />
                )}
              </span>
            </button>
          )}

          {/* Desktop/Tablet Synchronized Narrative Beat Lower-Third */}
          <div className="hidden sm:block absolute inset-x-0 bottom-0 z-20 px-7 pb-5 pointer-events-none">
            <div key={activeBeat.id} className="animate-cinema-beat flex flex-col gap-1 max-w-2xl">
              <div className="flex items-center gap-2.5 text-[11px] font-bold tracking-[0.2em] uppercase">
                <span
                  className="inline-block w-2 h-2 rounded-full"
                  style={{
                    backgroundColor: activeBeat.accentColor,
                    boxShadow: `0 0 12px ${activeBeat.accentColor}`,
                  }}
                />
                <span style={{ color: activeBeat.accentColor }}>{activeBeat.eyebrow}</span>
              </div>
              <h2 className="font-display text-2xl md:text-3xl font-bold text-white leading-tight drop-shadow-[0_2px_10px_rgba(0,0,0,0.85)]">
                {activeBeat.title}
              </h2>
              <p className="text-sm text-slate-200/95 font-medium drop-shadow-[0_1px_6px_rgba(0,0,0,0.9)]">
                {activeBeat.subtitle}
              </p>
            </div>
          </div>
        </div>

        {/* Mobile Narrative Beat Strip (keeps small aspect-video player completely unobstructed) */}
        <div key={`mob_${activeBeat.id}`} className="sm:hidden animate-cinema-beat px-1 text-center space-y-0.5">
          <div className="flex items-center justify-center gap-2 text-[10px] font-bold tracking-[0.16em] uppercase">
            <span
              className="inline-block w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: activeBeat.accentColor }}
            />
            <span style={{ color: activeBeat.accentColor }}>{activeBeat.eyebrow}</span>
          </div>
          <h2 className="font-display text-lg font-bold text-white leading-snug">
            {activeBeat.title}
          </h2>
          <p className="text-xs text-slate-300 leading-relaxed">
            {activeBeat.subtitle}
          </p>
        </div>
      </main>

      {/* Bottom Interactive Cinema Control Dock & Finale CTA */}
      <footer className="relative z-10 w-full max-w-5xl mx-auto px-4 sm:px-8 pb-4 sm:pb-6 pt-1 space-y-3 shrink-0">
        {/* Scrubbable Progress Bar with 4 Narrative Act Markers */}
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-semibold tabular-nums text-slate-300 w-9 text-right">
            {formatTimecode(currentTime)}
          </span>

          <div
            ref={progressTrackRef}
            onClick={handleSeek}
            role="slider"
            tabIndex={0}
            aria-label="Açılış videosu ilerleme çubuğu"
            aria-valuemin={0}
            aria-valuemax={Math.round(duration)}
            aria-valuenow={Math.round(currentTime)}
            className="relative flex-1 h-2.5 rounded-full bg-white/15 cursor-pointer group flex items-center"
          >
            {NARRATIVE_BEATS.slice(1).map((beat) => (
              <span
                key={beat.id}
                aria-hidden="true"
                className="absolute top-0 bottom-0 w-0.5 bg-white/25 z-10 pointer-events-none"
                style={{ left: `${beat.startRatio * 100}%` }}
              />
            ))}

            <div
              className="h-full rounded-full transition-[width] duration-100 ease-linear"
              style={{
                width: `${progress * 100}%`,
                background: 'linear-gradient(90deg, #3A86FF 0%, #00F5D4 50%, #FFBE0B 100%)',
              }}
            />

            <span
              aria-hidden="true"
              className="absolute w-3.5 h-3.5 -ml-1.5 rounded-full bg-[#FFBE0B] shadow-[0_0_12px_rgba(255,190,11,0.9)] ring-2 ring-white/80 transition-transform group-hover:scale-125 pointer-events-none"
              style={{ left: `${progress * 100}%` }}
            />
          </div>

          <span className="text-[11px] font-semibold tabular-nums text-slate-400 w-9">
            {formatTimecode(duration)}
          </span>
        </div>

        {/* Action Row */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={togglePlayPause}
                className="min-h-[40px] flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/18 border border-white/15 text-xs font-semibold text-slate-200 transition-colors cursor-pointer"
              >
                {isPlaying ? (
                  <>
                    <Pause className="w-3.5 h-3.5 text-[#00F5D4]" />
                    <span>Duraklat</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 text-[#00F5D4] fill-current" />
                    <span>Oynat</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleReplay}
                className="min-h-[40px] flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/18 border border-white/15 text-xs font-semibold text-slate-200 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-[#FFBE0B]" />
                <span>Tekrar İzle</span>
              </button>
            </div>

            <div className="hidden md:flex items-center gap-2 pl-2 text-xs text-slate-300">
              <Sparkles className="w-4 h-4 text-[#00F5D4] shrink-0" />
              <span>
                {autoEnterCountdown !== null
                  ? `Arenaya geçiliyor: ${autoEnterCountdown} sn`
                  : 'Canlı odalarda aynı tekerleme ile hız ve telaffuz yarışı'}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleFinish}
            className={`relative overflow-hidden w-full sm:w-auto min-h-[46px] px-8 py-3 rounded-2xl btn-epic-pomegranate font-bold text-sm tracking-wide flex items-center justify-center gap-2.5 cursor-pointer ${
              isFinaleHighlight
                ? 'ring-2 ring-[#FFBE0B]/80 shadow-[0_0_32px_rgba(255,190,11,0.45)]'
                : ''
            }`}
          >
            <span
              aria-hidden="true"
              className="hidden sm:block absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/25 to-transparent animate-cinema-shimmer pointer-events-none"
            />
            <Play className="relative z-10 w-4 h-4 fill-current" />
            <span className="relative z-10">
              {autoEnterCountdown !== null
                ? `ARENAYA GİR (${autoEnterCountdown})`
                : 'ARENAYA GİR'}
            </span>
          </button>
        </div>
      </footer>
    </div>
  );
};
