/**
 * 家长视图 —— 只读仪表盘。
 *
 * 修复的漏洞（旧版）：
 *   1. 旧版挂在学生 AppShell 里靠 viewMode 切换，家长登录后根本看不到这页；
 *   2. 切换孩子时偶尔显示「无数据」空态（数据未按 currentStudentId 联动）。
 *
 * 新版：
 *   - 独立 ParentShell + AuthGuard(parent) 强制分发，家长登录直达；
 *   - 顶部 StudentSwitcher 下拉切换孩子 → currentStudentId 变化 →
 *     本页所有 useEffect 重新拉取，进度/错题/成绩/星星/图表整体联动；
 *   - 严格只读：没有任何布置作业 / 批改入口，页脚明确提示联系老师。
 */

import { useEffect, useState } from 'react';
import type {
  ExamRecord,
  LearningUnit,
  ProgressState,
  RewardState,
  VocabularyWord,
  WrongRecord,
} from '@/types';
import {
  Card,
  Chip,
  EmptyState,
  ProgressBar,
  SectionTitle,
  StatCard,
  StarCount,
} from '@/components/ui';
import { Icon } from '@/components/Icon';
import { useRepositories } from '@/repositories/RepositoriesProvider';
import { useAuth } from '@/app/AuthProvider';
import { weekKeyOf } from '@/repositories/local/RewardRepository';
import { ParentToolbox } from './ParentToolbox';

interface ChildReport {
  studentId: string;
  progress: ProgressState;
  reward: RewardState;
  words: VocabularyWord[];
  wrongActive: WrongRecord[];
  wrongMastered: number;
  exams: ExamRecord[];
  units: LearningUnit[];
  weeklyStars: number;
  /** 最近 6 周星星趋势（含本周） */
  weeklyTrend: { week: string; stars: number }[];
}

/** 算最近 n 周（含本周）的 ISO 周 key，旧 → 新 */
function recentWeekKeys(n: number): string[] {
  const out: string[] = [];
  const now = Date.now();
  for (let i = n - 1; i >= 0; i--) {
    out.push(weekKeyOf(now - i * 7 * 86_400_000));
  }
  return out;
}

