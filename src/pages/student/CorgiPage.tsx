/**
 * 柯基乐园 —— 3D 柯基养成主页。
 *
 * 布局（按需求 spec）：
 *   顶部：柯基名 + 等级 + 经验进度条（升级双条件提示）+ 星星余额 + 属性条
 *         + 每日任务卡（5 词 + 10 星 → 属性回满）+ 周/月挑战与连续打卡走廊
 *   中央：全幅 3D Canvas（3D 柯基 + 拖拽旋转 + 点击互动 + 语音气泡
 *         + 连续 30 天解锁飞行云海 + 连续 3 天解锁洗澡动画）
 *   底部悬浮：🍖 喂养 / 🎾 玩耍 / 🛍️ 商城 / 🎙️ 语音指令 / 📖 日记
 *   右侧（桌面）：道具背包；移动端背包在商城弹窗内
 *
 * v2 持续喂养（模块三）：
 *   每日任务：学 5 词 + 拿 10 星 → 饱食/快乐回满；进入页面未完成时撒娇提醒一次
 *   周挑战：本周 30 词 → 豪华大礼包（星星 + 消耗品）
 *   月挑战：本月 100 词 → 等级上限 10→15 + 天使翅膀
 *   连续打卡：3 天洗澡动画 / 7 天免费星星披风 / 30 天飞行背景
 *   柯基日记：系统自动记录 + 孩子写贴心话
 *
 * 数据流（铁律：单向）：
 *   页面 state（command/heartsNonce/bubble）→ 3D 组件只读消费；
 *   3D 组件 → onZoneClick 回调 → 页面改 state。无环。
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { CorgiState, ProgressState } from '@/types';
import {
  CORGI_BOOSTED_MAX_LEVEL,
  CORGI_COMMANDS,
  CORGI_MISSION_DONE,
  CORGI_MISSION_REMINDER,
  CORGI_PRAISES,
  DAILY_MISSION_STARS,
  DAILY_MISSION_WORDS,
  MONTHLY_CHALLENGE_WORDS,
  SHOP_ITEMS,
  STREAK_UNLOCK_BATH,
  STREAK_UNLOCK_CLOTHES,
  STREAK_UNLOCK_FLYING,
  WEEKLY_CHALLENGE_WORDS,
  WEEKLY_GIFT,
  corgiMaxLevel,
  findShopItem,
  wordsNeededForLevel,
  xpToNext,
} from '@/types';
import { Icon } from '@/components/Icon';
import { useRepositories } from '@/repositories/RepositoriesProvider';
import { useAuth } from '@/app/AuthProvider';
import { useGlobalSpeech } from '@/services/speech/SpeechProvider';
import { CorgiScene } from '@/features/corgi3d/CorgiScene';
import { IDLE_COMMAND, type AnimCommand, type AnimType } from '@/features/corgi3d/animCommand';
import { playBark, playHappyWhine } from '@/features/corgi3d/useBark';
import { detectLowPerfDevice } from '@/features/corgi3d/perf';
import type { CorgiZone } from '@/features/corgi3d/ProceduralCorgi';
import { todayStr, weekKeyOf } from '@/repositories/local/RewardRepository';
import { monthKeyOf } from '@/repositories/local/CorgiRepository';

/* ── 语音识别（STT）能力检测 ── */
const SpeechRecognitionCtor =
  typeof window !== 'undefined'
    ? (window.SpeechRecognition ?? window.webkitSpeechRecognition)
    : undefined;

