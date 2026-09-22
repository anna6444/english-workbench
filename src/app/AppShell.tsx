/**
 * AppShell —— 学生端专用外壳：PC 侧边栏 + 移动端底部 Tab。
 *
 * 修复的漏洞（旧版）：
 *   旧外壳同时承载学生端 + 家长视图 + 辅导视图（靠 viewMode 切换），
 *   导致「家长登录后只看到孩子页面」。现在学生端就是学生端 ——
 *   家长/老师有各自的 Shell，由 AuthGuard 在路由层强制分发。
 *
 * 响应式策略：
 *   ≥1024px：左侧固定侧边栏（240px）+ 内容区
 *   <1024px：顶部栏 + 底部 5 个 Tab（首页/单元/单词库/柯基/考试）
 */

import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Icon } from '@/components/Icon';
import { MOBILE_TABS, STUDENT_NAV, TONE_CLASS } from '@/app/nav';
import { useAuth } from '@/app/AuthProvider';
import { storage } from '@/storage/StorageManager';

export function AppShell() {
  const { pathname } = useLocation();
  const { currentStudent, logout } = useAuth();
  const [drawer, setDrawer] = useState(false);
  const persistent = storage.isPersistent();

  /* 路由变化时收起移动端抽屉 */
  useEffect(() => {
    setDrawer(false);
  }, [pathname]);

  return (
    <div className="min-h-screen flex bg-gradient-to-b from-cream to-sakura-50">
      {/* ───────── PC 侧边栏 ───────── */}
      <aside className="hidden lg:flex flex-col w-60 shrink-0 bg-white/90 border-r-2 border-sakura-100 h-screen sticky top-0">
        <BrandHeader />
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          <NavGroupLabel>我的学习乐园</NavGroupLabel>
          {STUDENT_NAV.map((item) => (
            <SideLink
              key={item.path}
              to={item.path}
              icon={item.icon}
              label={item.label}
              tone={item.tone}
            />
          ))}
        </nav>
        <SidebarFooter
          studentName={currentStudent?.nickname ?? '小同学'}
          studentAvatar={currentStudent?.avatar ?? '🙂'}
          onLogout={logout}
        />
      </aside>

      {/* ───────── 主内容 ───────── */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* 顶部栏 */}
        <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b-2 border-sakura-100">
          <div className="flex items-center gap-3 px-4 sm:px-6 py-3">
            {/* 移动端菜单按钮 */}
            <button
              type="button"
              onClick={() => setDrawer(true)}
              className="lg:hidden w-11 h-11 flex items-center justify-center rounded-2xl hover:bg-sakura-100 text-cocoa-600"
              aria-label="打开菜单"
            >
              <Icon name="menu" size={24} />
            </button>

            <div className="lg:hidden flex items-center gap-2">
              <span className="text-2xl select-none">🌱</span>
              <span className="font-extrabold text-cocoa-700">英语生长世界</span>
            </div>

            <div className="hidden lg:block flex-1" />

            <div className="ml-auto flex items-center gap-2 sm:gap-3">
              {!persistent && (
                <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-amber-100 text-amber-700 px-3 py-1.5 text-xs font-bold">
                  <Icon name="info" size={14} />
                  临时存储
                </span>
              )}
              <div className="flex items-center gap-2 rounded-2xl bg-sakura-50 border-2 border-sakura-100 px-3 py-1.5">
                <span className="text-2xl leading-none select-none">
                  {currentStudent?.avatar ?? '🙂'}
                </span>
                <span className="hidden sm:block text-sm font-extrabold text-cocoa-600 leading-tight">
                  {currentStudent?.nickname ?? '小同学'}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* 页面内容 */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-5 lg:py-8 pb-28 lg:pb-10">
          <div className="mx-auto w-full max-w-5xl">
            <Outlet />
          </div>
        </main>
      </div>

      {/* ───────── 移动端抽屉 ───────── */}
      {drawer && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-cocoa-700/40"
            onClick={() => setDrawer(false)}
            aria-hidden="true"
          />
          <div className="relative w-72 max-w-[82vw] bg-white h-full flex flex-col animate-[slide-in_0.2s_ease-out]">
            <BrandHeader onClose={() => setDrawer(false)} />
            <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
              <NavGroupLabel>我的学习乐园</NavGroupLabel>
              {STUDENT_NAV.map((item) => (
                <SideLink
                  key={item.path}
                  to={item.path}
                  icon={item.icon}
                  label={item.label}
                  tone={item.tone}
                />
              ))}
            </nav>
            <SidebarFooter
              studentName={currentStudent?.nickname ?? '小同学'}
              studentAvatar={currentStudent?.avatar ?? '🙂'}
              onLogout={logout}
            />
          </div>
        </div>
      )}

      {/* ───────── 移动端底部 Tab（含 iOS 安全区适配） ───────── */}
      <MobileTabBar />
    </div>
  );
}

