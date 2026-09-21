/**
 * AuthProvider —— 全局鉴权与「当前查看学生」的唯一来源。
 *
 * 与旧 SessionProvider 的关键差异：
 *   1. role 三态（student / parent / tutor），登录即定型，不再有「视图切换器」
 *      —— 家长登录直接进家长端，学生登录直接进学生端，权限由 AuthGuard 强制。
 *   2. 学生是第一等登录主体（旧版学生只能借家长账号切换进入）。
 *   3. 家长/老师视图的「下拉切换孩子」= 改 activeStudentId，
 *      所有页面通过 currentStudentId 重新拉取自己的数据。
 *
 * 登录态持久化：localStorage（egw:v1:meta:auth），刷新页面不用重新登录。
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { ID, Parent, Student } from '@/types';
import { storage } from '@/storage/StorageManager';
import { GLOBAL_KEYS } from '@/storage/keys';
import type { AuthContextValue, AuthRole } from './authTypes';

const AUTH_KEY = `${GLOBAL_KEYS.meta}:auth`;

interface PersistedAuth {
  role: AuthRole;
  /** student 登录：学生 id */
  studentId?: ID;
  /** parent/tutor 登录：账号 id */
  guardianId?: ID;
  /** parent/tutor 正在查看的孩子 */
  activeStudentId?: ID;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export interface AuthProviderProps {
  children: ReactNode;
  /** 注入仓储查询能力，避免 Provider 直接依赖具体实现 */
  loadStudent: (id: ID) => Promise<Student | null>;
  loadGuardian: (id: ID) => Promise<Parent | null>;
  loadChildren: (parentId: ID) => Promise<Student[]>;
}

export function AuthProvider({
  children,
  loadStudent,
  loadGuardian,
  loadChildren,
}: AuthProviderProps) {
  const [role, setRole] = useState<AuthRole | null>(null);
  const [guardian, setGuardian] = useState<Parent | null>(null);
  const [student, setStudent] = useState<Student | null>(null);
  const [childList, setChildList] = useState<Student[]>([]);
  const [activeStudentId, setActiveStudentId] = useState<ID | null>(null);
  const [ready, setReady] = useState(false);

  /* ── 启动时恢复登录态（并校验账号仍存在，数据被重置时自动登出） ── */
  useEffect(() => {
    let alive = true;
    void (async () => {
      const saved = storage.get<PersistedAuth | null>(AUTH_KEY, null);
      if (!saved?.role) {
        if (alive) setReady(true);
        return;
      }

      if (saved.role === 'student') {
        if (!saved.studentId) {
          storage.remove(AUTH_KEY);
          if (alive) setReady(true);
          return;
        }
        const s = await loadStudent(saved.studentId);
        if (!alive) return;
        if (s) {
          setRole('student');
          setStudent(s);
        } else {
          storage.remove(AUTH_KEY);
        }
        setReady(true);
        return;
      }

      // parent / tutor
      if (!saved.guardianId) {
        storage.remove(AUTH_KEY);
        if (alive) setReady(true);
        return;
      }
      const g = await loadGuardian(saved.guardianId);
      if (!alive) return;
      if (!g) {
        storage.remove(AUTH_KEY);
        setReady(true);
        return;
      }
      const kids = await loadChildren(g.id);
      if (!alive) return;
      const restored =
        saved.activeStudentId && kids.some((k) => k.id === saved.activeStudentId)
          ? saved.activeStudentId
          : kids[0]?.id ?? null;
      setRole(g.role === 'tutor' ? 'tutor' : 'parent');
      setGuardian(g);
      setChildList(kids);
      setActiveStudentId(restored);
      setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, [loadStudent, loadGuardian, loadChildren]);

  /* ── 登录态变化时落盘 ── */
  useEffect(() => {
    if (!ready) return;
    if (!role) {
      storage.remove(AUTH_KEY);
      return;
    }
    const persist: PersistedAuth =
      role === 'student'
        ? { role, studentId: student?.id }
        : { role, guardianId: guardian?.id, activeStudentId: activeStudentId ?? undefined };
    storage.set<PersistedAuth>(AUTH_KEY, persist);
  }, [ready, role, student, guardian, activeStudentId]);

  /* ── 动作 ── */

  const loginStudent = useCallback((s: Student) => {
    setRole('student');
    setStudent(s);
    setGuardian(null);
    setChildList([]);
    setActiveStudentId(null);
  }, []);

  const loginGuardian = useCallback((g: Parent, kids: Student[]) => {
    setRole(g.role === 'tutor' ? 'tutor' : 'parent');
    setGuardian(g);
    setChildList(kids);
    setActiveStudentId(kids[0]?.id ?? null);
    setStudent(null);
  }, []);

  const switchStudent = useCallback((id: ID) => {
    setActiveStudentId(id);
  }, []);

  const refreshChildren = useCallback(async () => {
    if (!guardian) return;
    const kids = await loadChildren(guardian.id);
    setChildList(kids);
    setActiveStudentId((prev) =>
      prev && kids.some((k) => k.id === prev) ? prev : (kids[0]?.id ?? null),
    );
  }, [guardian, loadChildren]);

  const logout = useCallback(() => {
    setRole(null);
    setGuardian(null);
    setStudent(null);
    setChildList([]);
    setActiveStudentId(null);
    storage.remove(AUTH_KEY);
  }, []);

  /* ── 派生：当前查看的学生 ── */
  const currentStudentId = role === 'student' ? (student?.id ?? null) : activeStudentId;
  const currentStudent =
    role === 'student'
      ? student
      : (childList.find((s) => s.id === activeStudentId) ?? null);

  const value = useMemo<AuthContextValue>(
    () => ({
      ready,
      role,
      guardian,
      student,
      children: role === 'student' ? (student ? [student] : []) : childList,
      currentStudentId,
      currentStudent,
      loginStudent,
      loginGuardian,
      switchStudent,
      refreshChildren,
      logout,
    }),
    [
      ready,
      role,
      guardian,
      student,
      childList,
      currentStudentId,
      currentStudent,
      loginStudent,
      loginGuardian,
      switchStudent,
      refreshChildren,
      logout,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** 取鉴权上下文。必须在 <AuthProvider> 内部使用。 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('[useAuth] 必须在 <AuthProvider> 内部使用。');
  }
  return ctx;
}

/**
 * 兼容导出：旧学生页面大量使用 useSession().currentStudentId / currentStudent，
 * 语义与新版完全一致（当前查看的学生），保留别名减少迁移面。
 */
export function useSession(): AuthContextValue {
  return useAuth();
}

/**
 * 严格版：要求必须已选中学生，否则抛错。
 * 学生私有页面用它，可以从类型上保证 studentId 非空。
 */
export function useCurrentStudentId(): ID {
  const { currentStudentId } = useAuth();
  if (!currentStudentId) {
    throw new Error('[useCurrentStudentId] 当前没有选中的学生，请先登录。');
  }
  return currentStudentId;
}
