import type { DateStr, ID } from './base';

/**
 * 3D 柯基养成 —— 每个孩子固定一只柯基，按 studentId 物理隔离。
 * （约束：不支持多宠物，一个孩子一只，终身绑定）
 *
 * v2 扩展：持续喂养长期激励体系 ——
 *   每日任务（5 词 + 10 星 → 属性回满，未完成次日饱食下降）
 *   周/月挑战（30 词豪华礼包 / 100 词等级上限提升新形态）
 *   柯基日记（每日自动记录 + 翻看）
 *   升级双条件（喂食经验 + 累计学习单词数）
 */
export interface CorgiState {
  studentId: ID;
  /** 柯基名字（孩子可改，默认「小柯基」） */
  name: string;
  /** 饱食度 0-100，随时间缓慢下降 */
  satiety: number;
  /** 快乐度 0-100 */
  happiness: number;
  /** 亲密度 0-100，靠互动累积 */
  intimacy: number;
  /** 等级 1-10（月挑战达成后上限提升至 15） */
  level: number;
  /** 当前等级内经验值 */
  xp: number;
  /** 消耗品背包：itemId → 数量 */
  inventory: Record<string, number>;
  /** 已购永久道具 id（蝴蝶结/帽子/豪华狗窝/披风/翅膀…） */
  ownedPermanent: string[];
  /** 佩戴中饰品：'bow' | 'hat' | 'cape' | null */
  equippedAccessory: string | null;
  /** 豪华狗窝（场景升级） */
  hasLuxuryNest: boolean;
  /** 每日任务进度（学 5 个词 + 拿 10 颗星 → 属性回满） */
  dailyMission?: CorgiDailyMission;
  /** 柯基日记（最新在前，页面倒序展示） */
  diary: CorgiDiaryEntry[];
  /** 累计学会单词总数（升级双条件之二） */
  learnedWordCount: number;
  /** 月挑战达成：等级上限 10 → 15（新形态解锁） */
  maxLevelBoosted: boolean;
  /** 周词数记账：weekKey（如 2026-W37）→ 本周学会词数 */
  weeklyWords: Record<string, number>;
  /** 月词数记账：monthKey（如 2026-09）→ 本月学会词数 */
  monthlyWords: Record<string, number>;
  /** 已领取的挑战礼包 key，如 'weekly-2026-W37' / 'monthly-2026-09' */
  claimedChallenges: string[];
  /** 上次属性结算时间戳（离线饥饿/无聊衰减用） */
  lastTick: number;
  createdAt: number;
}

/* ───────────────────────── 每日任务 ───────────────────────── */

/** 每日任务目标：学 5 个词 + 当日获得 10 颗星 */
export const DAILY_MISSION_WORDS = 5;
export const DAILY_MISSION_STARS = 10;

/** 每日任务进度（柯基持续喂养的核心状态） */
export interface CorgiDailyMission {
  /** 任务归属日期 YYYY-MM-DD（跨天自动重置并结算昨日惩罚） */
  date: DateStr;
  /** 今日已学单词数 */
  wordsDone: number;
  /** 今日任务是否已结算（达成后回满属性，只结算一次） */
  settled: boolean;
}

/* ───────────────────────── 柯基日记 ───────────────────────── */

/** 日记条目：柯基视角记录每天的学习互动 */
export interface CorgiDiaryEntry {
  id: ID;
  date: DateStr;
  /** 心情 emoji：😊🐶🍖💤🎉… */
  mood: string;
  /** 日记正文（柯基第一人称口吻） */
  text: string;
  createdAt: number;
}

/* ───────────────────────── 周期挑战 ───────────────────────── */

/** 周挑战：一周学会 30 词 → 豪华大礼包（星星 + 消耗品礼包） */
export const WEEKLY_CHALLENGE_WORDS = 30;
/** 月挑战：一月学会 100 词 → 等级上限 10→15 + 星光披风新形态 */
export const MONTHLY_CHALLENGE_WORDS = 100;

/** 周挑战礼包内容（领取时发放） */
export const WEEKLY_GIFT = {
  stars: 30,
  inventory: { food: 3, ball: 2, bubble: 2 } as Record<string, number>,
} as const;

/* ───────────────────────── 连续打卡解锁 ───────────────────────── */

/**
 * 连续学习天数解锁（数据源：ProgressState.streakDays，实时推导，无需存储）
 *   3 天 → 洗澡动画（CorgiPage 出现「洗澡」按钮，播放泡泡动画）
 *   7 天 → 新衣服「星星披风」（免费佩戴）
 *   30 天 → 飞行背景（小院变成天空场景）
 */
export const STREAK_UNLOCK_BATH = 3;
export const STREAK_UNLOCK_CLOTHES = 7;
export const STREAK_UNLOCK_FLYING = 30;

/* ───────────────────────── 商城道具 ───────────────────────── */

export type ShopItemKind = 'consumable' | 'accessory' | 'scene';

export interface ShopItem {
  id: string;
  icon: string;
  name: string;
  price: number;
  desc: string;
  kind: ShopItemKind;
  /** 消耗品效果 */
  effect?: { satiety?: number; happiness?: number };
  /**
   * 成长型道具等级门槛：柯基等级不足时无法购买。
   * 「商城与养成深度绑定」——高级道具要先把柯基养大才配得上。
   */
  minLevel?: number;
}