export function CorgiPage() {
  const repos = useRepositories();
  const { currentStudentId, currentStudent } = useAuth();
  const speech = useGlobalSpeech();
  const sid = currentStudentId;

  /* ── 数据 ── */
  const [corgi, setCorgi] = useState<CorgiState | null>(null);
  const [stars, setStars] = useState(0);
  const [starsToday, setStarsToday] = useState(0);
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [force2D, setForce2D] = useState(false);
  const [loading, setLoading] = useState(true);

  /* ── 3D 交互命令 ── */
  const nonce = useRef(0);
  const [command, setCommand] = useState<AnimCommand>(IDLE_COMMAND);
  const [heartsNonce, setHeartsNonce] = useState(0);
  const [bubble, setBubble] = useState<string | null>(null);
  const bubbleTimer = useRef<number | null>(null);
  /** 洗澡动画 nonce（>0 时舞台覆盖泡泡雨，2.8s 后自动关闭） */
  const [bathNonce, setBathNonce] = useState(0);

  /* ── UI ── */
  const [toast, setToast] = useState<string | null>(null);
  const [shopOpen, setShopOpen] = useState(false);
  const [feedOpen, setFeedOpen] = useState(false);
  const [playOpen, setPlayOpen] = useState(false);
  const [diaryOpen, setDiaryOpen] = useState(false);
  const [streakOpen, setStreakOpen] = useState(false);
  const [diaryDraft, setDiaryDraft] = useState('');
  const [levelUpTo, setLevelUpTo] = useState<number | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState('');

  /* ── 性能降级 ── */
  const [lowPerf, setLowPerf] = useState(() => detectLowPerfDevice());
  const [perfTipShown, setPerfTipShown] = useState(false);

  /* ── STT ── */
  const [listening, setListening] = useState(false);
  const recRef = useRef<SpeechRecognition | null>(null);

  /* ── 初始加载 ── */
  const reload = useCallback(async () => {
    if (!sid) return;
    const [c, r, p, s] = await Promise.all([
      repos.corgi.get(sid),
      repos.reward.get(sid),
      repos.progress.get(sid),
      repos.settings.getSettings(),
    ]);
    setCorgi(c);
    setStars(r.stars);
    setStarsToday(r.dailyStars[todayStr()] ?? 0);
    setProgress(p);
    setForce2D(s.force2D);
    setLoading(false);
  }, [sid, repos]);

  useEffect(() => {
    void reload();
  }, [reload]);

  /* ── 工具函数 ── */
  const fire = useCallback((type: AnimType) => {
    nonce.current += 1;
    setCommand({ type, nonce: nonce.current });
  }, []);

  const showBubble = useCallback((text: string, ms = 2200) => {
    setBubble(text);
    if (bubbleTimer.current) window.clearTimeout(bubbleTimer.current);
    bubbleTimer.current = window.setTimeout(() => setBubble(null), ms);
  }, []);

  const sayZh = useCallback(
    (text: string) => {
      /* 童声鼓励语：中文、语速 0.9、优先匹配自然童声音色（voiceSelector 处理） */
      speech.speakZh(text, 0.9);
    },
    [speech],
  );

  const showToast = useCallback((text: string) => {
    setToast(text);
    window.setTimeout(() => setToast((cur) => (cur === text ? null : cur)), 2600);
  }, []);

  const celebrateLevelUp = useCallback(
    (to: number) => {
      setLevelUpTo(to);
      playHappyWhine();
      sayZh(`哇，${to} 级啦！`);
      setHeartsNonce((n) => n + 1);
      window.setTimeout(() => setLevelUpTo(null), 2400);
    },
    [sayZh],
  );

  /* ── 每日任务：进入页面时播报（每天每生最多一次，防聒噪） ──
     未完成 → 撒娇提醒；已完成 → 欢呼（对称反馈） */
  const missionDoneToday = !!(
    corgi?.dailyMission &&
    corgi.dailyMission.date === todayStr() &&
    corgi.dailyMission.settled
  );

  useEffect(() => {
    if (!sid || loading || !corgi) return;
    const key = missionDoneToday
      ? `egw-mission-done-${sid}-${todayStr()}`
      : `egw-mission-reminder-${sid}-${todayStr()}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch {
      /* 隐私模式禁用 sessionStorage 时静默跳过，不影响主流程 */
    }
    const line = missionDoneToday ? CORGI_MISSION_DONE : CORGI_MISSION_REMINDER;
    showBubble(line, 3200);
    sayZh(line);
  }, [sid, loading, corgi, missionDoneToday, showBubble, sayZh]);

  /* ── 领取周挑战大礼包 ── */
  const doClaimWeekly = useCallback(async () => {
    if (!sid) return;
    const r = await repos.corgi.claimWeeklyGift(sid);
    if (!r.ok) {
      showToast(r.reason ?? '还不能领取哦');
      return;
    }
    const reward = await repos.reward.get(sid);
    setStars(reward.stars);
    setCorgi(r.state);
    playHappyWhine();
    showToast(`🎁 周挑战大礼包到手：${WEEKLY_GIFT.stars}⭐ + 磨牙棒×3 网球×2 泡泡×2！`);
    if (r.levelUp > 0) celebrateLevelUp(r.state.level);
  }, [sid, repos, showToast, celebrateLevelUp]);

  /* ── 领取月挑战（等级上限提升 + 天使翅膀） ── */
  const doClaimMonthly = useCallback(async () => {
    if (!sid) return;
    const r = await repos.corgi.claimMonthlyChallenge(sid);
    if (!r.ok) {
      showToast(r.reason ?? '还不能领取哦');
      return;
    }
    const reward = await repos.reward.get(sid);
    setStars(reward.stars);
    setCorgi(r.state);
    setHeartsNonce((n) => n + 1);
    sayZh('月挑战达成！我要飞起来啦！');
    showToast('🚀 月挑战达成！等级上限升到 15 级 + 天使翅膀 + 100⭐！');
    if (r.levelUp > 0) celebrateLevelUp(r.state.level);
  }, [sid, repos, showToast, celebrateLevelUp, sayZh]);

  /* ── 洗澡动画（连续 3 天解锁）：泡泡雨 + 转圈 + 小经验 ── */
  const doBath = useCallback(async () => {
    if (!sid) return;
    setBathNonce((n) => n + 1);
    window.setTimeout(() => setBathNonce(0), 2800);
    fire('spin');
    showBubble('洗得香香的！', 2600);
    sayZh('洗得香香的');
    const s = await repos.corgi.addXp(sid, 2);
    setCorgi(s);
  }, [sid, repos, fire, showBubble, sayZh]);

  /* ── 柯基日记：孩子写一句贴心话 ── */
  const doAddDiary = useCallback(async () => {
    if (!sid || !diaryDraft.trim()) return;
    const s = await repos.corgi.addDiary(sid, '💬', diaryDraft);
    setCorgi(s);
    setDiaryDraft('');
    showBubble('记下来啦，汪！', 2000);
    showToast('写进柯基日记啦 📖');
  }, [sid, repos, diaryDraft, showBubble, showToast]);

  /* ── 连续 7 天：免费领取星星披风 ── */
  const doClaimCape = useCallback(async () => {
    if (!sid) return;
    const r = await repos.corgi.grantFreeItem(sid, 'cape', '连续学习 7 天奖励');
    if (!r.ok) {
      showToast(r.reason ?? '还不能领取哦');
      return;
    }
    setCorgi(r.state);
    playHappyWhine();
    showToast('🌟 星星披风免费到手，已经给柯基披上啦！');
    if (r.levelUp > 0) celebrateLevelUp(r.state.level);
  }, [sid, repos, showToast, celebrateLevelUp]);

  /* ── 点击柯基分区互动 ── */
  const handleZoneClick = useCallback(
    (zone: CorgiZone) => {
      if (zone === 'head') {
        // 头部：跳一下 + 爱心粒子 + 汪汪音效
        playBark();
        fire('jump');
        setHeartsNonce((n) => n + 1);
        showBubble('汪汪！');
      } else {
        // 身体：蹭一蹭 + 语音「好舒服呀～」
        fire('nuzzle');
        showBubble('好舒服呀～');
        sayZh('好舒服呀');
      }
    },
    [fire, showBubble, sayZh],
  );

  /* ── 喂养 ── */
  const doFeed = useCallback(
    async (foodId: string) => {
      if (!sid) return;
      const item = findShopItem(foodId);
      const r = await repos.corgi.feed(sid, foodId);
      if (!r.ok) {
        showToast(r.reason ?? '现在不能吃哦');
        return;
      }
      setCorgi(r.state);
      fire('sit');
      showBubble('真好吃！');
      sayZh('真好吃');
      showToast(`${item?.name ?? '食物'} 喂好啦，饱食度 +${item?.effect?.satiety ?? 0}`);
      if (r.levelUp > 0) celebrateLevelUp(r.state.level);
      setFeedOpen(false);
    },
    [sid, repos, fire, showBubble, sayZh, showToast, celebrateLevelUp],
  );

  /* ── 玩耍 ── */
  const doPlay = useCallback(
    async (toyId: string) => {
      if (!sid) return;
      const r = await repos.corgi.play(sid, toyId);
      if (!r.ok) {
        showToast(r.reason ?? '现在不玩哦');
        return;
      }
      setCorgi(r.state);
      if (toyId === 'pet') {
        fire('nuzzle');
        showBubble('好舒服呀～');
        sayZh('好舒服呀');
      } else if (toyId === 'ball') {
        fire('spin');
        showBubble('接住啦！');
        sayZh('接住啦');
      } else {
        fire('jump');
        showBubble('好开心呀！');
        sayZh('好开心呀');
      }
      setPlayOpen(false);
      if (r.levelUp > 0) celebrateLevelUp(r.state.level);
    },
    [sid, repos, fire, showBubble, sayZh, showToast, celebrateLevelUp],
  );

  /* ── 商城购买 ── */
  const doBuy = useCallback(
    async (itemId: string) => {
      if (!sid) return;
      const item = findShopItem(itemId);
      const r = await repos.corgi.buy(sid, itemId);
      if (!r.ok) {
        showToast(r.reason ?? '购买失败');
        return;
      }
      const reward = await repos.reward.get(sid);
      setStars(reward.stars);
      setCorgi(r.state);
      playHappyWhine(0.15);
      const label = !item
        ? '买到啦！'
        : item.kind === 'consumable'
          ? `买到${item.name}啦，放进背包了！`
          : `买到${item.name}啦，已经给柯基用上！`;
      showToast(label);
      if (r.levelUp > 0) celebrateLevelUp(r.state.level);
    },
    [sid, repos, showToast, celebrateLevelUp],
  );

  /* ── 佩戴饰品 ── */
  const doEquip = useCallback(
    async (itemId: string | null) => {
      if (!sid) return;
      const s = await repos.corgi.equip(sid, itemId);
      setCorgi(s);
      showToast(itemId ? '换好啦，好看吗？' : '摘下来啦');
    },
    [sid, repos, showToast],
  );

  /* ── 改名 ── */
  const doRename = useCallback(async () => {
    if (!sid) return;
    const s = await repos.corgi.rename(sid, nameDraft);
    setCorgi(s);
    setRenaming(false);
    showToast('改好名字啦！');
  }, [sid, repos, nameDraft, showToast]);

  /* ── 语音指令（STT） ── */
  const handleHeard = useCallback(
    (text: string) => {
      const praise = CORGI_PRAISES[Math.floor(Math.random() * CORGI_PRAISES.length)];
      if (text.includes('坐下')) {
        fire('sit');
        showBubble(`「${text}」→ 坐下！`);
        sayZh(praise);
        void repos.corgi.addXp(sid ?? '', 2).then((s) => setCorgi(s));
      } else if (text.includes('握手')) {
        fire('shake');
        showBubble(`「${text}」→ 握手！`);
        sayZh(praise);
        void repos.corgi.addXp(sid ?? '', 2).then((s) => setCorgi(s));
      } else if (text.includes('转圈')) {
        fire('spin');
        showBubble(`「${text}」→ 转圈！`);
        sayZh(praise);
        void repos.corgi.addXp(sid ?? '', 2).then((s) => setCorgi(s));
      } else {
        showBubble(`「${text}」汪？`, 2600);
        fire('idle');
      }
    },
    [fire, showBubble, sayZh, repos, sid],
  );

  const startListen = useCallback(() => {
    if (!SpeechRecognitionCtor || listening) return;
    try {
      const rec = new SpeechRecognitionCtor();
      recRef.current = rec;
      rec.lang = 'zh-CN';
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.onresult = (e) => {
        const text = e.results[0][0].transcript.trim();
        if (text) handleHeard(text);
      };
      rec.onend = () => setListening(false);
      rec.onerror = () => setListening(false);
      rec.start();
      setListening(true);
      showBubble('我在听你说哦…', 4000);
    } catch {
      setListening(false);
      showToast('语音识别启动失败，再试一次？');
    }
  }, [listening, handleHeard, showBubble, showToast]);

  useEffect(() => {
    return () => {
      recRef.current?.abort();
      if (bubbleTimer.current) window.clearTimeout(bubbleTimer.current);
    };
  }, []);

  /* ── 渲染 ── */
  if (!sid || !currentStudent) return null;

  if (loading || !corgi) {
    return (
      <div className="py-20 text-center">
        <div className="text-6xl mb-4 select-none animate-[wiggle_1.6s_ease-in-out_infinite]">
          🐕
        </div>
        <p className="text-base font-bold text-cocoa-400">柯基正在跑过来…</p>
      </div>
    );
  }

  /* ── 派生数值（模块三：升级双条件 / 每日任务 / 周月挑战 / 连续解锁） ── */
  const maxLv = corgiMaxLevel(corgi);
  const atMaxLevel = corgi.level >= maxLv;
  const xpNeed = xpToNext(corgi.level);
  const xpPercent = Math.min(100, Math.round((corgi.xp / xpNeed) * 100));
  /** 经验已够但单词数不够 → 提示还差 N 个词（升级双条件） */
  const wordsShortForLevelUp = Math.max(
    0,
    wordsNeededForLevel(corgi.level) - corgi.learnedWordCount,
  );

  const today = todayStr();
  const mission = corgi.dailyMission;
  const missionWordsDone =
    mission && mission.date === today ? Math.min(mission.wordsDone, DAILY_MISSION_WORDS) : 0;
  const missionStarsDone = Math.min(starsToday, DAILY_MISSION_STARS);
  const missionDone = !!(mission && mission.date === today && mission.settled);

  const wk = weekKeyOf();
  const mk = monthKeyOf();
  const weeklyDone = corgi.weeklyWords[wk] ?? 0;
  const monthlyDone = corgi.monthlyWords[mk] ?? 0;
  const weeklyClaimed = corgi.claimedChallenges.includes(`weekly-${wk}`);
  const monthlyClaimed =
    corgi.claimedChallenges.includes(`monthly-${mk}`) || corgi.maxLevelBoosted;

  const streakDays = progress?.streakDays ?? 0;
  const bathUnlocked = streakDays >= STREAK_UNLOCK_BATH;
  const capeUnlocked = streakDays >= STREAK_UNLOCK_CLOTHES;
  const flyingUnlocked = streakDays >= STREAK_UNLOCK_FLYING || corgi.ownedPermanent.includes('wings');
  const ownsCape = corgi.ownedPermanent.includes('cape');

  const foodInBag = SHOP_ITEMS.filter(
    (i) => i.kind === 'consumable' && i.effect?.satiety && (corgi.inventory[i.id] ?? 0) > 0,
  );
  const toysInBag = SHOP_ITEMS.filter(
    (i) => i.kind === 'consumable' && i.effect?.happiness && (corgi.inventory[i.id] ?? 0) > 0,
  );

  return (
    <div className="flex flex-col h-[calc(100dvh-215px)] min-h-[500px] lg:h-[calc(100vh-150px)]">
      {/* ───────── 顶部：状态栏 ───────── */}
      <div className="rounded-3xl bg-white/95 backdrop-blur border-2 border-sakura-100 shadow-soft p-4 sm:p-5 mb-3">
        <div className="flex items-center gap-3 flex-wrap">
          {/* 名字 + 等级 */}
          <button
            type="button"
            onClick={() => {
              setNameDraft(corgi.name);
              setRenaming(true);
            }}
            className="flex items-center gap-2 rounded-2xl px-3 py-2 hover:bg-sakura-50 transition-colors min-h-[44px]"
            title="点一下改名字"
          >
            <span className="text-2xl">🐶</span>
            <span className="text-lg font-extrabold text-cocoa-700">{corgi.name}</span>
            <Icon name="pencil" size={15} className="text-cocoa-400" />
          </button>
          <span className="inline-flex items-center rounded-full bg-butter-200 text-amber-700 px-3 py-1.5 text-sm font-extrabold">
            Lv.{corgi.level}
            <span className="ml-1 text-[11px] opacity-80">/{maxLv}</span>
          </span>

          {/* 经验条 */}
          <div className="flex-1 min-w-[130px]">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-extrabold text-cocoa-400">经验</span>
              <span className="text-[11px] font-extrabold text-amber-600">
                {atMaxLevel ? '已到上限' : `${corgi.xp} / ${xpNeed}`}
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-butter-400 to-amber-500 transition-all duration-500"
                style={{ width: `${atMaxLevel ? 100 : xpPercent}%` }}
              />
            </div>
            {/* 升级双条件提示：经验够但单词数不够 → 差 N 个词 */}
            {!atMaxLevel && corgi.xp >= xpNeed && wordsShortForLevelUp > 0 && (
              <p className="mt-1 text-[11px] font-extrabold text-amber-600">
                🎯 再学 {wordsShortForLevelUp} 个单词就能升级啦
              </p>
            )}
            {!atMaxLevel && corgi.xp < xpNeed && wordsShortForLevelUp === 0 && (
              <p className="mt-1 text-[11px] font-bold text-cocoa-400">
                升级 = 喂养经验 + 学满 {wordsNeededForLevel(corgi.level)} 个词（已达标 ✨）
              </p>
            )}
            {atMaxLevel && !corgi.maxLevelBoosted && (
              <p className="mt-1 text-[11px] font-extrabold text-violet-500">
                🚀 月挑战 100 词可解锁 Lv.15 新形态
              </p>
            )}
          </div>

          {/* 星星余额 */}
          <div className="inline-flex items-center gap-1.5 rounded-2xl bg-butter-50 border-2 border-butter-200 px-3.5 py-2">
            <Icon name="star" size={20} className="text-amber-500" />
            <span className="text-lg font-extrabold text-amber-600">{stars}</span>
          </div>
        </div>

        {/* 属性条 */}
        <div className="grid grid-cols-3 gap-2.5 mt-3.5">
          <StatusBar icon="🍖" label="饱食" value={corgi.satiety} from="#FFB27A" to="#F2924E" />
          <StatusBar icon="🎾" label="快乐" value={corgi.happiness} from="#FF9FB8" to="#F76F92" />
          <StatusBar icon="💗" label="亲密" value={corgi.intimacy} from="#C08BFF" to="#9D5DF0" />
        </div>

        {/* ── 每日任务卡（模块三 3.1：学 5 词 + 拿 10 星 → 属性回满） ── */}
        <div
          className={`mt-3 rounded-2xl border-2 px-4 py-3 ${
            missionDone
              ? 'bg-emerald-50 border-emerald-300'
              : 'bg-gradient-to-r from-butter-50 to-sakura-50 border-butter-200'
          }`}
        >
          <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
            <p className="text-xs font-extrabold text-cocoa-600">
              {missionDone ? '🎉 今日任务完成！吃得饱饱，开心转圈圈' : '🎯 每日任务'}
            </p>
            {missionDone ? (
              <span className="rounded-full bg-emerald-500 text-white px-3 py-1 text-[11px] font-extrabold">
                明天也要来哦
              </span>
            ) : (
              <p className="text-[11px] font-bold text-cocoa-400">
                完成 2 项才能吃饱饱 · 没完成明天柯基会饿肚子
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <MiniProgress
              icon="📚"
              label="学单词"
              done={missionWordsDone}
              goal={DAILY_MISSION_WORDS}
              tone="sky"
            />
            <MiniProgress
              icon="⭐"
              label="拿星星"
              done={missionStarsDone}
              goal={DAILY_MISSION_STARS}
              tone="amber"
            />
          </div>
        </div>

        {/* ── 挑战走廊：周挑战 / 月挑战 / 连续打卡解锁 ── */}
        <div className="mt-2.5 grid grid-cols-3 gap-2.5">
          {/* 周挑战 */}
          <div className="rounded-2xl bg-white/95 border-2 border-sakura-100 px-3 py-2.5 flex flex-col">
            <p className="text-[11px] font-extrabold text-cocoa-500">📅 周挑战</p>
            <p className="text-sm font-extrabold text-cocoa-700 mt-0.5">
              {weeklyDone}
              <span className="text-[11px] text-cocoa-400"> / {WEEKLY_CHALLENGE_WORDS} 词</span>
            </p>
            <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden mt-1.5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-pink-400 to-rose-400 transition-all duration-500"
                style={{
                  width: `${Math.min(100, (weeklyDone / WEEKLY_CHALLENGE_WORDS) * 100)}%`,
                }}
              />
            </div>
            {weeklyClaimed ? (
              <p className="mt-1.5 text-[11px] font-extrabold text-emerald-600">✅ 本周已领取</p>
            ) : weeklyDone >= WEEKLY_CHALLENGE_WORDS ? (
              <button
                type="button"
                onClick={() => void doClaimWeekly()}
                className="mt-1.5 rounded-xl bg-gradient-to-b from-pink-400 to-rose-400 text-white text-[11px] font-extrabold px-2 py-1.5 min-h-[30px] active:translate-y-0.5 transition-all"
              >
                🎁 领大礼包
              </button>
            ) : (
              <p className="mt-1.5 text-[11px] font-bold text-cocoa-400">
                差 {WEEKLY_CHALLENGE_WORDS - weeklyDone} 词
              </p>
            )}
          </div>

          {/* 月挑战 */}
          <div className="rounded-2xl bg-white/95 border-2 border-sakura-100 px-3 py-2.5 flex flex-col">
            <p className="text-[11px] font-extrabold text-cocoa-500">🏆 月挑战</p>
            <p className="text-sm font-extrabold text-cocoa-700 mt-0.5">
              {monthlyDone}
              <span className="text-[11px] text-cocoa-400"> / {MONTHLY_CHALLENGE_WORDS} 词</span>
            </p>
            <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden mt-1.5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-400 to-purple-500 transition-all duration-500"
                style={{
                  width: `${Math.min(100, (monthlyDone / MONTHLY_CHALLENGE_WORDS) * 100)}%`,
                }}
              />
            </div>
            {monthlyClaimed ? (
              <p className="mt-1.5 text-[11px] font-extrabold text-emerald-600">
                ✅ 上限 Lv.{CORGI_BOOSTED_MAX_LEVEL}
              </p>
            ) : monthlyDone >= MONTHLY_CHALLENGE_WORDS ? (
              <button
                type="button"
                onClick={() => void doClaimMonthly()}
                className="mt-1.5 rounded-xl bg-gradient-to-b from-violet-400 to-purple-500 text-white text-[11px] font-extrabold px-2 py-1.5 min-h-[30px] active:translate-y-0.5 transition-all"
              >
                🚀 领新形态
              </button>
            ) : (
              <p className="mt-1.5 text-[11px] font-bold text-cocoa-400">
                差 {MONTHLY_CHALLENGE_WORDS - monthlyDone} 词
              </p>
            )}
          </div>

          {/* 连续打卡解锁（点击打开奖励详情） */}
          <button
            type="button"
            onClick={() => setStreakOpen(true)}
            className="rounded-2xl bg-white/95 border-2 border-sakura-100 px-3 py-2.5 flex flex-col text-left hover:border-sakura-300 transition-colors"
          >
            <p className="text-[11px] font-extrabold text-cocoa-500">🔥 连续学习</p>
            <p className="text-sm font-extrabold text-cocoa-700 mt-0.5">
              {streakDays} <span className="text-[11px] text-cocoa-400">天</span>
            </p>
            <div className="flex items-center gap-1.5 mt-1.5">
              <StreakDot emoji="🛁" unlocked={bathUnlocked} label="3天" />
              <StreakDot emoji="🌟" unlocked={capeUnlocked} label="7天" />
              <StreakDot emoji="☁️" unlocked={flyingUnlocked} label="30天" />
            </div>
          </button>
        </div>
      </div>

      {/* ───────── 中央 3D 舞台 + 右侧背包（桌面） ───────── */}
      <div className="flex-1 min-h-0 flex gap-3">
        <div className="flex-1 min-w-0 relative rounded-3xl overflow-hidden border-2 border-sakura-100 shadow-soft bg-gradient-to-b from-sky-50 via-cream to-sakura-100">
          {/* 低画质提示 */}
          {lowPerf && !perfTipShown && (
            <button
              type="button"
              onClick={() => setPerfTipShown(true)}
              className="absolute top-3 left-3 z-10 rounded-2xl bg-white/95 border-2 border-butter-200 px-3.5 py-2 text-xs font-extrabold text-amber-700 shadow-soft"
            >
              ⚡ 已开启流畅模式（低画质保证不卡）点此隐藏
            </button>
          )}

          {/* 洗澡入口（连续 3 天解锁，模块三 3.1） */}
          {bathUnlocked && (
            <button
              type="button"
              onClick={() => void doBath()}
              title="给柯基洗个香香澡（连续学习 3 天解锁）"
              className="absolute top-3 right-3 z-10 rounded-2xl bg-white/95 border-2 border-sky-200 px-3.5 py-2 text-xs font-extrabold text-sky-600 shadow-soft hover:border-sky-300 transition-colors active:translate-y-0.5"
            >
              🛁 洗澡
            </button>
          )}

          <CorgiScene
            command={command}
            heartsNonce={heartsNonce}
            onZoneClick={handleZoneClick}
            equippedAccessory={corgi.equippedAccessory}
            hasLuxuryNest={corgi.hasLuxuryNest}
            bubble={bubble}
            lowPerf={lowPerf}
            onLowFps={() => setLowPerf(true)}
            force2D={force2D}
            flying={flyingUnlocked}
          />

          {/* 洗澡泡泡雨（bathNonce > 0 时播放 2.8s） */}
          {bathNonce > 0 && <BubbleRain nonce={bathNonce} />}

          {/* 飞行模式角标（连续 30 天 / 拥有翅膀） */}
          {flyingUnlocked && (
            <p className="absolute top-3 left-1/2 -translate-x-1/2 z-10 rounded-full bg-white/85 backdrop-blur px-3.5 py-1.5 text-[11px] font-extrabold text-violet-500 pointer-events-none">
              ☁️ 飞行模式 · 柯基在云海里啦
            </p>
          )}

          {/* 升级庆祝 */}
          {levelUpTo !== null && (
            <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
              <div className="rounded-3xl bg-white/95 border-4 border-butter-300 px-8 py-6 text-center shadow-soft-lg animate-[pop-in_0.3s_ease-out]">
                <p className="text-5xl mb-2 select-none">🎉</p>
                <p className="text-2xl font-extrabold text-amber-600">升级到 Lv.{levelUpTo}！</p>
              </div>
            </div>
          )}

          {/* 操作提示 */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 lg:bottom-4 z-10 pointer-events-none">
            <p className="rounded-full bg-white/80 backdrop-blur px-4 py-1.5 text-xs font-bold text-cocoa-500 whitespace-nowrap">
              拖一拖转圈看 · 点头顶有惊喜 · 点身体蹭一蹭
            </p>
          </div>
        </div>

        {/* 桌面右侧背包 */}
        <aside className="hidden lg:flex w-52 shrink-0 flex-col rounded-3xl bg-white/95 border-2 border-sakura-100 shadow-soft p-4 overflow-y-auto">
          <p className="text-sm font-extrabold text-cocoa-500 mb-3">🎒 道具背包</p>
          <BackpackList
            corgi={corgi}
            onEquip={doEquip}
            emptyHint="去商城买点好东西吧～"
          />
        </aside>
      </div>

      {/* ───────── 底部悬浮大按钮 ───────── */}
      <div className="mt-3 grid grid-cols-5 gap-2 sm:gap-2.5">
        <BigActionButton
          emoji="🍖"
          label="喂养"
          onClick={() => setFeedOpen(true)}
          className="bg-gradient-to-b from-orange-300 to-orange-400"
        />
        <BigActionButton
          emoji="🎾"
          label="玩耍"
          onClick={() => setPlayOpen(true)}
          className="bg-gradient-to-b from-lime-300 to-lime-400"
        />
        <BigActionButton
          emoji="🛍️"
          label="商城"
          onClick={() => setShopOpen(true)}
          className="bg-gradient-to-b from-pink-300 to-pink-400"
        />
        <BigActionButton
          emoji={listening ? '👂' : '🎙️'}
          label={listening ? '听ing' : '语音指令'}
          onClick={startListen}
          disabled={!SpeechRecognitionCtor}
          className={
            listening
              ? 'bg-gradient-to-b from-rose-400 to-rose-500 animate-pulse'
              : 'bg-gradient-to-b from-violet-300 to-violet-400'
          }
        />
        <BigActionButton
          emoji="📖"
          label="日记"
          onClick={() => setDiaryOpen(true)}
          className="bg-gradient-to-b from-amber-300 to-amber-400"
        />
      </div>
      {!SpeechRecognitionCtor && (
        <p className="mt-2 text-center text-[11px] font-bold text-cocoa-400">
          当前浏览器不支持语音识别（试试 Chrome / Edge）
        </p>
      )}

      {/* ───────── Toast ───────── */}
      {toast && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-28 lg:bottom-16 z-50 rounded-2xl bg-cocoa-700/90 text-white px-5 py-3 text-sm font-bold shadow-soft-lg animate-grow-up max-w-[88vw] text-center">
          {toast}
        </div>
      )}

      {/* ───────── 弹窗：喂养 ───────── */}
      {feedOpen && (
        <Modal title="🍖 喂点什么？" onClose={() => setFeedOpen(false)}>
          {foodInBag.length === 0 ? (
            <EmptyBag text="背包里没有食物啦" />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {foodInBag.map((item) => (
                <ItemButton
                  key={item.id}
                  icon={item.icon}
                  name={item.name}
                  desc={item.desc}
                  badge={`×${corgi.inventory[item.id] ?? 0}`}
                  onClick={() => void doFeed(item.id)}
                />
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              setFeedOpen(false);
              setShopOpen(true);
            }}
            className="mt-4 w-full rounded-2xl bg-pink-100 text-pink-600 px-4 py-3 text-sm font-extrabold min-h-[48px] hover:bg-pink-200 transition-colors"
          >
            🛍️ 去商城买食物
          </button>
        </Modal>
      )}

      {/* ───────── 弹窗：玩耍 ───────── */}
      {playOpen && (
        <Modal title="🎾 玩什么？" onClose={() => setPlayOpen(false)}>
          <div className="grid grid-cols-2 gap-3">
            {toysInBag.map((item) => (
              <ItemButton
                key={item.id}
                icon={item.icon}
                name={item.name}
                desc={item.desc}
                badge={`×${corgi.inventory[item.id] ?? 0}`}
                onClick={() => void doPlay(item.id)}
              />
            ))}
            <ItemButton
              icon="🤚"
              name="免费抚摸"
              desc="快乐度 +5"
              onClick={() => void doPlay('pet')}
            />
          </div>
          {toysInBag.length === 0 && (
            <p className="mt-3 text-center text-xs font-bold text-cocoa-400">
              背包里没有玩具，先免费摸摸头吧～
            </p>
          )}
        </Modal>
      )}

      {/* ───────── 弹窗：商城（移动端背包也在这） ───────── */}
      {shopOpen && (
        <Modal
          title="🛍️ 柯基商城"
          onClose={() => setShopOpen(false)}
          extra={
            <span className="inline-flex items-center gap-1 rounded-full bg-butter-50 border-2 border-butter-200 px-3 py-1.5 text-sm font-extrabold text-amber-600">
              <Icon name="star" size={16} />
              {stars}
            </span>
          }
        >
          {/* 移动端背包区（桌面右侧常驻，弹窗里也保留一份） */}
          <div className="lg:hidden mb-4">
            <p className="text-sm font-extrabold text-cocoa-500 mb-2">🎒 我的背包</p>
            <BackpackList corgi={corgi} onEquip={doEquip} emptyHint="背包还是空的～" compact />
          </div>

          <p className="text-sm font-extrabold text-cocoa-500 mb-2.5">🛒 货架</p>
          <div className="grid grid-cols-2 gap-3">
            {SHOP_ITEMS.map((item) => {
              const owned = item.kind !== 'consumable' && corgi.ownedPermanent.includes(item.id);
              const afford = stars >= item.price;
              /* 成长型道具等级门槛（模块三 3.5）：先把柯基养大才配得上 */
              const levelLocked = item.minLevel != null && corgi.level < item.minLevel;
              const buyable = !owned && !levelLocked && afford;
              return (
                <div
                  key={item.id}
                  className={`rounded-3xl border-2 border-sakura-100 bg-white p-4 flex flex-col items-center text-center ${
                    levelLocked ? 'opacity-70' : ''
                  }`}
                >
                  <span className="text-4xl select-none mb-1.5">{item.icon}</span>
                  <p className="text-sm font-extrabold text-cocoa-700">{item.name}</p>
                  <p className="text-[11px] font-bold text-cocoa-400 mt-0.5">{item.desc}</p>
                  <p className="mt-1.5 inline-flex items-center gap-1 text-sm font-extrabold text-amber-600">
                    <Icon name="star" size={14} /> {item.price}
                  </p>
                  <button
                    type="button"
                    disabled={owned || !buyable}
                    onClick={() => void doBuy(item.id)}
                    className={`mt-2.5 w-full rounded-2xl px-3 py-2.5 text-sm font-extrabold transition-all min-h-[44px] active:translate-y-0.5 ${
                      owned
                        ? 'bg-slate-100 text-cocoa-400 cursor-default'
                        : levelLocked
                          ? 'bg-slate-100 text-cocoa-400 cursor-not-allowed'
                          : afford
                            ? 'bg-gradient-to-b from-pink-400 to-pink-500 text-white shadow-[0_3px_0_0_#DB4E73]'
                            : 'bg-slate-100 text-cocoa-300 cursor-not-allowed'
                    }`}
                  >
                    {owned
                      ? '已拥有'
                      : levelLocked
                        ? `🔒 Lv.${item.minLevel} 解锁`
                        : afford
                          ? '买！'
                          : '星星不够'}
                  </button>
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-xs font-bold text-cocoa-400 text-center leading-relaxed">
            星星怎么来：学会一个单词 +1 ⭐ · 小测 +5 ⭐ · 周挑战礼包 +30 ⭐（每天最多拿 30 ⭐）
          </p>
        </Modal>
      )}

      {/* ───────── 弹窗：改名 ───────── */}
      {renaming && (
        <Modal title="✏️ 给柯基起个名字" onClose={() => setRenaming(false)}>
          <div className="flex gap-3">
            <input
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void doRename();
              }}
              maxLength={12}
              placeholder="比如：糯米"
              className="flex-1 min-w-0 rounded-2xl border-2 border-sakura-200 bg-white px-5 py-3.5 text-lg font-semibold text-cocoa-700 placeholder:text-cocoa-300 outline-none focus:border-sakura-400"
              style={{ fontSize: 18 }}
            />
            <button
              type="button"
              onClick={() => void doRename()}
              className="rounded-2xl bg-gradient-to-b from-pink-400 to-pink-500 text-white px-6 text-base font-extrabold min-h-[56px] shadow-[0_4px_0_0_#DB4E73] active:translate-y-0.5 active:shadow-none transition-all"
            >
              好啦
            </button>
          </div>
        </Modal>
      )}

      {/* ───────── 弹窗：柯基日记（模块三 3.3） ───────── */}
      {diaryOpen && (
        <Modal
          title="📖 柯基日记"
          onClose={() => setDiaryOpen(false)}
          extra={
            <span className="rounded-full bg-sakura-100 text-cocoa-500 px-3 py-1.5 text-xs font-extrabold">
              {corgi.diary.length} 条
            </span>
          }
        >
          {/* 写一句贴心话 */}
          <div className="flex gap-2.5">
            <input
              value={diaryDraft}
              onChange={(e) => setDiaryDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void doAddDiary();
              }}
              maxLength={60}
              placeholder="给柯基说一句贴心话…"
              className="flex-1 min-w-0 rounded-2xl border-2 border-sakura-200 bg-white px-4 py-3 text-base font-semibold text-cocoa-700 placeholder:text-cocoa-300 outline-none focus:border-sakura-400"
              style={{ fontSize: 16 }}
            />
            <button
              type="button"
              onClick={() => void doAddDiary()}
              disabled={!diaryDraft.trim()}
              className="rounded-2xl bg-gradient-to-b from-amber-400 to-amber-500 text-white px-5 text-sm font-extrabold min-h-[50px] shadow-[0_4px_0_0_#D9A13B] active:translate-y-0.5 active:shadow-none transition-all disabled:opacity-40 disabled:shadow-none"
            >
              写下
            </button>
          </div>

          {/* 日记列表（最新在前） */}
          <div className="mt-4 space-y-2.5 max-h-[46vh] overflow-y-auto pr-1">
            {corgi.diary.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-4xl mb-2 select-none">📖</p>
                <p className="text-sm font-bold text-cocoa-400">
                  日记还是空的，完成每日任务就会自动记录哦
                </p>
              </div>
            ) : (
              corgi.diary.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-start gap-3 rounded-2xl bg-white border-2 border-sakura-100 px-4 py-3"
                >
                  <span className="text-2xl select-none leading-none mt-0.5">{entry.mood}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-extrabold text-cocoa-400">{entry.date}</p>
                    <p className="text-sm font-semibold text-cocoa-700 mt-0.5 leading-snug">
                      {entry.text}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </Modal>
      )}

      {/* ───────── 弹窗：连续打卡奖励（模块三 3.1 解锁链） ───────── */}
      {streakOpen && (
        <Modal title="🔥 连续学习奖励" onClose={() => setStreakOpen(false)}>
          <p className="text-center text-lg font-extrabold text-cocoa-700 mb-4">
            已连续学习 <span className="text-2xl text-rose-500">{streakDays}</span> 天
          </p>
          <div className="space-y-3">
            {/* 3 天：洗澡动画 */}
            <div
              className={`flex items-center gap-3 rounded-2xl border-2 px-4 py-3.5 ${
                bathUnlocked ? 'bg-sky-50 border-sky-200' : 'bg-slate-50 border-slate-200 opacity-70'
              }`}
            >
              <span className="text-3xl select-none">🛁</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-extrabold text-cocoa-700">洗澡动画</p>
                <p className="text-[11px] font-bold text-cocoa-400 mt-0.5">
                  {bathUnlocked ? '已解锁！柯基页出现「洗澡」按钮' : `连续 ${STREAK_UNLOCK_BATH} 天解锁`}
                </p>
              </div>
              {bathUnlocked && (
                <button
                  type="button"
                  onClick={() => {
                    setStreakOpen(false);
                    void doBath();
                  }}
                  className="rounded-2xl bg-gradient-to-b from-sky-400 to-sky-500 text-white px-4 py-2.5 text-xs font-extrabold min-h-[44px] shadow-[0_3px_0_0_#3B9BD8] active:translate-y-0.5 transition-all"
                >
                  去洗澡
                </button>
              )}
            </div>

            {/* 7 天：免费星星披风 */}
            <div
              className={`flex items-center gap-3 rounded-2xl border-2 px-4 py-3.5 ${
                capeUnlocked
                  ? 'bg-amber-50 border-amber-200'
                  : 'bg-slate-50 border-slate-200 opacity-70'
              }`}
            >
              <span className="text-3xl select-none">🌟</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-extrabold text-cocoa-700">星星披风（免费）</p>
                <p className="text-[11px] font-bold text-cocoa-400 mt-0.5">
                  {ownsCape
                    ? '已拥有，可随时佩戴 ✨'
                    : capeUnlocked
                      ? '已解锁！点右边免费领取'
                      : `连续 ${STREAK_UNLOCK_CLOTHES} 天解锁`}
                </p>
              </div>
              {capeUnlocked && !ownsCape && (
                <button
                  type="button"
                  onClick={() => {
                    void doClaimCape();
                  }}
                  className="rounded-2xl bg-gradient-to-b from-amber-400 to-amber-500 text-white px-4 py-2.5 text-xs font-extrabold min-h-[44px] shadow-[0_3px_0_0_#D9A13B] active:translate-y-0.5 transition-all"
                >
                  免费领
                </button>
              )}
              {ownsCape && (
                <button
                  type="button"
                  onClick={() => void doEquip(corgi.equippedAccessory === 'cape' ? null : 'cape')}
                  className="rounded-2xl bg-white border-2 border-amber-300 text-amber-600 px-4 py-2.5 text-xs font-extrabold min-h-[44px]"
                >
                  {corgi.equippedAccessory === 'cape' ? '脱下' : '穿上'}
                </button>
              )}
            </div>

            {/* 30 天：飞行背景 */}
            <div
              className={`flex items-center gap-3 rounded-2xl border-2 px-4 py-3.5 ${
                flyingUnlocked
                  ? 'bg-violet-50 border-violet-200'
                  : 'bg-slate-50 border-slate-200 opacity-70'
              }`}
            >
              <span className="text-3xl select-none">☁️</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-extrabold text-cocoa-700">飞行背景</p>
                <p className="text-[11px] font-bold text-cocoa-400 mt-0.5">
                  {flyingUnlocked
                    ? '已解锁！柯基正在云海里飞 ☁️'
                    : `连续 ${STREAK_UNLOCK_FLYING} 天解锁（或商城 Lv.8 天使翅膀）`}
                </p>
              </div>
              {flyingUnlocked && (
                <span className="rounded-full bg-violet-500 text-white px-3 py-1.5 text-[11px] font-extrabold">
                  ✅ 生效中
                </span>
              )}
            </div>
          </div>
          <p className="mt-4 text-center text-[11px] font-bold text-cocoa-400">
            每天完成学习打卡，连续天数就 +1；中断会重新数哦
          </p>
        </Modal>
      )}

      {/* 隐藏链接：供屏幕阅读器/无 JS 场景返回 */}
      <Link to="/" className="sr-only">
        返回首页
      </Link>
    </div>
  );
}

/* ───────────────────────── 子组件 ───────────────────────── */

/** 每日任务 mini 双进度条（词/星） */
function MiniProgress({
  icon,
  label,
  done,
  goal,
  tone,
}: {
  icon: string;
  label: string;
  done: number;
  goal: number;
  tone: 'sky' | 'amber';
}) {
  const percent = Math.min(100, Math.round((done / goal) * 100));
  const reached = done >= goal;
  const barClass =
    tone === 'sky'
      ? 'bg-gradient-to-r from-sky-400 to-blue-500'
      : 'bg-gradient-to-r from-amber-400 to-orange-400';
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-extrabold text-cocoa-500">
          {icon} {label}
        </span>
        <span
          className={`text-[11px] font-extrabold ${reached ? 'text-emerald-600' : 'text-cocoa-500'}`}
        >
          {reached ? `${done}/${goal} ✅` : `${done}/${goal}`}
        </span>
      </div>
      <div className="h-2 rounded-full bg-white overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${reached ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' : barClass}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

/** 连续打卡解锁点：解锁点亮、未解锁灰色锁 */
function StreakDot({ emoji, unlocked, label }: { emoji: string; unlocked: boolean; label: string }) {
  return (
    <span
      title={unlocked ? `已解锁（${label}）` : `连续 ${label} 解锁`}
      className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-extrabold ${
        unlocked ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-400'
      }`}
    >
      <span className="select-none" style={{ filter: unlocked ? 'none' : 'grayscale(1)' }}>
        {emoji}
      </span>
      <span>{unlocked ? label : '🔒'}</span>
    </span>
  );
}

