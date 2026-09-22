import type { BaseEntity } from './base';

/** 绘本的一页：emoji 作插画 + 英文句子 + 中文对照 */
export interface BookPage {
  emoji: string;
  en: string;
  zh: string;
}

/**
 * 低幼绘本读物。
 * 与听力同理：不存图片文件，用 emoji 作插画，规避外链不可达。
 */
export interface PictureBook extends BaseEntity {
  title: string;
  titleZh: string;
  coverEmoji: string;
  level: 1 | 2 | 3;
  pages: BookPage[];
  /** 本册新词，读完后可一键加入单词库 */
  newWords: string[];
  /** 阅读后的小问题 */
  question?: {
    question: string;
    options: string[];
    correctAnswer: string;
    explanation: string;
  };
  estimatedMinutes: number;
}
