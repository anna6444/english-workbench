import type { LearningUnit, ListeningEpisode, PictureBook, Question } from '@/types';
import { CONTENT_KEYS } from '@/storage/keys';
import { storage } from '@/storage/StorageManager';
import { BaseRepository } from './BaseRepository';
import type {
  ListeningRepository as IListeningRepository,
  QuestionRepository as IQuestionRepository,
  ReadingRepository as IReadingRepository,
  UnitRepository as IUnitRepository,
} from '../types';

/** 学习单元（共享只读内容） */
export class UnitRepository extends BaseRepository<LearningUnit> implements IUnitRepository {
  protected storageKey() {
    return CONTENT_KEYS.units;
  }

  async listOrdered(): Promise<LearningUnit[]> {
    const all = await this.list();
    return all.slice().sort((a, b) => a.order - b.order);
  }

  async seed(items: LearningUnit[]): Promise<void> {
    storage.set(CONTENT_KEYS.units, items);
  }
}

/** 听力电台 */
export class ListeningRepository
  extends BaseRepository<ListeningEpisode>
  implements IListeningRepository
{
  protected storageKey() {
    return CONTENT_KEYS.listening;
  }

  async listOrdered(): Promise<ListeningEpisode[]> {
    const all = await this.list();
    return all.slice().sort((a, b) => a.level - b.level);
  }

  async seed(items: ListeningEpisode[]): Promise<void> {
    storage.set(CONTENT_KEYS.listening, items);
  }
}

/** 绘本阅读 */
export class ReadingRepository
  extends BaseRepository<PictureBook>
  implements IReadingRepository
{
  protected storageKey() {
    return CONTENT_KEYS.reading;
  }

  async listOrdered(): Promise<PictureBook[]> {
    const all = await this.list();
    return all.slice().sort((a, b) => a.level - b.level);
  }

  async seed(items: PictureBook[]): Promise<void> {
    storage.set(CONTENT_KEYS.reading, items);
  }
}

/** 题库 */
export class QuestionRepository
  extends BaseRepository<Question>
  implements IQuestionRepository
{
  protected storageKey() {
    return CONTENT_KEYS.questions;
  }

  async listByUnit(unitId: string): Promise<Question[]> {
    const all = await this.list();
    return all.filter((q) => q.unitId === unitId);
  }

  async random(
    n: number,
    filter?: { type?: Question['type']; unitId?: string },
  ): Promise<Question[]> {
    let pool = await this.list();
    if (filter?.type) pool = pool.filter((q) => q.type === filter.type);
    if (filter?.unitId) pool = pool.filter((q) => q.unitId === filter.unitId);
    // Fisher-Yates 洗牌后取前 n 个
    const arr = pool.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.slice(0, n);
  }

  async seed(items: Question[]): Promise<void> {
    storage.set(CONTENT_KEYS.questions, items);
  }

  /** 批量导入（老师粘贴文本解析后调用）：自动生成新 id 追加，返回新增题目 */
  async addBatch(items: Omit<Question, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<Question[]> {
    if (items.length === 0) return [];
    const now = Date.now();
    const all = await this.list();
    const created: Question[] = items.map((q, i) => ({
      ...q,
      id: `${now.toString(36)}-q${i}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: now + i,
      updatedAt: now + i,
    }));
    storage.set(CONTENT_KEYS.questions, [...all, ...created]);
    return created;
  }
}
