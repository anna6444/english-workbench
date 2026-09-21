/**
 * GuardianShell —— 家长端 / 老师端的共用外壳。
 *
 * 两者结构相同（顶栏 + 内容区），差异只在：
 *   - 标题与徽章（家长中心·只读 / 辅导中心·管理）
 *   - 主题色（家长=樱花粉 / 老师=鹅黄）
 *
 * 顶栏常驻 StudentSwitcher —— 下拉切换孩子，
 * 视图内所有数据按 currentStudentId 实时联动。
 */

import { Outlet, useNavigate } from 'react-router-dom';
import { Icon } from '@/components/Icon';
import { useAuth } from '@/app/AuthProvider';
import { StudentSwitcher } from './StudentSwitcher';

export function ParentShell() {
  const { guardian, logout } = useAuth();
  return (
    <GuardianShellLayout
      title="家长中心"
      badge="只读模式"
      accent="sakura"
      guardianName={guardian?.name ?? '家长'}
      guardianAvatar={guardian?.avatar ?? '👨‍👩‍👧'}
      onLogout={logout}
    />
  );
}

export function TutorShell() {
  const { guardian, logout } = useAuth();
  return (
    <GuardianShellLayout
      title="辅导中心"
      badge="管理 + 批改"
      accent="butter"
      guardianName={guardian?.name ?? '老师'}
      guardianAvatar={guardian?.avatar ?? '👩‍🏫'}
      onLogout={logout}
    />
  );
}

/* ───────────────────────── 布局实现 ───────────────────────── */

function GuardianShellLayout({
  title,
  badge,
  accent,
  guardianName,
  guardianAvatar,
  onLogout,
}: {
  title: string;
  badge: string;
  accent: 'sakura' | 'butter';
  guardianName: string;
  guardianAvatar: string;
  onLogout: () => void;
}) {
  const navigate = useNavigate();

  const accentClass =
    accent === 'sakura'
      ? 'bg-sakura-100 text-sakura-600'
      : 'bg-butter-100 text-amber-700';

  return (
    <div className="min-h-screen bg-gradient-to-b from-cream to-sakura-50">
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b-2 border-sakura-100">
        <div className="max-w-5xl mx-auto flex items-center gap-3 px-4 sm:px-6 py-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="w-11 h-11 flex items-center justify-center rounded-2xl hover:bg-sakura-100 text-cocoa-500"
            aria-label="返回"
          >
            <Icon name="arrowLeft" size={22} />
          </button>

          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <span className="text-2xl select-none shrink-0">{guardianAvatar}</span>
            <div className="leading-tight min-w-0">
              <p className="font-extrabold text-cocoa-700 truncate">{title}</p>
              <p className="text-xs text-cocoa-400 font-semibold truncate">{guardianName}</p>
            </div>
            <span
              className={`hidden sm:inline-flex shrink-0 rounded-full px-3 py-1.5 text-xs font-extrabold ${accentClass}`}
            >
              {badge}
            </span>
          </div>

          <StudentSwitcher label="正在查看" />

          <button
            type="button"
            onClick={onLogout}
            className="flex items-center gap-2 rounded-2xl px-3.5 py-2.5 text-sm font-bold text-cocoa-500 hover:bg-rose-50 hover:text-rose-600 transition-colors min-h-[44px]"
          >
            <Icon name="arrowLeft" size={18} />
            <span className="hidden sm:inline">退出</span>
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 lg:py-8">
        <Outlet />
      </main>
    </div>
  );
}
