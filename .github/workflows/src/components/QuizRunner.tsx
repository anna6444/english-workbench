/**
 * QuizRunner —— 通用答题器。
 *
 * 听力理解、阅读理解、单元小测、错题复习全部复用它，
 * 避免四套答题逻辑各写一遍（也就避免了四处不同的判分 bug）。
 *
 * 判分规则：
 *   答对 → 记一次正确；若这题在错题本里，连续答对 +1
 *   答错 → 立刻写入错题本（含题目快照，题库改了也能复习）
 *
 * 反馈设计（低龄要点）：
 *   选完立刻给结果，不等全部答完 —— 即时反馈才有成就感
 *   答错时展示解析 + 朗读按钮，把「错」变成「学」
 *
 * v2 柯基陪伴（模块三 3.3）：
 *   答题全程小柯基陪伴在侧（表情随对错变化）；
 *   答对随机欢呼「太棒了！你真是天才！」、答错温柔鼓励「别灰心，我们再试一次！」
 *   （语音按频率播报，避免每题都说话太吵）；
 *   真正「学会」一个词（连对达标）→ 柯基每日任务 +1 词并检查任务达成。
 */

import { useRef, useState } from 'react';
import type { Question } from '@/types';
import { CORGI_CHEER_RIGHT, CORGI_CHEER_WRONG } from '@/types';
import { Button, Card, Chip, ProgressBar } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { SpeakButton } from '@/components/SpeakButton';
import { useRepositories } from '@/repositories/RepositoriesProvider';
import { useGlobalSpeech } from '@/services/speech/SpeechProvider';

export interface QuizRunnerProps {
  questions: Question[];
  studentId: string;
  /** 用于结果页标题，如「单元一小测」 */
  title: string;
  /** 全部答完后回调（传入得分） */
  onFinished?: (result: { score: number; total: number }) => void;
  /** 是否展示逐题进度条 */
  showProgress?: boolean;
}

interface AnswerState {
  picked: string | null;
  isCorrect: boolean | null;
}

