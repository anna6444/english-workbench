/**
 * 柯基养成仓储 —— localStorage 实现。
 *
 * 存储模式：单对象（类似 RewardRepository），key = egw:v1:s:{sid}:corgi。
 * 每个学生固定一只柯基：get 时不存在则自动创建默认柯基。
 *
 * v2 持续喂养数值规则：
 *   - 饱食度/快乐度/亲密度 0-100 裁剪
 *   - 等级 1-10（月挑战达成后 15），xpToNext(level) = 40 + (level-1)*25
 *   - 升级双条件：经验达标 && 累计学习单词数 >= level*10（防沉迷，防刷经验）
 *   - 离线衰减：每 2 小时饱食度 -1、每小时快乐度 -1（封顶 60/40）
 *   - 每日任务（5 词 + 10 星）：达成 → 属性回满；未完成次日 → 饱食 -15 + 日记「肚子咕咕叫」
 *   - 周挑战 30 词 → 豪华大礼包；月挑战 100 词 → 等级上限提升 + 新形态
 *   - 商城购买：等级门槛道具需柯基等级达标（成长型绑定）
 */

import type { CorgiDiaryEntry, CorgiState, DateStr, ID } from '@/types';
import {
  DAILY_MISSION_STARS,
  DAILY_MISSION_WORDS,
  MONTHLY_CHALLENGE_WORDS,
  WEEKLY_CHALLENGE_WORDS,
  WEEKLY_GIFT,
  corgiMaxLevel,
  findShopItem,
  wordsNeededForLevel,
  xpToNext,
} from '@/types';
import { storage } from '@/storage/StorageManager';
import { studentKey } from '@/storage/keys';
import { newId } from './BaseRepository';
import { todayStr, weekKeyOf } from './RewardRepository';
import type {
  CorgiActionResult,
  CorgiRepository as ICorgiRepository,
  RewardRepository as IRewardRepository,
} from '../types';

/** 离线衰减封顶 */
const MAX_SATIETY_DECAY = 60;
const MAX_HAPPINESS_DECAY = 40;
/** 每日任务未完成的次日惩罚：饱食度 -15 */
const MISSION_FAIL_SATIETY_PENALTY = 15;
/** 日记上限（防止 localStorage 无限膨胀） */
const DIARY_CAP = 200;

/** 月记账 key："2026-09"（导出供页面周/月挑战进度展示复用） */
export function monthKeyOf(ts: number = Date.now()): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function defaultCorgi(studentId: ID): CorgiState {
  const now = Date.now();
  return {
    studentId,
    name: '小柯基',
    satiety: 70,
    happiness: 70,
    intimacy: 10,
    level: 1,
    xp: 0,
    inventory: {},
    ownedPermanent: [],
    equippedAccessory: null,
    hasLuxuryNest: false,
    dailyMission: { date: todayStr(), wordsDone: 0, settled: false },
    diary: [],
    learnedWordCount: 0,
    maxLevelBoosted: false,
    weeklyWords: {},
    monthlyWords: {},
    claimedChallenges: [],
    lastTick: now,
    createdAt: now,
  };
}

/** 旧版本数据缺 v2 字段时补默认值（向后兼容，升级不丢柯基） */
function normalizeCorgi(raw: CorgiState, studentId: ID): CorgiState {
  return {
    ...defaultCorgi(studentId),
    ...raw,
    diary: raw.diary ?? [],
    learnedWordCount: raw.learnedWordCount ?? 0,
    maxLevelBoosted: raw.maxLevelBoosted ?? false,
    weeklyWords: raw.weeklyWords ?? {},
    monthlyWords: raw.monthlyWords ?? {},
    claimedChallenges: raw.claimedChallenges ?? [],
  };
}

/** 属性裁剪到 0-100 */
function clamp(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)));
}

/** 追加一条日记（最新在前，容量裁剪） */
function pushDiary(state: CorgiState, mood: string, text: string): CorgiState {
  const entry: CorgiDiaryEntry = {
    id: newId(),
    date: todayStr(),
    mood,
    text,
    createdAt: Date.now(),
  };
  return { ...state, diary: [entry, ...state.diary].slice(0, DIARY_CAP) };
}

