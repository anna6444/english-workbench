/**
 * localStorage key 命名与隔离规则的唯一入口。
 *
 * ⚠️ 铁律：任何仓储层代码都不允许手写 key 字符串，必须走本文件导出的函数。
 * 这样「按 studentId 隔离」这件事只有一个地方会被改错。
 *
 * 命名格式：egw:v1:{scope}:{studentId?}:{entity}
 * 版本号编进 key（而不是只放在 meta 里）——
 * 迁移时可以直接枚举 egw:v0:* 整体搬迁，不会出现「读的时候版本已变」的竞态。
 */

export const SCHEMA_VERSION = 1;
export const SEED_VERSION = 1;

const NS = 'egw';

/** 全局（不区分学生） */
export const GLOBAL_KEYS = {
  meta: `${NS}:v${SCHEMA_VERSION}:meta`,
  accounts: `${NS}:v${SCHEMA_VERSION}:accounts`,
  parents: `${NS}:v${SCHEMA_VERSION}:parents`,
  students: `${NS}:v${SCHEMA_VERSION}:students`,
  /** 查词结果缓存，跨学生复用（只读语义，可随时清理） */
  dictionaryCache: `${NS}:v${SCHEMA_VERSION}:dictionary`,
  /** 全局设置（强制 2D 等，家长可改） */
  settings: `${NS}:v${SCHEMA_VERSION}:settings`,
} as const;

/** 共享教材内容（家长维护，学生只读） */
export const CONTENT_KEYS = {
  units: `${NS}:v${SCHEMA_VERSION}:content:units`,
  listening: `${NS}:v${SCHEMA_VERSION}:content:listening`,
  reading: `${NS}:v${SCHEMA_VERSION}:content:reading`,
  questions: `${NS}:v${SCHEMA_VERSION}:content:questions`,
  papers: `${NS}:v${SCHEMA_VERSION}:content:papers`,
  homework: `${NS}:v${SCHEMA_VERSION}:content:homework`,
} as const;

/** 每个学生的私有数据域 —— 隔离点 */
export const STUDENT_SCOPES = [
  'vocabulary',
  'folders',
  'wrongbook',
  'progress',
  'reward',
  'assignments',
  'submissions',
  'exams',
  'corgi',
] as const;

export type StudentScope = (typeof STUDENT_SCOPES)[number];

/**
 * 生成学生私有 key。
 * studentId 为空时直接抛错，而不是静默返回一个「全局 key」——
 * 忘了传 id 是这类应用最严重的 bug（A 孩子看到 B 孩子的错题），
 * 让它当场炸掉，好过上线后数据串号。
 */
export function studentKey(studentId: string, scope: StudentScope): string {
  if (!studentId || typeof studentId !== 'string') {
    throw new Error(
      `[keys] studentKey 收到空的 studentId（scope=${scope}）。` +
        '学生私有数据必须指定 studentId，拒绝跨生污染。',
    );
  }
  return `${NS}:v${SCHEMA_VERSION}:s:${studentId}:${scope}`;
}

/** 全部 key 的公共前缀，用于枚举与清理 */
export const ALL_PREFIX = `${NS}:`;

/** 解析任意 key 的元信息（迁移与调试用） */
export function parseKey(key: string): {
  version: number;
  isStudentScoped: boolean;
  studentId?: string;
  scope: string;
} | null {
  const m = key.match(/^egw:v(\d+):(?:(s):([^:]+):)?(.+)$/);
  if (!m) return null;
  return {
    version: Number(m[1]),
    isStudentScoped: Boolean(m[2]),
    studentId: m[3],
    scope: m[4],
  };
}
