import type { Parent, Student } from '@/types';
import { GLOBAL_KEYS } from '@/storage/keys';
import { storage } from '@/storage/StorageManager';
import { BaseRepository } from './BaseRepository';
import type { ParentRepository as IParentRepository, StudentRepository as IStudentRepository } from '../types';

export class ParentRepository extends BaseRepository<Parent> implements IParentRepository {
  protected storageKey() {
    return GLOBAL_KEYS.parents;
  }

  async findByAccount(account: string, password: string): Promise<Parent | null> {
    const all = await this.list();
    return all.find((p) => p.account === account && p.password === password) ?? null;
  }

  /** 种子初始化：整体覆写 */
  async seed(items: Parent[]): Promise<void> {
    storage.set<Parent[]>(GLOBAL_KEYS.parents, items);
  }
}

export class StudentRepository extends BaseRepository<Student> implements IStudentRepository {
  protected storageKey() {
    return GLOBAL_KEYS.students;
  }

  async listByParent(parentId: string): Promise<Student[]> {
    const all = await this.list();
    return all.filter((s) => s.parentId === parentId);
  }

  /** 种子初始化：整体覆写 */
  async seed(items: Student[]): Promise<void> {
    storage.set<Student[]>(GLOBAL_KEYS.students, items);
  }
}
