/**
 * 音节切分 —— 服务于「自然拼读」。
 *
 * 算法：元音核 + 最大起始原则（MOP, Maximal Onset Principle）
 *   1. 找出所有元音组（连续元音算一个核）
 *   2. 两个元音核之间的辅音串按规则分配：
 *        - 0 个辅音 → 直接分（li-on）
 *        - 1 个辅音 → 归后一音节（ba-na-na）
 *        - ≥2 个辅音 → 最后一个归后（ap-ple / win-dow）
 *   3. 二合字母（ch/sh/th/ph/wh/ck/ng/qu）必须整体归后，不能拆开
 *   4. 结尾不发音的 e 不单独成音节（make 不切成 ma-ke）
 *
 * 另配特例表覆盖高频不规则词 —— 纯算法无法处理英语里所有情况。
 */

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);

/**
 * 判断某位置上的字符是否充当「元音核」。
 *
 * y 需要特殊处理：
 *   - 词首的 y 是辅音（yes / yellow / yogurt）
 *   - 词中/词尾的 y 是元音（sunny / happy / baby / gym）
 * 不做这个区分的话，sunny 只会识别出 u 一个核，整词无法切分。
 */
function isVowelAt(word: string, index: number): boolean {
  const c = word[index];
  if (VOWELS.has(c)) return true;
  if (c === 'y') return index > 0;
  return false;
}

/** 二合字母：发音上是一个整体，切分时必须保留 */
const DIGRAPHS = ['ch', 'sh', 'th', 'ph', 'wh', 'ck', 'ng', 'qu', 'gh'];

/**
 * 特例表：覆盖算法容易切错的常见词。
 * 优先于算法结果，保证教材里的核心词一定正确。
 */
const EXCEPTIONS: Record<string, string[]> = {
  // -le 结尾
  apple: ['ap', 'ple'],
  people: ['peo', 'ple'],
  table: ['ta', 'ble'],
  little: ['lit', 'tle'],
  middle: ['mid', 'dle'],
  purple: ['pur', 'ple'],
  bottle: ['bot', 'tle'],
  candle: ['can', 'dle'],
  // y 结尾（重读闭音节 + y，算法会把 y 前的辅音误判给后一音节）
  study: ['stud', 'y'],
  ready: ['read', 'y'],
  windy: ['wind', 'y'],
  sunny: ['sun', 'ny'],
  // 不规则
  orange: ['or', 'ange'],
  water: ['wa', 'ter'],
  banana: ['ba', 'na', 'na'],
  family: ['fa', 'mi', 'ly'],
  elephant: ['el', 'e', 'phant'],
  beautiful: ['beau', 'ti', 'ful'],
  every: ['ev', 'ery'],
  because: ['be', 'cause'],
  animal: ['an', 'i', 'mal'],
  hospital: ['hos', 'pi', 'tal'],
  umbrella: ['um', 'brel', 'la'],
  computer: ['com', 'pu', 'ter'],
  birthday: ['birth', 'day'],
  breakfast: ['break', 'fast'],
  // 单音节（不该被切开）
  friend: ['friend'],
  school: ['school'],
  bread: ['bread'],
  house: ['house'],
  mouse: ['mouse'],
  juice: ['juice'],
  tiger: ['ti', 'ger'],
  rabbit: ['rab', 'bit'],
  panda: ['pan', 'da'],
  monkey: ['mon', 'key'],
  pencil: ['pen', 'cil'],
  mother: ['moth', 'er'],
  father: ['fa', 'ther'],
  brother: ['broth', 'er'],
  sister: ['sis', 'ter'],
  teacher: ['teach', 'er'],
  window: ['win', 'dow'],
  yellow: ['yel', 'low'],
  winter: ['win', 'ter'],
  summer: ['sum', 'mer'],
  autumn: ['au', 'tumn'],
  spring: ['spring'],
};

/** 结尾为「辅音 + e」且该 e 不发音 */
function hasSilentFinalE(word: string): boolean {
  return word.length > 2 && /[^aeiou]e$/.test(word);
}

/**
 * 切分音节，返回音节数组。
 * 例：apple → ['ap','ple']；banana → ['ba','na','na']
 */
export function splitSyllables(input: string): string[] {
  const word = input.trim().toLowerCase().replace(/[^a-z]/g, '');
  if (!word) return [];

  // 特例优先
  if (EXCEPTIONS[word]) return EXCEPTIONS[word];

  // 太短的词不切
  if (word.length <= 3) return [word];

  // 没有元音的词（如 myth、rhythm）不切
  if (!word.split('').some((_, idx) => isVowelAt(word, idx))) return [word];

  // ── 1. 找出元音核区间 ──
  const nuclei: { start: number; end: number }[] = [];
  let i = 0;
  while (i < word.length) {
    if (isVowelAt(word, i)) {
      const start = i;
      while (i < word.length && isVowelAt(word, i)) i++;
      nuclei.push({ start, end: i });
    } else {
      i++;
    }
  }

  if (nuclei.length <= 1) return [word];

  // ── 2. 处理结尾不发音的 e ──
  let effective = nuclei;
  if (hasSilentFinalE(word)) {
    const last = nuclei[nuclei.length - 1];
    // 结尾 e 单独成核且位于词尾 → 不算一个音节
    if (last.start >= word.length - 2) {
      effective = nuclei.slice(0, -1);
    }
  }

  if (effective.length <= 1) return [word];

  // ── 3. 按 MOP 规则确定切点 ──
  const cuts: number[] = [];
  for (let k = 0; k < effective.length - 1; k++) {
    const conStart = effective[k].end;
    const conEnd = effective[k + 1].start;
    const consonants = word.slice(conStart, conEnd);

    let cut: number;
    if (consonants.length === 0) {
      // 元音挨着元音 → 直接从中间分
      cut = conStart;
    } else if (consonants.length === 1) {
      // 单个辅音归后一音节（V-CV）
      cut = conStart;
    } else if (consonants.length === 2 && consonants[0] === consonants[1]) {
      // 双写辅音（sunny / happy / puppy）→ 从中间断开，前后各一个
      cut = conStart + 1;
    } else {
      // 其他多辅音：最后一个归后（VC-CV）
      const tail = consonants.slice(-2);
      if (DIGRAPHS.includes(tail)) {
        // 尾部是二合字母 → 整体归后，不能拆
        cut = conEnd - 2;
      } else {
        cut = conEnd - 1;
      }
    }

    if (cut > 0 && cut < word.length) cuts.push(cut);
  }

  // ── 4. 按切点组装 ──
  const unique = Array.from(new Set(cuts)).sort((a, b) => a - b);
  const parts: string[] = [];
  let prev = 0;
  for (const c of unique) {
    parts.push(word.slice(prev, c));
    prev = c;
  }
  parts.push(word.slice(prev));

  const cleaned = parts.filter((s) => s.length > 0);
  return cleaned.length > 1 ? cleaned : [word];
}

/** 展示用：apple → "ap-ple" */
export function formatSyllables(word: string): string {
  return splitSyllables(word).join('-');
}
