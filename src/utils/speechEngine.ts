// Robust Web Speech API engine tuned for Desktop & Mobile parity, overlap deduplication, and multi-alternative matching

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

  const prevTokens = cleanPrev.split(/\s+/);
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
        if (a !== b && wordSimilarity(a, b) < 0.82) {
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
          if (a !== b && wordSimilarity(a, b) < 0.85) {
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
    if (maxWordSim >= 0.68) {
      matchSum += maxWordSim;
    }
  }
  return matchSum;
}

/**
 * Evaluates ASR alternatives against the target tongue-twister vocabulary so out-of-vocabulary
 * Turkish tongue-twister words (kept in alt 1..4 on mobile) win over common-word autocorrects.
 */
function pickBestAlternative(result: any, targetNormWords: string[]): string {
  const altCount = Math.min(result?.length || 0, 5);
  if (altCount === 0) return '';
  const primary = (result[0]?.transcript || '').trim();
  if (altCount === 1 || targetNormWords.length === 0) return primary;

  let bestTranscript = primary;
  let bestScore = -1;

  for (let a = 0; a < altCount; a++) {
    const candidate = (result[a]?.transcript || '').trim();
    if (!candidate) continue;

    const candWords = splitWords(candidate);
    if (candWords.length === 0) continue;

    const matchSum = scoreTranscriptAgainstTarget(candidate, targetNormWords);
    // Small tie-breaker favoring primary hypothesis (a === 0)
    const score = matchSum / Math.max(1, candWords.length) + (a === 0 ? 0.04 : 0);
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
  private segmentMemory: Map<number, { text: string; targetScore: number }> = new Map();
  private pendingStopResolver: (() => void) | null = null;
  private isStoppingManually: boolean = false;

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

      // Drive audio level smoothly from speech events without opening a competing getUserMedia stream
      if (callbacks.onAudioLevelChange) {
        this.pulseInterval = setInterval(() => {
          if (!this.isListening) return;
          const timeSinceActivity = Date.now() - this.lastActivityAt;
          if (this.lastActivityAt > 0 && timeSinceActivity < 280) {
            const wave = Math.sin(Date.now() / 75) * 14;
            const level = Math.min(98, Math.max(52, Math.round(72 + wave + Math.random() * 14)));
            callbacks.onAudioLevelChange?.(level);
          } else if (this.lastActivityAt > 0 && timeSinceActivity < 560) {
            const decayRatio = 1 - (timeSinceActivity - 280) / 280;
            const level = Math.round(16 + decayRatio * 34);
            callbacks.onAudioLevelChange?.(level);
          } else {
            const idleLevel = Math.round(8 + Math.random() * 8);
            callbacks.onAudioLevelChange?.(idleLevel);
          }
        }, 85);
      }

      return true;
    } catch (err: any) {
      console.error('Failed to start speech recognition:', err);
      this.isListening = false;
      callbacks.onError?.(err?.message || 'Mikrofon başlatılamadı');
      return false;
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
    };

    recognition.onsoundstart = () => {
      const now = Date.now();
      this.lastActivityAt = now;
      if (!this.firstAudioAt) this.firstAudioAt = now;
    };

    recognition.onspeechstart = () => {
      const now = Date.now();
      this.lastActivityAt = now;
      if (!this.firstAudioAt) this.firstAudioAt = now;
      if (!this.firstSpeechAt) this.firstSpeechAt = now;
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

      let finalBuf = '';
      let interimBuf = '';

      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        let piece = pickBestAlternative(result, this.targetNormWords);
        if (!piece) continue;

        // Android Chrome 2nd-pass isFinal rescorer often drops or corrupts out-of-vocabulary
        // tongue-twister words that interim hypotheses recognized correctly. Keep whichever
        // version has significantly better target coverage for this result index.
        if (this.targetNormWords.length > 0) {
          const pieceScore = scoreTranscriptAgainstTarget(piece, this.targetNormWords);
          const prevSeg = this.segmentMemory.get(i);
          if (prevSeg && prevSeg.targetScore > pieceScore + 0.65) {
            piece = prevSeg.text;
          } else {
            this.segmentMemory.set(i, { text: piece, targetScore: pieceScore });
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
        const restartDelay = isMobileBrowser() ? 140 : 60;
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
    recognition.start();
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

  /**
   * Returns an effective start timestamp compensated for mobile microphone initialization lag.
   */
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
