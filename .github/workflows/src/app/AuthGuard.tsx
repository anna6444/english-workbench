/**
 * AuthGuard —— 路由级权限守卫。
 *
 * 修复的漏洞（旧版）：
 *   旧 RequireSession 只判断「是否登录」，不判断「是什么角色」，
 *   家长登录后被放进学生端，/parent /tutor 也无守卫，任何人可达。
 *
 * 新规则：
 *   <AuthGuard allow={['student']}> 只放行学生；家长/老师访问学生路由 →
 *   自动弹回自己的首页。反之亦然。未登录 → 一律去 /login。
 *   守卫在重定向前保持加载态，避免目标页面闪现一帧（数据串号风险）。
 */

import { useEffect, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LoadingState } from '@/components/ui';
import { useAuth } from './AuthProvider';
import type { AuthRole } from './authTypes';

/** 各角色登录后的首页 */
export function homeOfRole(role: AuthRole): string {
  if (role === 'parent') return '/parent';
  if (role === 'tutor') return '/tutor';
  return '/';
}

export function AuthGuard({ allow, children }: { allow: AuthRole[]; children: ReactNode }) {
  const { ready, role } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const allowed = role !== null && allow.includes(role);

  useEffect(() => {
    if (!ready) return;
    if (!role) {
      navigate('/login', { replace: true, state: { from: location.pathname } });
      return;
    }
    if (!allowed) {
      // 角色不符：强制弹回该角色自己的首页
      navigate(homeOfRole(role), { replace: true });
    }
  }, [ready, role, allowed, navigate, location.pathname]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingState text="正在唤醒学习数据…" />
      </div>
    );
  }

  if (!role || !allowed) {
    // 正在重定向，渲染占位（绝不渲染受保护内容）
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingState text="正在前往该去的地方…" />
      </div>
    );
  }

  return <>{children}</>;
}
