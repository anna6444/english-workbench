import type { ID, ProgressState } from '@/types';
import { storage } from '@/storage/StorageManager';
import { studentKey } from '@/storage/keys';
import type { ProgressRepository as IProgressRepository } from '../types';

/** 生成本地日期串 "2026-09-16"（避免 toISOString 的 UTC 偏移问题） */
export function todayStr(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 求两个日期串相差的天数（b - a） */
export function daysBetween(a: string, b: string): number {
  const pa = a.split('-').map(Number);
  const pb = b.split('-').map(Number);
  const ta = Date.UTC(pa[0], pa[1] - 1, pa[2]);
  const tb = Date.UTC(pb[0], pb[1] - 1, pb[2]);
  return Math.round((tb - ta) / 86_400_000);
}

function emptyProgress(studentId: ID): ProgressState {
  return {
    studentId,
    totalMinutes: 0,
    totalDays: 0,
    streakDays: 0,
    units: {},
    modules: {},
    completedLessons: 0,
    updatedAt: Date.now(),
  };
}

/**
 * 学生私有：学习进度（单对象）。
 * 注意这是「一个学生一份对象」，不是数组，所以直接用 storage 的
 * getForStudent/setForStudent，无需走数组仓储基类。
 */
export class ProgressRepositoryImpl implements IProgressRepository {
  private key(studentId: ID): string {
    return studentKey(studentId, 'progress');
  }

  async get(studentId: ID): Promise<ProgressState> {
    return storage.get<ProgressState>(this.key(studentId), emptyProgress(studentId));
  }

  /** 种子初始化：整体覆写某学生的进度（仅播种逻辑使用） */
  async seed(studentId: ID, state: ProgressState): Promise<void> {
    storage.set<ProgressState>(this.key(studentId), state);
  }

  async patch(studentId: ID, patch: Partial<ProgressState>): Promise<ProgressState> {
    return storage.update<ProgressState>(this.key(studentId), emptyProgress(studentId), (prev) => ({
      ...prev,
      ...patch,
      studentId,
      updatedAt: Date.now(),
    }));
  }

  /** 加学习时长，并维护连续打卡天数 */
  async addStudyMinutes(studentId: ID, minutes: number): Promise<ProgressState> {
    const today = todayStr();
    return storage.update<ProgressState>(this.key(studentId), emptyProgress(studentId), (prev) => {
      let streakDays = prev.streakDays;
      let totalDays = prev.totalDays;

      if (prev.lastStudyDate !== today) {
        // 昨天学过 → 连续 +1；否则从 1 重新开始
        const gap = prev.lastStudyDate ? daysBetween(prev.lastStudyDate, today) : Infinity;
        streakDays = gap === 1 ? prev.streakDays + 1 : 1;
        totalDays = prev.totalDays + 1;
      } else if (prev.streakDays === 0) {
        // 同一天多次学习，但今天是第一次
        streakDays = 1;
        totalDays = Math.max(1, prev.totalDays);
      }

      return {
        ...prev,
        studentId,
        totalMinutes: prev.totalMinutes + minutes,
        streakDays,
        totalDays,
        lastStudyDate: today,
        updatedAt: Date.now(),
      };
    });
  }

  /**
   * 标记某单元某单词已学会，并重算该单元完成百分比。
   * totalWords 由调用方传入（来自单元定义），避免在此硬编码。
   */
  async markWordLearned(
    studentId: ID,
    unitId: ID,
    word: string,
    totalWords: number,
  ): Promise<ProgressState> {
    return storage.update<ProgressState>(this.key(studentId), emptyProgress(studentId), (prev) => {
      const unit = prev.units[unitId] ?? { unitId, learnedWords: [], percent: 0 };
      if (unit.learnedWords.includes(word)) return prev;

      const learnedWords = [...unit.learnedWords, word];
      const safeTotal = totalWords > 0 ? totalWords : learnedWords.length;
      const percent = Math.min(100, Math.round((learnedWords.length / safeTotal) * 100));

      return {
        ...prev,
        studentId,
        units: {
          ...prev.units,
          [unitId]: {
            ...unit,
            learnedWords,
            percent,
            // 学完全部单词即视为该单元完成
            completedAt: percent >= 100 ? Date.now() : unit.completedAt,
          },
        },
        updatedAt: Date.now(),
      };
    });
  }

  /** 记录一次模块访问 */
  async touchModule(studentId: ID, moduleId: string): Promise<ProgressState> {
    return storage.update<ProgressState>(this.key(studentId), emptyProgress(studentId), (prev) => {
      const stat = prev.modules[moduleId] ?? { visits: 0, minutes: 0 };
      return {
        ...prev,
        studentId,
        modules: {
          ...prev.modules,
          [moduleId]: { ...stat, visits: stat.visits + 1, lastVisitAt: Date.now() },
        },
        updatedAt: Date.now(),
      };
    });
  }
}
