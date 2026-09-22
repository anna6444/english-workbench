/**
 * 数据备份结构 —— 家长视图「导出/导入 JSON」用。
 *
 * 打包范围（按规格书 1.2）：
 *   学生核心数据：单词本（含文件夹）、错题本、星星奖励、柯基状态、学习进度
 *   派生数据：作业、提交、考试记录（保证恢复后家长视图完整）
 *   账号体系：不打包（含密码，避免导出文件泄漏；恢复用内置账号即可）
 *
 * 导入语义：整体覆盖该学生的全部私有数据 + 全局共享内容（题库等）。
 */
import type {
  Assignment,
  CorgiState,
  ExamRecord,
  ProgressState,
  Question,
  RewardState,
  Submission,
  VocabFolder,
  VocabularyWord,
  WrongRecord,
} from './index';

/** 备份文件的单个学生数据包 */
export interface StudentBackup {
  studentId: string;
  nickname?: string;
  words: VocabularyWord[];
  folders: VocabFolder[];
  wrongs: WrongRecord[];
  reward: RewardState | null;
  corgi: CorgiState | null;
  progress: ProgressState | null;
  assignments: Assignment[];
  submissions: Submission[];
  exams: ExamRecord[];
}

/** 备份文件顶层结构 */
export interface BackupData {
  /** 备份格式版本 */
  format: 'egw-backup';
  version: 1;
  /** 导出时间戳 */
  exportedAt: number;
  /** 导出者身份（家长昵称） */
  exportedBy?: string;
  /** 全部学生数据 */
  students: StudentBackup[];
  /** 共享题库（老师批量导入的题也在里面，一并带走） */
  questions: Question[];
}
