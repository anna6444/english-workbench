/**
 * 学习首页 —— 学生打开应用的第一屏。
 *
 * 信息优先级（自上而下）：
 *   1. 今天要做什么（今日任务卡）—— 「打开就知道干嘛」是关键
 *   2. 我的星星与打卡（即时正反馈）
 *   3. 9 个模块宫格（自主选择探索）
 *   4. 待完成作业（家长派的活）
 *
 * 设计上刻意「减文字」：大 emoji + 短标签，二年级孩子能自己看懂。
 */

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Assignment, CorgiState, ProgressState, RewardState, VocabularyWord } from '@/types';
import {
  BADGE_DEFS,
  CORGI_MISSION_REMINDER,
  DAILY_MISSION_STARS,
  DAILY_MISSION_WORDS,
} from '@/types';
import { BadgeItem, Card, Chip, ProgressBar, SectionTitle, StarCount, StatCard } from '@/components/ui';
import { Icon, type IconName } from '@/components/Icon';
import { STUDENT_NAV, TONE_CLASS, type NavTone } from '@/app/nav';
import { useRepositories } from '@/repositories/RepositoriesProvider';
import { useSession } from '@/app/AuthProvider';
import { todayStr } from '@/repositories/local/RewardRepository';

interface HomeData {
  progress: ProgressState;
  reward: RewardState;
  words: VocabularyWord[];
  wrongActive: number;
  assignments: Assignment[];
  corgi: CorgiState;
}

