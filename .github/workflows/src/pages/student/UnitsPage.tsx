/**
 * 单元学习 —— 单元列表。
 *
 * 每个单元展示进度条与词数，孩子一眼看出「还差多少学完」。
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { LearningUnit, ProgressState } from '@/types';
import { Card, Chip, ProgressBar, SectionTitle } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { useRepositories } from '@/repositories/RepositoriesProvider';
import { useSession } from '@/app/AuthProvider';

export function UnitsPage() {
  const repos = useRepositories();
  const { currentStudentId } = useSession();
  const [units, setUnits] = useState<LearningUnit[]>([]);
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentStudentId) return;
    let alive = true;
    void (async () => {
      const [list, p] = await Promise.all([
        repos.unit.listOrdered(),
        repos.progress.get(currentStudentId),
      ]);
      if (!alive) return;
      setUnits(list);
      setProgress(p);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [repos, currentStudentId]);

  return (
    <div className="space-y-6">
      <SectionTitle icon="book" title="单元学习" />

      {loading ? (
        <div className="space-y-4">
          {[0, 1].map((i) => (
            <div key={i} className="h-44 rounded-3xl bg-white animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {units.map((u, idx) => {
            const up = progress?.units[u.id];
            const learned = up?.learnedWords.length ?? 0;
            const percent = up?.percent ?? 0;
            const done = percent >= 100;

            return (
              <Link key={u.id} to={`/units/${u.id}`} className="block">
                <Card interactive className="p-6">
                  <div className="flex items-start gap-5">
                    <span className="text-5xl leading-none select-none shrink-0">
                      {u.coverEmoji}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2.5 mb-2">
                        <Chip tone="sky" size="sm">
                          第 {idx + 1} 单元
                        </Chip>
                        {done && (
                          <Chip tone="grass" size="sm">
                            <Icon name="check" size={12} />
                            已完成
                          </Chip>
                        )}
                      </div>
                      <h3 className="text-xl font-extrabold text-slate-800">{u.titleZh}</h3>
                      <p className="text-sm font-semibold text-slate-400 mt-1">{u.title}</p>
                      <p className="text-sm text-slate-500 font-semibold mt-2.5 leading-relaxed">
                        {u.description}
                      </p>

                      <div className="mt-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-slate-400">
                            已学 {learned} / {u.coreWords.length} 个词
                          </span>
                          <span className="text-xs font-extrabold text-sky-600">
                            {percent}%
                          </span>
                        </div>
                        <ProgressBar percent={percent} tone={done ? 'grass' : 'sky'} />
                      </div>

                      <div className="flex items-center gap-3 mt-4 text-xs font-bold text-slate-400">
                        <span className="inline-flex items-center gap-1.5">
                          <Icon name="book" size={14} />
                          {u.coreWords.length} 个核心词
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <Icon name="target" size={14} />
                          约 {u.estimatedMinutes} 分钟
                        </span>
                      </div>
                    </div>
                    <Icon name="arrowRight" size={22} className="text-slate-300 shrink-0 mt-1" />
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default UnitsPage;
