// Robust Web Speech API engine tuned for Desktop & Mobile parity, overlap deduplication,
// multi-alternative matching, and low-latency real microphone envelope tracking.

import { splitWords, wordSimilarity } from './turkishNorm';

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export interface SpeechEngineCallbacks {
  targetText?: string;
  onTranscriptChange: (transcript: string, isFinal: boolean) => void;
  onAudioLevelChange?: (level: number) => void;
  onAudioReady?: () => void;
  onError?: (errorMessage: string) => void;
  onEnd?: () => void;
}

function isMobileBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

/**
 * Flattens a segment into raw-token-mapped normalized units so overlap deduplication works
 * even when mobile ASR outputs numbers ("40"), punctuation, or slight diacritic variations.
 */
function buildNormUnits(text: string): { norm: string; tokenIdx: number }[] {
  const rawTokens = text.trim().split(/\s+/).filter(Boolean);
  const units: { norm: string; tokenIdx: number }[] = [];
  for (let t = 0; t < rawTokens.length; t++) {
    const expanded = splitWords(rawTokens[t]);
    for (const norm of expanded) {
      units.push({ norm, tokenIdx: t });
    }
  }
  return units;
}

/**
 * Merges two speech segments while stripping overlapping suffix/prefix words
 * (prevents Android Chrome continuous=true from duplicating trailing words across restarts/results).
 */
function mergeSegmentsWithoutOverlap(prev: string, next: string): string {
  const cleanPrev = prev.trim();
  const cleanNext = next.trim();
  if (!cleanPrev) return cleanNext;
  if (!cleanNext) return cleanPrev;

  const nextTokens = cleanNext.split(/\s+/);
  const prevUnits = buildNormUnits(cleanPrev);
  const nextUnits = buildNormUnits(cleanNext);

  if (prevUnits.length > 0 && nextUnits.length > 0) {
    // 1) Check if next's prefix overlaps prev's suffix (with phonetic tolerance for ASR interim->final revisions)
    const maxOverlap = Math.min(prevUnits.length, nextUnits.length, 14);
    for (let k = maxOverlap; k >= 1; k--) {
      let matched = true;
      for (let i = 0; i < k; i++) {
        const a = prevUnits[prevUnits.length - k + i].norm;
        const b = nextUnits[i].norm;
        if (a !== b && wordSimilarity(a, b) < 0.8) {
          matched = false;
          break;
        }
      }
      if (matched) {
        if (k >= nextUnits.length) {
          return cleanPrev;
        }
        const cutTokenIdx = nextUnits[k].tokenIdx;
        const remainder = nextTokens.slice(cutTokenIdx).join(' ');
        return remainder ? `${cleanPrev} ${remainder}` : cleanPrev;
      }
    }

    // 2) Check if entire next is a short repeated echo inside the last 6 units of prev (Android Chrome quirk)
    if (nextUnits.length <= 4 && prevUnits.length >= nextUnits.length) {
      const tailStart = Math.max(0, prevUnits.length - 6);
      for (let start = tailStart; start <= prevUnits.length - nextUnits.length; start++) {
        let allMatch = true;
        for (let i = 0; i < nextUnits.length; i++) {
          const a = prevUnits[start + i].norm;
          const b = nextUnits[i].norm;
          if (a !== b && wordSimilarity(a, b) < 0.84) {
            allMatch = false;
            break;
          }
        }
        if (allMatch) {
          return cleanPrev;
        }
      }
    }
  }

  return `${cleanPrev} ${cleanNext}`.replace(/\s+/g, ' ').trim();
}

/**
 * Counts how well a candidate transcript matches the target vocabulary.
 */