/** 洗澡泡泡雨：固定 12 颗泡泡错峰上飘（key 变化重启动画） */
function BubbleRain({ nonce }: { nonce: number }) {
  const bubbles = Array.from({ length: 12 }, (_, i) => ({
    left: 6 + ((i * 37) % 88),
    size: 14 + ((i * 13) % 26),
    delay: (i % 6) * 0.22,
    duration: 2 + (i % 4) * 0.35,
  }));
  return (
    <div className="absolute inset-0 z-[5] overflow-hidden pointer-events-none" aria-hidden="true">
      <style>{`
        @keyframes egw-bubble-rise {
          0% { transform: translateY(0) scale(0.6); opacity: 0; }
          15% { opacity: 0.9; }
          100% { transform: translateY(-110%) scale(1.15); opacity: 0; }
        }
      `}</style>
      {bubbles.map((b, i) => (
        <span
          key={`${nonce}-${i}`}
          className="absolute bottom-[-8%] rounded-full border-2 border-white/70"
          style={{
            left: `${b.left}%`,
            width: b.size,
            height: b.size,
            background:
              'radial-gradient(circle at 32% 30%, rgba(255,255,255,0.95), rgba(186,225,255,0.55) 60%, rgba(145,200,255,0.35))',
            boxShadow: 'inset -2px -2px 4px rgba(160,205,255,0.5)',
            animation: `egw-bubble-rise ${b.duration}s ease-out ${b.delay}s forwards`,
          }}
        />
      ))}
    </div>
  );
}