export function ParentViewPage() {
  const repos = useRepositories();
  const { currentStudentId, currentStudent } = useAuth();
  const [report, setReport] = useState<ChildReport | null>(null);
  const [loading, setLoading] = useState(true);
  /** 工具箱操作（调星星/改商城/改设置）后递增 → 触发 effect 重新拉取 */
  const [reportNonce, setReportNonce] = useState(0);

  const reloadReport = () => setReportNonce((n) => n + 1);

  useEffect(() => {
    if (!currentStudentId) return;
    let alive = true;
    setLoading(true);
    void (async () => {
      const [progress, reward, words, wrongActive, wrongMastered, exams, units, weeklyStars] =
        await Promise.all([
          repos.progress.get(currentStudentId),
          repos.reward.get(currentStudentId),
          repos.vocabulary.listByStudent(currentStudentId),
          repos.wrongBook.listActive(currentStudentId),
          repos.wrongBook.countMastered(currentStudentId),
          repos.examRecord.listRecent(currentStudentId, 10),
          repos.unit.listOrdered(),
          repos.reward.weeklyStars(currentStudentId, weekKeyOf()),
        ]);
      if (!alive) return;

      const weeks = recentWeekKeys(6);
      const trend = weeks.map((week) => ({
        week,
        stars: reward.weeklyStars[week] ?? 0,
      }));

      setReport({
        studentId: currentStudentId,
        progress,
        reward,
        words,
        wrongActive,
        wrongMastered,
        exams,
        units,
        weeklyStars,
        weeklyTrend: trend,
      });
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [repos, currentStudentId, reportNonce]);

  if (loading || !report || !currentStudent) {
    return (
      <div className="space-y-5">
        <div className="h-32 rounded-3xl bg-white animate-pulse" />
        <div className="h-64 rounded-3xl bg-white animate-pulse" />
      </div>
    );
  }

  const masteredWords = report.words.filter((w) => w.isMastered).length;
  const avgExam = report.exams.length
    ? Math.round(
        report.exams.reduce(
          (s, e) => s + (e.totalScore ? (e.score / e.totalScore) * 100 : 0),
          0,
        ) / report.exams.length,
      )
    : null;

  return (
    <div className="space-y-6">
      {/* 孩子概览 */}
      <Card className="p-6">
        <div className="flex items-center gap-4">
          <span className="text-5xl select-none">{currentStudent.avatar}</span>
          <div className="flex-1 min-w-0">
            <p className="text-xl font-extrabold text-cocoa-700">
              {currentStudent.name}
              <span className="text-sm font-bold text-cocoa-400 ml-2">
                ({currentStudent.nickname})
              </span>
            </p>
            <p className="text-sm font-semibold text-cocoa-400 mt-1">
              {currentStudent.grade} 年级 · {currentStudent.className ?? '未分班'} · 目标{' '}
              {currentStudent.dailyGoalMinutes} 分钟/天
            </p>
          </div>
          <StarCount value={report.reward.stars} size={26} />
        </div>
        <p className="mt-4 text-xs font-bold text-cocoa-400">
          <Icon name="info" size={14} className="inline mr-1 -mt-0.5" />
          切换孩子后，下面的进度、错题、成绩、星星会整体切换 —— 数据按孩子隔离，绝不混显
        </p>
      </Card>

      {/* 核心指标 */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <StatCard
          label="累计学习"
          value={report.progress.totalMinutes}
          unit="分钟"
          emoji="⏱️"
          tone="sky"
        />
        <StatCard
          label="连续打卡"
          value={report.progress.streakDays}
          unit="天"
          emoji="🔥"
          tone="sun"
        />
        <StatCard label="单词量" value={report.words.length} unit="个" emoji="📚" tone="grape" />
        <StatCard
          label="待复习错题"
          value={report.wrongActive.length}
          unit="道"
          emoji="📌"
          tone="candy"
        />
      </section>

      {/* 周报 */}
      <section>
        <SectionTitle
          icon="chart"
          title="本周周报"
          extra={
            <Chip tone="sky" size="sm">
              只读
            </Chip>
          }
        />
        <Card className="p-5 sm:p-6 space-y-5">
          <div className="flex items-center justify-between">
            <span className="text-base font-bold text-cocoa-600">本周获得星星</span>
            <StarCount value={report.weeklyStars} size={22} />
          </div>
          <div className="grid grid-cols-2 gap-3.5">
            <div className="rounded-2xl bg-emerald-50 border-2 border-emerald-100 p-4">
              <p className="text-xs font-bold text-cocoa-500 mb-1">已掌握单词</p>
              <p className="text-2xl font-extrabold text-emerald-600">{masteredWords} 个</p>
            </div>
            <div className="rounded-2xl bg-sky-50 border-2 border-sky-100 p-4">
              <p className="text-xs font-bold text-cocoa-500 mb-1">错题消灭</p>
              <p className="text-2xl font-extrabold text-sky-600">{report.wrongMastered} 道</p>
            </div>
          </div>
          {avgExam !== null && (
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-sm font-bold text-cocoa-600">平均测验正确率</span>
                <span className="text-sm font-extrabold text-violet-600">{avgExam}%</span>
              </div>
              <ProgressBar percent={avgExam} tone="grape" />
            </div>
          )}
        </Card>
      </section>

      {/* 每周星星趋势（内联 SVG 折线图） */}
      <section>
        <SectionTitle icon="star" title="星星趋势（近 6 周）" />
        <Card className="p-5 sm:p-6">
          <WeeklyStarsChart data={report.weeklyTrend} />
        </Card>
      </section>

      {/* 单元进度 */}
      <section>
        <SectionTitle icon="book" title="单元学习进度" />
        <Card className="p-5 sm:p-6 space-y-6">
          {report.units.map((u) => {
            const up = report.progress.units[u.id];
            const learned = up?.learnedWords.length ?? 0;
            const percent = up?.percent ?? 0;
            return (
              <div key={u.id}>
                <div className="flex items-center gap-3 mb-2.5">
                  <span className="text-2xl select-none">{u.coverEmoji}</span>
                  <span className="flex-1 text-base font-extrabold text-cocoa-600 truncate">
                    {u.titleZh}
                  </span>
                  <span className="text-sm font-extrabold text-cocoa-500">{percent}%</span>
                </div>
                <ProgressBar percent={percent} tone={percent >= 100 ? 'grass' : 'sky'} />
                <p className="mt-1.5 text-xs font-bold text-cocoa-400">
                  已学 {learned} / {u.coreWords.length} 个词
                </p>
              </div>
            );
          })}
        </Card>
      </section>

      {/* 测验成绩 */}
      <section>
        <SectionTitle icon="target" title="测验成绩" />
        {report.exams.length === 0 ? (
          <Card>
            <EmptyState emoji="📄" title="还没有测验记录" desc="完成小测后成绩会显示在这里。" />
          </Card>
        ) : (
          <Card className="p-5">
            <div className="space-y-3">
              {report.exams.map((e) => {
                const percent = e.totalScore ? Math.round((e.score / e.totalScore) * 100) : 0;
                return (
                  <div
                    key={e.id}
                    className="flex items-center gap-4 rounded-2xl bg-slate-50 px-4 py-3.5"
                  >
                    <span className="text-2xl select-none">
                      {percent >= 80 ? '🏆' : percent >= 60 ? '💪' : '🌱'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-extrabold text-cocoa-600 truncate">
                        {e.paperTitle}
                      </p>
                      <p className="text-xs font-semibold text-cocoa-400 mt-0.5">
                        {new Date(e.finishedAt).toLocaleString('zh-CN', {
                          month: 'numeric',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-extrabold text-cocoa-600">
                        {e.score}
                        <span className="text-sm text-cocoa-400">/{e.totalScore}</span>
                      </p>
                      <p className="text-xs font-bold text-cocoa-400">{percent}%</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </section>

      {/* 错题明细 */}
      <section>
        <SectionTitle
          icon="shield"
          title="待复习错题"
          extra={
            <Chip tone="candy" size="sm">
              {report.wrongActive.length} 道
            </Chip>
          }
        />
        {report.wrongActive.length === 0 ? (
          <Card>
            <EmptyState emoji="🎉" title="没有待复习的错题" desc="孩子答错的题会自动收进这里。" />
          </Card>
        ) : (
          <div className="space-y-3">
            {report.wrongActive.slice(0, 6).map((r) => (
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
                      正确答案：<span className="text-emerald-600">{r.snapshot.correctAnswer}</span>
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* 家长工具箱：星星管理 / 奖励商城 / 数据备份 / 体验设置 */}
      <ParentToolbox
        reward={report.reward}
        studentName={currentStudent.nickname}
        onChanged={reloadReport}
      />

      {/* 只读声明 */}
      <Card className="p-5">
        <div className="flex items-start gap-3">
          <span className="text-2xl select-none">🔒</span>
          <p className="text-sm font-semibold text-cocoa-500 leading-relaxed">
            上方仪表盘为<b className="text-cocoa-700">只读模式</b>：查看孩子的进度、错题与成绩。
            管理操作（调星星、编辑奖品、备份、设置）集中在「家长工具箱」中；
            布置作业与批改请使用老师的「辅导中心」。
          </p>
        </div>
      </Card>
    </div>
  );
}

/* ───────────────────────── 每周星星趋势图（内联 SVG） ───────────────────────── */

function WeeklyStarsChart({ data }: { data: { week: string; stars: number }[] }) {
  const W = 320;
  const H = 140;
  const PAD_X = 30;
  const PAD_TOP = 18;
  const PAD_BOTTOM = 30;
  const maxStars = Math.max(5, ...data.map((d) => d.stars));

  const innerW = W - PAD_X * 2;
  const innerH = H - PAD_TOP - PAD_BOTTOM;
  const stepX = data.length > 1 ? innerW / (data.length - 1) : 0;

  const pts = data.map((d, i) => ({
    x: PAD_X + i * stepX,
    y: PAD_TOP + innerH - (d.stars / maxStars) * innerH,
    ...d,
  }));

  const linePath = pts
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ');
  const areaPath =
    pts.length > 0
      ? `${linePath} L${pts[pts.length - 1].x.toFixed(1)},${(PAD_TOP + innerH).toFixed(
          1,
        )} L${pts[0].x.toFixed(1)},${(PAD_TOP + innerH).toFixed(1)} Z`
      : '';

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        role="img"
        aria-label="每周星星趋势图"
      >
        <defs>
          <linearGradient id="starArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFD45C" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#FFD45C" stopOpacity="0.05" />
          </linearGradient>
        </defs>

        {/* 网格线 */}
        {[0, 0.5, 1].map((t) => (
          <line
            key={t}
            x1={PAD_X}
            x2={W - PAD_X}
            y1={PAD_TOP + innerH - t * innerH}
            y2={PAD_TOP + innerH - t * innerH}
            stroke="#F6EFEA"
            strokeWidth="1.5"
            strokeDasharray={t === 0 ? undefined : '4 4'}
          />
        ))}

        {/* 面积 + 折线 */}
        {areaPath && <path d={areaPath} fill="url(#starArea)" />}
        <path
          d={linePath}
          fill="none"
          stroke="#FBB428"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* 数据点 */}
        {pts.map((p) => (
          <g key={p.week}>
            <circle cx={p.x} cy={p.y} r="5" fill="#fff" stroke="#FBB428" strokeWidth="3" />
            {p.stars > 0 && (
              <text
                x={p.x}
                y={p.y - 10}
                textAnchor="middle"
                fontSize="11"
                fontWeight="800"
                fill="#B87515"
              >
                {p.stars}
              </text>
            )}
            <text
              x={p.x}
              y={H - 10}
              textAnchor="middle"
              fontSize="10"
              fontWeight="700"
              fill="#B79C90"
            >
              {p.week.replace(/^\d{4}-/, '')}
            </text>
          </g>
        ))}
      </svg>
      <p className="mt-2 text-xs font-bold text-cocoa-400 text-center">
        孩子每周获得的星星（学会单词 +1，完成小测 +5）
      </p>
    </div>
  );
}

export default ParentViewPage;
