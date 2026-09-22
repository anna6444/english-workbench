import type { ID, RewardState, RewardShopItem, WeekKey } from '@/types';
import { BADGE_DEFS, DAILY_STAR_CAP } from '@/types';
import { storage } from '@/storage/StorageManager';
import { studentKey } from '@/storage/keys';
import { newId } from './BaseRepository';
import type { RewardRepository as IRewardRepository } from '../types';

/** 计算某个时间戳属于哪一周（ISO 周，如 "2026-W37"） */
export function weekKeyOf(ts: number = Date.now()): WeekKey {
  const d = new Date(ts);
  // 复制到当天 00:00，避免时区导致跨周
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  // ISO 周：周四所在的年即为该周所属年
  const dayNum = (target.getDay() + 6) % 7; // 周一=0
  target.setDate(target.getDate() - dayNum + 3);
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const firstDayNum = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() - firstDayNum + 3);
  const week = 1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * 86_400_000));
  return `${target.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** "2026-09-16"（本地时区，与 ProgressRepository 同规则） */
export function todayStr(ts: number = Date.now()): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function emptyReward(studentId: ID): RewardState {
  return {
    studentId,
    stars: 0,
    coins: 0,
    badges: [],
    weeklyStars: {},
    dailyStars: {},
    adjustments: [],
    customShop: [],
    redeemed: [],
    updatedAt: Date.now(),
  };
}

/**
 * 旧版本数据缺新字段（dailyStars/adjustments/customShop/redeemed）时补默认值。
 * localStorage 方案的「向后兼容」关键：升级代码后老用户数据照常用。
 */
function normalize(state: RewardState, studentId: ID): RewardState {
  return {
    ...emptyReward(studentId),
    ...state,
    dailyStars: state.dailyStars ?? {},
    adjustments: state.adjustments ?? [],
    customShop: state.customShop ?? [],
    redeemed: state.redeemed ?? [],
  };
}

/** 学生私有：星星 / 金币 / 徽章 / 每日上限 / 自定义奖品商城 */
export class RewardRepositoryImpl implements IRewardRepository {
  private key(studentId: ID): string {
    return studentKey(studentId, 'reward');
  }

  async get(studentId: ID): Promise<RewardState> {
    const raw = storage.get<RewardState>(this.key(studentId), emptyReward(studentId));
    return normalize(raw, studentId);
  }

  /** 种子初始化：整体覆写某学生的奖励状态（仅播种逻辑使用） */
  async seed(studentId: ID, state: RewardState): Promise<void> {
    storage.set<RewardState>(this.key(studentId), normalize(state, studentId));
  }

  /**
   * 学习获得星星。
   * 防沉迷：每日上限 DAILY_STAR_CAP 颗，超出部分静默丢弃（不报错，孩子无感知）。
   * weeklyStars 与 stars 都只累计实际发放的量，保证报表不虚高。
   */
  async addStars(studentId: ID, n: number): Promise<RewardState> {
    if (n <= 0) return this.get(studentId);
    const wk = weekKeyOf();
    const today = todayStr();
    return storage.update<RewardState>(
      this.key(studentId),
      emptyReward(studentId),
      (raw) => {
        const prev = normalize(raw, studentId);
        const earnedToday = prev.dailyStars[today] ?? 0;
        const granted = Math.max(0, Math.min(n, DAILY_STAR_CAP - earnedToday));
        return {
          ...prev,
          stars: prev.stars + granted,
          weeklyStars: { ...prev.weeklyStars, [wk]: (prev.weeklyStars[wk] ?? 0) + granted },
          dailyStars: { ...prev.dailyStars, [today]: earnedToday + granted },
          updatedAt: Date.now(),
        };
      },
    );
  }

  async addCoins(studentId: ID, n: number): Promise<RewardState> {
    return storage.update<RewardState>(this.key(studentId), emptyReward(studentId), (raw) => {
      const prev = normalize(raw, studentId);
      return {
        ...prev,
        coins: prev.coins + n,
        updatedAt: Date.now(),
      };
    });
  }

  /** 消耗星星（柯基商城等）。余额不足返回 false 且不动账；消耗不计入 weeklyStars。 */
  async spendStars(studentId: ID, n: number): Promise<boolean> {
    const cur = await this.get(studentId);
    if (cur.stars < n) return false;
    storage.set<RewardState>(this.key(studentId), {
      ...cur,
      stars: cur.stars - n,
      updatedAt: Date.now(),
    });
    return true;
  }

  /** 授予徽章；已获得则返回 null（避免重复发奖） */
  async tryAwardBadge(studentId: ID, badgeId: string): Promise<RewardState | null> {
    const def = BADGE_DEFS.find((b) => b.id === badgeId);
    if (!def) return null;

    const current = await this.get(studentId);
    if (current.badges.some((b) => b.id === badgeId)) return null;

    return storage.update<RewardState>(this.key(studentId), emptyReward(studentId), (raw) => {
      const prev = normalize(raw, studentId);
      return {
        ...prev,
        badges: [...prev.badges, { ...def, earnedAt: Date.now() }],
        updatedAt: Date.now(),
      };
    });
  }

  async weeklyStars(studentId: ID, weekKey: WeekKey): Promise<number> {
    const state = await this.get(studentId);
    return state.weeklyStars[weekKey] ?? 0;
  }

  /* ────────────────────────────────────────────────
     家长/老师控制台：手动调整（不受每日上限，必附理由）
     ──────────────────────────────────────────────── */

  async adjustStars(
    studentId: ID,
    delta: number,
    reason: string,
    adjustedBy: string,
  ): Promise<RewardState> {
    if (delta === 0 || !reason.trim()) return this.get(studentId);
    const cur = await this.get(studentId);
    storage.set<RewardState>(this.key(studentId), {
      ...cur,
      stars: Math.max(0, cur.stars + delta),
      adjustments: [
        {
          id: newId(),
          delta,
          reason: reason.trim(),
          adjustedBy,
          createdAt: Date.now(),
        },
        ...cur.adjustments,
      ].slice(0, 50), // 只保留最近 50 条，避免无限膨胀
      updatedAt: Date.now(),
    });
    return this.get(studentId);
  }

  /** 奖励性星星（挑战礼包）：不受每日上限、不计 dailyStars，但计 weeklyStars + 调整记录 */
  async grantBonusStars(studentId: ID, n: number, reason: string): Promise<RewardState> {
    if (n <= 0) return this.get(studentId);
    const wk = weekKeyOf();
    const cur = await this.get(studentId);
    storage.set<RewardState>(this.key(studentId), {
      ...cur,
      stars: cur.stars + n,
      weeklyStars: { ...cur.weeklyStars, [wk]: (cur.weeklyStars[wk] ?? 0) + n },
      adjustments: [
        { id: newId(), delta: n, reason, adjustedBy: '系统礼包', createdAt: Date.now() },
        ...cur.adjustments,
      ].slice(0, 50),
      updatedAt: Date.now(),
    });
    return this.get(studentId);
  }

  /* ────────────────────────────────────────────────
     家长自定义奖品商城（现实奖励）
     ──────────────────────────────────────────────── */

  async addShopItem(
    studentId: ID,
    input: { name: string; emoji: string; cost: number },
  ): Promise<RewardShopItem> {
    const now = Date.now();
    const item: RewardShopItem = {
      id: newId(),
      name: input.name.trim().slice(0, 20) || '神秘奖品',
      emoji: input.emoji || '🎁',
      cost: Math.max(1, Math.round(input.cost)),
      enabled: true,
      createdAt: now,
      updatedAt: now,
    };
    const cur = await this.get(studentId);
    storage.set<RewardState>(this.key(studentId), {
      ...cur,
      customShop: [...cur.customShop, item],
      updatedAt: now,
    });
    return item;
  }

  async updateShopItem(
    studentId: ID,
    itemId: ID,
    patch: Partial<Pick<RewardShopItem, 'name' | 'emoji' | 'cost' | 'enabled'>>,
  ): Promise<RewardShopItem> {
    const cur = await this.get(studentId);
    const target = cur.customShop.find((i) => i.id === itemId);
    if (!target) throw new Error(`[Reward] 未找到奖品 id=${itemId}`);
    const updated: RewardShopItem = {
      ...target,
      ...patch,
      cost: patch.cost !== undefined ? Math.max(1, Math.round(patch.cost)) : target.cost,
      name: patch.name !== undefined ? patch.name.trim().slice(0, 20) || target.name : target.name,
      updatedAt: Date.now(),
    };
    storage.set<RewardState>(this.key(studentId), {
      ...cur,
      customShop: cur.customShop.map((i) => (i.id === itemId ? updated : i)),
      updatedAt: Date.now(),
    });
    return updated;
  }

  async removeShopItem(studentId: ID, itemId: ID): Promise<void> {
    const cur = await this.get(studentId);
    storage.set<RewardState>(this.key(studentId), {
      ...cur,
      customShop: cur.customShop.filter((i) => i.id !== itemId),
      updatedAt: Date.now(),
    });
  }

  async redeem(studentId: ID, itemId: ID): Promise<{ ok: boolean; reason?: string }> {
    const cur = await this.get(studentId);
    const item = cur.customShop.find((i) => i.id === itemId);
    if (!item) return { ok: false, reason: '奖品不存在' };
    if (!item.enabled) return { ok: false, reason: '这个奖品暂时下架了' };
    if (cur.stars < item.cost) {
      return { ok: false, reason: `星星不够（还差 ${item.cost - cur.stars} 颗）` };
    }

    const paid = await this.spendStars(studentId, item.cost);
    if (!paid) return { ok: false, reason: '星星不够' };

    const after = await this.get(studentId);
    storage.set<RewardState>(this.key(studentId), {
      ...after,
      redeemed: [
        {
          id: newId(),
          itemId: item.id,
          itemName: item.name,
          emoji: item.emoji,
          cost: item.cost,
          status: 'pending',
          redeemedAt: Date.now(),
        },
        ...after.redeemed,
      ],
      updatedAt: Date.now(),
    });
    return { ok: true };
  }

  async fulfillRedeem(studentId: ID, recordId: ID): Promise<void> {
    const cur = await this.get(studentId);
    storage.set<RewardState>(this.key(studentId), {
      ...cur,
      redeemed: cur.redeemed.map((r) =>
        r.id === recordId ? { ...r, status: 'fulfilled', fulfilledAt: Date.now() } : r,
      ),
      updatedAt: Date.now(),
    });
  }
}
