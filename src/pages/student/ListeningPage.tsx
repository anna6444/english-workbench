/**
 * 听力电台 —— 听慢速英文 + 做理解题。
 *
 * 音频不依赖任何文件：文稿交给 useSpeech 慢速朗读（rate 0.7~0.8）。
 * 孩子可以先「整段听」，也可以「逐句听」，再答题。
 */

import { useEffect, useMemo, useState } from 'react';
import type { ListeningEpisode } from '@/types';
import { Button, Card, Chip, EmptyState, SectionTitle } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { SpeakButton, SpeakPair } from '@/components/SpeakButton';
import { useRepositories } from '@/repositories/RepositoriesProvider';
import { useSession } from '@/app/AuthProvider';
import { useGlobalSpeech } from '@/services/speech/SpeechProvider';
import { QuizRunner } from '@/components/QuizRunner';

const LEVEL_LABEL: Record<number, string> = { 1: '简单', 2: '中等', 3: '挑战' };
const LEVEL_TONE: Record<number, 'grass' | 'sun' | 'candy'> = {
  1: 'grass',
  2: 'sun',
  3: 'candy',
};

export function ListeningPage() {
  const repos = useRepositories();
  const sid = useSession().currentStudentId;
  const [episodes, setEpisodes] = useState<ListeningEpisode[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const list = await repos.listening.listOrdered();
      if (!alive) return;
      setEpisodes(list);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [repos]);

  const opened = useMemo(
    () => episodes.find((e) => e.id === openId) ?? null,
    [episodes, openId],
  );

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

  if (opened) {
    return (
      <EpisodePlayer
        episode={opened}
        studentId={sid ?? ''}
        onBack={() => setOpenId(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <SectionTitle icon="headphone" title="听力电台" />
      <p className="text-base text-slate-500 font-semibold -mt-2 leading-relaxed">
        慢慢听，不着急。听不懂就点「慢慢读」再听一遍。
      </p>

      <div className="space-y-4">
        {episodes.map((ep) => (
          <Card key={ep.id} interactive onClick={() => setOpenId(ep.id)} className="p-5 sm:p-6">
            <div className="flex items-center gap-4 sm:gap-5">
              <span className="text-5xl leading-none select-none shrink-0">
                {ep.coverEmoji}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <Chip tone={LEVEL_TONE[ep.level]} size="sm">
                    {LEVEL_LABEL[ep.level]}
                  </Chip>
                  <Chip tone="slate" size="sm">
                    {ep.questions.length} 道题
                  </Chip>
                </div>
                <h3 className="text-lg font-extrabold text-slate-800">{ep.titleZh}</h3>
                <p className="text-sm font-semibold text-slate-400">{ep.title}</p>
                <p className="text-xs font-bold text-slate-400 mt-2.5">
                  约 {ep.estimatedMinutes} 分钟 · 语速偏慢
                </p>
              </div>
              <Icon name="arrowRight" size={22} className="text-slate-300 shrink-0" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ───────────────────────── 播放器 ───────────────────────── */

function EpisodePlayer({
  episode,
  studentId,
  onBack,
}: {
  episode: ListeningEpisode;
  studentId: string;
  onBack: () => void;
}) {
  const speech = useGlobalSpeech();
  const [showZh, setShowZh] = useState(false);
  const [quizOpen, setQuizOpen] = useState(false);

  /** 按句子切开，逐句听 */
  const sentences = useMemo(
    () =>
      episode.audioText
        .split(/(?<=[.!?])\s+/)
        .map((s) => s.trim())
        .filter(Boolean),
    [episode.audioText],
  );

  return (
    <div className="space-y-5">
      <Card className="p-5 sm:p-6">
        <div className="flex items-center gap-4 mb-5">
          <button
            type="button"
            onClick={onBack}
            className="w-11 h-11 flex items-center justify-center rounded-2xl hover:bg-slate-100 text-slate-500 shrink-0"
            aria-label="返回列表"
          >
            <Icon name="arrowLeft" size={22} />
          </button>
          <span className="text-4xl leading-none select-none">{episode.coverEmoji}</span>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-extrabold text-slate-800 truncate">
              {episode.titleZh}
            </h1>
            <p className="text-sm font-semibold text-slate-400 truncate">{episode.title}</p>
          </div>
        </div>

        {/* 整段播放 */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            tone="grape"
            size="lg"
            icon="volume"
            onClick={() => {
              speech.unlock();
              speech.speak(episode.audioText, { rate: episode.speechRate });
            }}
            className="flex-1"
          >
            整段听一遍
          </Button>
          <Button
            tone="plain"
            size="lg"
            icon="volumeSlow"
            onClick={() => {
              speech.unlock();
              speech.speak(episode.audioText, { rate: Math.max(0.4, episode.speechRate - 0.2) });
            }}
            className="flex-1"
          >
            更慢一点
          </Button>
        </div>

        {/* 中文对照（默认藏起来，避免孩子直接看答案） */}
        <button
          type="button"
          onClick={() => setShowZh((v) => !v)}
          className="mt-4 w-full flex items-center justify-center gap-2 rounded-2xl bg-slate-50 py-3.5 text-sm font-extrabold text-slate-500 hover:bg-slate-100 transition-colors min-h-[52px]"
        >
          <Icon name={showZh ? 'close' : 'info'} size={18} />
          {showZh ? '收起中文对照' : '听不出来？点这里看中文'}
        </button>
        {showZh && (
          <p className="mt-3.5 rounded-2xl bg-slate-50 p-4 text-base text-slate-600 font-semibold leading-relaxed animate-grow-up">
            {episode.translationZh}
          </p>
        )}
      </Card>

      {/* 逐句听 */}
      <section>
        <SectionTitle icon="headphone" title="一句一句听" />
        <div className="space-y-3">
          {sentences.map((s, i) => (
            <Card key={i} className="p-4 sm:p-5">
              <div className="flex items-start gap-4">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-violet-100 text-violet-600 text-sm font-extrabold shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <p className="flex-1 text-base font-bold text-slate-700 leading-relaxed">
                  {s}
                </p>
              </div>
              <div className="mt-3.5 sm:pl-12">
                <SpeakPair text={s} size="sm" />
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* 理解题 */}
      <section>
        <SectionTitle icon="target" title="听懂了就答题" />
        {quizOpen ? (
          <QuizRunner
            questions={episode.questions}
            studentId={studentId}
            title={episode.titleZh}
            onFinished={() => setQuizOpen(false)}
          />
        ) : (
          <Card className="p-6 text-center">
            <p className="text-4xl mb-3 select-none">🎧</p>
            <p className="text-base font-bold text-slate-600 mb-5">
              一共 {episode.questions.length} 道题，答错会自动记进错题本
            </p>
            <Button tone="grape" size="md" icon="target" onClick={() => setQuizOpen(true)}>
              开始答题
            </Button>
          </Card>
        )}
      </section>

      {/* 隐藏但保留：单独的中文朗读按钮（家长辅导时可能用） */}
      <div className="hidden">
        <SpeakButton text={episode.translationZh} zh />
      </div>
    </div>
  );
}

export default ListeningPage;
