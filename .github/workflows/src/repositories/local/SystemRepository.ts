/**
 * 系统元信息仓储 —— 管理种子标记与全局重置。
 *
 * 为什么不放在其它仓储里：这是一个跨域的横切关注点，
 * 页面需要「是否已播种 / 一键重置全部数据」这类能力，
 * 但它不属于任何一个业务实体。
 */

import type { ID } from '@/types';
import {
  CONTENT_KEYS,
  GLOBAL_KEYS,
  SEED_VERSION,
  STUDENT_SCOPES,
  studentKey,
} from '@/storage/keys';
import { storage } from '@/storage/StorageManager';

/** 存在 meta key 里的元信息结构 */
export interface SystemMeta {
  /** 已播种的种子版本；0 或未定义表示未播种 */
  seedVersion: number;
  seededAt?: number;
  /** 最后一次打开应用的版本，用于将来做迁移提示 */
  lastOpenedAt?: number;
}

const DEFAULT_META: SystemMeta = { seedVersion: 0 };

export interface SystemRepository {
  getMeta(): Promise<SystemMeta>;
  isSeeded(): Promise<boolean>;
  markSeeded(): Promise<void>;
  /** 清掉种子标记（数据保留），下次进入会重新播种 */
  clearSeedFlag(): Promise<void>;
  /** 清空所有 egw:* 数据（含各种学生私有域），回到初始状态 */
  resetAll(): Promise<void>;
  /** 统计各数据域条目数，用于「数据管理」面板展示 */
  stats(): Promise<{ key: string; bytes: number }[]>;
  /** 粗略估算已用存储字节数 */
  totalBytes(): Promise<number>;
}

export class SystemRepositoryImpl implements SystemRepository {
  async getMeta(): Promise<SystemMeta> {
    return storage.get<SystemMeta>(GLOBAL_KEYS.meta, DEFAULT_META);
  }

  async isSeeded(): Promise<boolean> {
    const meta = await this.getMeta();
    return meta.seedVersion >= SEED_VERSION;
  }

  async markSeeded(): Promise<void> {
    storage.set<SystemMeta>(GLOBAL_KEYS.meta, {
      seedVersion: SEED_VERSION,
      seededAt: Date.now(),
      lastOpenedAt: Date.now(),
    });
  }

  async clearSeedFlag(): Promise<void> {
    const meta = await this.getMeta();
    storage.set<SystemMeta>(GLOBAL_KEYS.meta, { ...meta, seedVersion: 0 });
  }

  /**
   * 清空全部应用数据。
   *
   * 这里不依赖 storage.clearAll()（它会清掉同一域名下别的应用的数据），
   * 而是显式枚举已知 key + 按学生清除各私有域，
   * 保证只动自己的数据。
   */
  async resetAll(): Promise<void> {
    // 1. 清共享内容与全局
    const globalKeys: string[] = [
      GLOBAL_KEYS.meta,
      GLOBAL_KEYS.accounts,
      GLOBAL_KEYS.parents,
      GLOBAL_KEYS.students,
      GLOBAL_KEYS.dictionaryCache,
      ...Object.values(CONTENT_KEYS),
    ];
    for (const k of globalKeys) storage.remove(k);

    // 2. 清每个学生的私有域
    const students = storage.get<{ id: ID }[]>(GLOBAL_KEYS.students, []);
    for (const s of students) {
      this.purgeStudentSync(s.id);
    }

    // 3. 兜底：扫一遍所有 key，清理残留的学生私有域
    //    （例如学生已被删除但数据还在的情况）
    const all = storage.allKeys();
    for (const k of all) {
      if (STUDENT_SCOPES.some((scope) => k.includes(`:${scope}`))) {
        storage.remove(k);
      }
    }
  }

  /** 同步版清除某学生全部私有数据 */
  private purgeStudentSync(studentId: ID): void {
    for (const scope of STUDENT_SCOPES) {
      storage.remove(studentKey(studentId, scope));
    }
  }

  async stats(): Promise<{ key: string; bytes: number }[]> {
    const out: { key: string; bytes: number }[] = [];
    for (const k of storage.allKeys()) {
      const raw = storage.get<unknown>(k, null);
      const str = raw === null ? '' : JSON.stringify(raw) ?? '';
      out.push({ key: k, bytes: str.length });
    }
    return out.sort((a, b) => b.bytes - a.bytes);
  }

  async totalBytes(): Promise<number> {
    const rows = await this.stats();
    return rows.reduce((sum, r) => sum + r.bytes, 0);
  }
}
