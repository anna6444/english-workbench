import type { BaseEntity, ID } from './base';
import type { QuestionType } from './question';

/** 作业类型 */
export type HomeworkType = 'reading' | 'writing' | 'vocabulary' | 'listening';

/** 作业提交状态 */
export type SubmissionStatus = 'assigned' | 'submitted' | 'graded';

/** 看图写句的一道小题 */
export interface WritingPrompt {
  emoji: string;
  /** 中文提示，如「这是一只猫」 */
  promptZh: string;
  /** 参考英文答案（供家长辅导视图批改时对照） */
  sampleEn: string;
}

/**
 * 作业模板（共享内容，由家长/辅导端维护）。
 * 具体派发给哪个孩子形成 Assignment。
 */
export interface Homework extends BaseEntity {
  title: string;
  type: HomeworkType;
  unitId?: ID;
  /** 给学生看的说明 */
  instructions: string;
  /** 建议完成天数（相对派发时间） */
  dueInDays: number;
  /** 看图写句题（type=writing 时使用） */
  prompts?: WritingPrompt[];
  /** 关联的题目 id（type=vocabulary / listening 时使用） */
  questionIds?: ID[];
  /** 建议时长（分钟） */
  estimatedMinutes: number;
}

/** 学生私有：收到的一份作业 */
export interface Assignment extends BaseEntity {
  studentId: ID;
  homeworkId: ID;
  homeworkTitle: string;
  homeworkType: HomeworkType;
  assignedBy: ID;
  assignedAt: number;
  dueAt: number;
  status: SubmissionStatus;
}

/** 学生私有：一次提交（含人工批改结果） */
export interface Submission extends BaseEntity {
  studentId: ID;
  assignmentId: ID;
  /** 学生提交的文本内容（看图写句等） */
  content: string;
  /** 客观题自动判分 */
  autoScore?: number;
  autoTotal?: number;
  /** 人工批改评语（辅导视图填写） */
  teacherComment?: string;
  /** 人工批改得分 */
  teacherScore?: number;
  /** 批改人 id */
  gradedBy?: ID;
  gradedAt?: number;
}
