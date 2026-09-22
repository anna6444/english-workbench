/**
 * 音色优选：模拟「中考听力风格」的发音。
 *
 * 评分优先级（高 → 低）：
 *   100  en-US + Microsoft + Natural   （Edge 的神经网络音色，最接近考试录音）
 *    95  en-US + Aria/Guy/Jenny/Michelle（微软指定优质音色）
 *    90  en-US + Microsoft
 *    80  en-US + Google
 *    70  en-US 其他
 *    60  en 其他地区（en-GB / en-AU）
 *    30  任意 en 开头
 *
 * 同分时优先 localService（本地合成，延迟低且离线可用）。
 */

interface ScoreRule {
  label: string;
  score: number;
  test: (v: SpeechSynthesisVoice) => boolean;
}

const SCORE_RULES: ScoreRule[] = [
  {
    label: 'MS Natural',
    score: 100,
    test: (v) => /en[-_]US/i.test(v.lang) && /Microsoft/i.test(v.name) && /Natural/i.test(v.name),
  },
  {
    label: 'MS 优质音色',
    score: 95,
    test: (v) => /en[-_]US/i.test(v.lang) && /Aria|Guy|Jenny|Michelle|Eric|Roger/i.test(v.name),
  },
  {
    label: 'MS 常规',
    score: 90,
    test: (v) => /en[-_]US/i.test(v.lang) && /Microsoft/i.test(v.name),
  },
  {
    label: 'Google US',
    score: 80,
    test: (v) => /en[-_]US/i.test(v.lang) && /Google/i.test(v.name),
  },
  {
    label: 'en-US 其他',
    score: 70,
    test: (v) => /en[-_]US/i.test(v.lang),
  },
  {
    label: 'en 其他地区',
    score: 60,
    test: (v) => /^en/i.test(v.lang),
  },
];

/** 给单个音色打分 */
export function scoreVoice(voice: SpeechSynthesisVoice): number {
  const rule = SCORE_RULES.find((r) => r.test(voice));
  if (!rule) return 0;
  // ×10 留出空间，再用 localService 做同分排序
  return rule.score * 10 + (voice.localService ? 1 : 0);
}

/** 从音色列表中选出最合适的一个；没有英文音色则返回 null */
export function selectBestVoice(
  voices: SpeechSynthesisVoice[],
): SpeechSynthesisVoice | null {
  const english = voices.filter((v) => /^en/i.test(v.lang));
  if (!english.length) return null;

  let best: SpeechSynthesisVoice | null = null;
  let bestScore = -1;
  for (const v of english) {
    const s = scoreVoice(v);
    if (s > bestScore) {
      bestScore = s;
      best = v;
    }
  }
  return best;
}

/** 描述当前音色的质量，用于在界面上给家长提示 */
export function describeVoice(voice: SpeechSynthesisVoice | null): string {
  if (!voice) return '未找到英文音色（发音可能不标准）';
  const rule = SCORE_RULES.find((r) => r.test(voice));
  return `${voice.name}（${rule?.label ?? '未知音色'}）`;
}
