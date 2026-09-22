import type { BaseEntity, ID } from './base';

/**
 * 查词状态：
 * - offline  离线词库命中，数据完整
 * - partial  只有占位数据（音标/翻译缺失），后台仍在补全 —— 此时已可交互
 * - online   在线数据补全成功
 * - failed   在线查询失败且离线未命中，保留占位数据
 */
export type LookupStatus = 'offline' | 'partial' | 'online' | 'failed';

/** 数据来源，用于 UI 上标注可信度 */
export type LookupSource = 'offline' | 'dictionaryapi' | 'mymemory' | 'mixed';

/** 学生私有：一个单词条目 */
export interface VocabularyWord extends BaseEntity {
  studentId: ID;
  /** 规范化为小写、已 trim */
  word: string;
  /** 中文翻译，查不到时为「暂无翻译」 */
  translation: string;
  /** 音标，查不到时为占位符 */
  phonetic: string;
  /** 音节数组，如 ['ap','ple']，用于自然拼读 */
  syllables: string[];
  /** 词性，如 n. / v. */
  pos?: string;
  exampleEn?: string;
  exampleZh?: string;
  /** 卡通配图（emoji），规避外链图片不可达 */
  imageEmoji: string;
  /** 所属单元 */
  unitId?: ID;
  /**
   * 所属文件夹（多级文件夹管理）。
   * null/undefined = 根目录（「我的单词」默认区）。
   */
  folderId?: ID | null;
  lookupStatus: LookupStatus;
  lookupSource?: LookupSource;
  /** 是否已掌握 */
  isMastered: boolean;
  /** 练习总次数 */
  practiceCount: number;
  /** 答对总次数 */
  correctCount: number;
  /** 当前连续答对次数（答错清零，用于掌握度判定） */
  correctStreak: number;
}

/**
 * 学生私有：单词文件夹（支持多级嵌套）。
 * 词库首页只展示文件夹卡片；点进去看单词列表。
 * parentFolderId = null 表示顶层文件夹。
 */
export interface VocabFolder extends BaseEntity {
  studentId: ID;
  /** 文件夹名，如「三年级上册」「动物单词」 */
  name: string;
  /** 自定义 emoji 图标 */
  emoji: string;
  /** 上一级文件夹 id，null = 顶层 */
  parentFolderId: ID | null;
}

/** 新建文件夹的输入 */
export interface VocabFolderInput {
  name: string;
  emoji?: string;
  parentFolderId?: ID | null;
}

/** 查词过程中的草稿（尚未落库），继承单词的可编辑字段 */
export interface LookupDraft {
  word: string;
  translation: string;
  phonetic: string;
  syllables: string[];
  pos?: string;
  exampleEn?: string;
  exampleZh?: string;
  imageEmoji: string;
  lookupStatus: LookupStatus;
  lookupSource?: LookupSource;
}
