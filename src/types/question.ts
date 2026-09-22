import type { BaseEntity, DateStr, ID } from './base';

/** 客观题型（可自动判分） */
export type QuestionType = 'choice' | 'listening' | 'reading' | 'fill';

/** 图片描述，供低龄儿童不认字也能懂题 */
export interface QuestionImage {
  emoji: string;
  labelZh: string;
}

/**
 * 题库题目。
 * explanation 必须通俗易懂（面向二年级），并在 UI 上支持语音朗读。
 */
export interface Question extends BaseEntity {
  type: QuestionType;
  /** 题干 */
  question: string;
  /** 听力题的朗读文稿 */
  audioText?: string;
  /** 阅读题的短文 */
  passage?: string;
  /** 配图（低龄重图文） */
  image?: QuestionImage;
  /** 2~4 个选项 */
  options: string[];
  /** 正确答案，必须与 options 中某一项完全一致 */
  correctAnswer: string;
  /** 通俗解析 */
  explanation: string;
  /** 关联单元 */
  unitId?: ID;
  /** 分值 */
  points: number;
}

/** 试卷（单元小测） */
export interface ExamPaper extends BaseEntity {
  title: string;
  titleZh: string;
  coverEmoji: string;
  unitId?: ID;
  questionIds: ID[];
  durationMin: number;
  /** 建议完成日期 */
  scheduledFor?: DateStr;
}

/** 学生私有：一次考试记录 */
export interface ExamRecord extends BaseEntity {
  studentId: ID;
  paperId: ID;
  paperTitle: string;
  answers: {
    questionId: ID;
    answer: string;
    isCorrect: boolean;
  }[];
  score: number;
  totalScore: number;
  finishedAt: number;
  /** 用时（秒） */
  durationSec: number;
}