export function QuizRunner({
  questions,
  studentId,
  title,
  onFinished,
  showProgress = true,
}: QuizRunnerProps) {
  const repos = useRepositories();
  const speech = useGlobalSpeech();

  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswerState[]>(() =>
    questions.map(() => ({ picked: null, isCorrect: null })),
  );
  const [finished, setFinished] = useState(false);
  const [saving, setSaving] = useState(false);

  /* ── 柯基陪伴状态（模块三 3.3）── */
  const [corgiMood, setCorgiMood] = useState<'idle' | 'happy' | 'worried'>('idle');
  /** 语音频率控制：答对每 3 次播 1 次、答错每 2 次播 1 次（防聒噪） */
  const cheerCounter = useRef(0);

  const pickOne = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];

  const total = questions.length;
  const q = questions[index];
  const cur = answers[index];
  const answeredCount = answers.filter((a) => a.picked !== null).length;
  const correctCount = answers.filter((a) => a.isCorrect === true).length;
  const maxScore = questions.reduce((s, x) => s + x.points, 0);
  const gotScore = questions.reduce(
    (s, x, i) => s + (answers[i].isCorrect ? x.points : 0),
    0,
  );

  /** 选择答案 —— 立即判分并落库 */
  async function pick(option: string) {
    if (cur.picked !== null || saving) return;

    const isCorrect = option === q.correctAnswer;
    const next = answers.map((a, i) =>
      i === index ? { picked: option, isCorrect } : a,
    );
    setAnswers(next);

    /* 柯基陪伴反馈：表情立刻变 + 按频率播语音 */
    if (isCorrect) {
      setCorgiMood('happy');
      cheerCounter.current += 1;
      if (cheerCounter.current % 3 === 1) {
        speech.speakZh(pickOne(CORGI_CHEER_RIGHT), 1);
      }
    } else {
      setCorgiMood('worried');
      if (cheerCounter.current % 2 === 0) {
        speech.speakZh(pickOne(CORGI_CHEER_WRONG), 0.95);
      }
    }
    window.setTimeout(() => setCorgiMood('idle'), 2600);

    setSaving(true);
    try {
      if (isCorrect) {
        // 答对：若错题本里有，连续答对 +1（达阈值自动掌握）
        const r = await repos.wrongBook.recordCorrect(studentId, q.id);
        // 星星经济：真正「学会」（连对达标自动掌握）才 +1 星
        if (r.justMastered) {
          await repos.reward.addStars(studentId, 1);
          // 柯基每日任务 +1 词，并检查任务是否达成（5 词 + 10 星 → 属性回满）
          await repos.corgi.recordLearnedWord(studentId);
        }
      } else {
        // 答错：写入错题本（带题目快照）
        await repos.wrongBook.addWrong(studentId, q);
      }
    } catch (e) {
      console.error('[QuizRunner] 记录答题结果失败', e);
    } finally {
      setSaving(false);
    }
  }

  function nextQuestion() {
    if (index < total - 1) {
      setIndex((i) => i + 1);
    } else {
      setFinished(true);
      onFinished?.({ score: gotScore, total: maxScore });
      void repos.progress.addStudyMinutes(studentId, Math.max(1, Math.round(total * 0.5)));
    }
  }

  function restart() {
    setAnswers(questions.map(() => ({ picked: null, isCorrect: null })));
    setIndex(0);
    setFinished(false);
  }

  /* ───────── 结果页 ───────── */
  if (finished) {
    const percent = maxScore > 0 ? Math.round((gotScore / maxScore) * 100) : 0;
    const great = percent >= 80;
    const ok = percent >= 60;

    return (
      <Card className="p-6 sm:p-8 text-center animate-grow-up">
        <p className="text-6xl mb-4 select-none">
          {great ? '🏆' : ok ? '💪' : '🌱'}
        </p>
        <h3 className="text-2xl font-extrabold text-slate-800 mb-2">
          {great ? '太棒啦！' : ok ? '做得不错！' : '再练一练会更好'}
        </h3>
        <p className="text-base font-bold text-slate-500 mb-6">{title}</p>

        <div className="inline-flex items-baseline gap-2 rounded-3xl bg-sky-50 border-2 border-sky-100 px-8 py-5 mb-6">
          <span className="text-4xl font-extrabold text-sky-600">{gotScore}</span>
          <span className="text-lg font-bold text-slate-400">/ {maxScore} 分</span>
        </div>

        <div className="grid grid-cols-2 gap-3.5 mb-7 text-left">
          <div className="rounded-2xl bg-emerald-50 border-2 border-emerald-100 p-4">
            <p className="text-xs font-bold text-slate-500 mb-1">答对</p>
            <p className="text-2xl font-extrabold text-emerald-600">{correctCount} 题</p>
          </div>
          <div className="rounded-2xl bg-rose-50 border-2 border-rose-100 p-4">
            <p className="text-xs font-bold text-slate-500 mb-1">答错</p>
            <p className="text-2xl font-extrabold text-rose-600">
              {total - correctCount} 题
            </p>
          </div>
        </div>

        {total - correctCount > 0 && (
          <p className="text-sm font-semibold text-slate-500 mb-6 leading-relaxed">
            答错的题已经自动收进错题本，随时可以重新练。
          </p>
        )}

        <Button tone="sky" size="md" icon="refresh" onClick={restart}>
          再练一次
        </Button>
      </Card>
    );
  }

  /* ───────── 答题页 ───────── */
  const answered = cur.picked !== null;

  return (
    <div className="space-y-5">
      {/* 进度 + 柯基陪伴 */}
      {showProgress && (
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-sm font-extrabold text-slate-500">
              第 {index + 1} 题 / 共 {total} 题
            </span>
            <div className="flex items-center gap-2">
              {/* 柯基陪伴（模块三 3.3）：答题时守在旁边，表情随对错变化 */}
              <span
                className={`text-2xl select-none transition-transform duration-300 ${
                  corgiMood === 'happy'
                    ? 'scale-125 -translate-y-1'
                    : corgiMood === 'worried'
                      ? 'scale-95'
                      : ''
                }`}
                title={corgiMood === 'happy' ? '柯基在为你欢呼！' : corgiMood === 'worried' ? '柯基在为你加油' : '柯基陪你一起答题'}
              >
                {corgiMood === 'happy' ? '🥳' : corgiMood === 'worried' ? '🥺' : '🐶'}
              </span>
              <Chip tone="sun" size="sm">
                已得 {gotScore} 分
              </Chip>
            </div>
          </div>
          <ProgressBar percent={(answeredCount / total) * 100} tone="sky" height={10} />
        </div>
      )}

      <Card className="p-5 sm:p-7">
        {/* 配图 */}
        {q.image && (
          <div className="flex flex-col items-center mb-5">
            <span className="text-6xl leading-none select-none mb-2.5">
              {q.image.emoji}
            </span>
            <span className="text-xs font-bold text-slate-400">{q.image.labelZh}</span>
          </div>
        )}

        {/* 阅读短文 */}
        {q.passage && (
          <div className="rounded-3xl bg-amber-50 border-2 border-amber-100 p-5 mb-5">
            <div className="flex items-center gap-2 mb-3">
              <Icon name="bookOpen" size={18} className="text-amber-600" />
              <span className="text-xs font-extrabold text-amber-700">读一读</span>
            </div>
            <p className="text-lg font-bold text-slate-700 leading-loose">{q.passage}</p>
            <div className="mt-3.5">
              <SpeakButton text={q.passage} size="sm" tone="sun" label="朗读短文" />
            </div>
          </div>
        )}

        {/* 听力题：播放按钮 */}
        {q.type === 'listening' && q.audioText && (
          <div className="rounded-3xl bg-violet-50 border-2 border-violet-100 p-5 mb-5 text-center">
            <p className="text-xs font-extrabold text-violet-700 mb-3">
              先听一听，再选答案
            </p>
            <div className="flex items-center justify-center gap-2.5">
              <Button
                tone="grape"
                size="md"
                icon="volume"
                onClick={() => {
                  speech.unlock();
                  speech.speakStandard(q.audioText!);
                }}
              >
                听一遍
              </Button>
              <Button
                tone="plain"
                size="md"
                icon="volumeSlow"
                onClick={() => {
                  speech.unlock();
                  speech.speakSlow(q.audioText!);
                }}
              >
                慢慢读
              </Button>
            </div>
          </div>
        )}

        {/* 题干 */}
        <h3 className="text-xl sm:text-2xl font-extrabold text-slate-800 leading-relaxed mb-6">
          {q.question}
        </h3>

        {/* 选项 */}
        <div className="space-y-3">
          {q.options.map((opt) => {
            const isPicked = cur.picked === opt;
            const isCorrectOpt = opt === q.correctAnswer;
            let cls =
              'border-slate-200 bg-white hover:border-sky-300 hover:bg-sky-50';
            if (answered) {
              if (isCorrectOpt) cls = 'border-emerald-400 bg-emerald-50';
              else if (isPicked) cls = 'border-rose-400 bg-rose-50';
              else cls = 'border-slate-100 bg-white opacity-55';
            }

            return (
              <button
                key={opt}
                type="button"
                disabled={answered}
                onClick={() => void pick(opt)}
                className={`w-full flex items-center gap-4 rounded-3xl border-2 px-5 py-4 text-left transition-all min-h-[68px] ${
                  answered ? '' : 'active:scale-[0.99]'
                } ${cls}`}
              >
                <span
                  className={`flex items-center justify-center w-9 h-9 rounded-full text-sm font-extrabold shrink-0 ${
                    answered && isCorrectOpt
                      ? 'bg-emerald-500 text-white'
                      : answered && isPicked
                        ? 'bg-rose-500 text-white'
                        : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {answered && isCorrectOpt ? (
                    <Icon name="check" size={18} />
                  ) : answered && isPicked ? (
                    <Icon name="close" size={18} />
                  ) : (
                    String.fromCharCode(65 + q.options.indexOf(opt))
                  )}
                </span>
                <span className="flex-1 text-lg font-bold text-slate-700 break-words">
                  {opt}
                </span>
              </button>
            );
          })}
        </div>

        {/* 即时反馈 */}
        {answered && (
          <div
            className={`mt-6 rounded-3xl border-2 p-5 animate-grow-up ${
              cur.isCorrect
                ? 'bg-emerald-50 border-emerald-200'
                : 'bg-rose-50 border-rose-200'
            }`}
          >
            <div className="flex items-center gap-2.5 mb-3">
              <Icon
                name={cur.isCorrect ? 'check' : 'info'}
                size={20}
                className={cur.isCorrect ? 'text-emerald-600' : 'text-rose-600'}
              />
              <span
                className={`text-base font-extrabold ${
                  cur.isCorrect ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                {cur.isCorrect ? '答对啦！+1 ⭐' : '再看看这道题'}
              </span>
            </div>

            {!cur.isCorrect && (
              <p className="text-base font-bold text-slate-600 mb-3">
                正确答案是：<span className="text-emerald-700">{q.correctAnswer}</span>
              </p>
            )}

            <p className="text-base text-slate-600 font-semibold leading-relaxed">
              {q.explanation}
            </p>

            <div className="mt-4">
              <SpeakButton
                text={q.explanation}
                size="sm"
                tone={cur.isCorrect ? 'grass' : 'plain'}
                zh
                label="听解析"
              />
            </div>
          </div>
        )}
      </Card>

      {/* 下一题 */}
      {answered && (
        <Button tone="sky" size="lg" block iconRight="arrowRight" onClick={nextQuestion}>
          {index < total - 1 ? '下一题' : '看结果'}
        </Button>
      )}
    </div>
  );
}

export default QuizRunner;
