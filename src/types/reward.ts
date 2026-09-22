import type { DateStr, ID, WeekKey } from './base';

/** 徽章定义 */
export interface BadgeDef {
  id: string;
  name: string;
  desc: string;
  emoji: string;
}

/** 学生已获得的徽章 */
export interface EarnedBadge extends BadgeDef {
  earnedAt: number;
}

/** 徽章表：达成条件由 rewardService 判定 */
export const BADGE_DEFS: BadgeDef[] = [
  { id: 'first-word', name: '第一步', desc: '添加第一个单词', emoji: '🌱' },
  { id: 'word-10', name: '小树苗', desc: '单词库满 10 个词', emoji: '🌿' },
  { id: 'word-50', name: '小树林', desc: '单词库满 50 个词', emoji: '🌳' },
  { id: 'listening-1', name: '小耳朵', desc: '完成 1 期听力', emoji: '👂' },
  { id: 'reading-1', name: '小书虫', desc: '读完 1 本绘本', emoji: '🐛' },
  { id: 'exam-first', name: '考试新手', desc: '完成第一次小测', emoji: '📝' },
  { id: 'exam-perfect', name: '满分达人', desc: '小测拿到满分', emoji: '💯' },
  { id: 'streak-3', name: '坚持三天', desc: '连续学习 3 天', emoji: '🔥' },
  { id: 'streak-7', name: '坚持一周', desc: '连续学习 7 天', emoji: '⭐' },
  { id: 'wrong-clear', name: '错题清道夫', desc: '消灭 5 道错题', emoji: '🧹' },
  { id: 'star-30', name: '星星收藏家', desc: '累计获得 30 颗星', emoji: '🌟' },
  { id: 'all-modules', name: '全能选手', desc: '用过全部 9 个模块', emoji: '👑' },
];

/**
 * 防沉迷：每日星星获取上限。
 * 孩子当天通过学习最多获得 30 颗星（超出部分不再发放），
 * 鼓励适可而止；家长手动调整不受此限制。
 */
export const DAILY_STAR_CAP = 30;

/** 家长/老师的星星手动调整记录（附理由，孩子可查） */
export interface StarAdjustment {
  id: ID;
  /** 正数补发 / 负数扣回 */
  delta: number;
  /** 调整理由（必填） */
  reason: string;
  /** 操作人名称（家长昵称/老师昵称） */
  adjustedBy: string;
  createdAt: number;
}

/**
 * 家长自定义奖品（现实奖励商城）。
 * 与柯基商城不同：这里兑换的是「看一集动画片」「去一次游乐园」等现实奖励，
 * 由家长在控制台编辑、孩子用星星兑换。
 */
export interface RewardShopItem {
  id: ID;
  /** 奖品名，如「看一集动画片」 */
  name: string;
  emoji: string;
  /** 兑换所需星星数 */
  cost: number;
  /** 上架/下架 */
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

/** 孩子的兑换记录 */
export interface RedeemRecord {
  id: ID;
  itemId: ID;
  itemName: string;
  emoji: string;
  cost: number;
  /** 兑换状态：pending = 待家长兑现 */
  status: 'pending' | 'fulfilled';
  redeemedAt: number;
  fulfilledAt?: number;
}

/**
 * 学生私有：奖励状态。
 */
export interface RewardState {
  studentId: ID;
  /** 通用星星数 */
  stars: number;
  /** 金币（可用于后续兑换功能） */
  coins: number;
  /** 已获得徽章 */
  badges: EarnedBadge[];
  /** 每周星星数，key = "2026-W37"，家长周报使用 */
  weeklyStars: Record<WeekKey, number>;
  /** 每日星星记账：date（YYYY-MM-DD）→ 当天学习获得星星数（防沉迷上限依据） */
  dailyStars: Record<DateStr, number>;
  /** 星星手动调整记录（家长/老师操作，最新在前） */
  adjustments: StarAdjustment[];
  /** 家长自定义的现实奖励商城 */
  customShop: RewardShopItem[];
  /** 兑换记录（最新在前） */
  redeemed: RedeemRecord[];
  updatedAt: number;
}
