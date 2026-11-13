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
  const prevNorms = splitWords(cleanPrev);
  const nextNorms = splitWords(cleanNext);

  if (prevNorms.length > 0 && nextNorms.length > 0 && prevNorms.length === prevTokens.length && nextNorms.length === nextTokens.length) {
    // Check if next is entirely contained at the end of prev
    const maxOverlap = Math.min(prevNorms.length, nextNorms.length, 10);
    for (let k = maxOverlap; k >= 1; k--) {
      let matched = true;
      for (let i = 0; i < k; i++) {
        if (prevNorms[prevNorms.length - k + i] !== nextNorms[i]) {
          matched = false;
          break;
        }
      }
      if (matched) {
        const remainder = nextTokens.slice(k).join(' ');
        return remainder ? `${cleanPrev} ${remainder}` : cleanPrev;
      }
    }
  }

  return `${cleanPrev} ${cleanNext}`.replace(/\s+/g, ' ').trim();
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

    let matchSum = 0;
    for (const cw of candWords) {
      let maxWordSim = 0;
      for (const tw of targetNormWords) {
        const sim = wordSimilarity(cw, tw);
        if (sim > maxWordSim) maxWordSim = sim;
      }
      if (maxWordSim >= 0.7) {
        matchSum += maxWordSim;
      }
    }

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
    this.pendingStopResolver = null;
    this.isStoppingManually = false;
    this.targetNormWords = callbacks.targetText ? splitWords(callbacks.targetText) : [];

    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRec) {
      callbacks.onError?.(
        'Tarayıcınız ses tanıma özelliğini desteklemiyor (Chrome, Edge veya Safari kullanın). Test için "Simüle Hızlı Oku" butonunu kullanabilirsiniz.'
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
          if (timeSinceActivity < 600) {
            const level = Math.round(45 + Math.random() * 50);
            callbacks.onAudioLevelChange?.(level);
          } else {
            const idleLevel = Math.round(12 + Math.random() * 15);
            callbacks.onAudioLevelChange?.(idleLevel);
          }
        }, 120);
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

    const recognition = new SpeechRec();
    recognition.lang = 'tr-TR';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 5;

    recognition.onaudiostart = () => {
      this.lastActivityAt = Date.now();
    };

    recognition.onsoundstart = () => {
      this.lastActivityAt = Date.now();
    };

    recognition.onspeechstart = () => {
      this.lastActivityAt = Date.now();
    };

    recognition.onresult = (event: any) => {
      this.lastActivityAt = Date.now();
      let finalBuf = '';
      let interimBuf = '';

      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        const piece = pickBestAlternative(result, this.targetNormWords);
        if (!piece) continue;

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
        // Mobile Chrome needs slightly longer gap before restarting audio capture
        const restartDelay = isMobileBrowser() ? 240 : 80;
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
