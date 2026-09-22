import type { ID, VocabularyWord } from '@/types';
import { StudentScopedBaseRepository } from './StudentScopedBaseRepository';
import type { VocabularyRepository as IVocabularyRepository } from '../types';

/** 单词库掌握阈值：连续答对 3 次（单词比题目要求略高） */
const WORD_MASTERY_STREAK = 3;

/**
 * 学生私有：单词库。
 * 每个学生一份独立的数组，A 孩子的单词永远不会出现在 B 孩子的库里。
 */
export class VocabularyRepository
  extends StudentScopedBaseRepository<VocabularyWord>
  implements IVocabularyRepository
{
  protected scope = 'vocabulary' as const;

  /** 批量入库（查词完成后调用），自动跳过已存在的词 */
  async addBatch(
    studentId: ID,
    words: Omit<VocabularyWord, 'id' | 'createdAt' | 'updatedAt' | 'studentId'>[],
  ): Promise<VocabularyWord[]> {
    const existing = await this.listByStudent(studentId);
    const existingWords = new Set(existing.map((w) => w.word));
    const created: VocabularyWord[] = [];
    const now = Date.now();

    for (const w of words) {
      if (existingWords.has(w.word)) continue;
      existingWords.add(w.word);
      created.push({
        ...w,
        studentId,
        id: `${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        createdAt: now,
        updatedAt: now,
      });
    }

    if (created.length) {
      // 一次性写回，避免逐个 set 造成的多次序列化
      await this.replaceForStudent(studentId, [...existing, ...created]);
    }
    return created;
  }

  async findByWord(studentId: ID, word: string): Promise<VocabularyWord | null> {
    const all = await this.listByStudent(studentId);
    const w = word.trim().toLowerCase();
    return all.find((x) => x.word === w) ?? null;
  }

  /** 种子初始化：整体覆写某学生的单词库（仅播种逻辑使用） */
  async seedForStudent(studentId: ID, words: VocabularyWord[]): Promise<void> {
    await this.replaceForStudent(studentId, words);
  }

  async listByUnit(studentId: ID, unitId: ID): Promise<VocabularyWord[]> {
    const all = await this.listByStudent(studentId);
    return all.filter((w) => w.unitId === unitId);
  }

  /** 列出某文件夹内的单词（folderId=null 表示根目录散词） */
  async listByFolder(studentId: ID, folderId: ID | null): Promise<VocabularyWord[]> {
    const all = await this.listByStudent(studentId);
    return all.filter((w) => (w.folderId ?? null) === folderId);
  }

  /** 移动单词到文件夹（folderId=null 移回根目录） */
  async moveToFolder(studentId: ID, wordId: ID, folderId: ID | null): Promise<VocabularyWord> {
    return this.updateForStudent(studentId, wordId, { folderId });
  }

  async setMastered(studentId: ID, wordId: ID, mastered: boolean): Promise<void> {
    await this.updateForStudent(studentId, wordId, { isMastered: mastered });
  }

  async countByStudent(studentId: ID): Promise<number> {
    return (await this.listByStudent(studentId)).length;
  }

  /**
   * 记录一次练习结果。
   * 连续答对达到阈值 → 自动标记已掌握；答错则清零连续计数
   * （但已获得的掌握状态不会撤销，避免孩子被「倒扣」打击信心）。
   */
  async recordPractice(
    studentId: ID,
    wordId: ID,
    isCorrect: boolean,
  ): Promise<{ word: VocabularyWord; justMastered: boolean }> {
    const word = await this.getForStudent(studentId, wordId);
    if (!word) throw new Error(`[Vocabulary] 未找到单词 id=${wordId}`);

    const practiceCount = word.practiceCount + 1;
    const correctCount = word.correctCount + (isCorrect ? 1 : 0);
    const correctStreak = isCorrect ? (word.correctStreak ?? 0) + 1 : 0;
    const justMastered =
      isCorrect && !word.isMastered && correctStreak >= WORD_MASTERY_STREAK;

    const updated = await this.updateForStudent(studentId, wordId, {
      practiceCount,
      correctCount,
      correctStreak,
      isMastered: word.isMastered || justMastered,
    });

    return { word: updated, justMastered };
  }
}
