/**
 * 写作工坊 —— 看图写句。
 *
 * 主观题无法自动判分（这是范围边界里明确不做的），
 * 所以流程是：孩子写 → 提交 → 家长在辅导视图人工批改。
 *
 * 孩子侧能获得的即时帮助：
 *   - 中文提示 + emoji 图
 *   - 点喇叭听「参考答案怎么读」（但不直接展示英文，避免抄）
 *   - 提交后能看到家长的评语与得分
 */

import { useEffect, useMemo, useState } from 'react';
import type { Assignment, Homework, Submission } from '@/types';
import { Button, Card, Chip, EmptyState, SectionTitle } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { SpeakButton } from '@/components/SpeakButton';
import { useRepositories } from '@/repositories/RepositoriesProvider';
import { useSession } from '@/app/AuthProvider';

interface WorkItem {
  assignment: Assignment;
  homework: Homework;
  submission: Submission | null;
}

export function WritingPage() {
  const repos = useRepositories();
  const sid = useSession().currentStudentId;
  const [items, setItems] = useState<WorkItem[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useMemo(
    () =>
      async function load(studentId: string) {
        const [assignments, homeworks] = await Promise.all([
          repos.assignment.listByStudent(studentId),
          repos.homework.list(),
        ]);
        const writing = assignments.filter((a) => a.homeworkType === 'writing');
        const out: WorkItem[] = [];
        for (const a of writing) {
          const hw = homeworks.find((h) => h.id === a.homeworkId);
          if (!hw) continue;
          const sub = await repos.submission.listByAssignment(studentId, a.id);
          out.push({ assignment: a, homework: hw, submission: sub });
        }
        return out;
      },
    [repos],
  );

  useEffect(() => {
    if (!sid) return;
    let alive = true;
    void (async () => {
      const list = await reload(sid);
      if (!alive) return;
      setItems(list);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [sid, reload]);

  const opened = items.find((i) => i.assignment.id === openId) ?? null;

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-20 rounded-3xl bg-white animate-pulse" />
        <div className="h-60 rounded-3xl bg-white animate-pulse" />
      </div>
    );
  }

  if (opened && sid) {
    return (
      <WritingEditor
        item={opened}
        studentId={sid}
        onBack={async () => {
          setOpenId(null);
          const list = await reload(sid);
          setItems(list);
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <SectionTitle icon="pencil" title="写作工坊" />
      <p className="text-base text-slate-500 font-semibold -mt-2 leading-relaxed">
        看图片写一句英文。写不好没关系，老师会帮你改。
      </p>

      {items.length === 0 ? (
        <Card>
          <EmptyState
            emoji="✍️"
            title="还没有写作任务"
            desc="等家长或老师布置后，这里就会出现题目。"
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {items.map((it) => (
            <Card
              key={it.assignment.id}
              interactive
              onClick={() => setOpenId(it.assignment.id)}
              className="p-5 sm:p-6"
            >
              <div className="flex items-center gap-4">
                <span className="text-4xl leading-none select-none shrink-0">✍️</span>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <StatusChip item={it} />
                    <Chip tone="slate" size="sm">
                      {it.homework.prompts?.length ?? 0} 个句子
                    </Chip>
                  </div>
                  <h3 className="text-lg font-extrabold text-slate-800">
                    {it.assignment.homeworkTitle}
                  </h3>
                  <p className="text-xs font-bold text-slate-400 mt-2">
                    {it.submission?.teacherScore != null
                      ? `已批改 · 得分 ${it.submission.teacherScore}`
                      : '还没提交'}
                  </p>
                </div>
                <Icon name="arrowRight" size={22} className="text-slate-300 shrink-0" />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusChip({ item }: { item: WorkItem }) {
  if (item.submission?.teacherScore != null) {
    return (
      <Chip tone="grass" size="sm">
        <Icon name="check" size={12} />
        已批改
      </Chip>
    );
  }
  if (item.submission) {
    return (
      <Chip tone="sun" size="sm">
        等批改
      </Chip>
    );
  }
  return (
    <Chip tone="sky" size="sm">
      待完成
    </Chip>
  );
}

/* ───────────────────────── 写作编辑器 ───────────────────────── */

function WritingEditor({
  item,
  studentId,
  onBack,
}: {
  item: WorkItem;
  studentId: string;
  onBack: () => void | Promise<void>;
}) {
  const repos = useRepositories();
  const prompts = item.homework.prompts ?? [];
  const [answers, setAnswers] = useState<string[]>(() =>
    prompts.map(() => (item.submission ? '' : '')),
  );
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(Boolean(item.submission));
  const [showSample, setShowSample] = useState<number | null>(null);

  const graded = item.submission?.teacherScore != null;
  const filledCount = answers.filter((a) => a.trim()).length;

  async function submit() {
    if (filledCount === 0) return;
    setSubmitting(true);
    try {
      const content = prompts
        .map((p, i) => `${i + 1}. ${p.promptZh}\n${answers[i].trim() || '(未作答)'}`)
        .join('\n\n');
      await repos.submission.submit(studentId, item.assignment.id, content);
      await repos.assignment.updateForStudent(studentId, item.assignment.id, {
        status: 'submitted',
      });
      await repos.progress.addStudyMinutes(studentId, 10);
      await repos.reward.addStars(studentId, 3);
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => void onBack()}
            className="w-11 h-11 flex items-center justify-center rounded-2xl hover:bg-slate-100 text-slate-500 shrink-0"
            aria-label="返回列表"
          >
            <Icon name="arrowLeft" size={22} />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-extrabold text-slate-800 truncate">
              {item.assignment.homeworkTitle}
            </h1>
            <p className="text-sm font-semibold text-slate-400 mt-0.5">
              {prompts.length} 个句子
            </p>
          </div>
        </div>
        <p className="mt-4 rounded-2xl bg-sky-50 border-2 border-sky-100 p-4 text-base text-slate-600 font-semibold leading-relaxed">
          {item.homework.instructions}
        </p>
      </Card>

      {/* 批改结果 */}
      {graded && item.submission && (
        <Card className="p-6 bg-emerald-50 border-emerald-200">
          <div className="flex items-center gap-2.5 mb-3">
            <Icon name="check" size={20} className="text-emerald-600" />
            <span className="text-lg font-extrabold text-emerald-700">老师批改啦</span>
            <span className="ml-auto text-2xl font-extrabold text-emerald-600">
              {item.submission.teacherScore} 分
            </span>
          </div>
          {item.submission.teacherComment && (
            <p className="text-base text-slate-700 font-semibold leading-relaxed">
              {item.submission.teacherComment}
            </p>
          )}
        </Card>
      )}

      {/* 逐题作答 */}
      <div className="space-y-4">
        {prompts.map((p, i) => (
          <Card key={i} className="p-5 sm:p-6">
            <div className="flex items-start gap-4 mb-4">
              <span className="text-5xl leading-none select-none shrink-0">{p.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-extrabold text-slate-400 mb-1">
                  第 {i + 1} 句
                </p>
                <p className="text-lg font-extrabold text-slate-700">{p.promptZh}</p>
              </div>
            </div>

            {submitted ? (
              <div className="space-y-3">
                <div className="rounded-2xl bg-slate-50 border-2 border-slate-100 p-4">
                  <p className="text-xs font-bold text-slate-400 mb-1.5">我的答案</p>
                  <p className="text-lg font-bold text-slate-700">
                    {answers[i]?.trim() || '（未作答）'}
                  </p>
                </div>
                {item.submission && (
                  <div className="rounded-2xl bg-amber-50 border-2 border-amber-100 p-4">
                    <p className="text-xs font-bold text-amber-700 mb-1.5">
                      参考说法（听听就好）
                    </p>
                    <div className="flex items-center gap-3">
                      <SpeakButton text={p.sampleEn} size="sm" tone="sun" label="" />
                      <span className="text-base font-bold text-slate-600">{p.sampleEn}</span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
                <input
                  value={answers[i] ?? ''}
                  onChange={(e) =>
                    setAnswers((prev) => {
                      const next = [...prev];
                      next[i] = e.target.value;
                      return next;
                    })
                  }
                  placeholder="在这里写英文句子…"
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  className="w-full rounded-2xl border-2 border-slate-200 bg-white px-5 py-4 text-base font-semibold text-slate-700 placeholder:text-slate-300 placeholder:font-normal outline-none focus:border-sky-400 transition-colors min-h-[62px]"
                />
                <button
                  type="button"
                  onClick={() => setShowSample(showSample === i ? null : i)}
                  className="mt-3 inline-flex items-center gap-2 text-sm font-extrabold text-slate-400 hover:text-sky-500 transition-colors min-h-[44px]"
                >
                  <Icon name="info" size={16} />
                  {showSample === i ? '收起提示' : '想不出来？听个提示'}
                </button>
                {showSample === i && (
                  <div className="mt-3 flex items-center gap-3 rounded-2xl bg-slate-50 p-4 animate-grow-up">
                    <SpeakButton
                      text={p.sampleEn.split(' ').slice(0, 2).join(' ')}
                      size="sm"
                      tone="plain"
                      label="开头是"
                    />
                    <span className="text-sm font-semibold text-slate-500">
                      这句话和「{p.promptZh}」有关，试着用简单词说出来。
                    </span>
                  </div>
                )}
              </>
            )}
          </Card>
        ))}
      </div>

      {!submitted && (
        <Button
          tone="grass"
          size="lg"
          block
          icon="check"
          disabled={filledCount === 0 || submitting}
          onClick={() => void submit()}
        >
          {submitting
            ? '提交中…'
            : filledCount === 0
              ? '先写一句再提交'
              : `提交这 ${filledCount} 句（+3 ⭐）`}
        </Button>
      )}

      {submitted && !graded && (
        <Card className="p-6 text-center">
          <p className="text-3xl mb-3 select-none">📮</p>
          <p className="text-base font-extrabold text-slate-700">
            已经交给老师啦，等批改就行
          </p>
          <p className="text-sm text-slate-400 font-semibold mt-2">
            批改结果会出现在这里
          </p>
        </Card>
      )}
    </div>
  );
}

export default WritingPage;
