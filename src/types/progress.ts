import type { DateStr, ID } from './base';

/** 单个单元的学习进度 */
export interface UnitProgress {
  unitId: ID;
  /** 已学会的单词（文本形式） */
  learnedWords: string[];
  /** 完成百分比 0~100 */
  percent: number;
  completedAt?: number;
}

/** 单个模块的访问统计 */
export interface ModuleStat {
  visits: number;
  minutes: number;
  lastVisitAt?: number;
}

/**
 * 学生私有：学习进度（单对象，存于该生专属 key）。
 */
export interface ProgressState {
  studentId: ID;
  /** 累计学习时长（分钟） */
  totalMinutes: number;
  /** 累计学习天数 */
  totalDays: number;
  /** 连续打卡天数 */
  streakDays: number;
  /** 最后一次学习日期，用于 streak 计算 */
  lastStudyDate?: DateStr;
  /** 各单元进度，key = unitId */
  units: Record<ID, UnitProgress>;
  /** 各模块访问统计，key = 模块 id */
  modules: Record<string, ModuleStat>;
  /** 已完成学习的学习单数 */
  completedLessons: number;
  updatedAt: number;
}
