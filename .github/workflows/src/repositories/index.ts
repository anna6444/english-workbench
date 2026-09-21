import * as local from './local';
import type { Repositories } from './types';

export type RepositoryMode = 'local' | 'remote';

/**
 * 仓储工厂 —— 换数据源的唯一开关。
 *
 * 未来接入真实后端时：
 *   1. 在 repositories/remote/ 下实现同样的 Repositories 接口（基于 fetch）
 *   2. 这里加一个 'remote' 分支
 *   3. 页面代码一行都不用改 —— 因为接口本来就是 async 的
 */
export function createRepositories(mode: RepositoryMode = 'local'): Repositories {
  if (mode === 'remote') {
    throw new Error(
      '[Repositories] remote 实现尚未接入。请在 repositories/remote/ 下实现同一套接口。',
    );
  }

  const reward = new local.RewardRepositoryImpl();
  const vocabulary = new local.VocabularyRepository();

  return {
    parent: new local.ParentRepository(),
    student: new local.StudentRepository(),
    unit: new local.UnitRepository(),
    vocabulary,
    folder: new local.VocabFolderRepository(vocabulary),
    question: new local.QuestionRepository(),
    listening: new local.ListeningRepository(),
    reading: new local.ReadingRepository(),
    homework: new local.HomeworkRepository(),
    paper: new local.PaperRepository(),
    assignment: new local.AssignmentRepository(),
    submission: new local.SubmissionRepository(),
    examRecord: new local.ExamRecordRepository(),
    wrongBook: new local.WrongBookRepository(),
    progress: new local.ProgressRepositoryImpl(),
    reward,
    corgi: new local.CorgiRepositoryImpl(reward),
    system: new local.SystemRepositoryImpl(),
    settings: new local.SettingsRepositoryImpl(),
  };
}

export * from './types';