function scoreTranscriptAgainstTarget(text: string, targetNormWords: string[]): number {
  if (!text.trim() || targetNormWords.length === 0) return 0;
  const candWords = splitWords(text);
  if (candWords.length === 0) return 0;

  let matchSum = 0;
  for (const cw of candWords) {
    let maxWordSim = 0;
    for (const tw of targetNormWords) {
      const sim = wordSimilarity(cw, tw);
      if (sim > maxWordSim) maxWordSim = sim;
    }
    if (maxWordSim >= 0.65) {
      matchSum += maxWordSim;
    }
  }
  return matchSum;
}

/**
 * Evaluates ASR alternatives against the target tongue-twister vocabulary using total matched
 * coverage (never dividing by length, so full phrases are never beaten by 1-word snippets).
 */
function pickBestAlternative(result: any, targetNormWords: string[]): string {
  const altCount = Math.min(result?.length || 0, 5);
  if (altCount === 0) return '';
  const primary = (result[0]?.transcript || '').trim();
  if (altCount === 1 || targetNormWords.length === 0) return primary;

  let bestTranscript = primary;
  let bestScore = -1e6;

  for (let a = 0; a < altCount; a++) {
    const candidate = (result[a]?.transcript || '').trim();
    if (!candidate) continue;

    const candWords = splitWords(candidate);
    if (candWords.length === 0) continue;

    const matchSum = scoreTranscriptAgainstTarget(candidate, targetNormWords);
    const unmatchedApprox = Math.max(0, candWords.length - matchSum);
    // Reward total matched target words while mildly penalizing spurious noise and preferring alt 0 on ties
    const score = matchSum - unmatchedApprox * 0.14 + (a === 0 ? 0.08 : 0);
    if (score > bestScore) {
      bestScore = score;
      bestTranscript = candidate;
    }
  }

  return bestTranscript;
}

export class SpeechEngine {
  private recognition: any = null;
  private isListening: boolean = false;
  private committedTranscript: string = '';
  private sessionFinal: string = '';
  private sessionInterim: string = '';
  private latestTranscript: string = '';
  private targetNormWords: string[] = [];
  private pulseInterval: any = null;
  private lastActivityAt: number = 0;
  private firstAudioAt: number = 0;
  private firstSpeechAt: number = 0;
  private lastSpeechAt: number = 0;
  private segmentMemory: Map<number, { text: string; targetScore: number; wordCount: number }> =
    new Map();
  private pendingStopResolver: (() => void) | null = null;
  private isStoppingManually: boolean = false;
  private audioReadyEmitted: boolean = false;

  // Real-time AnalyserNode metering for zero-latency desktop voice sync
  private micStream: MediaStream | null = null;
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private meterRafId: number | null = null;
  private micActive: boolean = false;

