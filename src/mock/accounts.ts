/**
 * Mock 数据 —— 账号（1 个家长 + 6 个学生）。
 *
 * 绑定关系设计：
 *   - 家长账号 guardian-1「李妈妈」绑定 3 个孩子（s-1 / s-2 / s-3）
 *     → 用于演示「一个家长管多个孩子」的切换场景
 *   - 辅导账号 guardian-2「王老师」绑定另外 3 个孩子（s-4 / s-5 / s-6）
 *     → 用于演示「辅导视图维护题库、批改作业」
 *
 * 6 个孩子的数据完全隔离：切换孩子时单词库/错题/星星/作业互不可见。
 */

import type { Parent, Student } from '../types';

const T = Date.parse('2026-09-01T07:00:00+08:00');

function student(
  id: string,
  name: string,
  nickname: string,
  avatar: string,
  parentId: string,
  className: string,
  dailyGoalMinutes = 15,
): Student {
  return {
    id,
    name,
    nickname,
    grade: 2,
    avatar,
    parentId,
    dailyGoalMinutes,
    className,
    createdAt: T,
    updatedAt: T,
  };
}

export const MOCK_PARENTS: Parent[] = [
  {
    id: 'guardian-1',
    name: '李妈妈',
    role: 'parent',
    avatar: '👩‍🦰',
    childIds: ['s-1', 's-2', 's-3'],
    account: 'mama',
    password: '1234',
    createdAt: T,
    updatedAt: T,
  },
  {
    id: 'guardian-2',
    name: '王老师',
    role: 'tutor',
    avatar: '👩‍🏫',
    childIds: ['s-4', 's-5', 's-6'],
    account: 'teacher',
    password: '1234',
    createdAt: T,
    updatedAt: T,
  },
];

export const MOCK_STUDENTS: Student[] = [
  student('s-1', '李思远', '远远', '🧒', 'guardian-1', '二年级 3 班'),
  student('s-2', '李思甜', '甜甜', '👧', 'guardian-1', '一年级 1 班', 10),
  student('s-3', '李思齐', '齐齐', '👦', 'guardian-1', '三年级 2 班', 20),
  student('s-4', '陈小满', '满满', '🧑', 'guardian-2', '二年级 1 班'),
  student('s-5', '周乐乐', '乐乐', '👧', 'guardian-2', '二年级 1 班'),
  student('s-6', '吴子涵', '涵涵', '👦', 'guardian-2', '二年级 2 班'),
];

/** 按 id 取学生 */
export function findStudent(id: string): Student | undefined {
  return MOCK_STUDENTS.find((s) => s.id === id);
}

/** 取某家长绑定的所有孩子 */
export function childrenOf(parentId: string): Student[] {
  const parent = MOCK_PARENTS.find((p) => p.id === parentId);
  if (!parent) return [];
  return parent.childIds
    .map((cid) => findStudent(cid))
    .filter((s): s is Student => Boolean(s));
}
