/**
 * 拍照/上传 OCR 识别导入弹窗（模块二 2.1）。
 *
 * 完整闭环：
 *   拍照/选图 → tesseract.js 本地识别（进度可见）→ 过滤只留英文
 *   → 【识别结果预览】可编辑卡片（词典 API 自动补全 + 手动改 + 删除 + 添加）
 *   → 点「确认导入」才真正入库（绝不静默写入孩子的单词库）
 *
 * 兜底设计：
 *   - 摄像头不可用 → 直接选图片文件
 *   - 识别失败/超时 → 提示重拍，或手动添加单词（不堵死流程）
 *   - 自动补全失败 → 保留占位（音标 /—/），孩子/家长可手动填
 */

import { useCallback, useRef, useState } from 'react';
import type { VocabFolder, VocabularyWord } from '@/types';
import { Icon } from '@/components/Icon';
import { useRepositories } from '@/repositories/RepositoriesProvider';
import { recognizeEnglishWords } from '@/services/ocr/ocrService';
import { resolveDraftImmediately, enhanceDraftOnline } from '@/services/lookup/lookupService';
import type { LookupDraft } from '@/types';

/** 预览阶段的单词草稿（带补全状态） */
interface OcrDraft extends LookupDraft {
  /** 自动补全状态 */
  enhancing: boolean;
}

type Phase = 'upload' | 'recognizing' | 'review';

