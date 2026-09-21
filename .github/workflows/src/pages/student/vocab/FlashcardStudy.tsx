/**
 * 文件夹闪卡学习模式（模块二 2.2：文件夹内「开始学习」= 今日打卡任务）。
 *
 * 玩法：
 *   一张一张翻卡片 —— 正面：emoji + 单词 + 音标（自动朗读，可再点小喇叭）
 *   点击卡片翻面看翻译和例句
 *   「我会了」→ 记一次答对（连对 3 次自动掌握，掌握瞬间 +1 ⭐ + 柯基每日任务 +1 词）
 *   「再学学」→ 记一次答错（连对清零），卡片轮到队尾再来
 *
 * 数据流：所有写操作完成后通过 onFinished 通知父页 reload —— 单向。
 */

import { useMemo, useState } from 'react';
import type { VocabFolder, VocabularyWord } from '@/types';
import { Icon } from '@/components/Icon';
import { SpeakPair } from '@/components/SpeakButton';
import { useRepositories } from '@/repositories/RepositoriesProvider';
import { useGlobalSpeech } from '@/services/speech/SpeechProvider';

export function FlashcardStudy({
  words,
  folderName,
  folderEmoji,
  onExit,
  onFinished,
}: {
  words: VocabularyWord[];
  folderName: string;
  folderEmoji: string;
  onExit: () => void;
  /** 每次答题落库后回调（父页刷新列表与柯基任务态） */
  onFinished: () => void;
}) {
  const repos = useRepositories();
  const speech = useGlobalSpeech();

  /** 队列：未学完的词（「再学学」的塞回队尾） */
  const [queue, setQueue] = useState<VocabularyWord[]>(() => [...words]);
  const [flipped, setFlipped] = useState(false);
  const [learned, setLearned] = useState(0);
  const [starToast, setStarToast] = useState<string | null>(null);

  const current = queue[0];
  const total = words.length;
  const donePercent = total > 0 ? Math.round(((total - queue.length) / total) * 100) : 0;

  /** 本轮已答对的词 id（用于结果统计去重展示） */
  const masteredThisRound = useMemo(() => new Set<string>(), []);

  if (!current) {
    /* ── 全部学完：结果页 ── */
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-cocoa-700/45" aria-hidden="true" />
        <div className="relative w-full sm:max-w-sm rounded-3xl bg-cream p-6 text-center animate-[grow-up_0.25s_ease-out]">
          <p className="text-6xl mb-3 select-none">🎉</p>
          <p className="text-2xl font-extrabold text-cocoa-700 mb-1.5">这一轮学完啦！</p>
          <p className="text-sm font-bold text-cocoa-500 mb-5">
            {folderEmoji} {folderName} · 本轮掌握 {learned} 个词
            {learned > 0 && ` · 获得 ${learned} ⭐`}
          </p>
          <button
            type="button"
            onClick={onExit}
            className="w-full rounded-2xl bg-gradient-to-b from-sky-400 to-sky-500 text-white px-4 py-3.5 text-base font-extrabold min-h-[56px] shadow-[0_4px_0_0_#2E9BD6] active:translate-y-0.5 active:shadow-none transition-all"
          >
            回到文件夹
          </button>
        </div>
      </div>
    );
  }

  /* ── 答题 ── */
  async function answer(knows: boolean) {
    const sid = current.studentId;
    setFlipped(false);

    try {
      const { justMastered } = await repos.vocabulary.recordPractice(sid, current.id, knows);
      if (justMastered) {
        // 学会瞬间：星星 + 柯基每日任务 + 徽章
        setLearned((n) => n + 1);
        masteredThisRound.add(current.id);
        await repos.reward.addStars(sid, 1);
        await repos.corgi.recordLearnedWord(sid);
        await repos.reward.tryAwardBadge(sid, 'first-word');
        setStarToast('🎉 学会了！+1 ⭐ 柯基好开心！');
        window.setTimeout(() => setStarToast(null), 2200);
      }
    } catch (e) {
      console.error('[Flashcard] 记录练习失败', e);
    }

    // 出队；「再学学」的塞回队尾（还有 3 张以上时轮换，避免死循环单卡）
    setQueue((prev) => {
      const [head, ...rest] = prev;
      if (!knows && rest.length >= 1) return [...rest, head];
      return rest;
    });
    onFinished();
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col">
      <div className="absolute inset-0 bg-gradient-to-b from-sky-50 via-cream to-sakura-100" aria-hidden="true" />

      {/* 顶栏 */}
      <div className="relative flex items-center gap-3 p-4">
        <button
          type="button"
          onClick={onExit}
          className="w-11 h-11 flex items-center justify-center rounded-2xl bg-white/90 border-2 border-sakura-100 text-cocoa-500"
          aria-label="退出学习"
        >
          <Icon name="close" size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-extrabold text-cocoa-600 truncate">
            {folderEmoji} {folderName}
          </p>
          <div className="mt-1.5 h-2 rounded-full bg-white/80 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-sky-400 to-violet-400 transition-all duration-500"
              style={{ width: `${donePercent}%` }}
            />
          </div>
        </div>
        <span className="text-sm font-extrabold text-cocoa-500 shrink-0">
          剩 {queue.length} 张
        </span>
      </div>

      {/* 卡片 */}
      <div className="relative flex-1 flex items-center justify-center p-4 overflow-y-auto">
        <button
          type="button"
          onClick={() => setFlipped((v) => !v)}
          className={`w-full max-w-sm rounded-[2rem] border-4 p-8 text-center transition-all duration-300 active:scale-[0.98] ${
            flipped
              ? 'bg-white border-violet-200 shadow-soft-lg'
              : 'bg-white border-sky-200 shadow-soft-lg'
          }`}
        >
          {!flipped ? (
            <>
              <p className="text-7xl mb-4 select-none">{current.imageEmoji}</p>
              <p className="text-4xl font-extrabold text-cocoa-700 break-words">{current.word}</p>
              <p className="mt-2 text-base font-semibold text-cocoa-400">{current.phonetic}</p>
              <p className="mt-6 text-xs font-bold text-cocoa-300">点卡片看意思 👆</p>
            </>
          ) : (
            <>
              <p className="text-3xl font-extrabold text-cocoa-700">{current.translation}</p>
              {current.syllables.length > 1 && (
                <div className="flex items-center justify-center flex-wrap gap-1.5 mt-3">
                  {current.syllables.map((s, i) => (
                    <span
                      key={i}
                      className="rounded-xl bg-sky-50 border-2 border-sky-100 px-2.5 py-1 text-sm font-extrabold text-sky-600"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              )}
              {current.exampleEn && (
                <div className="mt-4 rounded-2xl bg-slate-50 p-3.5 text-left">
                  <p className="text-sm font-bold text-cocoa-600">{current.exampleEn}</p>
                  {current.exampleZh && (
                    <p className="text-xs text-cocoa-400 font-semibold mt-1">{current.exampleZh}</p>
                  )}
                </div>
              )}
              <p className="mt-4 text-xs font-bold text-cocoa-300">点卡片翻回去 👆</p>
            </>
          )}
        </button>
      </div>

      {/* 底部操作 */}
      <div className="relative p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              speech.unlock();
              speech.speakStandard(current.word);
            }}
            className="w-14 h-14 shrink-0 flex items-center justify-center rounded-3xl bg-white border-2 border-sky-200 text-sky-500 shadow-[0_4px_0_0_#CFE6F5] active:translate-y-0.5 active:shadow-none transition-all"
            aria-label="朗读单词"
          >
            <Icon name="volume" size={24} />
          </button>
          <button
            type="button"
            onClick={() => void answer(false)}
            className="flex-1 rounded-3xl bg-gradient-to-b from-butter-300 to-butter-400 text-white px-4 py-4 text-lg font-extrabold min-h-[68px] shadow-[0_5px_0_0_#E8B93E] active:translate-y-0.5 active:shadow-none transition-all"
          >
            🌱 再学学
          </button>
          <button
            type="button"
            onClick={() => void answer(true)}
            className="flex-1 rounded-3xl bg-gradient-to-b from-grass-300 to-grass-400 text-white px-4 py-4 text-lg font-extrabold min-h-[68px] shadow-[0_5px_0_0_#7FC98B] active:translate-y-0.5 active:shadow-none transition-all"
          >
            ✅ 我会了
          </button>
        </div>
        {/* 隐藏朗读组件保留序列朗读能力 */}
        <div className="sr-only">
          <SpeakPair text={current.word} />
        </div>
      </div>

      {/* 星星提示 */}
      {starToast && (
        <div className="fixed left-1/2 -translate-x-1/2 top-20 z-[60] rounded-2xl bg-cocoa-700/90 text-white px-5 py-3 text-sm font-bold shadow-soft-lg animate-grow-up">
          {starToast}
        </div>
      )}
    </div>
  );
}

export default FlashcardStudy;
