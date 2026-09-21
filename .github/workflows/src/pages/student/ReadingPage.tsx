/**
 * 阅读世界 —— 绘本阅读。
 *
 * 一页一页翻，每页点喇叭听朗读，读完整本做一道小问题。
 * 新词可以一键收进单词库（读→积累的闭环）。
 */

import { useEffect, useMemo, useState } from 'react';
import type { PictureBook } from '@/types';
import { Button, Card, Chip, SectionTitle } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { SpeakButton, SpeakPair } from '@/components/SpeakButton';
import { useRepositories } from '@/repositories/RepositoriesProvider';
import { useSession } from '@/app/AuthProvider';
import { useGlobalSpeech } from '@/services/speech/SpeechProvider';
import {
  draftFromOffline,
  lookupOffline,
  normalizeWord,
  pickEmojiByWord,
} from '@/services/lookup/offlineDictionary';
import { splitSyllables } from '@/services/lookup/syllable';

const LEVEL_LABEL: Record<number, string> = { 1: '简单', 2: '中等', 3: '挑战' };
const LEVEL_TONE: Record<number, 'grass' | 'sun' | 'candy'> = {
  1: 'grass',
  2: 'sun',
  3: 'candy',
};

export function ReadingPage() {
  const repos = useRepositories();
  const { currentStudentId } = useSession();
  const [books, setBooks] = useState<PictureBook[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const list = await repos.reading.listOrdered();
      if (!alive) return;
      setBooks(list);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [repos]);

  const opened = useMemo(() => books.find((b) => b.id === openId) ?? null, [books, openId]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-20 rounded-3xl bg-white animate-pulse" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-28 rounded-3xl bg-white animate-pulse" />
        ))}
      </div>
    );
  }

  if (opened && currentStudentId) {
    return (
      <BookReader
        book={opened}
        studentId={currentStudentId}
        onBack={() => setOpenId(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <SectionTitle icon="bookOpen" title="阅读世界" />
      <p className="text-base text-slate-500 font-semibold -mt-2 leading-relaxed">
        一页一句，点小喇叭就能听。读完可以拿星星哦。
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {books.map((b) => (
          <Card key={b.id} interactive onClick={() => setOpenId(b.id)} className="p-5">
            <div className="flex items-start gap-4">
              <span className="text-5xl leading-none select-none shrink-0">
                {b.coverEmoji}
              </span>
              <div className="flex-1 min-w-0">
                <Chip tone={LEVEL_TONE[b.level]} size="sm">
                  {LEVEL_LABEL[b.level]}
                </Chip>
                <h3 className="text-lg font-extrabold text-slate-800 mt-1.5">
                  {b.titleZh}
                </h3>
                <p className="text-sm font-semibold text-slate-400">{b.title}</p>
                <p className="text-xs font-bold text-slate-400 mt-2.5">
                  {b.pages.length} 页 · {b.newWords.length} 个新词 · 约 {b.estimatedMinutes} 分钟
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ───────────────────────── 阅读器 ───────────────────────── */

function BookReader({
  book,
  studentId,
  onBack,
}: {
  book: PictureBook;
  studentId: string;
  onBack: () => void;
}) {
  const repos = useRepositories();
  const speech = useGlobalSpeech();
  const [page, setPage] = useState(0);
  const [quizDone, setQuizDone] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [added, setAdded] = useState(false);

  const total = book.pages.length;
  const p = book.pages[page];
  const atFirst = page === 0;
  const atLast = page === total - 1;

  /** 读完整本后把新词收进单词库（走离线词库解析，拿完整音标/翻译/音节） */
  async function collectWords() {
    const res = await repos.vocabulary.addBatch(
      studentId,
      book.newWords.map((raw) => {
        const w = normalizeWord(raw);
        const entry = lookupOffline(w);
        if (entry) {
          const d = draftFromOffline(entry);
          return {
            word: d.word,
            translation: d.translation,
            phonetic: d.phonetic,
            syllables: d.syllables,
            pos: d.pos,
            exampleEn: d.exampleEn,
            exampleZh: d.exampleZh,
            imageEmoji: d.imageEmoji,
            lookupStatus: 'offline' as const,
            lookupSource: 'offline' as const,
            isMastered: false,
            practiceCount: 0,
            correctCount: 0,
            correctStreak: 0,
          };
        }
        // 离线未收录（如 "get up" 这类短语）→ 用占位数据，稍后可在单词库联网补全
        return {
          word: w,
          translation: '暂无翻译',
          phonetic: '/—/',
          syllables: splitSyllables(w),
          pos: undefined,
          exampleEn: undefined,
          exampleZh: undefined,
          imageEmoji: pickEmojiByWord(w),
          lookupStatus: 'partial' as const,
          lookupSource: 'offline' as const,
          isMastered: false,
          practiceCount: 0,
          correctCount: 0,
          correctStreak: 0,
        };
      }),
    );
    setAdded(true);
    await repos.reward.addStars(studentId, 2);
    return res;
  }

  return (
    <div className="space-y-5">
      {/* 头部 */}
      <Card className="p-5">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onBack}
            className="w-11 h-11 flex items-center justify-center rounded-2xl hover:bg-slate-100 text-slate-500 shrink-0"
            aria-label="返回书架"
          >
            <Icon name="arrowLeft" size={22} />
          </button>
          <span className="text-4xl leading-none select-none">{book.coverEmoji}</span>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-extrabold text-slate-800 truncate">{book.titleZh}</h1>
            <p className="text-sm font-semibold text-slate-400">
              第 {page + 1} 页 / 共 {total} 页
            </p>
          </div>
        </div>
      </Card>

      {/* 绘本页 */}
      <Card className="p-8 sm:p-12">
        <div className="flex flex-col items-center text-center">
          <span className="text-[100px] sm:text-[120px] leading-none select-none mb-8">
            {p.emoji}
          </span>
          <p className="text-2xl sm:text-3xl font-extrabold text-slate-800 leading-relaxed mb-3">
            {p.en}
          </p>
          <p className="text-lg font-semibold text-slate-400">{p.zh}</p>
          <div className="mt-7">
            <SpeakPair text={p.en} size="lg" />
          </div>
        </div>
      </Card>

      {/* 翻页 */}
      <div className="flex items-center gap-3">
        <Button
          tone="plain"
          size="md"
          icon="arrowLeft"
          disabled={atFirst}
          onClick={() => setPage((i) => Math.max(0, i - 1))}
          className="flex-1"
        >
          上一页
        </Button>
        <Button
          tone={atLast ? 'plain' : 'candy'}
          size="md"
          iconRight="arrowRight"
          disabled={atLast}
          onClick={() => setPage((i) => Math.min(total - 1, i + 1))}
          className="flex-1"
        >
          下一页
        </Button>
      </div>

      {/* 读完后：整本朗读 + 新词 + 小问题 */}
      {atLast && (
        <div className="space-y-5 animate-grow-up">
          <Card className="p-6 text-center">
            <p className="text-3xl mb-3 select-none">🎉</p>
            <p className="text-lg font-extrabold text-slate-700 mb-4">读完啦！</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button
                tone="grape"
                size="md"
                icon="volume"
                onClick={() => {
                  speech.unlock();
                  speech.speak(book.pages.map((x) => x.en).join(' '), { rate: 0.75 });
                }}
              >
                整本听一遍
              </Button>
              <Button
                tone={added ? 'plain' : 'grass'}
                size="md"
                icon={added ? 'check' : 'plus'}
                disabled={added}
                onClick={() => void collectWords()}
              >
                {added ? '已收进单词库' : `收录 ${book.newWords.length} 个新词`}
              </Button>
            </div>
          </Card>

          {/* 新词预览 */}
          <section>
            <SectionTitle icon="cards" title="这本里的新词" />
            <div className="flex flex-wrap gap-2.5">
              {book.newWords.map((w) => (
                <span
                  key={w}
                  className="inline-flex items-center gap-2 rounded-2xl bg-white border-2 border-slate-100 px-4 py-2.5"
                >
                  <span className="text-base font-extrabold text-slate-700">{w}</span>
                  <SpeakButton text={w} size="sm" tone="plain" label="" />
                </span>
              ))}
            </div>
          </section>

          {/* 小问题 */}
          {book.question && (
            <section>
              <SectionTitle icon="target" title="读懂了没？" />
              <Card className="p-5 sm:p-6">
                <h3 className="text-lg font-extrabold text-slate-800 mb-5">
                  {book.question.question}
                </h3>
                <div className="space-y-3">
                  {book.question.options.map((opt) => {
                    const isCorrect = opt === book.question!.correctAnswer;
                    const isPicked = picked === opt;
                    let cls = 'border-slate-200 bg-white hover:border-sky-300';
                    if (quizDone) {
                      if (isCorrect) cls = 'border-emerald-400 bg-emerald-50';
                      else if (isPicked) cls = 'border-rose-400 bg-rose-50';
                      else cls = 'border-slate-100 opacity-55';
                    }
                    return (
                      <button
                        key={opt}
                        type="button"
                        disabled={quizDone}
                        onClick={() => {
                          setPicked(opt);
                          setQuizDone(true);
                          if (opt === book.question!.correctAnswer) {
                            void repos.reward.addStars(studentId, 2);
                          }
                        }}
                        className={`w-full rounded-2xl border-2 px-5 py-4 text-left text-lg font-bold text-slate-700 transition-all min-h-[64px] ${cls}`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
                {quizDone && (
                  <div className="mt-5 rounded-2xl bg-sky-50 border-2 border-sky-100 p-4 animate-grow-up">
                    <p className="text-base font-semibold text-slate-600 leading-relaxed">
                      {book.question.explanation}
                    </p>
                  </div>
                )}
              </Card>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

export default ReadingPage;
