/**
 * 路由表 —— 三棵角色路由树 + AuthGuard 强制分发。
 *
 * 修复的漏洞（旧版）：
 *   旧版只有一个 RequireSession（只判断登录），所有路由都渲染在同一个
 *   AppShell 里，家长登录后直接落进学生端首页，/parent /tutor 也可被
 *   任何登录者访问。新版按角色拆成三棵树：
 *
 *   /login                          公开
 *   /*   (student only, AppShell)   学生端：首页/单元/单词库/听力/阅读/
 *                                   写作/考试/错题本/进度/柯基乐园
 *   /parent (parent only, ParentShell)   家长视图（只读仪表盘）
 *   /tutor  (tutor only, TutorShell)     辅导视图（绑定/布置/批改/错题）
 *
 * 用 HashRouter：静态托管时无需服务端 rewrite，复制走就能跑。
 */

import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { LoadingState } from '@/components/ui';
import { AuthGuard } from '@/app/AuthGuard';
import { AppShell } from '@/app/AppShell';
import { ParentShell, TutorShell } from '@/app/GuardianShell';
import { LoginPage } from '@/pages/Login/LoginPage';

/* 学生端 */
import { HomePage } from '@/pages/student/HomePage';
import { UnitsPage } from '@/pages/student/UnitsPage';
import { UnitDetailPage } from '@/pages/student/UnitDetailPage';
import { VocabularyPage } from '@/pages/student/VocabularyPage';
import { ListeningPage } from '@/pages/student/ListeningPage';
import { ReadingPage } from '@/pages/student/ReadingPage';
import { WritingPage } from '@/pages/student/WritingPage';
import { ExamPage } from '@/pages/student/ExamPage';
import { WrongBookPage } from '@/pages/student/WrongBookPage';
import { ProgressPage } from '@/pages/student/ProgressPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

/* 管理端 */
import { ParentViewPage } from '@/pages/parent/ParentViewPage';
import { TutorViewPage } from '@/pages/parent/TutorViewPage';

/* 3D 柯基乐园 —— three.js 体积大，路由级懒加载，首屏不受影响 */
const CorgiPage = lazy(() => import('@/pages/student/CorgiPage'));

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      {/* ── 学生端（仅学生角色可达） ── */}
      <Route
        element={
          <AuthGuard allow={['student']}>
            <AppShell />
          </AuthGuard>
        }
      >
        <Route path="/" element={<HomePage />} />
        <Route path="/units" element={<UnitsPage />} />
        <Route path="/units/:unitId" element={<UnitDetailPage />} />
        <Route path="/vocabulary" element={<VocabularyPage />} />
        <Route path="/listening" element={<ListeningPage />} />
        <Route path="/reading" element={<ReadingPage />} />
        <Route path="/writing" element={<WritingPage />} />
        <Route path="/exam" element={<ExamPage />} />
        <Route path="/wrongbook" element={<WrongBookPage />} />
        <Route path="/progress" element={<ProgressPage />} />
        <Route
          path="/corgi"
          element={
            <Suspense
              fallback={
                <div className="py-16">
                  <LoadingState text="柯基正在跑过来…" />
                </div>
              }
            >
              <CorgiPage />
            </Suspense>
          }
        />
      </Route>

      {/* ── 家长端（只读仪表盘，仅家长角色可达） ── */}
      <Route
        element={
          <AuthGuard allow={['parent']}>
            <ParentShell />
          </AuthGuard>
        }
      >
        <Route path="/parent" element={<ParentViewPage />} />
      </Route>

      {/* ── 老师端（管理 + 批改，仅老师角色可达） ── */}
      <Route
        element={
          <AuthGuard allow={['tutor']}>
            <TutorShell />
          </AuthGuard>
        }
      >
        <Route path="/tutor" element={<TutorViewPage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
