import { ALL_PREFIX, GLOBAL_KEYS, STUDENT_SCOPES, studentKey, type StudentScope } from './keys';
import { isQuotaError, safeParse, safeStringify } from './safeJSON';

export interface StorageStat {
  key: string;
  bytes: number;
}

/**
 * StorageManager —— 只管四件事：
 *   1. 序列化 / 反序列化（容错，脏数据不炸）
 *   2. 命名空间与 studentId 隔离（唯一入口）
 *   3. 可用性降级（隐私模式 / 配额满 → 内存兜底）
 *   4. 原子读-改-写（避免并发覆盖）
 *
 * 不含任何业务语义 —— 业务逻辑属于 Repository 层。
 */
class StorageManagerImpl {
  /** localStorage 是否真的可用（隐私模式下会抛异常） */
  private readonly available: boolean;
  /** localStorage 不可用时的内存兜底（刷新即丢，但至少不崩） */
  private memory = new Map<string, string>();

  constructor() {
    this.available = this.probe();
    if (!this.available) {
      console.warn(
        '[Storage] localStorage 不可用（可能是隐私模式或配额受限），已降级为内存存储。数据在刷新后会丢失。',
      );
    }
  }

  private probe(): boolean {
    try {
      const k = '__egw_probe__';
      window.localStorage.setItem(k, '1');
      window.localStorage.removeItem(k);
      return true;
    } catch {
      return false;
    }
  }

  /** 统一底层读写入口，自动处理降级 */
  private backend(): {
    getItem(k: string): string | null;
    setItem(k: string, v: string): void;
    removeItem(k: string): void;
    keys(): string[];
  } {
    if (this.available) {
      return {
        getItem: (k) => window.localStorage.getItem(k),
        setItem: (k, v) => window.localStorage.setItem(k, v),
        removeItem: (k) => window.localStorage.removeItem(k),
        keys: () => {
          const out: string[] = [];
          for (let i = 0; i < window.localStorage.length; i++) {
            const k = window.localStorage.key(i);
            if (k) out.push(k);
          }
          return out;
        },
      };
    }
    return {
      getItem: (k) => this.memory.get(k) ?? null,
      setItem: (k, v) => void this.memory.set(k, v),
      removeItem: (k) => void this.memory.delete(k),
      keys: () => Array.from(this.memory.keys()),
    };
  }

  // ─────────────── 基础 API ───────────────

  get<T>(key: string, fallback: T): T {
    const raw = this.backend().getItem(key);
    const parsed = safeParse<T>(raw);
    return parsed === undefined ? fallback : parsed;
  }

  set<T>(key: string, value: T): boolean {
    const s = safeStringify(value);
    if (s === undefined) return false;
    try {
      this.backend().setItem(key, s);
      return true;
    } catch (e) {
      if (isQuotaError(e)) {
        // 配额满：先清掉可再生的词典缓存，再重试一次
        console.warn('[Storage] 配额已满，清理词典缓存后重试');
        this.backend().removeItem(GLOBAL_KEYS.dictionaryCache);
        try {
          this.backend().setItem(key, s);
          return true;
        } catch {
          /* 仍然失败就放弃，不阻断流程 */
        }
      }
      console.error('[Storage] 写入失败', key, e);
      return false;
    }
  }

  remove(key: string): void {
    this.backend().removeItem(key);
  }

  has(key: string): boolean {
    return this.backend().getItem(key) !== null;
  }

  /**
   * 原子读-改-写：把「取出来 → 改 → 存回去」合成一次操作，
   * 避免连续两次写各自基于旧值，后写覆盖先写。
   */
  update<T>(key: string, fallback: T, updater: (prev: T) => T): T {
    const next = updater(this.get<T>(key, fallback));
    this.set<T>(key, next);
    return next;
  }

  // ─────────────── 学生隔离 API（推荐入口） ───────────────

  getForStudent<T>(studentId: string, scope: StudentScope, fallback: T): T {
    return this.get<T>(studentKey(studentId, scope), fallback);
  }

  setForStudent<T>(studentId: string, scope: StudentScope, value: T): boolean {
    return this.set<T>(studentKey(studentId, scope), value);
  }

  removeForStudent(studentId: string, scope: StudentScope): void {
    this.remove(studentKey(studentId, scope));
  }

  /** 清空某个学生的全部私有数据（解绑 / 换设备时用） */
  purgeStudent(studentId: string): void {
    STUDENT_SCOPES.forEach((s) => this.removeForStudent(studentId, s));
  }

  // ─────────────── 枚举与统计（迁移 / 调试） ───────────────

  allKeys(prefix: string = ALL_PREFIX): string[] {
    return this.backend().keys().filter((k) => k.startsWith(prefix));
  }

  stats(): StorageStat[] {
    const b = this.backend();
    return this.allKeys(ALL_PREFIX).map((key) => ({
      key,
      // localStorage 以 UTF-16 存储，字符数 ×2 ≈ 字节数
      bytes: (b.getItem(key)?.length ?? 0) * 2,
    }));
  }

  totalBytes(): number {
    return this.stats().reduce((sum, s) => sum + s.bytes, 0);
  }

  isPersistent(): boolean {
    return this.available;
  }

  /** 危险操作：清空本应用的全部数据（不清其他站点的） */
  clearAll(): void {
    this.allKeys(ALL_PREFIX).forEach((k) => this.remove(k));
  }
}

export const storage = new StorageManagerImpl();