/** 离线衰减结算（纯函数，便于测试） */
export function applyOfflineDecay(state: CorgiState): CorgiState {
  const now = Date.now();
  const hours = (now - state.lastTick) / 3_600_000;
  if (hours < 1) return { ...state, lastTick: now };

  const satietyDecay = Math.min(MAX_SATIETY_DECAY, Math.floor((hours / 2) * 1));
  const happinessDecay = Math.min(MAX_HAPPINESS_DECAY, Math.floor(hours * 1));
  return {
    ...state,
    satiety: clamp(state.satiety - satietyDecay),
    happiness: clamp(state.happiness - happinessDecay),
    lastTick: now,
  };
}

/**
 * 每日任务跨天结算（纯函数）：
 *   昨天任务已结算/不存在 → 直接重置为今天
 *   昨天任务未完成 → 饱食 -15 + 日记「肚子咕咕叫」，再重置
 * 隔多天未打开只惩罚一次（对孩子友好，惩罚是提醒不是打击）。
 */
export function settleDailyMissionAcrossDays(state: CorgiState): CorgiState {
  const today = todayStr();
  const mission = state.dailyMission;

  // 今天的数据 → 无需处理
  if (!mission || mission.date === today) {
    return mission
      ? state
      : { ...state, dailyMission: { date: today, wordsDone: 0, settled: false } };
  }

  let next: CorgiState = state;
  if (!mission.settled) {
    next = {
      ...next,
      satiety: clamp(next.satiety - MISSION_FAIL_SATIETY_PENALTY),
    };
    next = pushDiary(
      next,
      '😣',
      `${mission.date} 的每日任务没完成（学了 ${mission.wordsDone}/${DAILY_MISSION_WORDS} 个词），肚子咕咕叫…`,
    );
  }

  return {
    ...next,
    dailyMission: { date: today, wordsDone: 0, settled: false },
  };
}

/**
 * 加经验并处理升级（双条件 + 动态上限），返回 [新状态, 升了几级]。
 * v2 双条件：经验达标 && 累计学习单词数 >= wordsNeededForLevel(当前等级)。
 * 经验够但单词数不够 → 经验保留（不吞），显示「还差 N 个单词升级」。
 */
export function gainXp(state: CorgiState, amount: number): [CorgiState, number] {
  let next: CorgiState = { ...state, xp: state.xp + amount };
  let levelUp = 0;
  const maxLv = corgiMaxLevel(next);

  while (
    next.level < maxLv &&
    next.xp >= xpToNext(next.level) &&
    next.learnedWordCount >= wordsNeededForLevel(next.level)
  ) {
    next = {
      ...next,
      xp: next.xp - xpToNext(next.level),
      level: next.level + 1,
      // 升级奖励：更开心一点
      happiness: clamp(next.happiness + 10),
    };
    levelUp += 1;
  }
  // 满级后经验清零，避免经验条溢出显示
  if (next.level >= maxLv && next.xp >= xpToNext(next.level)) {
    next = { ...next, xp: 0 };
  }
  return [next, levelUp];
}

export class CorgiRepositoryImpl implements ICorgiRepository {
  constructor(private reward: IRewardRepository) {}

  private key(studentId: ID): string {
    return studentKey(studentId, 'corgi');
  }

  async get(studentId: ID): Promise<CorgiState> {
    const raw = storage.get<CorgiState | null>(this.key(studentId), null);
    if (!raw) {
      const fresh = defaultCorgi(studentId);
      storage.set<CorgiState>(this.key(studentId), fresh);
      return fresh;
    }
    // 归一化（v2 字段补默认）→ 跨天任务结算 → 离线衰减，然后落盘
    let state = normalizeCorgi(raw, studentId);
    state = settleDailyMissionAcrossDays(state);
    state = applyOfflineDecay(state);
    if (state !== raw) {
      storage.set<CorgiState>(this.key(studentId), state);
    }
    return state;
  }

  private async save(state: CorgiState): Promise<CorgiState> {
    storage.set<CorgiState>(this.key(state.studentId), state);
    return state;
  }

  async rename(studentId: ID, name: string): Promise<CorgiState> {
    const cur = await this.get(studentId);
    return this.save({ ...cur, name: name.trim().slice(0, 12) || cur.name });
  }