/* ───────────────────────── 子组件 ───────────────────────── */

function BrandHeader({ onClose }: { onClose?: () => void }) {
  return (
    <div className="flex items-center gap-2.5 px-5 py-5 border-b-2 border-sakura-100">
      <span className="text-3xl select-none">🌱</span>
      <div className="leading-tight flex-1">
        <p className="font-extrabold text-cocoa-700 text-base">英语生长世界</p>
        <p className="text-xs text-cocoa-400 font-semibold">English Growth World</p>
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-sakura-100 text-cocoa-500"
          aria-label="关闭菜单"
        >
          <Icon name="close" size={20} />
        </button>
      )}
    </div>
  );
}

function NavGroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 pt-3 pb-1.5 text-xs font-extrabold text-cocoa-400 tracking-wide">
      {children}
    </p>
  );
}

function SideLink({
  to,
  icon,
  label,
  tone,
}: {
  to: string;
  icon: Parameters<typeof Icon>[0]['name'];
  label: string;
  tone: keyof typeof TONE_CLASS;
}) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-2xl px-3.5 py-3 font-bold transition-colors min-h-[52px] ${
          isActive
            ? `${TONE_CLASS[tone].softBg} ${TONE_CLASS[tone].text}`
            : 'text-cocoa-600 hover:bg-sakura-50'
        }`
      }
    >
      <Icon name={icon} size={22} />
      <span className="text-[15px]">{label}</span>
    </NavLink>
  );
}

function SidebarFooter({
  studentName,
  studentAvatar,
  onLogout,
}: {
  studentName: string;
  studentAvatar: string;
  onLogout: () => void;
}) {
  return (
    <div className="border-t-2 border-sakura-100 p-3 space-y-1">
      <div className="flex items-center gap-2.5 px-2 py-2">
        <span className="text-xl select-none">{studentAvatar}</span>
        <span className="text-sm font-bold text-cocoa-600 flex-1 truncate">{studentName}</span>
      </div>
      <button
        type="button"
        onClick={onLogout}
        className="w-full flex items-center gap-2.5 rounded-2xl px-3.5 py-3 text-sm font-bold text-cocoa-500 hover:bg-rose-50 hover:text-rose-600 transition-colors min-h-[48px]"
      >
        <Icon name="arrowLeft" size={18} />
        退出登录
      </button>
    </div>
  );
}

/** 移动端底部 Tab：5 个高频模块 */
function MobileTabBar() {
  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t-2 border-sakura-100"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="grid grid-cols-5">
        {MOBILE_TABS.map((tab) => (
          <NavLink
            key={tab.path}
            to={tab.path}
            end={tab.path === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-1 py-2.5 min-h-[60px] transition-colors ${
                isActive ? TONE_CLASS[tab.tone].text : 'text-cocoa-400'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={`flex items-center justify-center w-9 h-7 rounded-xl transition-colors ${
                    isActive ? TONE_CLASS[tab.tone].softBg : ''
                  }`}
                >
                  <Icon name={tab.icon} size={21} />
                </span>
                <span className="text-[10px] font-extrabold">{tab.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
