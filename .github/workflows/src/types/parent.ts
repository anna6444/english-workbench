import type { BaseEntity, ID } from './base';

/** 家长角色：家长本人 / 辅导老师（拥有维护题库与批改权限） */
export type GuardianRole = 'parent' | 'tutor';

/**
 * 家长 / 辅导端账号。
 * 同一账号拥有「家长视图」（只读）与「辅导视图」（可管理+批改）两种界面。
 */
export interface Parent extends BaseEntity {
  name: string;
  role: GuardianRole;
  /** emoji 头像，避免外链图片不可达 */
  avatar: string;
  /** 绑定的孩子 id 列表 */
  childIds: ID[];
  /** 登录账号（mock，仅演示） */
  account: string;
  /** 登录口令（mock，仅演示，明文存储；真实项目必须走服务端） */
  password: string;
}

/** 登录页展示用的账号摘要 */
export interface AccountSummary {
  id: ID;
  name: string;
  avatar: string;
  kind: 'parent' | 'student';
  /** 学生专属：所属家长 id */
  parentId?: ID;
  /** 学生专属：年级 */
  grade?: number;
}
