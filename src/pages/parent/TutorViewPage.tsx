/**
 * 辅导视图（老师专用）—— 管理 + 批改。
 *
 * 四个能力：
 *   1. 账号绑定管理：查看当前绑定的孩子，绑定新孩子 / 解绑
 *   2. 布置作业：选单个孩子 → 选作业模板 → 派发（只出现在那个孩子的列表）
 *   3. 批改写作：查看孩子提交的短句 → 打分 → 写评语（孩子能看到）
 *   4. 错题汇总：跟随顶部下拉切换，查看当前孩子的待复习错题
 *
 * 修复的漏洞（旧版）：靠 viewMode 切换才能看到本页；新版由
 * AuthGuard(tutor) 强制分发，老师登录直达。
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Assignment, Homework, LearningUnit, Student, Submission, WrongRecord } from '@/types';
import { Button, Card, Chip, EmptyState, SectionTitle } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { useRepositories } from '@/repositories/RepositoriesProvider';
import { useAuth } from '@/app/AuthProvider';
import { QuestionImportCard } from './QuestionImportCard';

interface PendingGrade {
  student: Student;
  assignment: Assignment;
  submission: Submission;
}

type TabKey = 'assign' | 'grade' | 'children' | 'wrong' | 'import';

export function TutorViewPage() {
  const repos = useRepositories();
  const { guardian, children, currentStudentId, refreshChildren } = useAuth();

  const [tab, setTab] = useState<TabKey>('assign');
  const [homeworks, setHomeworks] = useState<Homework[]>([]);
  const [assignTarget, setAssignTarget] = useState<string>('');
  const [assignHw, setAssignHw] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [pending, setPending] = useState<PendingGrade[]>([]);
  const [loadingPending, setLoadingPending] = useState(true);
  const [draftScores, setDraftScores] = useState<Record<string, string>>({});
  const [draftComments, setDraftComments] = useState<Record<string, string>>({});

  /* 绑定管理：全部学生 + 当前账号绑定的 */
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [bindingBusy, setBindingBusy] = useState<string | null>(null);

  /* 错题汇总：跟随顶部下拉的孩子 */
  const [wrongList, setWrongList] = useState<WrongRecord[] | null>(null);

  const say = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3000);
  }, []);

  /* ── 载入作业模板 + 全部学生 ── */
  useEffect(() => {
    void (async () => {
      const [list, students] = await Promise.all([
        repos.homework.list(),
        repos.student.list(),
      ]);
      setHomeworks(list);
      setAllStudents(students);
      if (list[0]) setAssignHw(list[0].id);
    })();
  }, [repos]);

  useEffect(() => {
    if (children[0] && !assignTarget) setAssignTarget(children[0].id);
  }, [children, assignTarget]);

  /* ── 载入待批改提交（所有绑定孩子） ── */
  const loadPending = useCallback(async () => {
    if (children.length === 0) {
      setPending([]);
      setLoadingPending(false);
      return;
    }
    setLoadingPending(true);
    const out: PendingGrade[] = [];
    for (const s of children) {
      const assignments = await repos.assignment.listByStudent(s.id);
      for (const a of assignments) {
        const sub = await repos.submission.listByAssignment(s.id, a.id);
        if (sub && sub.teacherScore == null) {
          out.push({ student: s, assignment: a, submission: sub });
        }
      }
    }
    setPending(out);
    setLoadingPending(false);
  }, [repos, children]);

  useEffect(() => {
    void loadPending();
  }, [loadPending]);

  /* ── 错题汇总：跟随 currentStudentId ── */
  useEffect(() => {
    if (!currentStudentId) return;
    let alive = true;
    setWrongList(null);
    void (async () => {
      const list = await repos.wrongBook.listActive(currentStudentId);
      if (alive) setWrongList(list);
    })();
    return () => {
      alive = false;
    };
  }, [repos, currentStudentId]);

  const targetStudent = useMemo(
    () => children.find((c) => c.id === assignTarget) ?? null,
    [children, assignTarget],
  );

  const boundIds = useMemo(() => new Set(children.map((c) => c.id)), [children]);
  const unboundStudents = allStudents.filter((s) => !boundIds.has(s.id));

  /* ── 绑定 / 解绑 ── */
  async function bindStudent(s: Student) {
    if (!guardian) return;
    setBindingBusy(s.id);
    try {
      await repos.student.update(s.id, { parentId: guardian.id });
      await refreshChildren();
      say(`已绑定 ${s.nickname}，现在可以给他/她布置作业了`);
    } finally {
      setBindingBusy(null);
    }
  }

  async function unbindStudent(s: Student) {
    setBindingBusy(s.id);
    try {
      await repos.student.update(s.id, { parentId: '' });
      await refreshChildren();
      say(`已解绑 ${s.nickname}（他/她仍可用自己的账号登录学习）`);
    } finally {
      setBindingBusy(null);
    }
  }

  /* ── 布置作业 ── */
  async function doAssign() {
    if (!assignTarget || !assignHw || !guardian) return;
    const hw = homeworks.find((h) => h.id === assignHw);
    if (!hw) return;
    setBusy(true);
    try {
      await repos.assignment.assign(assignTarget, hw, guardian.id);
      say(`已给 ${targetStudent?.nickname ?? ''} 布置「${hw.title}」`);
      await loadPending();
    } finally {
      setBusy(false);
    }
  }

  /* ── 批改 ── */
  async function doGrade(p: PendingGrade) {
    const scoreRaw = draftScores[p.submission.id];
    const comment = draftComments[p.submission.id] ?? '';
    const score = Number(scoreRaw);
    if (!Number.isFinite(score) || score < 0 || score > 100) {
      say('请先填 0~100 的分数');
      return;
    }
    setBusy(true);
    try {
      await repos.submission.grade(
        p.student.id,
        p.submission.id,
        score,
        comment,
        guardian?.id ?? '',
      );
      await repos.assignment.updateForStudent(p.student.id, p.assignment.id, {
        status: 'graded',
      });
      await repos.reward.addStars(p.student.id, 2);
      say(`已批改 ${p.student.nickname} 的作业，奖励 2 颗星星`);
      await loadPending();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <SectionTitle
        icon="clipboard"
        title="辅导中心"
        extra={
          <Chip tone="sun" size="sm">
            {guardian?.role === 'tutor' ? '辅导老师' : '老师'}
          </Chip>
        }
      />

      {toast && (
        <div className="flex items-center gap-2.5 rounded-2xl bg-emerald-50 border-2 border-emerald-100 px-4 py-3 text-sm text-emerald-700 font-bold animate-grow-up">
          <Icon name="check" size={18} />
          {toast}
        </div>
      )}

      {/* 标签页 */}
      <div className="flex items-center gap-1.5 rounded-2xl bg-slate-100 p-1.5 overflow-x-auto">
        {(
          [
            { k: 'assign', label: '布置作业', icon: 'plus' },
            { k: 'grade', label: `批改${pending.length ? ` (${pending.length})` : ''}`, icon: 'pencil' },
            { k: 'children', label: '账号绑定', icon: 'users' },
            { k: 'wrong', label: '错题汇总', icon: 'shield' },
            { k: 'import', label: '题库导入', icon: 'cards' },
          ] as const
        ).map((t) => (
          <button
            key={t.k}
            type="button"
            onClick={() => setTab(t.k)}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl px-2 py-3 text-xs sm:text-sm font-extrabold transition-all min-h-[48px] whitespace-nowrap ${
              tab === t.k ? 'bg-white text-violet-600 shadow-sm' : 'text-cocoa-500'
            }`}
          >
            <Icon name={t.icon} size={17} />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── 布置作业 ── */}
      {tab === 'assign' && (
        <div className="space-y-5">
          <Card className="p-5 sm:p-6 space-y-5">
            <div>
              <p className="text-sm font-extrabold text-cocoa-500 mb-3">1. 选一个孩子</p>
              {children.length === 0 ? (
                <EmptyState
                  emoji="🤝"
                  title="还没有绑定的孩子"
                  desc="先去「账号绑定」把要辅导的孩子绑到你的账号下。"
                />
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {children.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setAssignTarget(c.id)}
                      className={`flex items-center gap-3 rounded-2xl border-2 px-4 py-3.5 transition-all min-h-[62px] ${
                        assignTarget === c.id
                          ? 'border-violet-300 bg-violet-50'
                          : 'border-slate-100 bg-white hover:border-slate-200'
                      }`}
                    >
                      <span className="text-2xl select-none">{c.avatar}</span>
                      <span className="text-sm font-extrabold text-cocoa-600 truncate">
                        {c.nickname}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className="text-sm font-extrabold text-cocoa-500 mb-3">2. 选一份作业</p>
              <div className="space-y-3">
                {homeworks.map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => setAssignHw(h.id)}
                    className={`w-full flex items-center gap-4 rounded-2xl border-2 px-5 py-4 text-left transition-all min-h-[72px] ${
                      assignHw === h.id
                        ? 'border-violet-300 bg-violet-50'
                        : 'border-slate-100 bg-white hover:border-slate-200'
                    }`}
                  >
                    <span className="text-2xl select-none">
                      {h.type === 'writing' ? '✍️' : h.type === 'listening' ? '🎧' : '📖'}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-base font-extrabold text-cocoa-600">
                        {h.title}
                      </span>
                      <span className="block text-xs font-semibold text-cocoa-400 mt-0.5">
                        {h.type === 'writing'
                          ? `${h.prompts?.length ?? 0} 个句子`
                          : `${h.questionIds?.length ?? 0} 道题`}{' '}
                        · 约 {h.estimatedMinutes} 分钟 · {h.dueInDays} 天内完成
                      </span>
                    </span>
                    {assignHw === h.id && (
                      <Icon name="check" size={20} className="text-violet-500" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <Button
              tone="grape"
              size="lg"
              block
              icon="upload"
              disabled={busy || !assignTarget || !assignHw}
              onClick={() => void doAssign()}
            >
              {busy ? '布置中…' : `布置给 ${targetStudent?.nickname ?? '（先选孩子）'}`}
            </Button>

            <p className="text-xs font-bold text-cocoa-400 leading-relaxed">
              <Icon name="info" size={13} className="inline mr-1 -mt-0.5" />
              作业只会出现在你选中的那个孩子的列表里，其他孩子看不到。
            </p>
          </Card>
        </div>
      )}

      {/* ── 批改写作 ── */}
      {tab === 'grade' && (
        <div className="space-y-5">
          {loadingPending ? (
            <div className="space-y-4">
              {[0, 1].map((i) => (
                <div key={i} className="h-52 rounded-3xl bg-white animate-pulse" />
              ))}
            </div>
          ) : pending.length === 0 ? (
            <Card>
              <EmptyState
                emoji="📭"
                title="暂时没有要批改的"
                desc="孩子提交写作后，会出现在这里等你打分。"
              />
            </Card>
          ) : (
            pending.map((p) => (
              <Card key={p.submission.id} className="p-5 sm:p-6">
                <div className="flex items-center gap-3.5 mb-4">
                  <span className="text-3xl select-none">{p.student.avatar}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-extrabold text-cocoa-700">{p.student.nickname}</p>
                    <p className="text-xs font-semibold text-cocoa-400 mt-0.5">
                      {p.assignment.homeworkTitle} · 提交于{' '}
                      {new Date(p.submission.createdAt).toLocaleString('zh-CN', {
                        month: 'numeric',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <Chip tone="sun" size="sm">
                    等批改
                  </Chip>
                </div>

                {/* 孩子的作答内容 */}
                <div className="rounded-2xl bg-slate-50 border-2 border-slate-100 p-4 mb-5">
                  <p className="text-xs font-bold text-cocoa-400 mb-2">孩子的答案</p>
                  <pre className="text-sm text-cocoa-600 font-semibold leading-relaxed whitespace-pre-wrap break-words font-sans">
                    {p.submission.content}
                  </pre>
                </div>

                {/* 打分与评语 */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-extrabold text-cocoa-500 mb-2">
                      打分（0-100）
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      inputMode="numeric"
                      value={draftScores[p.submission.id] ?? ''}
                      onChange={(e) =>
                        setDraftScores((prev) => ({
                          ...prev,
                          [p.submission.id]: e.target.value,
                        }))
                      }
                      placeholder="比如 85"
                      className="w-full rounded-2xl border-2 border-slate-200 bg-white px-5 py-3.5 text-base font-semibold text-cocoa-600 placeholder:text-cocoa-300 outline-none focus:border-violet-400 min-h-[58px]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-extrabold text-cocoa-500 mb-2">
                      评语（孩子能看到）
                    </label>
                    <textarea
                      rows={3}
                      value={draftComments[p.submission.id] ?? ''}
                      onChange={(e) =>
                        setDraftComments((prev) => ({
                          ...prev,
                          [p.submission.id]: e.target.value,
                        }))
                      }
                      placeholder="写点鼓励的话，比如：句子写得很完整，注意 apple 前面要用 an 哦～"
                      className="w-full rounded-2xl border-2 border-slate-200 bg-white px-5 py-4 text-base font-semibold text-cocoa-600 placeholder:text-cocoa-300 outline-none focus:border-violet-400 resize-none leading-relaxed"
                    />
                  </div>
                  <Button
                    tone="grape"
                    size="md"
                    block
                    icon="check"
                    disabled={busy}
                    onClick={() => void doGrade(p)}
                  >
                    {busy ? '提交中…' : '提交批改'}
                  </Button>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* ── 账号绑定管理 ── */}
      {tab === 'children' && (
        <div className="space-y-5">
          <Card className="p-5 sm:p-6">
            <p className="text-sm font-extrabold text-cocoa-500 mb-4">
              {guardian?.name} 绑定的孩子（{children.length} 个）
            </p>
            <div className="space-y-3">
              {children.length === 0 && (
                <EmptyState emoji="🤝" title="还没有绑定任何孩子" desc="从下面的列表里绑定要辅导的孩子。" />
              )}
              {children.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-4 rounded-2xl bg-slate-50 px-4 py-4"
                >
                  <span className="text-3xl select-none">{c.avatar}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-extrabold text-cocoa-600">{c.name}</p>
                    <p className="text-xs font-semibold text-cocoa-400 mt-0.5">
                      {c.nickname} · {c.grade} 年级 · {c.className ?? '未分班'}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={bindingBusy === c.id}
                    onClick={() => void unbindStudent(c)}
                    className="rounded-2xl border-2 border-rose-200 bg-rose-50 text-rose-600 px-4 py-2.5 text-sm font-extrabold hover:bg-rose-100 transition-colors min-h-[44px] disabled:opacity-50"
                  >
                    {bindingBusy === c.id ? '…' : '解绑'}
                  </button>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5 sm:p-6">
            <p className="text-sm font-extrabold text-cocoa-500 mb-4">
              可绑定的孩子（{unboundStudents.length} 个）
            </p>
            <div className="space-y-3">
              {unboundStudents.length === 0 ? (
                <p className="text-sm font-semibold text-cocoa-400 py-4 text-center">
                  所有孩子都已绑定账号啦
                </p>
              ) : (
                unboundStudents.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-4 rounded-2xl bg-white border-2 border-slate-100 px-4 py-4"
                  >
                    <span className="text-3xl select-none">{c.avatar}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-extrabold text-cocoa-600">{c.name}</p>
                      <p className="text-xs font-semibold text-cocoa-400 mt-0.5">
                        {c.nickname} · {c.grade} 年级 · {c.className ?? '未分班'}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={bindingBusy === c.id}
                      onClick={() => void bindStudent(c)}
                      className="rounded-2xl bg-violet-500 text-white px-4 py-2.5 text-sm font-extrabold hover:bg-violet-600 transition-colors min-h-[44px] disabled:opacity-50"
                    >
                      {bindingBusy === c.id ? '…' : '绑定'}
                    </button>
                  </div>
                ))
              )}
            </div>
            <p className="mt-5 text-xs font-bold text-cocoa-400 leading-relaxed">
              <Icon name="info" size={13} className="inline mr-1 -mt-0.5" />
              每个孩子的学习数据按 id 物理隔离存放，互不可见。解绑不影响孩子自己登录学习，
              只是这个账号不再能给他/她布置作业、看数据。
            </p>
          </Card>
        </div>
      )}

      {/* ── 题库批量导入 ── */}
      {tab === 'import' && <QuestionImportCard onImported={say} />}

      {/* ── 错题汇总 ── */}
      {tab === 'wrong' && (
        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex items-center gap-3">
              <Icon name="shield" size={22} className="text-violet-500" />
              <p className="text-sm font-bold text-cocoa-500 flex-1">
                用顶部的孩子切换器选择要查看的孩子
              </p>
              <Chip tone="grape" size="sm">
                {wrongList?.length ?? 0} 道
              </Chip>
            </div>
          </Card>

          {wrongList === null ? (
            <div className="space-y-3">
              {[0, 1].map((i) => (
                <div key={i} className="h-24 rounded-3xl bg-white animate-pulse" />
              ))}
            </div>
          ) : wrongList.length === 0 ? (
            <Card>
              <EmptyState emoji="🎉" title="这个孩子没有待复习的错题" desc="答错的题会自动收进错题本。" />
            </Card>
          ) : (
            wrongList.map((r) => (
              <Card key={r.id} className="p-5">
                <div className="flex items-start gap-3.5">
                  <span className="text-2xl leading-none select-none shrink-0 mt-0.5">
                    {r.snapshot.emoji ?? '❓'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-extrabold text-cocoa-600 leading-relaxed">
                      {r.snapshot.question}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-2.5">
                      <Chip tone="rose" size="sm">
                        错过 {r.wrongCount} 次
                      </Chip>
                      <Chip tone="slate" size="sm">
                        连对 {r.correctStreak}/2
                      </Chip>
                    </div>
                    <p className="mt-3 text-sm text-cocoa-500 font-semibold leading-relaxed">
                      正确答案：
                      <span className="text-emerald-600">{r.snapshot.correctAnswer}</span>
                    </p>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default TutorViewPage;
