/**
 * 鉴权类型 —— 三种角色的单一事实来源。
 *
 * 修复的漏洞（旧版）：
 *   旧 SessionProvider 只有「家长/老师账号」概念，学生没有独立登录流程，
 *   且家长登录后 viewMode 默认 'student'，直接落进学生页面。
 *
 * 新模型：
 *   role = 'student' | 'parent' | 'tutor'，登录即定型，路由层按 role 分发。
 *   - student：学生本人登录（点头像 / 输入名字），只能进学生端。
 *   - parent：家长登录 → 家长视图（只读仪表盘 + 切换孩子）。
 *   - tutor：老师登录 → 辅导视图（绑定管理 + 布置作业 + 批改 + 错题汇总）。
 */

import type { ID, Parent, Student } from '@/types';

export type AuthRole = 'student' | 'parent' | 'tutor';

export interface AuthContextValue {
  /** 会话恢复中（读 localStorage + 校验账号存在） */
  ready: boolean;
  /** 当前登录角色，未登录为 null */
  role: AuthRole | null;
  /** 家长/老师登录的账号对象（学生登录为 null） */
  guardian: Parent | null;
  /** 学生登录的学生对象（家长/老师登录为 null） */
  student: Student | null;
  /** 家长/老师绑定的孩子列表（学生登录为 [自己]） */
  children: Student[];
  /**
   * 当前查看的学生 id —— 所有学生私有数据的唯一入口：
   *   学生登录 = 自己；家长/老师 = 正在下拉选中的孩子。
   * 切换孩子只改这一个值，各页面按它重拉数据，天然做到「切换=换一套数据」。
   */
  currentStudentId: ID | null;
  /** 当前查看的学生对象（含昵称头像） */
  currentStudent: Student | null;
  /* ── 动作 ── */
  loginStudent: (s: Student) => void;
  loginGuardian: (g: Parent, kids: Student[]) => void;
  /** 家长/老师视图内切换正在查看的孩子 */
  switchStudent: (id: ID) => void;
  /** 老师绑定/解绑孩子后刷新孩子列表 */
  refreshChildren: () => Promise<void>;
  logout: () => void;
}
