/**
 * Turkish text normalization, digit-to-word expansion, and phonetic similarity utilities
 */

const NUMBER_WORDS_ONES = ['', 'bir', 'iki', 'üç', 'dört', 'beş', 'altı', 'yedi', 'sekiz', 'dokuz'];
const NUMBER_WORDS_TENS = ['', 'on', 'yirmi', 'otuz', 'kırk', 'elli', 'altmış', 'yetmiş', 'seksen', 'doksan'];

function intToTurkishWords(n: number): string[] {
  if (!Number.isFinite(n) || n < 0 || n > 9999) return [String(n)];
  if (n === 0) return ['sıfır'];

  const parts: string[] = [];
  const thousands = Math.floor(n / 1000);
  if (thousands > 0) {
    if (thousands > 1) parts.push(NUMBER_WORDS_ONES[thousands]);
    parts.push('bin');
  }

  const remThousands = n % 1000;
  const hundreds = Math.floor(remThousands / 100);
  if (hundreds > 0) {
    if (hundreds > 1) parts.push(NUMBER_WORDS_ONES[hundreds]);
    parts.push('yüz');
  }

  const remHundreds = remThousands % 100;
  const tens = Math.floor(remHundreds / 10);
  const ones = remHundreds % 10;
  if (tens > 0) parts.push(NUMBER_WORDS_TENS[tens]);
  if (ones > 0) parts.push(NUMBER_WORDS_ONES[ones]);

  return parts.filter(Boolean);
}

/**
 * Folds Turkish circumflexes and cleans punctuation without splitting apostrophe-joined suffixes
 * (e.g. "Çatalca'da" -> "çatalcada", matching mobile/PC speech recognition output).
 */
export function normalizeTurkish(text: string): string {
  if (!text) return '';
  return text
    .toLocaleLowerCase('tr-TR')
    .replace(/â/g, 'a')
    .replace(/î/g, 'i')
    .replace(/û/g, 'u')
    .replace(/['’]/g, '')
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?""“”…—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalizes a single original word token so target rawWords[] and origNormWords[] stay 1-to-1 aligned.
 */
export function normalizeSingleWord(word: string): string {
  return normalizeTurkish(word).replace(/\s+/g, '');
}

/**
 * Splits spoken/target text into normalized words while expanding numeric digits
 * that mobile voice recognition frequently produces (e.g. "1" -> "bir", "40" -> "kırk", "50" -> "elli").
 */
export function splitWords(text: string): string[] {
  const norm = normalizeTurkish(text);
  if (!norm) return [];

  const tokens = norm.split(' ').filter(Boolean);
  const expanded: string[] = [];

  for (const token of tokens) {
    if (/^\d{1,4}$/.test(token)) {
      const num = parseInt(token, 10);
      expanded.push(...intToTurkishWords(num));
    } else {
      // Handle attached digits + suffixes like "50lik" -> "elli" + "lik" or "100ü"
      const mixedMatch = token.match(/^(\d{1,4})([a-zçğıöşü]+)$/i);
      if (mixedMatch) {
        const numWords = intToTurkishWords(parseInt(mixedMatch[1], 10));
        if (numWords.length > 0) {
          const lastIdx = numWords.length - 1;
          numWords[lastIdx] = numWords[lastIdx] + mixedMatch[2];
          expanded.push(...numWords);
        } else {
          expanded.push(token);
        }
      } else {
        expanded.push(token);
      }
    }
  }

  return expanded;
}

const PHONETIC_CONFUSION_PAIRS = new Set<string>([
  'ı:i', 'i:ı',
  'o:ö', 'ö:o',
  'u:ü', 'ü:u',
  'c:ç', 'ç:c',
  's:ş', 'ş:s',
  'g:ğ', 'ğ:g'
]);

/**
 * Calculates Turkish-aware weighted Levenshtein similarity (0 to 1) between two words.
 * Softens common mobile ASR Turkish diacritic slips (ı/i, ö/o, ü/u, ğ/g) while keeping true errors distinct.
 */
export function wordSimilarity(w1: string, w2: string): number {
  if (!w1 && !w2) return 1;
  if (!w1 || !w2) return 0;
  if (w1 === w2) return 1;

  const m = w1.length;
  const n = w2.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const c1 = w1[i - 1];
      const c2 = w2[j - 1];
      let cost = 0;
      if (c1 !== c2) {
        cost = PHONETIC_CONFUSION_PAIRS.has(`${c1}:${c2}`) ? 0.35 : 1;
      }
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }

  const distance = dp[m][n];
  const maxLen = Math.max(m, n);
  return Math.max(0, 1 - distance / maxLen);
}
