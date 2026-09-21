/**
 * Mock 数据 —— 学习单元（共享内容，所有学生共用）。
 *
 * 遵循「离线词库优先」：coreWords 里的词尽量落在 offlineDictionary 中，
 * 这样学生点进单元学习时，每个词都能 0ms 拿到音标/翻译/例句。
 */

import type { LearningUnit } from '../types';

/** 固定时间戳，保证种子数据幂等（每次重建都得到相同 id/时间） */
const T = Date.parse('2026-09-01T08:00:00+08:00');

function unit(
  id: string,
  order: number,
  title: string,
  titleZh: string,
  coverEmoji: string,
  description: string,
  coreWords: string[],
  goals: string[],
  estimatedMinutes: number,
): LearningUnit {
  return {
    id,
    title,
    titleZh,
    coverEmoji,
    order,
    description,
    coreWords,
    goals,
    estimatedMinutes,
    createdAt: T + order * 1000,
    updatedAt: T + order * 1000,
  };
}

export const MOCK_UNITS: LearningUnit[] = [
  unit(
    'unit-1',
    1,
    'My Family & Friends',
    '我的家人与朋友',
    '👨‍👩‍👧‍👦',
    '认识家里的每个人，学会介绍自己的家人和朋友。',
    [
      'family', 'father', 'mother', 'brother', 'sister',
      'grandpa', 'grandma', 'friend', 'boy', 'girl',
      'baby', 'people', 'name', 'home', 'love',
      'happy', 'big', 'small', 'old', 'young',
    ],
    [
      '能说出 8 个家人称呼',
      '能用 This is my... 介绍家人',
      '能区分 boy / girl、big / small',
    ],
    15,
  ),
  unit(
    'unit-2',
    2,
    'Food & Drink',
    '食物与饮料',
    '🍎🥛',
    '认识日常的食物和饮料，学会表达喜欢吃什么。',
    [
      'apple', 'banana', 'orange', 'bread', 'milk',
      'water', 'juice', 'rice', 'egg', 'cake',
      'noodle', 'candy', 'cookie', 'meat', 'fish',
      'soup', 'eat', 'drink', 'sweet', 'hot',
    ],
    [
      '能说出 10 种食物名称',
      '能用 I like... / I don\'t like... 表达喜好',
      '能听懂并回答 What do you like to eat?',
    ],
    15,
  ),
];

/** 按 id 取单元 */
export function findUnit(id: string): LearningUnit | undefined {
  return MOCK_UNITS.find((u) => u.id === id);
}
