/**
 * 学生私有：单词文件夹仓储 —— localStorage 实现。
 *
 * 多级文件夹模型：
 *   根目录（虚拟，不落盘）→ VocabFolder（可嵌套）→ VocabularyWord.folderId 挂靠
 *
 * 删除语义（防丢数据）：删除文件夹时，内部单词与子文件夹全部上移到
 * 被删文件夹的父级，绝不静默丢弃孩子的单词。
 */

import type { ID, VocabFolder } from '@/types';
import { storage } from '@/storage/StorageManager';
import { studentKey } from '@/storage/keys';
import { newId } from './BaseRepository';
import type { VocabularyRepository as IVocabularyRepository } from '../types';
import type { VocabFolderRepository as IVocabFolderRepository } from '../types';

/** 文件夹默认 emoji 候选（新建时轮换使用，孩子可自行修改） */
export const FOLDER_EMOJI_POOL = ['📁', '📚', '🌸', '🍎', '🐝', '🚀', '🌈', '⭐', '🐠', '🎁'];

export class VocabFolderRepository implements IVocabFolderRepository {
  /** 单词仓储引用：删除文件夹时要把内部单词移回去（防丢数据） */
  constructor(private vocabulary: IVocabularyRepository) {}

  protected scope = 'folders' as const;

  protected keyOf(studentId: ID): string {
    return studentKey(studentId, this.scope);
  }

  async listByStudent(studentId: ID): Promise<VocabFolder[]> {
    const list = storage.get<VocabFolder[]>(this.keyOf(studentId), []);
    return list.sort((a, b) => b.createdAt - a.createdAt);
  }

  async getForStudent(studentId: ID, id: ID): Promise<VocabFolder | null> {
    const all = await this.listByStudent(studentId);
    return all.find((f) => f.id === id) ?? null;
  }

  /** 列出某层级的文件夹（parentFolderId=null 为顶层） */
  async listByParent(studentId: ID, parentFolderId: ID | null): Promise<VocabFolder[]> {
    const all = await this.listByStudent(studentId);
    return all.filter((f) => (f.parentFolderId ?? null) === parentFolderId);
  }

  async create(input: { studentId: ID; name: string; emoji?: string; parentFolderId?: ID | null }): Promise<VocabFolder> {
    const now = Date.now();
    const all = await this.listByStudent(input.studentId);
    const folder: VocabFolder = {
      id: newId(),
      studentId: input.studentId,
      name: input.name.trim().slice(0, 16) || '新文件夹',
      emoji:
        input.emoji ||
        FOLDER_EMOJI_POOL[all.length % FOLDER_EMOJI_POOL.length],
      parentFolderId: input.parentFolderId ?? null,
      createdAt: now,
      updatedAt: now,
    };
    storage.set<VocabFolder[]>(this.keyOf(input.studentId), [folder, ...all]);
    return folder;
  }

  async createFolder(
    studentId: ID,
    input: { name: string; emoji?: string; parentFolderId?: ID | null },
  ): Promise<VocabFolder> {
    return this.create({ studentId, ...input });
  }

  /** 重命名 / 改 emoji */
  async updateFolder(
    studentId: ID,
    folderId: ID,
    patch: Partial<Pick<VocabFolder, 'name' | 'emoji'>>,
  ): Promise<VocabFolder> {
    const all = await this.listByStudent(studentId);
    const target = all.find((f) => f.id === folderId);
    if (!target) throw new Error(`[Folder] 未找到文件夹 id=${folderId}`);

    const updated: VocabFolder = {
      ...target,
      ...patch,
      name:
        patch.name !== undefined
          ? patch.name.trim().slice(0, 16) || target.name
          : target.name,
      updatedAt: Date.now(),
    };
    storage.set<VocabFolder[]>(
      this.keyOf(studentId),
      all.map((f) => (f.id === folderId ? updated : f)),
    );
    return updated;
  }

  /**
   * 删除文件夹（不删单词）：
   *   内部单词 → 上移到被删文件夹的父级
   *   子文件夹 → 上移到被删文件夹的父级
   */
  async removeFolder(studentId: ID, folderId: ID): Promise<void> {
    const all = await this.listByStudent(studentId);
    const target = all.find((f) => f.id === folderId);
    if (!target) return;

    const parentId = target.parentFolderId ?? null;

    // 1. 子文件夹上移
    const rest = all
      .filter((f) => f.id !== folderId)
      .map((f) =>
        (f.parentFolderId ?? null) === folderId
          ? { ...f, parentFolderId: parentId, updatedAt: Date.now() }
          : f,
      );
    storage.set<VocabFolder[]>(this.keyOf(studentId), rest);

    // 2. 内部单词上移（词多时逐个 patch 太慢，一次性批量处理）
    const words = await this.vocabulary.listByStudent(studentId);
    const moved = words.map((w) =>
      w.folderId === folderId
        ? { ...w, folderId: parentId, updatedAt: Date.now() }
        : w,
    );
    if (moved.some((w, i) => w !== words[i])) {
      await this.vocabulary.seedForStudent(studentId, moved);
    }
  }

  /* ── StudentScopedRepository 接口要求的成员 ── */

  async updateForStudent(studentId: ID, id: ID, patch: Partial<VocabFolder>): Promise<VocabFolder> {
    return this.updateFolder(studentId, id, patch);
  }

  async removeForStudent(studentId: ID, id: ID): Promise<void> {
    // 与 removeFolder 同语义（接口统一入口）
    return this.removeFolder(studentId, id);
  }

  async removeAllForStudent(studentId: ID): Promise<void> {
    storage.remove(this.keyOf(studentId));
  }

  /** 种子初始化：整体覆写（仅播种逻辑使用） */
  async seedForStudent(studentId: ID, folders: VocabFolder[]): Promise<void> {
    storage.set<VocabFolder[]>(this.keyOf(studentId), folders);
  }
}