  async feed(studentId: ID, foodId: string): Promise<CorgiActionResult> {
    const cur = await this.get(studentId);
    const item = findShopItem(foodId);
    if (!item || item.kind !== 'consumable' || !item.effect?.satiety) {
      return { ok: false, reason: '这不是能吃的食物哦', state: cur, levelUp: 0 };
    }
    const count = cur.inventory[foodId] ?? 0;
    if (count <= 0) {
      return { ok: false, reason: `背包里没有${item.name}啦，去商城看看吧`, state: cur, levelUp: 0 };
    }
    if (cur.satiety >= 98) {
      return { ok: false, reason: `${cur.name}已经吃得饱饱的啦`, state: cur, levelUp: 0 };
    }

    let next: CorgiState = {
      ...cur,
      inventory: { ...cur.inventory, [foodId]: count - 1 },
      satiety: clamp(cur.satiety + item.effect.satiety),
      intimacy: clamp(cur.intimacy + 2),
    };
    const [withXp, levelUp] = gainXp(next, 5);
    next = withXp;
    return { ok: true, state: await this.save(next), levelUp };
  }

  async play(studentId: ID, toyId: string): Promise<CorgiActionResult> {
    const cur = await this.get(studentId);

    /* 免费抚摸 */
    if (toyId === 'pet') {
      if (cur.happiness >= 98) {
        return { ok: false, reason: `${cur.name}已经开心得转圈圈啦`, state: cur, levelUp: 0 };
      }
      let next: CorgiState = {
        ...cur,
        happiness: clamp(cur.happiness + 5),
        intimacy: clamp(cur.intimacy + 1),
      };
      const [withXp, levelUp] = gainXp(next, 1);
      next = withXp;
      return { ok: true, state: await this.save(next), levelUp };
    }

    const item = findShopItem(toyId);
    if (!item || item.kind !== 'consumable' || !item.effect?.happiness) {
      return { ok: false, reason: '这不是玩具哦', state: cur, levelUp: 0 };
    }
    const count = cur.inventory[toyId] ?? 0;
    if (count <= 0) {
      return {
        ok: false,
        reason: `背包里没有${item.name}啦，去商城看看吧`,
        state: cur,
        levelUp: 0,
      };
    }
    if (cur.happiness >= 98) {
      return { ok: false, reason: `${cur.name}已经开心得转圈圈啦`, state: cur, levelUp: 0 };
    }

    let next: CorgiState = {
      ...cur,
      inventory: { ...cur.inventory, [toyId]: count - 1 },
      happiness: clamp(cur.happiness + item.effect.happiness),
      intimacy: clamp(cur.intimacy + 2),
    };
    const [withXp, levelUp] = gainXp(next, 4);
    next = withXp;
    return { ok: true, state: await this.save(next), levelUp };
  }

  async buy(studentId: ID, itemId: string): Promise<CorgiActionResult> {
    const cur = await this.get(studentId);
    const item = findShopItem(itemId);
    if (!item) {
      return { ok: false, reason: '没有这个道具', state: cur, levelUp: 0 };
    }

    /* 成长型道具等级门槛：先把柯基养大才配得上好东西 */
    if (item.minLevel && cur.level < item.minLevel) {
      return {
        ok: false,
        reason: `柯基要升到 Lv.${item.minLevel} 才能用${item.name}哦，继续加油！`,
        state: cur,
        levelUp: 0,
      };
    }

    /* 永久道具：已购则不可重复购买 */
    if (item.kind !== 'consumable') {
      if (cur.ownedPermanent.includes(itemId)) {
        return { ok: false, reason: `已经拥有${item.name}啦`, state: cur, levelUp: 0 };
      }
    }

    /* 扣星星（与星星经济打通） */
    const paid = await this.reward.spendStars(studentId, item.price);
    if (!paid) {
      return {
        ok: false,
        reason: `星星不够啦（还差 ${item.price - (await this.reward.get(studentId)).stars} 颗），去学习赚星星吧！`,
        state: cur,
        levelUp: 0,
      };
    }

    let next: CorgiState;
    if (item.kind === 'consumable') {
      next = {
        ...cur,
        inventory: { ...cur.inventory, [itemId]: (cur.inventory[itemId] ?? 0) + 1 },
      };
    } else {
      next = {
        ...cur,
        ownedPermanent: [...cur.ownedPermanent, itemId],
        equippedAccessory: item.kind === 'accessory' ? itemId : cur.equippedAccessory,
        hasLuxuryNest: item.id === 'nest' ? true : cur.hasLuxuryNest,
      };
    }

    const [withXp, levelUp] = gainXp(next, item.kind === 'consumable' ? 2 : 10);
    next = withXp;
    return { ok: true, state: await this.save(next), levelUp };
  }

