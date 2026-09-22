import type {
  Assignment,
  ExamPaper,
  ExamRecord,
  Homework,
  ID,
  Submission,
} from '@/types';
import { CONTENT_KEYS } from '@/storage/keys';
import { storage } from '@/storage/StorageManager';
import { BaseRepository, newId } from './BaseRepository';
import { StudentScopedBaseRepository } from './StudentScopedBaseRepository';
import type {
  AssignmentRepository as IAssignmentRepository,
  ExamRecordRepository as IExamRecordRepository,
  HomeworkRepository as IHomeworkRepository,
  PaperRepository as IPaperRepository,
  SubmissionRepository as ISubmissionRepository,
} from '../types';

/** 作业模板（共享，家长维护） */
export class HomeworkRepository
  extends BaseRepository<Homework>
  implements IHomeworkRepository
{
  protected storageKey() {
    return CONTENT_KEYS.homework;
  }

  async seed(items: Homework[]): Promise<void> {
    storage.set(CONTENT_KEYS.homework, items);
  }
}

/** 试卷（共享） */
export class PaperRepository extends BaseRepository<ExamPaper> implements IPaperRepository {
  protected storageKey() {
    return CONTENT_KEYS.papers;
  }

  async listOrdered(): Promise<ExamPaper[]> {
    const all = await this.list();
    return all.slice().sort((a, b) => a.createdAt - b.createdAt);
  }

  async seed(items: ExamPaper[]): Promise<void> {
    storage.set(CONTENT_KEYS.papers, items);
  }
}

/** 学生私有：收到的作业 */
export class AssignmentRepository
  extends StudentScopedBaseRepository<Assignment>
  implements IAssignmentRepository
{
  protected scope = 'assignments' as const;

  /** 种子初始化：整体覆写某学生的作业列表（仅播种逻辑使用） */
  async seedForStudent(studentId: ID, items: Assignment[]): Promise<void> {
    await this.replaceForStudent(studentId, items);
  }

  async assign(studentId: ID, homework: Homework, assignedBy: ID): Promise<Assignment> {
    const now = Date.now();
    return this.create({
      studentId,
      homeworkId: homework.id,
      homeworkTitle: homework.title,
      homeworkType: homework.type,
      assignedBy,
      assignedAt: now,
      dueAt: now + homework.dueInDays * 24 * 60 * 60 * 1000,
      status: 'assigned',
    });
  }

  async listByStatus(studentId: ID, status: Assignment['status']): Promise<Assignment[]> {
    const all = await this.listByStudent(studentId);
    return all.filter((a) => a.status === status);
  }
}

/** 学生私有：提交与批改 */
export class SubmissionRepository
  extends StudentScopedBaseRepository<Submission>
  implements ISubmissionRepository
{
  protected scope = 'submissions' as const;

  async submit(studentId: ID, assignmentId: ID, content: string): Promise<Submission> {
    return this.create({ studentId, assignmentId, content });
  }

  async grade(
    studentId: ID,
    submissionId: ID,
    score: number,
    comment: string,
    gradedBy: ID,
  ): Promise<Submission> {
    return this.updateForStudent(studentId, submissionId, {
      teacherScore: score,
      teacherComment: comment,
      gradedBy,
      gradedAt: Date.now(),
    });
  }

  async listByAssignment(studentId: ID, assignmentId: ID): Promise<Submission | null> {
    const all = await this.listByStudent(studentId);
    return all.find((s) => s.assignmentId === assignmentId) ?? null;
  }

  /** 备份恢复：整体覆写（仅导入逻辑使用） */
  async seedForStudent(studentId: ID, items: Submission[]): Promise<void> {
    await this.replaceForStudent(studentId, items);
  }
}

/** 学生私有：考试记录 */
export class ExamRecordRepository
  extends StudentScopedBaseRepository<ExamRecord>
  implements IExamRecordRepository
{
  protected scope = 'exams' as const;

  async saveRecord(
    studentId: ID,
    record: Omit<ExamRecord, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<ExamRecord> {
    return this.create(record);
  }

  async listRecent(studentId: ID, limit: number): Promise<ExamRecord[]> {
    const all = await this.listByStudent(studentId);
    return all
      .slice()
      .sort((a, b) => b.finishedAt - a.finishedAt)
      .slice(0, limit);
  }

  /** 备份恢复：整体覆写（仅导入逻辑使用） */
  async seedForStudent(studentId: ID, items: ExamRecord[]): Promise<void> {
    await this.replaceForStudent(studentId, items);
  }
}

/** 供种子使用：直接写入学生私有数据 */
export function seedStudentScope<T>(key: string, items: T[]): void {
  storage.set(key, items);
}

export { newId };
