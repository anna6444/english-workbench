/**
 * 单元详情 —— 逐个学单词。
 *
 * 学习闭环：
 *   进入 → 卡片依次展示（点喇叭听发音）→ 点「学会了」标记掌握
 *        → 学完全部后到小测
 *
 * 单词数据来源：离线词库同步解析（0ms），所以翻卡时不会卡顿。
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { LearningUnit } from '@/types';
import { Button, Card, Chip, EmptyState, ProgressBar, SectionTitle } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { SpeakPair } from '@/components/SpeakButton';
import { useRepositories } from '@/repositories/RepositoriesProvider';
import { useSession } from '@/app/AuthProvider';
import { draftFromOffline, lookupOffline, normalizeWord } from '@/services/lookup/offlineDictionary';
import { splitSyllables } from '@/services/lookup/syllable';

interface WordCard {
  word: string;
  translation: string;
  phonetic: string;
  syllables: string[];
  pos?: string;
  exampleEn?: string;
  exampleZh?: string;
  emoji: string;
  /** 该生是否已学过 */
  learned: boolean;
}

export function UnitDetailPage() {
  const { unitId } = useParams<{ unitId: string }>();
  const repos = useRepositories();
  const { currentStudentId } = useSession();
  const navigate = useNavigate();

  const [unit, setUnit] = useState<LearningUnit | null>(null);
  const [cards, setCards] = useState<WordCard[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);

  /* ── 载入单元与词卡 ── */
  useEffect(() => {
    if (!unitId || !currentStudentId) return;
    let alive = true;
    void (async () => {
      const [u, progress, wrongs, vocab] = await Promise.all([
        repos.unit.get(unitId),
        repos.progress.get(currentStudentId),
        repos.wrongBook.listByStudent(currentStudentId),
        repos.vocabulary.listByStudent(currentStudentId),
      ]);
      if (!alive || !u) return;

      const learnedSet = new Set(progress.units[unitId]?.learnedWords ?? []);
      void wrongs; // 预留给后续「本单元错题」提示

      const list: WordCard[] = u.coreWords.map((raw) => {
        const w = normalizeWord(raw);
        const entry = lookupOffline(w);
        if (entry) {
          const d = draftFromOffline(entry);
          return {
            word: w,
            translation: d.translation,
            phonetic: d.phonetic,
            syllables: d.syllables,
            pos: d.pos,
            exampleEn: d.exampleEn,
            exampleZh: d.exampleZh,
            emoji: d.imageEmoji,
            learned: learnedSet.has(raw) || learnedSet.has(w),
          };
        }
        // 离线未收录 → 看学生词库里有没有（可能之前查过）
        const inLib = vocab.find((v) => v.word === w);
        return {
          word: w,
          translation: inLib?.translation ?? '暂无翻译',
          phonetic: inLib?.phonetic ?? '/—/',
          syllables: inLib?.syllables ?? splitSyllables(w),
          pos: inLib?.pos,
          exampleEn: inLib?.exampleEn,
          exampleZh: inLib?.exampleZh,
          emoji: inLib?.imageEmoji ?? '📘',
          learned: learnedSet.has(raw) || learnedSet.has(w),
        };
      });

      setUnit(u);
      setCards(list);
      // 定位到第一个没学的词
      const firstUnlearned = list.findIndex((c) => !c.learned);
      setIndex(firstUnlearned >= 0 ? firstUnlearned : 0);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [repos, unitId, currentStudentId]);

  const current = cards[index];
  const learnedCount = useMemo(() => cards.filter((c) => c.learned).length, [cards]);
  const percent = cards.length ? Math.round((learnedCount / cards.length) * 100) : 0;

  /** 标记当前词已学会 */
  async function markLearned() {
    if (!currentStudentId || !unitId || !unit || !current) return;
    setMarking(true);
    try {
      await repos.progress.markWordLearned(
        currentStudentId,
        unitId,
        current.word,
        unit.coreWords.length,
      );
      // 同时写入单词库并记一次答对，帮助掌握度累积
      const existing = await repos.vocabulary.findByWord(currentStudentId, current.word);
      if (!existing) {
        const added = await repos.vocabulary.addBatch(currentStudentId, [
          {
            word: current.word,
            translation: current.translation,
            phonetic: current.phonetic,
            syllables: current.syllables,
            pos: current.pos,
            exampleEn: current.exampleEn,
            exampleZh: current.exampleZh,
            imageEmoji: current.emoji,
            unitId,
            lookupStatus: 'offline',
            lookupSource: 'offline',
            isMastered: false,
            practiceCount: 0,
            correctCount: 0,
            correctStreak: 0,
          },
        ]);
        if (added[0]) {
          await repos.vocabulary.recordPractice(currentStudentId, added[0].id, true);
        }
      } else {
        await repos.vocabulary.recordPractice(currentStudentId, existing.id, true);
      }
      await repos.reward.addStars(currentStudentId, 1);

      // 本地更新状态（避免整页重载）
      setCards((prev) =>
        prev.map((c, i) => (i === index ? { ...c, learned: true } : c)),
      );
      // 自动跳到下一个未学的词
      const next = cards.findIndex((c, i) => i > index && !c.learned);
      if (next >= 0) setIndex(next);
      else if (index < cards.length - 1) setIndex(index + 1);
    } finally {
      setMarking(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="h-24 rounded-3xl bg-white animate-pulse" />
        <div className="h-96 rounded-3xl bg-white animate-pulse" />
      </div>
    );
  }

  if (!unit || !current) {
    return (
      <Card>
        <EmptyState
          emoji="🔍"
          title="没找到这个单元"
          desc="它可能被删除了，回单元列表看看吧。"
          action={
            <Button tone="sky" icon="arrowLeft" onClick={() => navigate('/units')}>
              回单元列表
            </Button>
          }
        />
      </Card>
    );
  }

  const allLearned = learnedCount === cards.length;
  const atFirst = index === 0;
  const atLast = index === cards.length - 1;

  return (
    <div className="space-y-5">
      {/* 顶部：单元信息 + 进度 */}
      <Card className="p-5 sm:p-6">
        <div className="flex items-center gap-4 mb-5">
          <Link
            to="/units"
            className="w-11 h-11 flex items-center justify-center rounded-2xl hover:bg-slate-100 text-slate-500 shrink-0"
            aria-label="返回单元列表"
          >
            <Icon name="arrowLeft" size={22} />
          </Link>
          <span className="text-4xl leading-none select-none">{unit.coverEmoji}</span>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-extrabold text-slate-800 truncate">{unit.titleZh}</h1>
            <p className="text-sm font-semibold text-slate-400 truncate">{unit.title}</p>
          </div>
          <Chip tone={allLearned ? 'grass' : 'sky'} size="sm">
            {learnedCount} / {cards.length}
          </Chip>
        </div>
        <ProgressBar percent={percent} tone={allLearned ? 'grass' : 'sky'} />
        <p className="mt-2.5 text-xs font-bold text-slate-400">
          第 {index + 1} 个词 · 已学会 {learnedCount} 个
        </p>
      </Card>

      {/* 单词卡 */}
      <Card className="p-6 sm:p-8">
        <div className="flex flex-col items-center text-center">
          <span className="text-7xl sm:text-8xl leading-none select-none mb-5">
            {current.emoji}
          </span>

          <div className="flex items-center gap-2.5 mb-2">
            {current.learned && (
              <Chip tone="grass" size="sm">
                <Icon name="check" size={12} />
                已学会
              </Chip>
            )}
            {current.pos && <Chip tone="slate" size="sm">{current.pos}</Chip>}
          </div>

          <h2 className="text-4xl sm:text-5xl font-extrabold text-slate-800 break-all">
            {current.word}
          </h2>
          <p className="text-lg font-semibold text-slate-400 mt-2">{current.phonetic}</p>

          {/* 音节 */}
          {current.syllables.length > 1 && (
            <div className="flex items-center justify-center flex-wrap gap-2 mt-4">
              {current.syllables.map((s, i) => (
                <span
                  key={i}
                  className="rounded-2xl bg-amber-50 border-2 border-amber-200 px-3.5 py-1.5 text-base font-extrabold text-amber-700"
                >
                  {s}
                </span>
              ))}
            </div>
          )}

          <p className="text-2xl font-extrabold text-slate-700 mt-5">{current.translation}</p>

          {/* 例句 */}
          {current.exampleEn && (
            <div className="w-full max-w-md mt-6 rounded-3xl bg-sky-50 border-2 border-sky-100 p-5">
              <p className="text-lg font-bold text-slate-700 leading-relaxed">
                {current.exampleEn}
              </p>
              {current.exampleZh && (
                <p className="text-sm text-slate-400 font-semibold mt-2">
                  {current.exampleZh}
                </p>
              )}
              <div className="mt-4 flex justify-center">
                <SpeakPair text={current.exampleEn} size="sm" />
              </div>
            </div>
          )}

          {/* 单词朗读 */}
          <div className="mt-6">
            <SpeakPair text={current.word} size="lg" />
          </div>
        </div>
      </Card>

      {/* 操作区 */}
      <div className="flex items-center gap-3">
        <Button
          tone="plain"
          size="md"
          icon="arrowLeft"
          disabled={atFirst}
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          className="flex-1"
        >
          上一个
        </Button>
        <Button
          tone="plain"
          size="md"
          iconRight="arrowRight"
          disabled={atLast}
          onClick={() => setIndex((i) => Math.min(cards.length - 1, i + 1))}
          className="flex-1"
        >
          下一个
        </Button>
      </div>

      <Button
        tone={current.learned ? 'plain' : 'grass'}
        size="lg"
        icon={current.learned ? 'check' : 'star'}
        block
        disabled={marking}
        onClick={() => void markLearned()}
      >
        {marking ? '记录中…' : current.learned ? '再学一遍（+1 星）' : '我学会了（+1 星）'}
      </Button>

      {allLearned && (
        <div className="rounded-3xl bg-emerald-50 border-2 border-emerald-200 p-6 text-center animate-grow-up">
          <p className="text-3xl mb-2 select-none">🎉</p>
          <p className="text-lg font-extrabold text-emerald-700 mb-4">
            这个单元全部学完啦，去挑战小测吧！
          </p>
          <Button
            tone="grass"
            size="md"
            icon="target"
            onClick={() => navigate('/exam')}
          >
            去挑战小测
          </Button>
        </div>
      )}
    </div>
  );
}

export default UnitDetailPage;
