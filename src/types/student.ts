import type { BaseEntity, ID } from './base';

/**
 * 学生账号。
 * 所有学习数据（单词库/错题/进度/星星/作业）都按 id 物理隔离存放。
 */
export interface Student extends BaseEntity {
  name: string;
  nickname: string;
  /** 年级，当前项目面向二年级 = 2 */
  grade: number;
  avatar: string;
  /** 绑定的家长 id */
  parentId: ID;
  /** 每日学习目标（分钟），单次学习建议 10-15 分钟 */
  dailyGoalMinutes: number;
  /** 班级/小组，仅展示用 */
  className?: string;
}
