/**
 * 登录页 —— 三种角色选择（修复「学生入口缺失」漏洞）。
 *
 * 旧版问题：只有「家长/老师」两个演示账号按钮，孩子没有自己的入口。
 * 新版三角色：
 *   🧑‍🎓 我是孩子 → 点选头像 或 输入名字 直接进入学生端
 *   👨‍👩‍👧 我是家长 → 账号密码登录 → 家长视图（只读）
 *   👩‍🏫 我是老师 → 账号密码登录 → 辅导视图（管理 + 批改）
 *
 * 面向家庭场景，不做注册流程（账号由 Mock 预置并播种）。
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, ErrorNote } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { useRepositories } from '@/repositories/RepositoriesProvider';
import { useAuth } from '@/app/AuthProvider';
import { homeOfRole } from '@/app/AuthGuard';
import { seedIfNeeded } from '@/mock/seed';
import type { Student } from '@/types';

type LoginStep = 'role' | 'student' | 'parent' | 'tutor';

export function LoginPage() {
  const repos = useRepositories();
  const { loginStudent, loginGuardian, role } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<LoginStep>('role');
  const [students, setStudents] = useState<Student[]>([]);
  const [seeding, setSeeding] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* 学生流程：名字输入框 */
  const [nameInput, setNameInput] = useState('');
  /* 家长/老师流程 */
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');

  /* 进登录页先确保种子数据就位（同时拿到学生列表供头像宫格） */
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const r = await seedIfNeeded(repos);
        if (r.seeded) {
          console.info('[seed] 首次播种完成', r);
        }
      } catch (e) {
        console.error('[seed] 播种失败', e);
      }
      try {
        const list = await repos.student.list();
        if (!alive) return;
        setStudents(list);
      } catch (e) {
        console.error('[login] 拉取学生列表失败', e);
      } finally {
        if (alive) setSeeding(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [repos]);

  /* 已登录直接回自己的首页（防止登录页被已登录用户重复进入） */
  useEffect(() => {
    if (role) navigate(homeOfRole(role), { replace: true });
  }, [role, navigate]);

  /* ── 学生登录：点头像 ── */
  function pickStudent(s: Student) {
    loginStudent(s);
    navigate('/', { replace: true });
  }

  /* ── 学生登录：输名字 ── */
  function loginByName() {
    const kw = nameInput.trim();
    if (!kw) {
      setError('先写下你的名字，或点下面的头像进入～');
      return;
    }
    const hit = students.find(
      (s) => s.name === kw || s.nickname === kw || s.name.includes(kw) || s.nickname.includes(kw),
    );
    if (!hit) {
      setError(`没有找到叫「${kw}」的小朋友，试试点下面的头像吧～`);
      return;
    }
    pickStudent(hit);
  }

  /* ── 家长/老师登录 ── */
  async function handleGuardianLogin(expect: 'parent' | 'tutor') {
    if (!account.trim() || !password.trim()) {
      setError('请输入账号和密码。');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const g = await repos.parent.findByAccount(account.trim(), password);
      if (!g) {
        setError('账号或密码不对，再试一次～');
        return;
      }
      if (g.role !== expect) {
        setError(
          g.role === 'parent'
            ? '这是家长账号，请返回选择「我是家长」。'
            : '这是老师账号，请返回选择「我是老师」。',
        );
        return;
      }
      const kids = await repos.student.listByParent(g.id);
      if (kids.length === 0) {
        setError('这个账号还没有绑定孩子，请先用老师账号完成绑定。');
        return;
      }
      loginGuardian(g, kids);
      navigate(homeOfRole(g.role), { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : '登录失败，请重试。');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-5 bg-gradient-to-br from-butter-100 via-cream to-sakura-100">
      <div className="w-full max-w-md">
        {/* 品牌区 */}
        <button
          type="button"
          onClick={() => {
            setStep('role');
            setError(null);
          }}
          className="block mx-auto text-center mb-7"
        >
          <div className="text-6xl mb-3 select-none animate-[wiggle_2.4s_ease-in-out_infinite]">
            🌱
          </div>
          <h1 className="text-3xl font-extrabold text-cocoa-700 mb-1.5">英语生长世界</h1>
          <p className="text-base text-cocoa-500 font-semibold">
            每天 10 分钟，单词慢慢长成小树林
          </p>
        </button>

        {error && (
          <div className="mb-5">
            <ErrorNote>{error}</ErrorNote>
          </div>
        )}

        {/* ───────── 第一步：选角色 ───────── */}
        {step === 'role' && (
          <Card className="p-6">
            <p className="text-sm font-extrabold text-cocoa-400 mb-4">
              {seeding ? '正在准备学习数据…' : '你是谁呀？选一个进入吧'}
            </p>
            <div className="space-y-3.5">
              <RoleCard
                emoji="🧑‍🎓"
                title="我是孩子"
                desc="点头像或写名字，就能进去学习"
                disabled={seeding}
                onClick={() => {
                  setError(null);
                  setStep('student');
                }}
              />
              <RoleCard
                emoji="👨‍👩‍👧"
                title="我是家长"
                desc="看看孩子学得怎么样（只读）"
                disabled={seeding}
                onClick={() => {
                  setError(null);
                  setStep('parent');
                }}
              />
              <RoleCard
                emoji="👩‍🏫"
                title="我是老师"
                desc="布置作业、批改写作、管理绑定"
                disabled={seeding}
                onClick={() => {
                  setError(null);
                  setStep('tutor');
                }}
              />
            </div>
          </Card>
        )}

        {/* ───────── 学生流程 ───────── */}
        {step === 'student' && (
          <Card className="p-6 space-y-6">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setStep('role');
                  setError(null);
                }}
                className="w-11 h-11 flex items-center justify-center rounded-2xl hover:bg-sakura-100 text-cocoa-500"
                aria-label="返回"
              >
                <Icon name="arrowLeft" size={22} />
              </button>
              <p className="text-lg font-extrabold text-cocoa-700">写下你的名字</p>
            </div>

            <div className="flex gap-3">
              <input
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') loginByName();
                }}
                placeholder="比如：甜甜"
                className="flex-1 min-w-0 rounded-2xl border-2 border-sakura-200 bg-white px-5 py-3.5 text-lg font-semibold text-cocoa-700 placeholder:text-cocoa-300 outline-none focus:border-sakura-400"
                style={{ fontSize: 18 }}
                aria-label="你的名字"
              />
              <Button tone="candy" size="md" disabled={seeding} onClick={loginByName}>
                进入
              </Button>
            </div>

            <div className="flex items-center gap-3">
              <span className="flex-1 h-0.5 rounded-full bg-sakura-100" />
              <span className="text-xs font-extrabold text-cocoa-400">或者点你的头像</span>
              <span className="flex-1 h-0.5 rounded-full bg-sakura-100" />
            </div>

            <div className="grid grid-cols-3 gap-3">
              {students.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  disabled={seeding}
                  onClick={() => pickStudent(s)}
                  className="flex flex-col items-center gap-2 rounded-3xl border-2 border-sakura-100 bg-white px-3 py-4 transition-all hover:border-sakura-300 hover:bg-sakura-50 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50"
                >
                  <span className="text-4xl select-none">{s.avatar}</span>
                  <span className="text-sm font-extrabold text-cocoa-600">{s.nickname}</span>
                </button>
              ))}
            </div>
          </Card>
        )}

        {/* ───────── 家长 / 老师流程 ───────── */}
        {(step === 'parent' || step === 'tutor') && (
          <Card className="p-6 space-y-5">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setStep('role');
                  setError(null);
                  setAccount('');
                  setPassword('');
                }}
                className="w-11 h-11 flex items-center justify-center rounded-2xl hover:bg-sakura-100 text-cocoa-500"
                aria-label="返回"
              >
                <Icon name="arrowLeft" size={22} />
              </button>
              <p className="text-lg font-extrabold text-cocoa-700">
                {step === 'parent' ? '👨‍👩‍👧 家长登录' : '👩‍🏫 老师登录'}
              </p>
            </div>

            <div>
              <label className="block text-sm font-extrabold text-cocoa-500 mb-2">账号</label>
              <input
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                placeholder={step === 'parent' ? 'mama' : 'teacher'}
                autoCapitalize="off"
                className="w-full rounded-2xl border-2 border-sakura-200 bg-white px-5 py-3.5 text-lg font-semibold text-cocoa-700 placeholder:text-cocoa-300 outline-none focus:border-sakura-400"
                style={{ fontSize: 18 }}
              />
            </div>

            <div>
              <label className="block text-sm font-extrabold text-cocoa-500 mb-2">密码</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleGuardianLogin(step);
                }}
                placeholder="••••"
                className="w-full rounded-2xl border-2 border-sakura-200 bg-white px-5 py-3.5 text-lg font-semibold text-cocoa-700 placeholder:text-cocoa-300 outline-none focus:border-sakura-400"
                style={{ fontSize: 18 }}
              />
            </div>

            <Button
              tone={step === 'parent' ? 'candy' : 'grape'}
              size="md"
              block
              disabled={busy || seeding}
              onClick={() => void handleGuardianLogin(step)}
            >
              {busy ? '登录中…' : '登录'}
            </Button>

            <p className="text-xs text-cocoa-400 font-semibold text-center leading-relaxed">
              演示账号：{step === 'parent' ? 'mama' : 'teacher'} / 1234
              <br />
              数据保存在你自己的浏览器里，不会上传到任何服务器
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}

/* ───────────────────────── 角色选择卡 ───────────────────────── */

function RoleCard({
  emoji,
  title,
  desc,
  disabled,
  onClick,
}: {
  emoji: string;
  title: string;
  desc: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="w-full flex items-center gap-4 rounded-3xl border-2 border-sakura-100 bg-white px-5 py-5 text-left transition-all hover:border-sakura-300 hover:bg-sakura-50 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 min-h-[84px]"
    >
      <span className="text-4xl select-none">{emoji}</span>
      <span className="flex-1 leading-tight">
        <span className="block text-lg font-extrabold text-cocoa-700">{title}</span>
        <span className="block text-sm text-cocoa-400 font-semibold mt-1">{desc}</span>
      </span>
      <Icon name="arrowRight" size={22} className="text-sakura-300" />
    </button>
  );
}

export default LoginPage;
