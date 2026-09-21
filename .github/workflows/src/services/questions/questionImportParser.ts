/**
 * 题库批量导入解析器（模块一 1.3：老师粘贴文本 → 题目数组）。
 *
 * 文本格式（一行一题，竖线分隔）：
 *   choice|题干|选项A|选项B|选项C|选项D|答案|解析
 *
 * 规则：
 *   - 第 1 段 type：choice（选择）/ fill（填空），可省略（默认 choice）
 *   - 中间段：题干 + 至少 2 个选项
 *   - 答案段：直接写选项文本，或写 A/B/C/D 字母
 *   - 解析段：可省略
 *   - # 开头的行是注释，空行忽略
 *
 * 示例：
 *   choice|What color is the apple?|red|blue|green|yellow|A|Apples are usually red.
 *   fill|I ___ a student.|am|is|are|be|am|主语 I 用 am。
 */

import type { Question } from '@/types';

export interface ParseResult {
  questions: Omit<Question, 'id' | 'createdAt' | 'updatedAt'>[];
  /** 每条错误的行号与原因，UI 逐行展示方便老师修正 */
  errors: { line: number; reason: string }[];
}

export function parseQuestionText(
  text: string,
  unitId?: string,
  points = 1,
): ParseResult {
  const questions: ParseResult['questions'] = [];
  const errors: ParseResult['errors'] = [];

  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].trim();
    // 空行与注释跳过
    if (!raw || raw.startsWith('#')) continue;

    const parts = raw.split('|').map((s) => s.trim());

    // 第 1 段是题型 or 题干
    let type: Question['type'] = 'choice';
    let cursor = 0;
    if (parts[0] === 'choice' || parts[0] === 'fill') {
      type = parts[0];
      cursor = 1;
    }

    const question = parts[cursor];
    if (!question) {
      errors.push({ line: i + 1, reason: '缺少题干' });
      continue;
    }

    // 最后一段可能是答案或解析；从右往左确定
    // 布局：题干 | opt1..optN | 答案 | [解析]
    let explanation: string | undefined;
    let answer: string | undefined;
    const rest = parts.slice(cursor + 1);

    if (rest.length < 3) {
      errors.push({ line: i + 1, reason: '至少需要 2 个选项 + 1 个答案（题干|选项A|选项B|答案）' });
      continue;
    }

    // 解析（可选）= 最后一段，若剩下还有 ≥4 段（选项们+答案）
    let optsAndAnswer = rest;
    if (rest.length >= 4) {
      explanation = rest[rest.length - 1] || undefined;
      optsAndAnswer = rest.slice(0, -1);
    }
    answer = optsAndAnswer[optsAndAnswer.length - 1];
    const options = optsAndAnswer.slice(0, -1);

    if (options.length < 2) {
      errors.push({ line: i + 1, reason: '选项不足 2 个' });
      continue;
    }

    // 答案归一：A/B/C/D 字母 → 选项文本
    let correctAnswer = answer ?? '';
    const letterIdx = answer?.match(/^([A-Da-d])$/);
    if (letterIdx) {
      const idx = letterIdx[1].toUpperCase().charCodeAt(0) - 65;
      if (idx >= options.length) {
        errors.push({ line: i + 1, reason: `答案 ${answer.toUpperCase()} 超出选项范围（只有 ${options.length} 个选项）` });
        continue;
      }
      correctAnswer = options[idx];
    } else if (!options.includes(correctAnswer)) {
      errors.push({
        line: i + 1,
        reason: `答案「${answer}」必须是选项之一，或写 A/B/C/D 字母`,
      });
      continue;
    }

    questions.push({
      type,
      question,
      options,
      correctAnswer,
      explanation: explanation ?? '仔细想一想再选哦～',
      unitId,
      points,
    });
  }

  return { questions, errors };
}

/** 生成一段示例文本（老师控制台「插入示例」按钮用） */
export const QUESTION_IMPORT_SAMPLE = `# 一行一题：题干|选项A|选项B|选项C|选项D|答案|解析
# 答案可以写选项原文，也可以写 A/B/C/D；解析可省略
choice|What color is the apple?|red|blue|green|yellow|A|Apples are usually red.
choice|Which animal says "moo"?|cat|cow|dog|duck|B|奶牛 moo，小猫喵喵。
fill|I ___ a student.|am|is|are|be|am|主语是 I，用 am。`;
