import React, { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  rotation: number;
  rotSpeed: number;
  shape: 'rumi' | 'droplet';
}

const CELEBRATION_EVENT = 'dilbaz:celebration';

export function triggerCelebration(options?: { xRatio?: number; yRatio?: number; count?: number }) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CELEBRATION_EVENT, { detail: options || {} }));
}

export const FxCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const handleCelebration = (ev: Event) => {
      const detail = (ev as CustomEvent<{ xRatio?: number; yRatio?: number; count?: number }>).detail || {};
      const originX = canvas.width * (detail.xRatio ?? 0.5);
      const originY = canvas.height * (detail.yRatio ?? 0.35);
      const count = detail.count ?? 42;
      const colors = ['#FFBE0B', '#FF006E', '#3A86FF', '#00F5D4', '#FFFFFF'];

      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.45;
        const speed = 2.5 + Math.random() * 6.5;
        particlesRef.current.push({
          x: originX,
          y: originY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 2,
          size: 4 + Math.random() * 5.5,
          color: colors[Math.floor(Math.random() * colors.length)],
          alpha: 1,
          rotation: Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() - 0.5) * 0.16,
          shape: i % 2 === 0 ? 'rumi' : 'droplet',
        });
      }
    };

    window.addEventListener(CELEBRATION_EVENT, handleCelebration);

    let rafId = 0;
    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const particles = particlesRef.current;

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.14;
        p.alpha -= 0.016;
        p.rotation += p.rotSpeed;

        if (p.alpha <= 0) {
          particles.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;

        if (p.shape === 'rumi') {
          ctx.beginPath();
          ctx.moveTo(0, -p.size * 1.4);
          ctx.quadraticCurveTo(p.size * 0.5, -p.size * 0.5, p.size * 1.4, 0);
          ctx.quadraticCurveTo(p.size * 0.5, p.size * 0.5, 0, p.size * 1.4);
          ctx.quadraticCurveTo(-p.size * 0.5, p.size * 0.5, -p.size * 1.4, 0);
          ctx.quadraticCurveTo(-p.size * 0.5, -p.size * 0.5, 0, -p.size * 1.4);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.size * 0.75, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
      window.removeEventListener(CELEBRATION_EVENT, handleCelebration);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 w-full h-full z-50 pointer-events-none"
    />
  );
};
