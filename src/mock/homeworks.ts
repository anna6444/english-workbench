/**
 * Mock 数据 —— 作业模板 + 试卷。
 *
 * 作业有两种形态，正好覆盖两种批改路径：
 *   - hw-1「单元一单词认读」：客观题 → 自动判分
 *   - hw-2「看图写句」：主观题 → 需要家长在辅导视图人工批改
 */

import type { ExamPaper, Homework } from '../types';

const T = Date.parse('2026-09-01T09:30:00+08:00');

export const MOCK_HOMEWORKS: Homework[] = [
  {
    id: 'hw-1',
    title: 'Unit 1 Word Practice',
    type: 'vocabulary',
    unitId: 'unit-1',
    instructions:
      '把单元一的单词认读一遍，共 6 道小题，答错了会自动记进错题本，别着急～',
    dueInDays: 3,
    questionIds: ['q-101', 'q-103', 'q-105', 'q-106', 'q-109', 'q-112'],
    estimatedMinutes: 8,
    createdAt: T,
    updatedAt: T,
  },
  {
    id: 'hw-2',
    title: 'Look and Write',
    type: 'writing',
    unitId: 'unit-2',
    instructions:
      '看图片写一句英文。不会的单词可以点小喇叭听一听，写不出来也没关系，尽力就好！',
    dueInDays: 5,
    prompts: [
      { emoji: '🍎', promptZh: '这是一个苹果。', sampleEn: 'This is an apple.' },
      { emoji: '🥛', promptZh: '我喜欢牛奶。', sampleEn: 'I like milk.' },
      { emoji: '🍰', promptZh: '蛋糕是甜的。', sampleEn: 'The cake is sweet.' },
      { emoji: '😊', promptZh: '我很开心。', sampleEn: 'I am happy.' },
    ],
    estimatedMinutes: 12,
    createdAt: T + 1,
    updatedAt: T + 1,
  },
];

export const MOCK_PAPERS: ExamPaper[] = [
  {
    id: 'paper-1',
    title: 'Unit 1 Quiz',
    titleZh: '单元一 小测',
    coverEmoji: '📝',
    unitId: 'unit-1',
    questionIds: ['q-101', 'q-102', 'q-103', 'q-104', 'q-106', 'q-107', 'q-108'],
    durationMin: 8,
    scheduledFor: '2026-09-20',
    createdAt: T,
    updatedAt: T,
  },
  {
    id: 'paper-2',
    title: 'Unit 2 Quiz',
    titleZh: '单元二 小测',
    coverEmoji: '✏️',
    unitId: 'unit-2',
    questionIds: ['q-201', 'q-202', 'q-203', 'q-204', 'q-205', 'q-207', 'q-208'],
    durationMin: 8,
    scheduledFor: '2026-09-27',
    createdAt: T + 1,
    updatedAt: T + 1,
  },
];

export function findHomework(id: string): Homework | undefined {
  return MOCK_HOMEWORKS.find((h) => h.id === id);
}

export function findPaper(id: string): ExamPaper | undefined {
  return MOCK_PAPERS.find((p) => p.id === id);
}
