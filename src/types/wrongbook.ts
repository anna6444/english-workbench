import type { BaseEntity, ID } from './base';
import type { QuestionType } from './question';

/** 错题本掌握阈值：连续答对达到该次数即标记为已掌握 */
export const MASTERY_STREAK_THRESHOLD = 2;

/**
 * 学生私有：错题记录。
 * 存题目快照而非只存 id —— 万一题库内容被家长修改，
 * 孩子的错题仍能正常复习，不会变成空白。
 */
export interface WrongRecord extends BaseEntity {
  studentId: ID;
  questionId: ID;
  /** 答错次数 */
  wrongCount: number;
  /** 当前连续答对次数 */
  correctStreak: number;
  /** correctStreak >= MASTERY_STREAK_THRESHOLD 时自动置 true */
  isMastered: boolean;
  lastWrongAt: number;
  lastPracticedAt?: number;
  /** 题目快照，保证错题随时可复习 */
  snapshot: {
    type: QuestionType;
    question: string;
    options: string[];
    correctAnswer: string;
    explanation: string;
    emoji?: string;
    audioText?: string;
    passage?: string;
  };
}