function StatusBar({
  icon,
  label,
  value,
  from,
  to,
}: {
  icon: string;
  label: string;
  value: number;
  from: string;
  to: string;
}) {
  return (
    <div className="rounded-2xl bg-slate-50 px-3 py-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-extrabold text-cocoa-500">
          {icon} {label}
        </span>
        <span className="text-[11px] font-extrabold text-cocoa-500">{value}</span>
      </div>
      <div className="h-2 rounded-full bg-white overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${value}%`, background: `linear-gradient(90deg, ${from}, ${to})` }}
        />
      </div>
    </div>
  );
}

function BigActionButton({
  emoji,
  label,
  onClick,
  className = '',
  disabled,
}: {
  emoji: string;
  label: string;
  onClick: () => void;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center justify-center gap-0.5 rounded-3xl text-white shadow-[0_5px_0_0_rgba(0,0,0,0.12)] transition-all active:translate-y-0.5 active:shadow-none disabled:opacity-50 min-h-[68px] ${className}`}
    >
      <span className="text-2xl leading-none select-none">{emoji}</span>
      <span className="text-xs font-extrabold">{label}</span>
    </button>
  );
}

function Modal({
  title,
  extra,
  onClose,
  children,
}: {
  title: string;
  extra?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-cocoa-700/45" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full sm:max-w-md max-h-[82vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-cream p-5 sm:p-6 animate-[grow-up_0.22s_ease-out]">
        <div className="flex items-center justify-between mb-4">
          <p className="text-lg font-extrabold text-cocoa-700">{title}</p>
          <div className="flex items-center gap-2">
            {extra}
            <button
              type="button"
              onClick={onClose}
              className="w-11 h-11 flex items-center justify-center rounded-2xl hover:bg-sakura-100 text-cocoa-500"
              aria-label="关闭"
            >
              <Icon name="close" size={20} />
            </button>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

function ItemButton({
  icon,
  name,
  desc,
  badge,
  onClick,
}: {
  icon: string;
  name: string;
  desc: string;
  badge?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex flex-col items-center rounded-3xl border-2 border-sakura-100 bg-white p-4 transition-all hover:border-sakura-300 hover:-translate-y-0.5 active:translate-y-0 min-h-[110px]"
    >
      {badge && (
        <span className="absolute top-2 right-2 rounded-full bg-butter-200 text-amber-700 px-2 py-0.5 text-[11px] font-extrabold">
          {badge}
        </span>
      )}
      <span className="text-4xl select-none mb-1">{icon}</span>
      <span className="text-sm font-extrabold text-cocoa-700">{name}</span>
      <span className="text-[11px] font-bold text-cocoa-400 mt-0.5">{desc}</span>
    </button>
  );
}

/** 背包列表：消耗品数量 + 永久饰品佩戴切换 */
function BackpackList({
  corgi,
  onEquip,
  emptyHint,
  compact,
}: {
  corgi: CorgiState;
  onEquip: (id: string | null) => void;
  emptyHint: string;
  compact?: boolean;
}) {
  const consumables = SHOP_ITEMS.filter(
    (i) => i.kind === 'consumable' && (corgi.inventory[i.id] ?? 0) > 0,
  );
  const permanents = SHOP_ITEMS.filter(
    (i) => i.kind !== 'consumable' && corgi.ownedPermanent.includes(i.id),
  );

  if (consumables.length === 0 && permanents.length === 0) {
    return <p className="text-xs font-bold text-cocoa-400 py-4 text-center">{emptyHint}</p>;
  }

  return (
    <div className={`space-y-2 ${compact ? '' : 'flex-1'}`}>
      {consumables.map((item) => (
        <div
          key={item.id}
          className="flex items-center gap-2.5 rounded-2xl bg-slate-50 px-3 py-2.5"
        >
          <span className="text-2xl select-none">{item.icon}</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-extrabold text-cocoa-600">{item.name}</p>
            <p className="text-[10px] font-bold text-cocoa-400">{item.desc}</p>
          </div>
          <span className="text-xs font-extrabold text-amber-600">
            ×{corgi.inventory[item.id] ?? 0}
          </span>
        </div>
      ))}
      {permanents.map((item) => {
        const isAccessory = item.kind === 'accessory';
        const worn = corgi.equippedAccessory === item.id;
        return (
          <div
            key={item.id}
            className="flex items-center gap-2.5 rounded-2xl bg-sakura-50 border-2 border-sakura-100 px-3 py-2.5"
          >
            <span className="text-2xl select-none">{item.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-extrabold text-cocoa-600">{item.name}</p>
              <p className="text-[10px] font-bold text-cocoa-400">
                {item.kind === 'scene' ? '已生效（场景升级）' : worn ? '佩戴中' : '可佩戴'}
              </p>
            </div>
            {isAccessory && (
              <button
                type="button"
                onClick={() => onEquip(worn ? null : item.id)}
                className={`rounded-xl px-3 py-2 text-[11px] font-extrabold transition-colors min-h-[36px] ${
                  worn
                    ? 'bg-white text-cocoa-500 border-2 border-sakura-200'
                    : 'bg-pink-400 text-white'
                }`}
              >
                {worn ? '摘下' : '戴'}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function EmptyBag({ text }: { text: string }) {
  return (
    <div className="py-8 text-center">
      <p className="text-4xl mb-2 select-none">🈳</p>
      <p className="text-sm font-bold text-cocoa-400">{text}</p>
    </div>
  );
}

export default CorgiPage;
