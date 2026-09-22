/**
 * 考试挑战 —— 单元小测。
 *
 * 选一套卷子 → 答题（复用 QuizRunner）→ 自动判分存档。
 * 成绩会写进 ExamRecord，家长视图能看到历史成绩。
 */

import { useEffect, useMemo, useState } from 'react';
import type { ExamPaper, ExamRecord, Question } from '@/types';
import { Button, Card, Chip, EmptyState, SectionTitle } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { QuizRunner } from '@/components/QuizRunner';
import { useRepositories } from '@/repositories/RepositoriesProvider';
import { useSession } from '@/app/AuthProvider';

interface PaperWithQuestions {
  paper: ExamPaper;
  questions: Question[];
}

export function ExamPage() {
  const repos = useRepositories();
  const sid = useSession().currentStudentId;

  const [papers, setPapers] = useState<PaperWithQuestions[]>([]);
  const [records, setRecords] = useState<ExamRecord[]>([]);
  const [running, setRunning] = useState<PaperWithQuestions | null>(null);
  const [loading, setLoading] = useState(true);
  const [finishedScore, setFinishedScore] = useState<{
    score: number;
    total: number;
    paperTitle: string;
  } | null>(null);

  const reloadRecords = useMemo(
    () => async (studentId: string) => repos.examRecord.listByStudent(studentId),
    [repos],
  );

  useEffect(() => {
    if (!sid) return;
    let alive = true;
    void (async () => {
      const [list, allQ, recs] = await Promise.all([
        repos.paper.listOrdered(),
        repos.question.list(),
        reloadRecords(sid),
      ]);
      if (!alive) return;

      const withQ: PaperWithQuestions[] = list
        .map((paper) => ({
          paper,
          questions: paper.questionIds
            .map((qid) => allQ.find((q) => q.id === qid))
            .filter((q): q is Question => Boolean(q)),
        }))
        .filter((x) => x.questions.length > 0);

      setPapers(withQ);
      setRecords(recs.sort((a, b) => b.finishedAt - a.finishedAt));
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [sid, repos, reloadRecords]);

  /** 交卷：写成绩记录 */
  async function handleFinish(score: number, total: number) {
    if (!sid || !running) return;
    await repos.examRecord.saveRecord(sid, {
      studentId: sid,
      paperId: running.paper.id,
      paperTitle: running.paper.titleZh,
      answers: [],
      score,
      totalScore: total,
      finishedAt: Date.now(),
      durationSec: 0,
    });
    // 星星经济：完成单元小测固定 +5 颗星星（柯基商城的口粮来源）
    await repos.reward.addStars(sid, 5);
    if (score >= total && total > 0) {
      await repos.reward.tryAwardBadge(sid, 'exam-perfect');
    }
    await repos.reward.tryAwardBadge(sid, 'exam-first');
    setFinishedScore({ score, total, paperTitle: running.paper.titleZh });
    setRunning(null);
    const recs = await reloadRecords(sid);
    setRecords(recs.sort((a, b) => b.finishedAt - a.finishedAt));
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-20 rounded-3xl bg-white animate-pulse" />
        {[0, 1].map((i) => (
          <div key={i} className="h-32 rounded-3xl bg-white animate-pulse" />
        ))}
      </div>
    );
  }

  /* ── 答题中 ── */
  if (running && sid) {
    return (
      <div className="space-y-5">
        <Card className="p-5">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setRunning(null)}
              className="w-11 h-11 flex items-center justify-center rounded-2xl hover:bg-slate-100 text-slate-500 shrink-0"
              aria-label="退出考试"
            >
              <Icon name="arrowLeft" size={22} />
            </button>
            <span className="text-4xl leading-none select-none">
              {running.paper.coverEmoji}
            </span>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-extrabold text-slate-800 truncate">
                {running.paper.titleZh}
              </h1>
              <p className="text-sm font-semibold text-slate-400">
                {running.questions.length} 道题 · 建议 {running.paper.durationMin} 分钟
              </p>
            </div>
          </div>
        </Card>

        <QuizRunner
          questions={running.questions}
          studentId={sid}
          title={running.paper.titleZh}
          onFinished={({ score, total }) => void handleFinish(score, total)}
        />
      </div>
    );
  }

  /* ── 刚考完 ── */
  if (finishedScore) {
    return (
      <div className="space-y-5">
        <Card className="p-6 sm:p-8 text-center animate-grow-up">
          <p className="text-6xl mb-4 select-none">📝</p>
          <h2 className="text-2xl font-extrabold text-slate-800 mb-2">成绩已记录</h2>
          <p className="text-base font-bold text-slate-500 mb-6">
            {finishedScore.paperTitle}
          </p>
          <div className="inline-flex items-baseline gap-2 rounded-3xl bg-emerald-50 border-2 border-emerald-100 px-8 py-5 mb-7">
            <span className="text-4xl font-extrabold text-emerald-600">
              {finishedScore.score}
            </span>
            <span className="text-lg font-bold text-slate-400">
              / {finishedScore.total} 分
            </span>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button tone="sky" size="md" icon="chart" onClick={() => setFinishedScore(null)}>
              回到考试列表
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  /* ── 卷子列表 ── */
  return (
    <div className="space-y-6">
      <SectionTitle icon="target" title="考试挑战" />
      <p className="text-base text-slate-500 font-semibold -mt-2 leading-relaxed">
        准备好就来挑战，答错不要紧，错题会帮你记着。
      </p>

      {papers.length === 0 ? (
        <Card>
          <EmptyState emoji="📄" title="暂时没有试卷" desc="老师出卷后会出现在这里。" />
        </Card>
      ) : (
        <div className="space-y-4">
          {papers.map(({ paper, questions }) => {
            const best = records
              .filter((r) => r.paperId === paper.id)
              .sort((a, b) => b.score - a.score)[0];
            const totalScore = questions.reduce((s, q) => s + q.points, 0);

            return (
              <Card key={paper.id} className="p-5 sm:p-6">
                <div className="flex items-start gap-4 sm:gap-5">
                  <span className="text-5xl leading-none select-none shrink-0">
                    {paper.coverEmoji}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <Chip tone="sky" size="sm">
                        {questions.length} 道题
                      </Chip>
                      <Chip tone="slate" size="sm">
                        满分 {totalScore}
                      </Chip>
                      {best && (
                        <Chip tone="grass" size="sm">
                          最好 {best.score} 分
                        </Chip>
                      )}
                    </div>
                    <h3 className="text-lg font-extrabold text-slate-800">
                      {paper.titleZh}
                    </h3>
                    <p className="text-sm font-semibold text-slate-400">{paper.title}</p>
                    <p className="text-xs font-bold text-slate-400 mt-2.5">
                      约 {paper.durationMin} 分钟
                    </p>

                    <div className="mt-4">
                      <Button
                        tone="sun"
                        size="sm"
                        icon="target"
                        onClick={() => setRunning({ paper, questions })}
                      >
                        开始挑战
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* 历史成绩 */}
      {records.length > 0 && (
        <section>
          <SectionTitle icon="chart" title="我的考试成绩" />
          <Card className="p-5">
            <div className="space-y-3">
              {records.slice(0, 8).map((r) => {
                const percent = r.totalScore
                  ? Math.round((r.score / r.totalScore) * 100)
                  : 0;
                return (
                  <div
                    key={r.id}
                    className="flex items-center gap-4 rounded-2xl bg-slate-50 px-4 py-3.5"
                  >
                    <span className="text-2xl select-none">
                      {percent >= 80 ? '🏆' : percent >= 60 ? '💪' : '🌱'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-extrabold text-slate-700 truncate">
                        {r.paperTitle}
                      </p>
                      <p className="text-xs font-semibold text-slate-400 mt-0.5">
                        {new Date(r.finishedAt).toLocaleDateString('zh-CN')}
                      </p>
                    </div>
                    <span className="text-lg font-extrabold text-slate-600">
                      {r.score}
                      <span className="text-sm text-slate-400">/{r.totalScore}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>
        </section>
      )}
    </div>
  );
}

export default ExamPage;
