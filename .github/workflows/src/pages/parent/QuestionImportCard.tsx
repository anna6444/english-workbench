/**
 * 题库批量导入卡（模块一 1.3：老师粘贴文本 → 批量入题库）。
 *
 * 流程：粘贴文本 → 实时解析预览（题目数 + 逐行错误提示）→ 选归属单元（可选）→ 确认导入。
 * 纯前端解析（questionImportParser），导入走 QuestionRepository.addBatch。
 */

import { useEffect, useMemo, useState } from 'react';
import type { LearningUnit } from '@/types';
import { Button, Card, Chip } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { useRepositories } from '@/repositories/RepositoriesProvider';
import {
  parseQuestionText,
  QUESTION_IMPORT_SAMPLE,
} from '@/services/questions/questionImportParser';

export function QuestionImportCard({ onImported }: { onImported: (msg: string) => void }) {
  const repos = useRepositories();
  const [text, setText] = useState('');
  const [units, setUnits] = useState<LearningUnit[]>([]);
  const [unitId, setUnitId] = useState<string>('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void repos.unit.listOrdered().then((list) => {
      setUnits(list);
      if (list[0]) setUnitId(list[0].id);
    });
  }, [repos]);

  /** 实时解析（每敲一个字符重新解析，纯同步计算，量级在千行内毫无压力） */
  const parsed = useMemo(() => parseQuestionText(text, unitId || undefined), [text, unitId]);

  async function doImport() {
    if (parsed.questions.length === 0) return;
    setBusy(true);
    try {
      const created = await repos.question.addBatch(parsed.questions);
      onImported(`成功导入 ${created.length} 道题${unitId ? `（已挂到所选单元）` : ''}`);
      setText('');
    } catch (e) {
      console.error('[QuestionImport] 导入失败', e);
      onImported('导入失败，请检查内容后重试');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <Card className="p-5 sm:p-6 space-y-5">
        {/* 格式说明 */}
        <div className="rounded-3xl bg-violet-50 border-2 border-violet-100 p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl select-none">📋</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-extrabold text-violet-700">一行一题，竖线分隔</p>
              <code className="block mt-2 rounded-xl bg-white px-3 py-2 text-xs font-bold text-cocoa-600 overflow-x-auto whitespace-nowrap">
                题干|选项A|选项B|选项C|选项D|答案|解析
              </code>
              <p className="text-xs font-semibold text-cocoa-500 mt-2 leading-relaxed">
                · 答案写选项原文或 A/B/C/D 字母；解析可省略<br />
                · 以 <code className="font-extrabold">choice</code> 或 <code className="font-extrabold">fill</code> 开头可指定题型（默认选择题）<br />
                · <code className="font-extrabold">#</code> 开头的行是注释，空行忽略
              </p>
              <button
                type="button"
                onClick={() => setText(QUESTION_IMPORT_SAMPLE)}
                className="mt-3 rounded-xl bg-white border-2 border-violet-200 text-violet-600 px-4 py-2 text-xs font-extrabold min-h-[40px] hover:border-violet-300 transition-colors"
              >
                填入示例试试
              </button>
            </div>
          </div>
        </div>

        {/* 粘贴区 */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-extrabold text-cocoa-500">粘贴题目文本</label>
            {text.trim() && (
              <Chip tone={parsed.errors.length ? 'rose' : 'grass'} size="sm">
                {parsed.questions.length} 题可导入
                {parsed.errors.length > 0 && ` · ${parsed.errors.length} 行有误`}
              </Chip>
            )}
          </div>
          <textarea
            rows={8}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={'What color is the apple?|red|blue|green|yellow|A|Apples are usually red.\n（点上面的「填入示例试试」看完整格式）'}
            className="w-full rounded-2xl border-2 border-slate-200 bg-white px-5 py-4 text-sm font-semibold text-cocoa-700 placeholder:text-cocoa-300 outline-none focus:border-violet-400 resize-y leading-relaxed"
            style={{ fontSize: 14 }}
          />
        </div>

        {/* 错误行提示 */}
        {parsed.errors.length > 0 && (
          <div className="rounded-2xl bg-rose-50 border-2 border-rose-100 p-4 space-y-1.5 max-h-40 overflow-y-auto">
            {parsed.errors.map((e) => (
              <p key={e.line} className="text-xs font-bold text-rose-600">
                第 {e.line} 行：{e.reason}
              </p>
            ))}
          </div>
        )}

        {/* 预览首题 */}
        {parsed.questions.length > 0 && (
          <div className="rounded-2xl bg-slate-50 border-2 border-slate-100 p-4">
            <p className="text-xs font-bold text-cocoa-400 mb-2">预览第 1 题</p>
            <p className="text-sm font-extrabold text-cocoa-700">{parsed.questions[0].question}</p>
            <div className="flex flex-wrap gap-2 mt-2">
              {parsed.questions[0].options.map((o) => (
                <span
                  key={o}
                  className={`rounded-xl px-3 py-1.5 text-xs font-extrabold border-2 ${
                    o === parsed.questions[0].correctAnswer
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                      : 'bg-white border-slate-200 text-cocoa-500'
                  }`}
                >
                  {o === parsed.questions[0].correctAnswer ? '✓ ' : ''}
                  {o}
                </span>
              ))}
            </div>
            <p className="text-xs font-semibold text-cocoa-400 mt-2">
              解析：{parsed.questions[0].explanation}
            </p>
          </div>
        )}

        {/* 单元归属 + 导入 */}
        <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <div className="flex-1">
            <label className="block text-sm font-extrabold text-cocoa-500 mb-2">
              归属单元（影响单元小测抽题范围）
            </label>
            <select
              value={unitId}
              onChange={(e) => setUnitId(e.target.value)}
              className="w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3.5 text-base font-semibold text-cocoa-700 outline-none focus:border-violet-400 min-h-[58px]"
              style={{ fontSize: 16 }}
            >
              <option value="">（不挂单元，进公共题库）</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.titleZh}
                </option>
              ))}
            </select>
          </div>
          <Button
            tone="grape"
            size="lg"
            icon="upload"
            disabled={busy || parsed.questions.length === 0}
            onClick={() => void doImport()}
          >
            {busy ? '导入中…' : `导入 ${parsed.questions.length} 道题`}
          </Button>
        </div>

        <p className="text-xs font-bold text-cocoa-400 leading-relaxed">
          <Icon name="info" size={13} className="inline mr-1 -mt-0.5" />
          导入的题会进入共享题库，单元小测、闯关练习会自动从中抽题。数据保存在本机浏览器，可用家长视图的「数据备份」导出。
        </p>
      </Card>
    </div>
  );
}

export default QuestionImportCard;
