// Interactive, motivational synthesized Web Audio API sound effects for Dilbaz

let sharedAudioCtx: AudioContext | null = null;
let globalMuted = false;

export function setSoundMuted(muted: boolean) {
  globalMuted = muted;
}

export function getSoundMuted(): boolean {
  return globalMuted;
}

function getCtx(): AudioContext | null {
  if (globalMuted || typeof window === 'undefined') return null;
  try {
    const AudioContextCtor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return null;
    if (!sharedAudioCtx) {
      sharedAudioCtx = new AudioContextCtor();
    }
    if (sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume();
    }
    return sharedAudioCtx;
  } catch {
    return null;
  }
}

export type SoundToneType =
  | 'tap'
  | 'correct'
  | 'wrong'
  | 'hint'
  | 'countdown'
  | 'round_start'
  | 'timer_urgent'
  | 'combo_streak'
  | 'victory'
  | 'fanfare'
  | 'notification';

/**
 * Plays a rising pentatonic chime as consecutive tongue-twister words are spoken accurately.
 */
export function playComboWordTone(comboCount: number) {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    // C major pentatonic ascending across 2 octaves
    const scale = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51];
    const freq = scale[Math.min(scale.length - 1, Math.max(0, comboCount - 1))];

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.06, now + 0.08);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.15);
  } catch {
    // ignore
  }
}

export function playTone(type: SoundToneType) {
  const ctx = getCtx();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;

    if (type === 'tap') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(760, now + 0.07);
      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.09);
    } else if (type === 'countdown') {
      // Rhythmic arena pulse + warm wooden chime
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(660, now);
      osc.frequency.exponentialRampToValueAtTime(440, now + 0.14);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.17);
    } else if (type === 'round_start') {
      // Energetic competition start chord ("BAŞLA!")
      const chord = [523.25, 659.25, 783.99, 1046.5];
      chord.forEach((freq, idx) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'triangle';
        o.frequency.setValueAtTime(freq, now + idx * 0.035);
        g.gain.setValueAtTime(0.11, now + idx * 0.035);
        g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.035 + 0.32);
        o.connect(g);
        g.connect(ctx.destination);
        o.start(now + idx * 0.035);
        o.stop(now + idx * 0.035 + 0.34);
      });
    } else if (type === 'timer_urgent') {
      // Fast double-tick urgency pulse for the last 5 seconds
      [0, 0.09].forEach((offset, idx) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(idx === 0 ? 920 : 1180, now + offset);
        g.gain.setValueAtTime(0.075, now + offset);
        g.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.07);
        o.connect(g);
        g.connect(ctx.destination);
        o.start(now + offset);
        o.stop(now + offset + 0.075);
      });
    } else if (type === 'combo_streak') {
      // Sparkling milestone arpeggio (when hitting >=80% live accuracy)
      [783.99, 987.77, 1174.66, 1567.98].forEach((freq, idx) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(freq, now + idx * 0.05);
        g.gain.setValueAtTime(0.09, now + idx * 0.05);
        g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.22);
        o.connect(g);
        g.connect(ctx.destination);
        o.start(now + idx * 0.05);
        o.stop(now + idx * 0.05 + 0.23);
      });
    } else if (type === 'correct' || type === 'victory' || type === 'fanfare') {
      const notes =
        type === 'fanfare'
          ? [523.25, 659.25, 783.99, 1046.5, 987.77, 1046.5, 1318.51, 1567.98]
          : type === 'victory'
          ? [523.25, 659.25, 783.99, 1046.5, 1318.5]
          : [523.25, 659.25, 783.99, 1046.5];
      const step = type === 'fanfare' ? 0.085 : 0.07;
      notes.forEach((freq, idx) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'triangle';
        o.frequency.setValueAtTime(freq, now + idx * step);
        g.gain.setValueAtTime(0.12, now + idx * step);
        g.gain.exponentialRampToValueAtTime(0.001, now + idx * step + 0.3);
        o.connect(g);
        g.connect(ctx.destination);
        o.start(now + idx * step);
        o.stop(now + idx * step + 0.31);
      });
    } else if (type === 'wrong') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(195, now);
      osc.frequency.linearRampToValueAtTime(130, now + 0.22);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.23);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.24);
    } else if (type === 'hint') {
      const notes = [880, 1320];
      notes.forEach((freq, idx) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(freq, now + idx * 0.08);
        g.gain.setValueAtTime(0.095, now + idx * 0.08);
        g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.22);
        o.connect(g);
        g.connect(ctx.destination);
        o.start(now + idx * 0.08);
        o.stop(now + idx * 0.08 + 0.23);
      });
    } else if (type === 'notification') {
      playDilbazSynthChime(ctx, now);
    }
  } catch {
    // Ignore audio context restriction errors
  }
}

function playDilbazSynthChime(ctx: AudioContext, now: number): void {
  // Custom Dilbaz motif: Anatolian Santur / Ebru Golden Chime (D5 -> F#5 -> A5 -> D6 + A6 shimmer)
  const motif = [
    { offset: 0.0, freq: 587.33, dur: 0.36, amp: 0.11 },
    { offset: 0.09, freq: 739.99, dur: 0.38, amp: 0.1 },
    { offset: 0.18, freq: 880.0, dur: 0.44, amp: 0.11 },
    { offset: 0.28, freq: 1174.66, dur: 0.62, amp: 0.13 },
    { offset: 0.3, freq: 1760.0, dur: 0.45, amp: 0.045 }
  ];

  motif.forEach(({ offset, freq, dur, amp }) => {
    const fundamental = ctx.createOscillator();
    const harmonic = ctx.createOscillator();
    const gain = ctx.createGain();
    const harmGain = ctx.createGain();

    fundamental.type = 'triangle';
    fundamental.frequency.setValueAtTime(freq, now + offset);

    harmonic.type = 'sine';
    harmonic.frequency.setValueAtTime(freq * 2, now + offset);

    gain.gain.setValueAtTime(0.001, now + offset);
    gain.gain.linearRampToValueAtTime(amp, now + offset + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + offset + dur);

    harmGain.gain.setValueAtTime(amp * 0.35, now + offset);
    harmGain.gain.exponentialRampToValueAtTime(0.0005, now + offset + dur * 0.55);

    fundamental.connect(gain);
    harmonic.connect(harmGain);
    harmGain.connect(gain);
    gain.connect(ctx.destination);

    fundamental.start(now + offset);
    harmonic.start(now + offset);
    fundamental.stop(now + offset + dur + 0.02);
    harmonic.stop(now + offset + dur + 0.02);
  });
}

let cachedNotifAudio: HTMLAudioElement | null = null;

export function playDilbazNotificationSound(): void {
  if (globalMuted || typeof window === 'undefined') return;
  try {
    const base = import.meta.env.BASE_URL || '/';
    if (!cachedNotifAudio) {
      cachedNotifAudio = new Audio(`${base}sounds/dilbaz-bildirim.wav`);
      cachedNotifAudio.preload = 'auto';
      cachedNotifAudio.volume = 0.85;
    }
    cachedNotifAudio.currentTime = 0;
    const p = cachedNotifAudio.play();
    if (p && typeof p.catch === 'function') {
      p.catch(() => {
        playTone('notification');
      });
    }
  } catch {
    playTone('notification');
  }
}

