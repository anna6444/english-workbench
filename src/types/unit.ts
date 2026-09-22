import type { BaseEntity, ID } from './base';

/**
 * 学习单元（共享教材内容，所有学生共用一份，只读）。
 * 每个单元 ≥15 个核心词汇。
 */
export interface LearningUnit extends BaseEntity {
  title: string;
  titleZh: string;
  coverEmoji: string;
  /** 排序序号 */
  order: number;
  description: string;
  /** 该单元的核心词汇（纯文本，学生首次进入时按需注入自己的单词库） */
  coreWords: string[];
  /** 单元学习目标描述 */
  goals: string[];
  /** 建议学习时长（分钟） */
  estimatedMinutes: number;
}
