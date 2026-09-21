import type { BaseEntity, CreateInput, ID } from '@/types';
import { storage } from '@/storage/StorageManager';

/** 生成 id：优先用 crypto.randomUUID，降级到时间戳+随机串 */
export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * 共享内容仓储的基类（单元/听力/绘本/题库/作业等）。
 * 这类数据不分学生，全局一份。
 */
export abstract class BaseRepository<T extends BaseEntity> {
  /** 子类返回自己对应的 storage key */
  protected abstract storageKey(): string;

  async list(): Promise<T[]> {
    return storage.get<T[]>(this.storageKey(), []);
  }

  async get(id: ID): Promise<T | null> {
    const all = await this.list();
    return all.find((x) => x.id === id) ?? null;
  }

  async create(input: CreateInput<T>): Promise<T> {
    const now = Date.now();
    const entity = { ...input, id: newId(), createdAt: now, updatedAt: now } as T;
    storage.update<T[]>(this.storageKey(), [], (prev) => [...prev, entity]);
    return entity;
  }

  async update(id: ID, patch: Partial<T>): Promise<T> {
    let updated: T | undefined;
    storage.update<T[]>(this.storageKey(), [], (prev) =>
      prev.map((x) => {
        if (x.id !== id) return x;
        updated = { ...x, ...patch, updatedAt: Date.now() };
        return updated;
      }),
    );
    if (!updated) throw new Error(`[${this.constructor.name}] 未找到 id=${id}`);
    return updated;
  }

  async remove(id: ID): Promise<void> {
    storage.update<T[]>(this.storageKey(), [], (prev) => prev.filter((x) => x.id !== id));
  }

  /** 整体覆写（种子数据初始化用） */
  protected async replaceAll(items: T[]): Promise<void> {
    storage.set<T[]>(this.storageKey(), items);
  }
}