  public static isSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      (Boolean(window.SpeechRecognition) || Boolean(window.webkitSpeechRecognition))
    );
  }

  public async start(callbacks: SpeechEngineCallbacks): Promise<boolean> {
    this.stop();

    this.committedTranscript = '';
    this.sessionFinal = '';
    this.sessionInterim = '';
    this.latestTranscript = '';
    this.lastActivityAt = 0;
    this.firstAudioAt = 0;
    this.firstSpeechAt = 0;
    this.lastSpeechAt = 0;
    this.segmentMemory.clear();
    this.pendingStopResolver = null;
    this.isStoppingManually = false;
    this.audioReadyEmitted = false;
    this.targetNormWords = callbacks.targetText ? splitWords(callbacks.targetText) : [];

    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRec) {
      callbacks.onError?.(
        'Tarayıcınız ses tanıma özelliğini desteklemiyor (Chrome, Edge veya Safari kullanın).'
      );
      return false;
    }

    try {
      this.isListening = true;
      this.initRecognitionInstance(SpeechRec, callbacks);

      if (callbacks.onAudioLevelChange) {
        // On desktop, run a real 60fps AnalyserNode mic meter for zero-latency voice reactivity;
        // on mobile, keep single-stream SpeechRecognition and drive smooth event-based envelope.
        if (!isMobileBrowser()) {
          void this.startRealMicMeter(callbacks);
        }
        this.startEventEnvelopeFallback(callbacks);
      }

      return true;
    } catch (err: any) {
      console.error('Failed to start speech recognition:', err);
      this.isListening = false;
      callbacks.onError?.(err?.message || 'Mikrofon başlatılamadı');
      return false;
    }
  }

  private async startRealMicMeter(callbacks: SpeechEngineCallbacks) {
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      if (!this.isListening || this.isStoppingManually) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      const winAudio = window as unknown as {
        AudioContext?: typeof AudioContext;
        webkitAudioContext?: typeof AudioContext;
      };
      const AudioCtx = winAudio.AudioContext || winAudio.webkitAudioContext;
      if (!AudioCtx) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') {
        await ctx.resume().catch(() => undefined);
      }

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.52;
      source.connect(analyser);

      this.micStream = stream;
      this.audioCtx = ctx;
      this.analyser = analyser;
      this.micActive = true;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      let smoothed = 8;

      const tick = () => {
        if (!this.isListening || !this.analyser) return;
        this.analyser.getByteTimeDomainData(dataArray);

        let sumSq = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const norm = (dataArray[i] - 128) / 128;
          sumSq += norm * norm;
        }
        const rms = Math.sqrt(sumSq / dataArray.length);
        // Map typical spoken RMS (0.015 .. 0.25) to responsive 8..100 scale
        const instant = Math.min(100, Math.max(8, Math.round(rms * 420 + 6)));
        smoothed = smoothed * 0.45 + instant * 0.55;

        if (instant >= 26) {
          this.lastActivityAt = Date.now();
        }
        callbacks.onAudioLevelChange?.(Math.round(smoothed));
        this.meterRafId = requestAnimationFrame(tick);
      };

      this.meterRafId = requestAnimationFrame(tick);
    } catch {
      // Silently fall back to speech-event envelope if getUserMedia is unavailable
      this.micActive = false;
    }
  }

  private startEventEnvelopeFallback(callbacks: SpeechEngineCallbacks) {
    this.pulseInterval = setInterval(() => {
      if (!this.isListening || this.micActive) return;
      const timeSinceActivity = Date.now() - this.lastActivityAt;
      if (this.lastActivityAt > 0 && timeSinceActivity < 320) {
        const wave = Math.sin(Date.now() / 65) * 14;
        const level = Math.min(98, Math.max(54, Math.round(74 + wave + Math.random() * 12)));
        callbacks.onAudioLevelChange?.(level);
      } else if (this.lastActivityAt > 0 && timeSinceActivity < 620) {
        const decayRatio = 1 - (timeSinceActivity - 320) / 300;
        const level = Math.round(14 + decayRatio * 36);
        callbacks.onAudioLevelChange?.(level);
      } else {
        const idleLevel = Math.round(8 + Math.random() * 6);
        callbacks.onAudioLevelChange?.(idleLevel);
      }
    }, 65);
  }

  private stopMicMeter() {
    this.micActive = false;
    if (this.meterRafId !== null) {
      cancelAnimationFrame(this.meterRafId);
      this.meterRafId = null;
    }
    if (this.micStream) {
      try {
        this.micStream.getTracks().forEach((t) => t.stop());
      } catch {
        // ignore
      }
      this.micStream = null;
    }
    if (this.audioCtx) {
      try {
        void this.audioCtx.close();
      } catch {
        // ignore
      }
      this.audioCtx = null;
    }
    this.analyser = null;
  }

  private notifyAudioReady(callbacks: SpeechEngineCallbacks) {
    if (!this.audioReadyEmitted) {
      this.audioReadyEmitted = true;
      callbacks.onAudioReady?.();
    }
  }

  private initRecognitionInstance(SpeechRec: any, callbacks: SpeechEngineCallbacks) {
    if (!this.isListening) return;

    this.segmentMemory.clear();
    const recognition = new SpeechRec();
    recognition.lang = 'tr-TR';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 5;

    recognition.onaudiostart = () => {
      const now = Date.now();
      this.lastActivityAt = now;
      if (!this.firstAudioAt) this.firstAudioAt = now;
      this.notifyAudioReady(callbacks);
    };

    recognition.onsoundstart = () => {
      const now = Date.now();
      this.lastActivityAt = now;
      if (!this.firstAudioAt) this.firstAudioAt = now;
      this.notifyAudioReady(callbacks);
    };

    recognition.onspeechstart = () => {
      const now = Date.now();
      this.lastActivityAt = now;
      if (!this.firstAudioAt) this.firstAudioAt = now;
      if (!this.firstSpeechAt) this.firstSpeechAt = now;
      this.notifyAudioReady(callbacks);
    };

    recognition.onspeechend = () => {
      this.lastActivityAt = Math.min(this.lastActivityAt, Date.now() - 320);
    };

    recognition.onsoundend = () => {
      this.lastActivityAt = Math.min(this.lastActivityAt, Date.now() - 400);
    };

    recognition.onresult = (event: any) => {
      const now = Date.now();
      this.lastActivityAt = now;
      if (!this.firstAudioAt) this.firstAudioAt = now;
      this.notifyAudioReady(callbacks);

      let finalBuf = '';
      let interimBuf = '';

      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        let piece = pickBestAlternative(result, this.targetNormWords);
        if (!piece) continue;

        const pieceWords = splitWords(piece);

        // Protect finalized segments against Android Chrome 2nd-pass rescorer dropping or mangling
        // out-of-vocabulary tongue-twister words, while NEVER freezing evolving interim hypotheses.
        if (this.targetNormWords.length > 0) {
          const pieceScore = scoreTranscriptAgainstTarget(piece, this.targetNormWords);
          const prevSeg = this.segmentMemory.get(i);

          if (
            result.isFinal &&
            prevSeg &&
            prevSeg.targetScore > pieceScore + 0.65 &&
            prevSeg.wordCount >= pieceWords.length
          ) {
            piece = prevSeg.text;
          } else {
            this.segmentMemory.set(i, {
              text: piece,
              targetScore: pieceScore,
              wordCount: pieceWords.length
            });
          }
        }

        if (result.isFinal) {
          finalBuf = mergeSegmentsWithoutOverlap(finalBuf, piece);
        } else {
          interimBuf = mergeSegmentsWithoutOverlap(interimBuf, piece);
        }
      }

      this.sessionFinal = finalBuf.trim();
      this.sessionInterim = interimBuf.trim();

      let combined = mergeSegmentsWithoutOverlap(this.committedTranscript, this.sessionFinal);
      combined = mergeSegmentsWithoutOverlap(combined, this.sessionInterim);

      if (combined.trim()) {
        if (!this.firstSpeechAt) this.firstSpeechAt = now;
        if (combined !== this.latestTranscript) {
          this.lastSpeechAt = now;
        }
      }

      this.latestTranscript = combined;
      callbacks.onTranscriptChange(combined, !this.sessionInterim);
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'no-speech' || event.error === 'aborted') {
        return;
      }
      console.warn('Speech recognition error:', event.error);
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        this.isListening = false;
        this.stopMicMeter();
        callbacks.onError?.('Mikrofon izni reddedildi. Tarayıcı ayarlarından mikrofon izni verin.');
      } else {
        callbacks.onError?.(`Mikrofon uyarısı: ${event.error}`);
      }
    };

    recognition.onend = () => {
      // Commit everything captured in this session before potential auto-restart or final stop
      const sessionText = mergeSegmentsWithoutOverlap(this.sessionFinal, this.sessionInterim);
      if (sessionText) {
        this.committedTranscript = mergeSegmentsWithoutOverlap(
          this.committedTranscript,
          sessionText
        );
        this.latestTranscript = this.committedTranscript;
        this.sessionFinal = '';
        this.sessionInterim = '';
        callbacks.onTranscriptChange(this.latestTranscript, true);
      }

      if (this.pendingStopResolver) {
        const resolve = this.pendingStopResolver;
        this.pendingStopResolver = null;
        resolve();
        return;
      }

      if (this.isListening && !this.isStoppingManually) {
        const restartDelay = isMobileBrowser() ? 110 : 40;
        setTimeout(() => {
          if (this.isListening && !this.isStoppingManually) {
            try {
              this.initRecognitionInstance(SpeechRec, callbacks);
            } catch {
              callbacks.onEnd?.();
            }
          }
        }, restartDelay);
      } else {
        callbacks.onEnd?.();
      }
    };

    this.recognition = recognition;
    try {
      recognition.start();
    } catch {
      // Handle transient start race cleanly
    }
  }

  public getLatestTranscript(): string {
    return this.latestTranscript.trim();
  }

  /**
   * Returns fair [startMs, endMs] speaking bounds so mobile mic warm-up lag and
   * post-speech silence auto-stop wait time never inflate reading duration.
   */
  public getSpeakingBounds(
    fallbackStartMs: number,
    fallbackEndMs: number = Date.now()
  ): { startMs: number; endMs: number } {
    const mobile = isMobileBrowser();
    const maxLag = mobile ? 2400 : 1400;

    // Prefer true speech onset (minus natural onset cushion) over silent onaudiostart
    const rawOnset =
      this.firstSpeechAt > fallbackStartMs
        ? Math.max(fallbackStartMs, this.firstSpeechAt - 280)
        : this.firstAudioAt > fallbackStartMs
        ? this.firstAudioAt
        : fallbackStartMs;

    const lag = Math.max(0, Math.min(maxLag, rawOnset - fallbackStartMs));
    const startMs = fallbackStartMs + lag;

    // Trim trailing silence detection delay & ASR finalization latency
    const endMs =
      this.lastSpeechAt > startMs + 400
        ? Math.min(fallbackEndMs, this.lastSpeechAt + 320)
        : fallbackEndMs;

    return {
      startMs,
      endMs: Math.max(startMs + 800, endMs)
    };
  }

  public getEffectiveStartTime(fallbackStartMs: number): number {
    return this.getSpeakingBounds(fallbackStartMs).startMs;
  }

  public getLastSpeechTimestamp(): number {
    return this.lastSpeechAt;
  }

  /**
   * Stops recognition and waits briefly (especially helpful on Mobile Chrome/Safari)
   * so any buffered final speech results flush before evaluation.
   */
  public async stopAsync(maxWaitMs?: number): Promise<string> {
    const waitMs = maxWaitMs ?? (isMobileBrowser() ? 380 : 160);
    this.isStoppingManually = true;
    this.isListening = false;
    this.stopMicMeter();

    if (this.pulseInterval) {
      clearInterval(this.pulseInterval);
      this.pulseInterval = null;
    }

    const rec = this.recognition;
    if (!rec) {
      return this.latestTranscript.trim();
    }

    await new Promise<void>((resolve) => {
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        this.pendingStopResolver = null;
        resolve();
      };

      const timeoutId = setTimeout(done, waitMs);
      this.pendingStopResolver = () => {
        clearTimeout(timeoutId);
        done();
      };

      try {
        rec.stop();
      } catch {
        clearTimeout(timeoutId);
        done();
      }
    });

    this.recognition = null;
    return this.latestTranscript.trim();
  }

  public stop(): string {
    this.isStoppingManually = true;
    this.isListening = false;
    this.pendingStopResolver = null;
    this.stopMicMeter();

    if (this.pulseInterval) {
      clearInterval(this.pulseInterval);
      this.pulseInterval = null;
    }

    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {
        // ignore
      }
      this.recognition = null;
    }

    return this.latestTranscript.trim();
  }
}
