import type { ID, Question, WrongRecord } from '@/types';
import { MASTERY_STREAK_THRESHOLD } from '@/types';
import { StudentScopedBaseRepository } from './StudentScopedBaseRepository';
import type { WrongBookRepository as IWrongBookRepository } from '../types';

/**
 * 学生私有：错题本。
 *
 * 掌握规则：连续答对 MASTERY_STREAK_THRESHOLD（2）次 → 自动标记「已掌握」。
 * 答错则清零连续计数。已掌握后再次答错会重新回到待复习状态
 * （说明是忘记了，需要重新巩固）。
 */
export class WrongBookRepository
  extends StudentScopedBaseRepository<WrongRecord>
  implements IWrongBookRepository
{
  protected scope = 'wrongbook' as const;

  /** 种子初始化：整体覆写某学生的错题本（仅播种逻辑使用） */
  async seedForStudent(studentId: ID, records: WrongRecord[]): Promise<void> {
    await this.replaceForStudent(studentId, records);
  }

  /** 答错：已有记录则累加，否则新建（并保存题目快照） */
  async addWrong(studentId: ID, question: Question): Promise<WrongRecord> {
    const all = await this.listByStudent(studentId);
    const hit = all.find((r) => r.questionId === question.id);
    const now = Date.now();

    const snapshot: WrongRecord['snapshot'] = {
      type: question.type,
      question: question.question,
      options: question.options,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation,
      emoji: question.image?.emoji,
      audioText: question.audioText,
      passage: question.passage,
    };

    if (hit) {
      return this.updateForStudent(studentId, hit.id, {
        wrongCount: hit.wrongCount + 1,
        // 答错清零连续计数，并退出已掌握状态（孩子忘记了这个知识点）
        correctStreak: 0,
        isMastered: false,
        lastWrongAt: now,
        snapshot,
      });
    }

    return this.create({
      studentId,
      questionId: question.id,
      wrongCount: 1,
      correctStreak: 0,
      isMastered: false,
      lastWrongAt: now,
      snapshot,
    });
  }

  /** 答对：连续计数 +1，达到阈值自动置为已掌握 */
  async recordCorrect(
    studentId: ID,
    questionId: ID,
  ): Promise<{ record: WrongRecord | null; justMastered: boolean }> {
    const all = await this.listByStudent(studentId);
    const hit = all.find((r) => r.questionId === questionId);
    if (!hit) return { record: null, justMastered: false };

    const correctStreak = hit.correctStreak + 1;
    const justMastered = !hit.isMastered && correctStreak >= MASTERY_STREAK_THRESHOLD;

    const record = await this.updateForStudent(studentId, hit.id, {
      correctStreak,
      isMastered: hit.isMastered || justMastered,
      lastPracticedAt: Date.now(),
    });

    return { record, justMastered };
  }

  /** 待复习（未掌握）的错题，按最近答错时间倒序 */
  async listActive(studentId: ID): Promise<WrongRecord[]> {
    const all = await this.listByStudent(studentId);
    return all
      .filter((r) => !r.isMastered)
      .sort((a, b) => b.lastWrongAt - a.lastWrongAt);
  }

  /** 已掌握的错题 */
  async listMastered(studentId: ID): Promise<WrongRecord[]> {
    const all = await this.listByStudent(studentId);
    return all.filter((r) => r.isMastered);
  }

  async countMastered(studentId: ID): Promise<number> {
    return (await this.listMastered(studentId)).length;
  }
}