  async equip(studentId: ID, itemId: string | null): Promise<CorgiState> {
    const cur = await this.get(studentId);
    if (itemId !== null && !cur.ownedPermanent.includes(itemId)) {
      return cur;
    }
    return this.save({ ...cur, equippedAccessory: itemId });
  }

  async addXp(studentId: ID, amount: number): Promise<CorgiState> {
    const cur = await this.get(studentId);
    const [next] = gainXp(cur, amount);
    return this.save(next);
  }

  /** 备份恢复/播种：整体覆写柯基状态（仅导入逻辑使用） */
  async seedForStudent(studentId: ID, state: CorgiState): Promise<void> {
    storage.set<CorgiState>(this.key(studentId), normalizeCorgi(state, studentId));
  }

  /* ────────────────────────────────────────────────
     持续喂养：每日任务（5 词 + 10 星 → 属性回满）
     ──────────────────────────────────────────────── */

  /** 学会一个单词：任务词数 / 周 / 月记账 + 累计学习数，然后顺带检查任务达成 */
  async recordLearnedWord(studentId: ID): Promise<CorgiState> {
    const cur = await this.get(studentId);
    const today = todayStr();
    const wk = weekKeyOf();
    const mk = monthKeyOf();

    const mission =
      cur.dailyMission && cur.dailyMission.date === today
        ? cur.dailyMission
        : { date: today, wordsDone: 0, settled: false };

    let next: CorgiState = {
      ...cur,
      dailyMission: { ...mission, wordsDone: mission.wordsDone + 1 },
      learnedWordCount: cur.learnedWordCount + 1,
      weeklyWords: { ...cur.weeklyWords, [wk]: (cur.weeklyWords[wk] ?? 0) + 1 },
      monthlyWords: { ...cur.monthlyWords, [mk]: (cur.monthlyWords[mk] ?? 0) + 1 },
    };

    // 学会单词的经验（升级双条件里单词数刚 +1，可能正好解锁升级）
    const [withXp] = gainXp(next, 6);
    next = withXp;

    next = await this.settleIfMissionDone(next, studentId);
    return this.save(next);
  }

  /** 星星达标时机检查任务（幂等，未达标原样返回） */
  async checkMission(studentId: ID): Promise<CorgiState> {
    const cur = await this.get(studentId);
    const next = await this.settleIfMissionDone(cur, studentId);
    if (next !== cur) {
      return this.save(next);
    }
    return cur;
  }

  /**
   * 任务达成结算（内部方法）：
   * 词数达标 && 今日星星达标 && 未结算 → 属性回满 + 亲密度 +5 + 日记。
   */
  private async settleIfMissionDone(state: CorgiState, studentId: ID): Promise<CorgiState> {
    const mission = state.dailyMission;
    if (!mission || mission.settled) return state;

    const reward = await this.reward.get(studentId);
    const starsToday = reward.dailyStars[mission.date as DateStr] ?? 0;

    if (mission.wordsDone >= DAILY_MISSION_WORDS && starsToday >= DAILY_MISSION_STARS) {
      let next: CorgiState = {
        ...state,
        dailyMission: { ...mission, settled: true },
        satiety: 100,
        happiness: 100,
        intimacy: clamp(state.intimacy + 5),
      };
      next = pushDiary(
        next,
        '🥳',
        `今天的每日任务完成啦（${DAILY_MISSION_WORDS} 词 + ${DAILY_MISSION_STARS} 星）！吃得饱饱的，开心得转圈圈！`,
      );
      // 任务奖励经验
      const [withXp] = gainXp(next, 10);
      return withXp;
    }
    return state;
  }

  /** 孩子给柯基写一句贴心话（日记） */
  async addDiary(studentId: ID, mood: string, text: string): Promise<CorgiState> {
    const cur = await this.get(studentId);
    const trimmed = text.trim().slice(0, 60);
    if (!trimmed) return cur;
    return this.save(pushDiary(cur, mood || '💬', `小主人说：${trimmed}`));
  }

  /* ────────────────────────────────────────────────
     持续喂养：周期挑战
     ──────────────────────────────────────────────── */

