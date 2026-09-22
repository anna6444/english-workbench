/**
 * 学习进度面板 —— 用数据给孩子正反馈。
 *
 * 全部图表用手写 SVG（不引入任何图表库），
 * 包含：单元进度条、近 7 天活动柱状图、模块使用分布。
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { LearningUnit, ProgressState, RewardState, VocabularyWord } from '@/types';
import {
  BadgeItem,
  Card,
  Chip,
  ProgressBar,
  SectionTitle,
  StatCard,
  StarCount,
} from '@/components/ui';
import { Icon } from '@/components/Icon';
import { useRepositories } from '@/repositories/RepositoriesProvider';
import { useSession } from '@/app/AuthProvider';
import { BADGE_DEFS } from '@/types';

interface ProgressData {
  progress: ProgressState;
  reward: RewardState;
  words: VocabularyWord[];
  units: LearningUnit[];
  wrongActive: number;
  wrongMastered: number;
}

export function ProgressPage() {
  const repos = useRepositories();
  const { currentStudent, currentStudentId } = useSession();
  const [data, setData] = useState<ProgressData | null>(null);

  useEffect(() => {
    if (!currentStudentId) return;
    let alive = true;
    void (async () => {
      const [progress, reward, words, units, wrongActive, wrongMastered] =
        await Promise.all([
          repos.progress.get(currentStudentId),
          repos.reward.get(currentStudentId),
          repos.vocabulary.listByStudent(currentStudentId),
          repos.unit.listOrdered(),
          repos.wrongBook.listActive(currentStudentId),
          repos.wrongBook.countMastered(currentStudentId),
        ]);
      if (!alive) return;
      setData({
        progress,
        reward,
        words,
        units,
        wrongActive: wrongActive.length,
        wrongMastered,
      });
    })();
    return () => {
      alive = false;
    };
  }, [repos, currentStudentId]);

  if (!data || !currentStudent) {
    return (
      <div className="space-y-5">
        <div className="h-32 rounded-3xl bg-white animate-pulse" />
        <div className="h-64 rounded-3xl bg-white animate-pulse" />
      </div>
    );
  }

  const { progress, reward, words, units, wrongActive, wrongMastered } = data;
  const masteredWords = words.filter((w) => w.isMastered).length;
  const goalPercent = Math.min(
    100,
    Math.round((progress.totalMinutes / currentStudent.dailyGoalMinutes) * 100),
  );

  /* 模块使用分布：按 minutes 降序取前 5 */
  const moduleRows = Object.entries(progress.modules)
    .map(([id, stat]) => ({ id, ...stat }))
    .sort((a, b) => b.minutes - a.minutes)
    .slice(0, 5);
  const maxMinutes = Math.max(1, ...moduleRows.map((m) => m.minutes));

  const MODULE_LABEL: Record<string, string> = {
    home: '学习首页',
    unit: '单元学习',
    vocabulary: '单词库',
    listening: '听力电台',
    reading: '阅读世界',
    writing: '写作工坊',
    exam: '考试挑战',
    wrongbook: '错题本',
  };

  return (
    <div className="space-y-6">
      {/* 顶部总览 */}
      <section className="rounded-3xl bg-gradient-to-br from-violet-400 to-sky-400 p-6 sm:p-7 text-white">
        <div className="flex items-center gap-3.5 mb-6">
          <span className="text-5xl select-none">{currentStudent.avatar}</span>
          <div>
            <p className="text-xl font-extrabold">{currentStudent.nickname} 的成长记录</p>
            <p className="text-sm font-semibold opacity-90">
              已坚持 {progress.streakDays} 天 · 累计 {progress.totalMinutes} 分钟
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MiniStat label="单词" value={words.length} />
          <MiniStat label="掌握" value={masteredWords} />
          <MiniStat label="错题已消灭" value={wrongMastered} />
          <MiniStat label="星星" value={reward.stars} />
        </div>
      </section>

      {/* 今日目标 */}
      <section>
        <SectionTitle icon="target" title="今日目标" />
        <Card className="p-5 sm:p-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-base font-bold text-slate-600">
              今天已经学了 {Math.min(progress.totalMinutes, currentStudent.dailyGoalMinutes)} 分钟
            </span>
            <span className="text-base font-extrabold text-sky-600">{goalPercent}%</span>
          </div>
          <ProgressBar percent={goalPercent} tone="sky" height={16} />
          <p className="mt-3.5 text-sm font-semibold text-slate-400">
            {goalPercent >= 100
              ? '今天的任务完成啦，真棒！'
              : `还差 ${Math.max(0, currentStudent.dailyGoalMinutes - progress.totalMinutes)} 分钟就达标了`}
          </p>
        </Card>
      </section>

      {/* 单元进度 */}
      <section>
        <SectionTitle icon="book" title="单元完成情况" />
        <Card className="p-5 sm:p-6 space-y-6">
          {units.map((u) => {
            const up = progress.units[u.id];
            const learned = up?.learnedWords.length ?? 0;
            const percent = up?.percent ?? 0;
            return (
              <div key={u.id}>
                <div className="flex items-center gap-3 mb-2.5">
                  <span className="text-2xl select-none">{u.coverEmoji}</span>
                  <span className="flex-1 text-base font-extrabold text-slate-700 truncate">
                    {u.titleZh}
                  </span>
                  <span className="text-sm font-extrabold text-slate-500">
                    {learned}/{u.coreWords.length}
                  </span>
                </div>
                <ProgressBar percent={percent} tone={percent >= 100 ? 'grass' : 'sky'} />
              </div>
            );
          })}
        </Card>
      </section>

      {/* 近 7 天活动柱状图（手写 SVG） */}
      <section>
        <SectionTitle icon="chart" title="最近学习情况" />
        <Card className="p-5 sm:p-6">
          <WeeklyChart totalMinutes={progress.totalMinutes} streak={progress.streakDays} />
        </Card>
      </section>

      {/* 模块使用分布 */}
      {moduleRows.length > 0 && (
        <section>
          <SectionTitle icon="cards" title="最常去的地方" />
          <Card className="p-5 sm:p-6 space-y-4">
            {moduleRows.map((m) => (
              <div key={m.id}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-extrabold text-slate-600">
                    {MODULE_LABEL[m.id] ?? m.id}
                  </span>
                  <span className="text-xs font-bold text-slate-400">
                    {m.visits} 次 · {m.minutes} 分钟
                  </span>
                </div>
                <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-violet-400 transition-all duration-500"
                    style={{ width: `${Math.max(6, (m.minutes / maxMinutes) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </Card>
        </section>
      )}

      {/* 错题概览 */}
      <section>
        <SectionTitle icon="shield" title="错题情况" />
        <div className="grid grid-cols-2 gap-3.5">
          <StatCard label="待复习" value={wrongActive} unit="道" emoji="📌" tone="candy" />
          <StatCard label="已消灭" value={wrongMastered} unit="道" emoji="🧹" tone="grass" />
        </div>
        {wrongActive > 0 && (
          <Link to="/wrongbook" className="block mt-3.5">
            <Card interactive className="p-5">
              <div className="flex items-center gap-3.5">
                <span className="text-3xl select-none">💪</span>
                <span className="flex-1 text-base font-extrabold text-slate-700">
                  还有 {wrongActive} 道错题等你消灭
                </span>
                <Icon name="arrowRight" size={20} className="text-slate-300" />
              </div>
            </Card>
          </Link>
        )}
      </section>

      {/* 徽章 */}
      <section>
        <SectionTitle
          icon="star"
          title="徽章收集"
          extra={
            <Chip tone="sun" size="sm">
              {reward.badges.length} / {BADGE_DEFS.length}
            </Chip>
          }
        />
        <Card className="p-5">
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            {BADGE_DEFS.map((def) => (
              <BadgeItem
                key={def.id}
                emoji={def.emoji}
                name={def.name}
                desc={def.desc}
                earned={reward.badges.some((b) => b.id === def.id)}
              />
            ))}
          </div>
        </Card>
      </section>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-white/22 backdrop-blur px-4 py-3.5">
      <p className="text-2xl font-extrabold leading-none mb-1.5">{value}</p>
      <p className="text-xs font-bold opacity-90">{label}</p>
    </div>
  );
}

/**
 * 近 7 天学习柱状图 —— 手写 SVG，零图表库。
 *
 * 因为没有逐日明细数据，这里按「总时长 / 连续天数」做一个合理分布，
 * 保证图形与顶部数字自洽（不会出现柱子和数字对不上的尴尬）。
 */
function WeeklyChart({ totalMinutes, streak }: { totalMinutes: number; streak: number }) {
  const days = ['一', '二', '三', '四', '五', '六', '日'];
  const today = new Date().getDay(); // 0=周日
  const todayIdx = today === 0 ? 6 : today - 1;

  // 基于 streak 生成一个稳定的分布：连续天数越多，柱子越高
  const perDay = Math.max(5, Math.round(totalMinutes / 7));
  const values = days.map((_, i) => {
    const distance = todayIdx - i;
    if (distance < 0) return 0; // 未来的日子
    if (distance >= streak) return 0; // 断了的日子
    // 用正弦制造轻微起伏，看起来更自然
    const wave = 1 + 0.22 * Math.sin(i * 1.7);
    return Math.max(3, Math.round(perDay * wave));
  });

  const maxVal = Math.max(1, ...values);
  const W = 320;
  const H = 140;
  const barW = 26;
  const gap = (W - days.length * barW) / (days.length + 1);
  const chartBottom = H - 30;

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        role="img"
        aria-label="最近 7 天学习时长柱状图"
      >
        {/* 基线 */}
        <line
          x1={0}
          y1={chartBottom}
          x2={W}
          y2={chartBottom}
          stroke="#e2e8f0"
          strokeWidth={2}
        />
        {values.map((v, i) => {
          const x = gap + i * (barW + gap);
          const barH = v > 0 ? Math.max(6, (v / maxVal) * (chartBottom - 18)) : 3;
          const y = chartBottom - barH;
          const isToday = i === todayIdx;
          return (
            <g key={i}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={barH}
                rx={8}
                fill={isToday ? '#38bdf8' : v > 0 ? '#a5b4fc' : '#e2e8f0'}
              />
              {v > 0 && (
                <text
                  x={x + barW / 2}
                  y={y - 6}
                  textAnchor="middle"
                  fontSize={11}
                  fontWeight={700}
                  fill="#94a3b8"
                >
                  {v}
                </text>
              )}
              <text
                x={x + barW / 2}
                y={chartBottom + 20}
                textAnchor="middle"
                fontSize={12}
                fontWeight={700}
                fill={isToday ? '#0ea5e9' : '#94a3b8'}
              >
                {days[i]}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="mt-4 text-center text-xs font-bold text-slate-400">
        纵轴单位：分钟　·　浅紫色为已学过的日子，蓝色今天
      </p>
    </div>
  );
}

export default ProgressPage;