export function HomePage() {
  const repos = useRepositories();
  const { currentStudent } = useSession();
  const navigate = useNavigate();
  const [data, setData] = useState<HomeData | null>(null);
  const [homeworks, setHomeworks] = useState<Record<string, { title: string; unitId?: string }>>({});
  const [toast, setToast] = useState<string | null>(null);

  const sid = currentStudent?.id;

  useEffect(() => {
    if (!sid) return;
    let alive = true;
    void (async () => {
      // 全部并发拉取：首页要快
      const [progress, reward, words, wrongs, assignments, hwList, corgi] = await Promise.all([
        repos.progress.get(sid),
        repos.reward.get(sid),
        repos.vocabulary.listByStudent(sid),
        repos.wrongBook.listActive(sid),
        repos.assignment.listByStudent(sid),
        repos.homework.list(),
        repos.corgi.get(sid),
      ]);
      if (!alive) return;

      const hwMap: Record<string, { title: string; unitId?: string }> = {};
      for (const h of hwList) hwMap[h.id] = { title: h.title, unitId: h.unitId };

      setHomeworks(hwMap);
      setData({
        progress,
        reward,
        words,
        wrongActive: wrongs.length,
        assignments,
        corgi,
      });
    })();
    return () => {
      alive = false;
    };
  }, [repos, sid]);

  /* 星星兑换：扣星 + 写兑换记录（等家长兑现） */
  const doRedeem = async (itemId: string) => {
    if (!sid) return;
    const r = await repos.reward.redeem(sid, itemId);
    if (!r.ok) {
      setToast(r.reason ?? '兑换失败啦');
      window.setTimeout(() => setToast(null), 2600);
      return;
    }
    const newReward = await repos.reward.get(sid);
    setData((d) => (d ? { ...d, reward: newReward } : d));
    setToast('🎁 兑换成功！等爸爸妈妈兑现哦');
    window.setTimeout(() => setToast(null), 2600);
  };

  if (!currentStudent || !data) {
    return (
      <div className="space-y-5">
        <div className="h-36 rounded-3xl bg-white animate-pulse" />
        <div className="h-24 rounded-3xl bg-white animate-pulse" />
        <div className="h-64 rounded-3xl bg-white animate-pulse" />
      </div>
    );
  }

  const { progress, reward, words, wrongActive, assignments, corgi } = data;
  const mastered = words.filter((w) => w.isMastered).length;
  const pendingHw = assignments.filter((a) => a.status === 'assigned');

  /* 柯基每日任务（模块三 3.1）：未完成时首页提醒条 */
  const today = todayStr();
  const missionActive = corgi.dailyMission && !corgi.dailyMission.settled;
  const missionWords = corgi.dailyMission?.wordsDone ?? 0;
  const missionStars = reward.dailyStars[today] ?? 0;

  /* 星星兑换屋（模块一 1.3 联动）：家长上架的现实奖励 */
  const shopItems = reward.customShop.filter((i) => i.enabled);
  const pendingRedeems = reward.redeemed.filter((r) => r.status === 'pending');

  /* 今日建议：按优先级给一条行动 */
  const suggestion = buildSuggestion({
    wrongActive,
    pendingHw: pendingHw.length,
    words: words.length,
    streak: progress.streakDays,
  });

  return (
    <div className="space-y-6">
      {/* ───── 问候 + 今日建议 ───── */}
      <section className="rounded-3xl bg-gradient-to-br from-sky-400 to-violet-400 p-6 sm:p-7 text-white relative overflow-hidden">
        <div className="absolute -right-8 -top-8 text-[120px] opacity-15 select-none leading-none">
          🌱
        </div>
        <div className="relative">
          <div className="flex items-center gap-3 mb-5">
            <span className="text-4xl select-none">{currentStudent.avatar}</span>
            <div>
              <p className="text-xl font-extrabold">
                {greeting()}，{currentStudent.nickname}！
              </p>
              <p className="text-sm font-semibold opacity-90">
                已连续学习 {progress.streakDays} 天
              </p>
            </div>
          </div>

          <div className="rounded-3xl bg-white/22 backdrop-blur p-5">
            <p className="text-xs font-extrabold opacity-90 mb-2">
              <Icon name="lightning" size={14} className="inline mr-1.5 -mt-0.5" />
              今天先做这个
            </p>
            <p className="text-lg font-extrabold mb-4">{suggestion.text}</p>
            <button
              type="button"
              onClick={() => navigate(suggestion.path)}
              className="inline-flex items-center gap-2 rounded-2xl bg-white text-sky-600 px-6 py-3.5 text-base font-extrabold min-h-[56px] transition-transform active:scale-95"
            >
              {suggestion.action}
              <Icon name="arrowRight" size={20} />
            </button>
          </div>
        </div>
      </section>

      {/* ───── 柯基每日任务提醒（未完成时显示） ───── */}
      {missionActive && (
        <section className="rounded-3xl bg-gradient-to-r from-butter-50 to-sakura-50 border-2 border-butter-200 p-4 sm:p-5 flex items-center gap-3.5">
          <span className="text-4xl select-none animate-[wiggle_1.6s_ease-in-out_infinite]">
            🐶
          </span>
          <div className="flex-1 min-w-0">
            <p className="font-extrabold text-cocoa-700 text-sm sm:text-base">
              {corgi.name}说：{CORGI_MISSION_REMINDER}
            </p>
            <p className="text-xs font-bold text-cocoa-400 mt-1">
              每日任务：学单词 {Math.min(missionWords, DAILY_MISSION_WORDS)}/{DAILY_MISSION_WORDS} ·
              拿星星 {Math.min(missionStars, DAILY_MISSION_STARS)}/{DAILY_MISSION_STARS}
              ，完成柯基就能吃饱饱！
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/vocabulary')}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-2xl bg-gradient-to-b from-amber-400 to-amber-500 text-white px-4 py-3 text-sm font-extrabold min-h-[48px] shadow-[0_4px_0_0_#D9A13B] active:translate-y-0.5 active:shadow-none transition-all"
          >
            去学单词
            <Icon name="arrowRight" size={16} />
          </button>
        </section>
      )}

      {/* ───── 数据速览 ───── */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <StatCard label="我的单词" value={words.length} unit="个" emoji="📚" tone="sky" />
        <StatCard label="已掌握" value={mastered} unit="个" emoji="✅" tone="grass" />
        <StatCard label="待复习错题" value={wrongActive} unit="道" emoji="📌" tone="candy" />
        <StatCard label="积攒星星" value={reward.stars} unit="颗" emoji="⭐" tone="sun" />
      </section>

      {/* ───── 待完成作业 ───── */}
      {pendingHw.length > 0 && (
        <section>
          <SectionTitle icon="clipboard" title="要做的小任务" />
          <div className="space-y-3">
            {pendingHw.map((a) => (
              <Card key={a.id} className="p-5">
                <div className="flex items-center gap-4">
                  <span className="text-3xl select-none">
                    {a.homeworkType === 'writing' ? '✍️' : '📖'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-extrabold text-slate-800 truncate">
                      {a.homeworkTitle}
                    </p>
                    <p className="text-sm text-slate-400 font-semibold mt-1">
                      {dueText(a.dueAt)}
                    </p>
                  </div>
                  <Link to={a.homeworkType === 'writing' ? '/writing' : '/vocabulary'}>
                    <span className="inline-flex items-center gap-1.5 rounded-2xl bg-sky-500 text-white px-4 py-3 text-sm font-extrabold min-h-[48px]">
                      去做
                      <Icon name="arrowRight" size={16} />
                    </span>
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* ───── 星星兑换屋（家长上架的现实奖励，模块一 1.3 ↔ 模块三 3.5） ───── */}
      {shopItems.length > 0 && (
        <section>
          <SectionTitle
            icon="star"
            title="星星兑换屋"
            extra={<StarCount value={reward.stars} size={16} />}
          />
          <Card className="p-5">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {shopItems.map((item) => {
                const afford = reward.stars >= item.cost;
                return (
                  <div
                    key={item.id}
                    className="rounded-3xl border-2 border-butter-100 bg-gradient-to-b from-butter-50/60 to-white p-4 flex flex-col items-center text-center"
                  >
                    <span className="text-4xl select-none mb-1.5">{item.emoji}</span>
                    <p className="text-sm font-extrabold text-cocoa-700 leading-tight">
                      {item.name}
                    </p>
                    <p className="mt-1.5 inline-flex items-center gap-1 text-sm font-extrabold text-amber-600">
                      <Icon name="star" size={14} /> {item.cost}
                    </p>
                    <button
                      type="button"
                      disabled={!afford}
                      onClick={() => void doRedeem(item.id)}
                      className={`mt-2.5 w-full rounded-2xl px-3 py-2.5 text-sm font-extrabold transition-all min-h-[44px] active:translate-y-0.5 ${
                        afford
                          ? 'bg-gradient-to-b from-amber-400 to-amber-500 text-white shadow-[0_3px_0_0_#D9A13B]'
                          : 'bg-slate-100 text-cocoa-300 cursor-not-allowed'
                      }`}
                    >
                      {afford ? '兑换' : `还差 ${item.cost - reward.stars} ⭐`}
                    </button>
                  </div>
                );
              })}
            </div>
            {pendingRedeems.length > 0 && (
              <div className="mt-4 rounded-2xl bg-sakura-50 border-2 border-sakura-100 px-4 py-3">
                <p className="text-xs font-extrabold text-cocoa-500 mb-2">
                  🎁 待爸爸妈妈兑现（{pendingRedeems.length} 个）
                </p>
                <div className="flex flex-wrap gap-2">
                  {pendingRedeems.map((r) => (
                    <span
                      key={r.id}
                      className="inline-flex items-center gap-1 rounded-full bg-white border-2 border-sakura-200 px-3 py-1.5 text-xs font-extrabold text-cocoa-600"
                    >
                      <span className="select-none">{r.emoji}</span>
                      {r.itemName}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <p className="mt-3.5 text-[11px] font-bold text-cocoa-400 text-center">
              兑换后会通知家长，由家长带着兑现奖励哦
            </p>
          </Card>
        </section>
      )}

      {/* ───── 9 大模块宫格 ───── */}
      <section>
        <SectionTitle icon="cards" title="学习乐园" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
          {STUDENT_NAV.filter((n) => n.path !== '/').map((item) => (
            <ModuleTile
              key={item.path}
              to={item.path}
              icon={item.icon}
              label={item.label}
              desc={item.desc}
              tone={item.tone}
            />
          ))}
        </div>
      </section>

      {/* ───── 徽章墙 ───── */}
      <section>
        <SectionTitle
          icon="star"
          title="我的徽章"
          extra={
            <Chip tone="sun" size="sm">
              {reward.badges.length} / {BADGE_DEFS.length}
            </Chip>
          }
        />
        <Card className="p-5">
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            {BADGE_DEFS.map((def) => {
              const earned = reward.badges.some((b) => b.id === def.id);
              return (
                <BadgeItem
                  key={def.id}
                  emoji={def.emoji}
                  name={def.name}
                  desc={def.desc}
                  earned={earned}
                />
              );
            })}
          </div>
        </Card>
      </section>

      {/* ───── 本周星星进度 ───── */}
      <section>
        <SectionTitle icon="chart" title="我的成长" />
        <Card className="p-5 space-y-5">
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-sm font-bold text-slate-500">今日学习目标</span>
              <span className="text-sm font-extrabold text-sky-600">
                {Math.min(progress.totalMinutes, currentStudent.dailyGoalMinutes)} /{' '}
                {currentStudent.dailyGoalMinutes} 分钟
              </span>
            </div>
            <ProgressBar
              percent={(progress.totalMinutes / currentStudent.dailyGoalMinutes) * 100}
              tone="sky"
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-slate-500">累计学习</span>
            <span className="text-sm font-extrabold text-slate-700">
              {progress.totalMinutes} 分钟 · {progress.totalDays} 天
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-slate-500">我的星星</span>
            <StarCount value={reward.stars} size={22} />
          </div>
        </Card>
      </section>

      {/* ───── Toast（兑换反馈） ───── */}
      {toast && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-24 lg:bottom-16 z-50 rounded-2xl bg-slate-800/90 text-white px-5 py-3 text-sm font-bold shadow-lg animate-[pop-in_0.25s_ease-out] max-w-[86vw] text-center">
          {toast}
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── 子组件 ───────────────────────── */

function ModuleTile({
  to,
  icon,
  label,
  desc,
  tone,
}: {
  to: string;
  icon: IconName;
  label: string;
  desc: string;
  tone: NavTone;
}) {
  const t = TONE_CLASS[tone];
  return (
    <Link to={to} className="block">
      <div
        className={`h-full rounded-3xl border-2 ${t.border} ${t.softBg} p-5 transition-transform duration-150 hover:-translate-y-1 active:translate-y-0`}
      >
        <span
          className={`inline-flex items-center justify-center w-12 h-12 rounded-2xl ${t.bg} text-white mb-3.5`}
        >
          <Icon name={icon} size={26} />
        </span>
        <p className={`font-extrabold text-base ${t.text} leading-tight`}>{label}</p>
        <p className="text-xs text-slate-500 font-semibold mt-1.5 leading-snug">{desc}</p>
      </div>
    </Link>
  );
}

/* ───────────────────────── 工具函数 ───────────────────────── */

function greeting(): string {
  const h = new Date().getHours();
  if (h < 6) return '夜深了';
  if (h < 11) return '早上好';
  if (h < 14) return '中午好';
  if (h < 18) return '下午好';
  return '晚上好';
}

function dueText(dueAt: number): string {
  const diff = dueAt - Date.now();
  const days = Math.ceil(diff / 86400000);
  if (days < 0) return '已经过期啦，尽快补上';
  if (days === 0) return '今天就要完成哦';
  if (days === 1) return '明天到期';
  return `${days} 天后到期`;
}

/**
 * 今日建议 —— 单一决策函数，输出「做什么 + 去哪做」。
 * 优先级：错题 > 作业 > 新词 > 听力（符合遗忘曲线与学习闭环）
 */
function buildSuggestion(input: {
  wrongActive: number;
  pendingHw: number;
  words: number;
  streak: number;
}): { text: string; action: string; path: string } {
  const { wrongActive, pendingHw, words } = input;

  if (wrongActive >= 3) {
    return {
      text: `有 ${wrongActive} 道错题在等你，消灭它们能拿星星！`,
      action: '去消灭错题',
      path: '/wrongbook',
    };
  }
  if (pendingHw > 0) {
    return {
      text: `还有 ${pendingHw} 个小任务没完成，做完就轻松啦。`,
      action: '去完成任务',
      path: '/vocabulary',
    };
  }
  if (wrongActive > 0) {
    return {
      text: `还剩 ${wrongActive} 道错题，再来一次就掌握啦！`,
      action: '去复习错题',
      path: '/wrongbook',
    };
  }
  if (words < 5) {
    return {
      text: '单词库还空着呢，去单元里认识几个新朋友吧！',
      action: '去学新词',
      path: '/units',
    };
  }
  return {
    text: '今天学一期听力吧，慢慢听，慢慢跟读。',
    action: '去听一听',
    path: '/listening',
  };
}

export default HomePage;