/** 商城货架（与星星经济打通：学会单词+1星 / 完成小测+5星 / 批改+2星） */
export const SHOP_ITEMS: ShopItem[] = [
  {
    id: 'bone',
    icon: '🦴',
    name: '磨牙棒',
    price: 8,
    desc: '饱食度 +15',
    kind: 'consumable',
    effect: { satiety: 15 },
  },
  {
    id: 'food',
    icon: '🍖',
    name: '狗粮',
    price: 10,
    desc: '饱食度 +30',
    kind: 'consumable',
    effect: { satiety: 30 },
  },
  {
    id: 'ball',
    icon: '🎾',
    name: '网球',
    price: 15,
    desc: '快乐度 +25',
    kind: 'consumable',
    effect: { happiness: 25 },
  },
  {
    id: 'bubble',
    icon: '🛁',
    name: '洗澡泡泡',
    price: 20,
    desc: '快乐度 +15',
    kind: 'consumable',
    effect: { happiness: 15 },
  },
  {
    id: 'cake',
    icon: '🍰',
    name: '元气蛋糕',
    price: 25,
    desc: '饱食 +40 快乐 +40 · 需 Lv.4',
    kind: 'consumable',
    effect: { satiety: 40, happiness: 40 },
    minLevel: 4,
  },
  {
    id: 'bow',
    icon: '🎀',
    name: '蝴蝶结',
    price: 30,
    desc: '永久佩戴 · 戴在头上',
    kind: 'accessory',
  },
  {
    id: 'hat',
    icon: '🎩',
    name: '小礼帽',
    price: 30,
    desc: '永久佩戴 · 绅士风',
    kind: 'accessory',
  },
  {
    id: 'cape',
    icon: '🌟',
    name: '星星披风',
    price: 45,
    desc: '永久佩戴 · 闪闪发光 · 需 Lv.5',
    kind: 'accessory',
    minLevel: 5,
  },
  {
    id: 'wings',
    icon: '🪽',
    name: '天使翅膀',
    price: 60,
    desc: '永久场景 · 柯基会飞啦 · 需 Lv.8',
    kind: 'scene',
    minLevel: 8,
  },
  {
    id: 'nest',
    icon: '🛏️',
    name: '豪华狗窝',
    price: 50,
    desc: '永久场景 · 柯基的家大升级',
    kind: 'scene',
  },
];

export function findShopItem(id: string): ShopItem | undefined {
  return SHOP_ITEMS.find((i) => i.id === id);
}

/* ───────────────────────── 等级经验表 ───────────────────────── */

/** 常规等级上限；月挑战达成后提升至 15（新形态） */
export const CORGI_MAX_LEVEL = 10;
export const CORGI_BOOSTED_MAX_LEVEL = 15;

/** 每升一级需要的「累计学习单词数」（升级双条件之二） */
export function wordsNeededForLevel(level: number): number {
  return level * 10;
}

/** 升到下一级所需经验（本级内）：随等级缓慢增长 */
export function xpToNext(level: number): number {
  return 40 + (level - 1) * 25;
}

/** 当前等级上限（月挑战提升后为 15） */
export function corgiMaxLevel(state: Pick<CorgiState, 'maxLevelBoosted'>): number {
  return state.maxLevelBoosted ? CORGI_BOOSTED_MAX_LEVEL : CORGI_MAX_LEVEL;
}

/* ───────────────────────── 语音指令 ───────────────────────── */

/** STT 可识别的柯基指令 */
export const CORGI_COMMANDS = ['坐下', '握手', '转圈'] as const;
export type CorgiCommand = (typeof CORGI_COMMANDS)[number];

/** 柯基鼓励语（点击互动时随机说，童声 TTS） */
export const CORGI_PRAISES = [
  '你好棒！',
  '我最喜欢你啦！',
  '继续加油哦！',
  '我们又是好朋友啦！',
  '你今天真厉害！',
] as const;

/** 答题时柯基陪伴语音（QuizRunner 调用，随机挑一条，避免每题都说话） */
export const CORGI_CHEER_RIGHT = [
  '太棒了！你真是天才！',
  '答对啦！你真聪明！',
  '汪汪！我就知道你可以！',
  '好厉害，向你学习！',
] as const;

export const CORGI_CHEER_WRONG = [
  '别灰心，我们再试一次！',
  '没关系，错误是学习的好朋友！',
  '汪呜…我陪着你，再来一次！',
  '差一点点啦，我相信你！',
] as const;

/** 每日任务未完成时的撒娇提醒（进入柯基页时说一次） */
export const CORGI_MISSION_REMINDER = '今天还没有背单词哦，我饿了～';
/** 每日任务完成时的欢呼 */
export const CORGI_MISSION_DONE = '任务完成！我是世界上最幸福的柯基！';
/** 昨日未完成任务的饥饿抱怨 */
export const CORGI_HUNGRY_GROAN = '昨天没吃饱，肚子咕咕叫…';
