import type { BaseEntity, CreateInput, ID } from '@/types';
import { storage } from '@/storage/StorageManager';
import { studentKey, type StudentScope } from '@/storage/keys';
import { newId } from './BaseRepository';

/**
 * 学生私有仓储的基类 —— 数据隔离的核心。
 *
 * 隔离原理：每个学生一份独立的 localStorage 数组，
 * 而不是把所有学生的数据混在一个数组里再用 studentId 过滤。
 * 物理隔离的好处是：A 孩子的写入根本碰不到 B 孩子的数组，
 * 不存在「过滤条件写错就串号」的可能。
 *
 * ⚠️ 设计上故意不提供不带 studentId 的 list()/update()/remove() ——
 * 见下方抛错的方法说明。
 */
export abstract class StudentScopedBaseRepository<
  T extends BaseEntity & { studentId: ID },
> {
  /** 子类声明自己属于哪个数据域 */
  protected abstract scope: StudentScope;

  protected keyOf(studentId: ID): string {
    return studentKey(studentId, this.scope);
  }

  async listByStudent(studentId: ID): Promise<T[]> {
    return storage.get<T[]>(this.keyOf(studentId), []);
  }

  async getForStudent(studentId: ID, id: ID): Promise<T | null> {
    const all = await this.listByStudent(studentId);
    return all.find((x) => x.id === id) ?? null;
  }

  async create(input: CreateInput<T>): Promise<T> {
    const now = Date.now();
    const entity = { ...input, id: newId(), createdAt: now, updatedAt: now } as T;
    storage.update<T[]>(this.keyOf(entity.studentId), [], (prev) => [...prev, entity]);
    return entity;
  }

  async updateForStudent(studentId: ID, id: ID, patch: Partial<T>): Promise<T> {
    let updated: T | undefined;
    storage.update<T[]>(this.keyOf(studentId), [], (prev) =>
      prev.map((x) => {
        if (x.id !== id) return x;
        updated = { ...x, ...patch, updatedAt: Date.now() };
        return updated;
      }),
    );
    if (!updated) {
      throw new Error(`[${this.constructor.name}] 未找到 id=${id}（student=${studentId}）`);
    }
    return updated;
  }

  async removeForStudent(studentId: ID, id: ID): Promise<void> {
    storage.update<T[]>(this.keyOf(studentId), [], (prev) => prev.filter((x) => x.id !== id));
  }

  async removeAllForStudent(studentId: ID): Promise<void> {
    storage.remove(this.keyOf(studentId));
  }

  async countByStudent(studentId: ID): Promise<number> {
    return (await this.listByStudent(studentId)).length;
  }

  /** 整体覆写（种子数据用） */
  protected async replaceForStudent(studentId: ID, items: T[]): Promise<void> {
    storage.set<T[]>(this.keyOf(studentId), items);
  }

  /* ────────────────────────────────────────────────────────────
     以下是「护栏方法」：故意抛错。
     忘传 studentId 是这类应用最严重的 bug（A 孩子看到 B 孩子的错题），
     让它在开发期就炸，远好过上线后数据串号。
     ──────────────────────────────────────────────────────────── */

  async list(): Promise<never> {
    throw new Error(
      `[${this.constructor.name}] 学生私有数据不支持无 studentId 的 list()。` +
        '请改用 listByStudent(studentId)。',
    );
  }

  async get(_id: ID): Promise<never> {
    throw new Error(
      `[${this.constructor.name}] 学生私有数据不支持无 studentId 的 get()。` +
        '请改用 getForStudent(studentId, id)。',
    );
  }

  async update(_id: ID, _patch: Partial<T>): Promise<never> {
    throw new Error(
      `[${this.constructor.name}] 学生私有数据不支持无 studentId 的 update()。` +
        '请改用 updateForStudent(studentId, id, patch)。',
    );
  }

  async remove(_id: ID): Promise<never> {
    throw new Error(
      `[${this.constructor.name}] 学生私有数据不支持无 studentId 的 remove()。` +
        '请改用 removeForStudent(studentId, id)。',
    );
  }
}