  /** 周挑战：本周学会 ≥30 词 → 豪华大礼包（一次一周） */
  async claimWeeklyGift(studentId: ID): Promise<CorgiActionResult> {
    const cur = await this.get(studentId);
    const wk = weekKeyOf();
    const claimKey = `weekly-${wk}`;
    const wordsThisWeek = cur.weeklyWords[wk] ?? 0;

    if (wordsThisWeek < WEEKLY_CHALLENGE_WORDS) {
      return {
        ok: false,
        reason: `本周已学 ${wordsThisWeek}/${WEEKLY_CHALLENGE_WORDS} 词，继续加油！`,
        state: cur,
        levelUp: 0,
      };
    }
    if (cur.claimedChallenges.includes(claimKey)) {
      return { ok: false, reason: '这周的礼包已经领过啦', state: cur, levelUp: 0 };
    }

    // 发放：星星（走 bonus，不受每日上限）+ 消耗品礼包
    await this.reward.grantBonusStars(studentId, WEEKLY_GIFT.stars, '周挑战豪华大礼包');

    const inventory = { ...cur.inventory };
    for (const [itemId, count] of Object.entries(WEEKLY_GIFT.inventory)) {
      inventory[itemId] = (inventory[itemId] ?? 0) + count;
    }

    let next: CorgiState = {
      ...cur,
      inventory,
      claimedChallenges: [...cur.claimedChallenges, claimKey],
    };
    next = pushDiary(next, '🎁', '本周 30 词挑战达成！豪华大礼包到手，我是最幸福的柯基！');
    const [withXp, levelUp] = gainXp(next, 20);
    next = withXp;
    return { ok: true, state: await this.save(next), levelUp };
  }

  /** 月挑战：本月学会 ≥100 词 → 等级上限 10→15 + 新形态（天使翅膀） */
  async claimMonthlyChallenge(studentId: ID): Promise<CorgiActionResult> {
    const cur = await this.get(studentId);
    const mk = monthKeyOf();
    const claimKey = `monthly-${mk}`;
    const wordsThisMonth = cur.monthlyWords[mk] ?? 0;

    if (wordsThisMonth < MONTHLY_CHALLENGE_WORDS) {
      return {
        ok: false,
        reason: `本月已学 ${wordsThisMonth}/${MONTHLY_CHALLENGE_WORDS} 词，月末冲一把！`,
        state: cur,
        levelUp: 0,
      };
    }
    if (cur.claimedChallenges.includes(claimKey)) {
      return { ok: false, reason: '这个月的挑战奖励已经领过啦', state: cur, levelUp: 0 };
    }
    if (cur.maxLevelBoosted) {
      return { ok: false, reason: '等级上限已经提升过啦', state: cur, levelUp: 0 };
    }

    await this.reward.grantBonusStars(studentId, 100, '月挑战 100 词达成大奖励');

    let next: CorgiState = {
      ...cur,
      maxLevelBoosted: true,
      ownedPermanent: cur.ownedPermanent.includes('wings')
        ? cur.ownedPermanent
        : [...cur.ownedPermanent, 'wings'],
      claimedChallenges: [...cur.claimedChallenges, claimKey],
    };
    next = pushDiary(
      next,
      '🚀',
      '月挑战 100 词达成！等级上限提升到 15 级，还获得了天使翅膀——我要飞起来啦！',
    );
    const [withXp, levelUp] = gainXp(next, 50);
    next = withXp;
    return { ok: true, state: await this.save(next), levelUp };
  }

  /**
   * 免费发放永久道具（连续打卡解锁奖励，不扣星星）。
   * 饰品类自动佩戴；写入日记留痕。
   */
  async grantFreeItem(studentId: ID, itemId: string, source: string): Promise<CorgiActionResult> {
    const cur = await this.get(studentId);
    const item = findShopItem(itemId);
    if (!item) {
      return { ok: false, reason: '没有这个道具', state: cur, levelUp: 0 };
    }
    if (cur.ownedPermanent.includes(itemId)) {
      return { ok: false, reason: `已经拥有${item.name}啦`, state: cur, levelUp: 0 };
    }

    let next: CorgiState = {
      ...cur,
      ownedPermanent: [...cur.ownedPermanent, itemId],
      equippedAccessory: item.kind === 'accessory' ? itemId : cur.equippedAccessory,
    };
    next = pushDiary(next, '🎁', `${source}：免费获得${item.name}！谢谢小主人坚持学习～`);
    const [withXp, levelUp] = gainXp(next, 10);
    next = withXp;
    return { ok: true, state: await this.save(next), levelUp };
  }
}