export function OcrImportModal({
  sid,
  folders,
  defaultFolderId,
  onClose,
  onImported,
}: {
  sid: string;
  folders: VocabFolder[];
  defaultFolderId: string | null;
  onClose: () => void;
  onImported: (msg: string) => void;
}) {
  const repos = useRepositories();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<Phase>('upload');
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<OcrDraft[]>([]);
  const [importing, setImporting] = useState(false);
  const [targetFolder, setTargetFolder] = useState<string>(defaultFolderId ?? '');

  /* ── 开始识别 ── */
  const startRecognize = useCallback(async (file: File) => {
    setPhase('recognizing');
    setError(null);
    setProgress(0);
    setStatusText('正在加载识别引擎…');
    try {
      const words = await recognizeEnglishWords(file, (status, p) => {
        setStatusText(statusTextOf(status));
        setProgress(Math.round(p * 100));
      });
      if (words.length === 0) {
        setError('没认出英文单词。试试拍得更清楚一点，或者手动添加～');
        setPhase('upload');
        return;
      }

      // 第一段：离线词库同步填充（0ms，立刻有音标/翻译）
      const initial: OcrDraft[] = words.slice(0, 30).map((w) => ({
        ...resolveDraftImmediately(w).draft,
        enhancing: true,
      }));
      setDrafts(initial);
      setPhase('review');

      // 第二段：在线逐个补全（并发 3，避免词典 API 限流）
      void enhanceAll(initial);
    } catch (e) {
      console.error('[OCR] 识别失败', e);
      setError('识别出了点问题，请重试或改用手动添加。');
      setPhase('upload');
    }
  }, []);

  /** 后台并发补全：每个词独立更新，失败保留占位 */
  const enhanceAll = useCallback(
    async (list: OcrDraft[]) => {
      const CONCURRENCY = 3;
      const queue = [...list];
      const worker = async () => {
        while (queue.length > 0) {
          const item = queue.shift();
          if (!item) break;
          try {
            const { draft } = await enhanceDraftOnline(item.word, item);
            setDrafts((prev) =>
              prev.map((d) =>
                d.word === item.word
                  ? { ...draft, word: item.word, enhancing: false }
                  : d,
              ),
            );
          } catch {
            setDrafts((prev) =>
              prev.map((d) => (d.word === item.word ? { ...d, enhancing: false } : d)),
            );
          }
        }
      };
      await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
    },
    [],
  );

  /* ── 卡片编辑 ── */
  function updateDraft(word: string, patch: Partial<OcrDraft>) {
    setDrafts((prev) => prev.map((d) => (d.word === word ? { ...d, ...patch } : d)));
  }

  function removeDraft(word: string) {
    setDrafts((prev) => prev.filter((d) => d.word !== word));
  }

  function addEmptyDraft() {
    setDrafts((prev) => [
      ...prev,
      {
        word: '',
        translation: '',
        phonetic: '',
        syllables: [],
        imageEmoji: '📘',
        lookupStatus: 'partial',
        enhancing: false,
      },
    ]);
  }

  /* ── 确认导入 ── */
  async function doImport() {
    const valid = drafts.filter((d) => d.word.trim());
    if (valid.length === 0) {
      setError('至少要有一个单词才能导入哦');
      return;
    }
    setImporting(true);
    try {
      const inputs: Omit<VocabularyWord, 'id' | 'createdAt' | 'updatedAt' | 'studentId'>[] =
        valid.map((d) => ({
          word: d.word.trim().toLowerCase(),
          translation: d.translation.trim() || '暂无翻译',
          phonetic: d.phonetic.trim() || '/—/',
          syllables: d.syllables,
          pos: d.pos,
          exampleEn: d.exampleEn,
          exampleZh: d.exampleZh,
          imageEmoji: d.imageEmoji || '📘',
          folderId: targetFolder || null,
          lookupStatus: d.lookupStatus,
          lookupSource: d.lookupSource,
          isMastered: false,
          practiceCount: 0,
          correctCount: 0,
          correctStreak: 0,
        }));
      const created = await repos.vocabulary.addBatch(sid, inputs);
      const skipped = valid.length - created.length;
      onImported(
        `导入 ${created.length} 个单词${skipped > 0 ? `（${skipped} 个已在库中自动跳过）` : ''}` +
          (targetFolder ? '，已放进所选文件夹' : ''),
      );
      onClose();
    } catch (e) {
      console.error('[OCR] 导入失败', e);
      setError('导入失败，请重试');
    } finally {
      setImporting(false);
    }
  }

  const busy = phase === 'recognizing' || importing;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-cocoa-700/45" onClick={busy ? undefined : onClose} aria-hidden="true" />
      <div className="relative w-full sm:max-w-lg max-h-[88vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-cream p-5 sm:p-6 animate-[grow-up_0.22s_ease-out]">
        {/* 标题栏 */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-lg font-extrabold text-cocoa-700">📷 拍照识别单词</p>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="w-11 h-11 flex items-center justify-center rounded-2xl hover:bg-sakura-100 text-cocoa-500 disabled:opacity-40"
            aria-label="关闭"
          >
            <Icon name="close" size={20} />
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-2xl bg-rose-50 border-2 border-rose-100 px-4 py-3 text-sm font-bold text-rose-600">
            {error}
          </div>
        )}

        {/* ── 阶段一：上传 ── */}
        {phase === 'upload' && (
          <div className="space-y-4">
            <p className="text-sm font-semibold text-cocoa-500 leading-relaxed">
              拍下课本、单词卡或作业上的单词，自动识别出英文单词。
              识别在<b className="text-cocoa-700">本机完成</b>，不联网上传照片，完全免费。
            </p>
            <div className="grid grid-cols-2 gap-3.5">
              <button
                type="button"
                onClick={() => cameraRef.current?.click()}
                className="flex flex-col items-center rounded-3xl bg-sky-50 border-2 border-sky-200 p-5 transition-all hover:border-sky-300 active:translate-y-0.5 min-h-[130px]"
              >
                <span className="text-5xl mb-2 select-none">📷</span>
                <span className="text-base font-extrabold text-sky-600">拍照识别</span>
                <span className="text-xs font-bold text-cocoa-400 mt-1">拍单词页</span>
              </button>
              <button
                type="button"
                onClick={() => galleryRef.current?.click()}
                className="flex flex-col items-center rounded-3xl bg-violet-50 border-2 border-violet-200 p-5 transition-all hover:border-violet-300 active:translate-y-0.5 min-h-[130px]"
              >
                <span className="text-5xl mb-2 select-none">🖼️</span>
                <span className="text-base font-extrabold text-violet-600">选图片</span>
                <span className="text-xs font-bold text-cocoa-400 mt-1">从相册选</span>
              </button>
            </div>
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void startRecognize(f);
                e.target.value = '';
              }}
            />
            <input
              ref={galleryRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void startRecognize(f);
                e.target.value = '';
              }}
            />
            <p className="text-xs font-bold text-cocoa-400 text-center">
              首次使用需加载识别引擎（约 24MB），之后有缓存就快了
            </p>
          </div>
        )}

        {/* ── 阶段二：识别中 ── */}
        {phase === 'recognizing' && (
          <div className="py-10 text-center">
            <div className="text-6xl mb-4 select-none animate-[wiggle_1.6s_ease-in-out_infinite]">
              🔍
            </div>
            <p className="text-base font-extrabold text-cocoa-600 mb-1">{statusText}</p>
            <div className="mx-auto mt-4 w-64 h-3 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-sky-400 to-violet-400 transition-all duration-300"
                style={{ width: `${Math.max(8, progress)}%` }}
              />
            </div>
            <p className="mt-3 text-sm font-bold text-cocoa-400">{progress}%</p>
          </div>
        )}

        {/* ── 阶段三：识别结果预览（可编辑闭环） ── */}
        {phase === 'review' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-extrabold text-cocoa-600">
                识别到 {drafts.length} 个单词
              </p>
              <span className="text-xs font-bold text-cocoa-400">
                （检查一下，改错的改一改，不要的直接删）
              </span>
            </div>

            {/* 目标文件夹 */}
            <div>
              <label className="block text-xs font-bold text-cocoa-400 mb-1.5">导入到</label>
              <select
                value={targetFolder}
                onChange={(e) => setTargetFolder(e.target.value)}
                className="w-full rounded-2xl border-2 border-sakura-200 bg-white px-4 py-3 text-base font-semibold text-cocoa-700 outline-none focus:border-sakura-400 min-h-[52px]"
                style={{ fontSize: 16 }}
              >
                <option value="">📥 未分类（根目录）</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.emoji} {f.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 单词卡片列表 */}
            <div className="space-y-3">
              {drafts.map((d, i) => (
                <div
                  key={i}
                  className="rounded-3xl bg-white border-2 border-sakura-100 p-4 animate-grow-up"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-3xl leading-none select-none shrink-0 mt-1">
                      {d.imageEmoji}
                    </span>
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          value={d.word}
                          onChange={(e) => updateDraft(d.word, { word: e.target.value })}
                          placeholder="单词"
                          className="flex-1 min-w-0 rounded-xl border-2 border-slate-100 px-3 py-2.5 text-base font-extrabold text-cocoa-700 outline-none focus:border-sky-400"
                          style={{ fontSize: 16 }}
                        />
                        {d.enhancing ? (
                          <span className="text-xs font-bold text-sky-500 shrink-0">补全中…</span>
                        ) : (
                          <span className="text-xs font-bold text-emerald-500 shrink-0">✓</span>
                        )}
                      </div>
                      <input
                        value={d.phonetic}
                        onChange={(e) => updateDraft(d.word, { phonetic: e.target.value })}
                        placeholder="音标，如 /ˈæpl/"
                        className="w-full rounded-xl border-2 border-slate-100 px-3 py-2 text-sm font-semibold text-cocoa-500 outline-none focus:border-sky-400"
                        style={{ fontSize: 14 }}
                      />
                      <input
                        value={d.translation}
                        onChange={(e) => updateDraft(d.word, { translation: e.target.value })}
                        placeholder="中文意思，如 苹果"
                        className="w-full rounded-xl border-2 border-slate-100 px-3 py-2 text-sm font-semibold text-cocoa-600 outline-none focus:border-sky-400"
                        style={{ fontSize: 14 }}
                      />
                      <input
                        value={d.exampleEn ?? ''}
                        onChange={(e) => updateDraft(d.word, { exampleEn: e.target.value })}
                        placeholder="例句（可选）"
                        className="w-full rounded-xl border-2 border-slate-100 px-3 py-2 text-sm font-semibold text-cocoa-500 outline-none focus:border-sky-400"
                        style={{ fontSize: 14 }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeDraft(d.word)}
                      className="w-10 h-10 flex items-center justify-center rounded-xl bg-rose-50 text-rose-500 shrink-0"
                      aria-label="删除这个词"
                    >
                      <Icon name="trash" size={17} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* 添加 + 导入 */}
            <button
              type="button"
              onClick={addEmptyDraft}
              className="w-full rounded-2xl border-2 border-dashed border-sakura-300 bg-white/60 text-cocoa-500 px-4 py-3.5 text-sm font-extrabold min-h-[52px] hover:border-sakura-400 transition-colors"
            >
              ＋ 手动添加一个单词
            </button>

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => {
                  setDrafts([]);
                  setPhase('upload');
                }}
                disabled={importing}
                className="flex-1 rounded-2xl bg-white border-2 border-slate-200 text-cocoa-500 px-4 py-3.5 text-sm font-extrabold min-h-[56px] disabled:opacity-50"
              >
                重新拍
              </button>
              <button
                type="button"
                onClick={() => void doImport()}
                disabled={importing || drafts.length === 0}
                className="flex-[2] rounded-2xl bg-gradient-to-b from-sky-400 to-sky-500 text-white px-4 py-3.5 text-base font-extrabold min-h-[56px] shadow-[0_4px_0_0_#2E9BD6] active:translate-y-0.5 active:shadow-none transition-all disabled:opacity-50"
              >
                {importing ? '导入中…' : `确认导入 ${drafts.filter((d) => d.word.trim()).length} 个单词`}
              </button>
            </div>
            <p className="text-xs font-bold text-cocoa-400 text-center">
              点「确认导入」才会保存到单词库
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/** tesseract 状态码 → 孩子能看懂的中文 */
function statusTextOf(status: string): string {
  if (status.includes('loading')) return '正在加载识别引擎…';
  if (status.includes('initializing')) return '正在初始化…';
  if (status.includes('recognizing')) return '正在识别单词…';
  return '努力工作中…';
}

export default OcrImportModal;
