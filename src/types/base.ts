/** 通用基础类型 */

export type ID = string;

/** 所有实体的公共字段 */
export interface BaseEntity {
  id: ID;
  createdAt: number;
  updatedAt: number;
}

/** 创建时的输入：由仓储层补齐 id / createdAt / updatedAt */
export type CreateInput<T extends BaseEntity> = Omit<
  T,
  'id' | 'createdAt' | 'updatedAt'
>;

/** ISO 周键，如 "2026-W37"，用于周报统计 */
export type WeekKey = string;

/** "2026-09-16" 形式的本地日期串 */
export type DateStr = string;
