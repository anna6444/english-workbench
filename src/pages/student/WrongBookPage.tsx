/**
 * 错题本 —— 把「错」变成「学」。
 *
 * 掌握规则（与仓储层一致）：
 *   连续答对 2 次 → 自动标记「已掌握」并移出待复习列表
 *   答错 → 连续计数清零（已掌握的会退回待复习）
 *
 * 复习界面复用 QuizRunner，但每次只喂一道题，
 * 用「快照」而不是题库原题 —— 题库被家长改了也不影响孩子复习。
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Question, WrongRecord } from '@/types';
import { Button, Card, Chip, EmptyState, ProgressBar, SectionTitle, StatCard } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { QuizRunner } from '@/components/QuizRunner';
import { useRepositories } from '@/repositories/RepositoriesProvider';
import { useSession } from '@/app/AuthProvider';
import { MASTERY_STREAK_THRESHOLD } from '@/types';

/** 把错题快照还原成一道可作答的 Question */
function recordToQuestion(r: WrongRecord): Question {
  return {
    id: r.questionId,
    type: r.snapshot.type,
    question: r.snapshot.question,
    options: r.snapshot.options,
    correctAnswer: r.snapshot.correctAnswer,
    explanation: r.snapshot.explanation,
    audioText: r.snapshot.audioText,
    passage: r.snapshot.passage,
    image: r.snapshot.emoji ? { emoji: r.snapshot.emoji, labelZh: '看图' } : undefined,
    points: 5,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

export function WrongBookPage() {
  const repos = useRepositories();
  const sid = useSession().currentStudentId;

  const [active, setActive] = useState<WrongRecord[]>([]);
  const [mastered, setMastered] = useState<WrongRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState<WrongRecord | null>(null);

  const reload = useCallback(
    async (studentId: string) => {
      const [a, m] = await Promise.all([
        repos.wrongBook.listActive(studentId),
        repos.wrongBook.listMastered(studentId),
      ]);
      return { a, m };
    },
    [repos],
  );

  useEffect(() => {
    if (!sid) return;
    let alive = true;
    void (async () => {
      const { a, m } = await reload(sid);
      if (!alive) return;
      setActive(a.sort((x, y) => y.lastWrongAt - x.lastWrongAt));
      setMastered(m.sort((x, y) => (y.lastPracticedAt ?? 0) - (x.lastPracticedAt ?? 0)));
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [sid, reload]);

  /** 复习完一道题后刷新列表 */
  async function afterReview() {
    if (!sid) return;
    const { a, m } = await reload(sid);
    setActive(a.sort((x, y) => y.lastWrongAt - x.lastWrongAt));
    setMastered(m.sort((x, y) => (y.lastPracticedAt ?? 0) - (x.lastPracticedAt ?? 0)));
    setReviewing(null);
  }

  const total = active.length + mastered.length;
  const percent = total > 0 ? Math.round((mastered.length / total) * 100) : 0;

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-32 rounded-3xl bg-white animate-pulse" />
        <div className="h-60 rounded-3xl bg-white animate-pulse" />
      </div>
    );
  }

  /* ── 复习中 ── */
  if (reviewing && sid) {
    return (
      <div className="space-y-5">
        <Card className="p-5">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setReviewing(null)}
              className="w-11 h-11 flex items-center justify-center rounded-2xl hover:bg-slate-100 text-slate-500 shrink-0"
              aria-label="退出复习"
            >
              <Icon name="arrowLeft" size={22} />
            </button>
            <span className="text-3xl leading-none select-none">🧹</span>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-extrabold text-slate-800">复习错题</h1>
              <p className="text-sm font-semibold text-slate-400">
                再连对 {Math.max(0, MASTERY_STREAK_THRESHOLD - reviewing.correctStreak)} 次就掌握啦
              </p>
            </div>
          </div>
        </Card>

        <QuizRunner
          questions={[recordToQuestion(reviewing)]}
          studentId={sid}
          title="错题复习"
          showProgress={false}
          onFinished={() => void afterReview()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionTitle icon="shield" title="错题本" />

      <section className="grid grid-cols-3 gap-3.5">
        <StatCard label="待复习" value={active.length} unit="道" emoji="📌" tone="candy" />
        <StatCard label="已掌握" value={mastered.length} unit="道" emoji="✅" tone="grass" />
        <StatCard label="消灭进度" value={`${percent}`} unit="%" emoji="🧹" tone="sun" />
      </section>

      {total > 0 && (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-sm font-bold text-slate-500">错题消灭进度</span>
            <span className="text-sm font-extrabold text-emerald-600">{percent}%</span>
          </div>
          <ProgressBar percent={percent} tone="grass" />
          <p className="mt-3 text-xs font-bold text-slate-400">
            连续答对 {MASTERY_STREAK_THRESHOLD} 次，这道题就算掌握啦
          </p>
        </Card>
      )}

      {/* 待复习 */}
      <section>
        <SectionTitle icon="lightning" title="要复习的题" />
        {active.length === 0 ? (
          <Card>
            <EmptyState
              emoji="🎉"
              title="太棒了，没有待复习的错题"
              desc="继续去学新东西吧，答错的题会自动出现在这里。"
            />
          </Card>
        ) : (
          <div className="space-y-3">
            {active.map((r) => (
              <WrongRow
                key={r.id}
                record={r}
                onReview={() => setReviewing(r)}
              />
            ))}
          </div>
        )}
      </section>

      {/* 已掌握 */}
      {mastered.length > 0 && (
        <section>
          <SectionTitle icon="check" title="已经掌握的" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {mastered.map((r) => (
              <Card key={r.id} className="p-4">
                <div className="flex items-start gap-3">
                  <span className="text-2xl leading-none select-none shrink-0 mt-0.5">✅</span>
                  <p className="flex-1 text-sm font-bold text-slate-500 leading-relaxed line-clamp-2">
                    {r.snapshot.question}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function WrongRow({
  record,
  onReview,
}: {
  record: WrongRecord;
  onReview: () => void;
}) {
  const remain = Math.max(0, MASTERY_STREAK_THRESHOLD - record.correctStreak);

  return (
    <Card className="p-5">
      <div className="flex items-start gap-4">
        <span className="text-3xl leading-none select-none shrink-0 mt-0.5">
          {record.snapshot.emoji ?? '❓'}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-base font-extrabold text-slate-800 leading-relaxed">
            {record.snapshot.question}
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-2.5">
            <Chip tone="rose" size="sm">
              错过 {record.wrongCount} 次
            </Chip>
            {record.correctStreak > 0 && (
              <Chip tone="sun" size="sm">
                已连对 {record.correctStreak} 次
              </Chip>
            )}
          </div>
          <div className="mt-3.5 space-y-1.5">
            <p className="text-xs font-bold text-slate-400">再连对 {remain} 次就掌握</p>
            <ProgressBar
              percent={(record.correctStreak / MASTERY_STREAK_THRESHOLD) * 100}
              tone="grass"
              height={8}
            />
          </div>
          <div className="mt-4">
            <Button tone="candy" size="sm" icon="refresh" onClick={onReview}>
              再做一次
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

export default WrongBookPage;
