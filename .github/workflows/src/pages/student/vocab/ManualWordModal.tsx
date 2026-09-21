/**
 * 手动建词弹窗（模块一 1.4：离线查词兜底）。
 *
 * 两种方式：
 *   快速：一行式 `apple|/ˈæpl/|苹果`（竖线分隔，只有单词也行，自动查离线词库）
 *   详细：分字段输入（单词/音标/翻译/例句）
 *
 * 场景：网络查词失败/太慢时，家长或孩子直接手输，跳过网络直接入库。
 */

import { useState } from 'react';
import type { VocabularyWord } from '@/types';
import { Icon } from '@/components/Icon';
import { useRepositories } from '@/repositories/RepositoriesProvider';
import { resolveDraftImmediately } from '@/services/lookup/lookupService';

export function ManualWordModal({
  sid,
  onClose,
  onAdded,
}: {
  sid: string;
  onClose: () => void;
  onAdded: (msg: string) => void;
}) {
  const repos = useRepositories();
  const [mode, setMode] = useState<'quick' | 'detail'>('quick');
  const [quickText, setQuickText] = useState('');
  const [detail, setDetail] = useState({
    word: '',
    phonetic: '',
    translation: '',
    exampleEn: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** 快速模式：竖线分隔解析（word 必填，其余可选，缺的用离线词库补） */
  function parseQuick(): Omit<VocabularyWord, 'id' | 'createdAt' | 'updatedAt' | 'studentId'>[] {
    const lines = quickText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) {
      setError('先输入至少一个单词');
      return [];
    }
    const out: ReturnType<typeof parseQuick> = [];
    for (const line of lines.slice(0, 30)) {
      const parts = line.split('|').map((s) => s.trim());
      const word = (parts[0] ?? '').toLowerCase();
      if (!word || !/^[a-z][a-z'-]*$/.test(word)) {
        setError(`「${parts[0]}」不是有效的英文单词`);
        return [];
      }
      // 离线词库打底（有音标/翻译/例句就用它的）
      const base = resolveDraftImmediately(word).draft;
      // 第 2 段以 / 开头视为音标，否则视为翻译
      let phonetic = base.phonetic;
      let translation = base.translation;
      if (parts[1]) {
        if (parts[1].startsWith('/')) {
          phonetic = parts[1];
          if (parts[2]) translation = parts[2];
        } else {
          translation = parts[1];
        }
      }
      out.push({
        word,
        translation,
        phonetic,
        syllables: base.syllables,
        pos: base.pos,
        exampleEn: base.exampleEn,
        exampleZh: base.exampleZh,
        imageEmoji: base.imageEmoji,
        folderId: null,
        lookupStatus: base.lookupStatus,
        lookupSource: base.lookupSource,
        isMastered: false,
        practiceCount: 0,
        correctCount: 0,
        correctStreak: 0,
      });
    }
    return out;
  }

  /** 详细模式：分字段 */
  function buildDetail(): Omit<VocabularyWord, 'id' | 'createdAt' | 'updatedAt' | 'studentId'> | null {
    const word = detail.word.trim().toLowerCase();
    if (!word || !/^[a-z][a-z'-]*$/.test(word)) {
      setError('单词只能包含英文字母');
      return null;
    }
    if (!detail.translation.trim()) {
      setError('请填写中文意思');
      return null;
    }
    const base = resolveDraftImmediately(word).draft;
    return {
      word,
      translation: detail.translation.trim(),
      phonetic: detail.phonetic.trim() || base.phonetic,
      syllables: base.syllables,
      pos: base.pos,
      exampleEn: detail.exampleEn.trim() || base.exampleEn,
      exampleZh: base.exampleZh,
      imageEmoji: base.imageEmoji,
      folderId: null,
      lookupStatus: base.lookupStatus,
      lookupSource: base.lookupSource,
      isMastered: false,
      practiceCount: 0,
      correctCount: 0,
      correctStreak: 0,
    };
  }

  async function doAdd() {
    setError(null);
    const inputs = mode === 'quick' ? parseQuick() : buildDetail() ? [buildDetail()!] : [];
    if (inputs.length === 0) return;

    setBusy(true);
    try {
      const created = await repos.vocabulary.addBatch(sid, inputs);
      if (created.length === 0) {
        setError('这些单词已经在库里啦');
      } else {
        onAdded(`已添加 ${created.length} 个单词`);
        onClose();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-cocoa-700/45" onClick={busy ? undefined : onClose} aria-hidden="true" />
      <div className="relative w-full sm:max-w-md max-h-[88vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-cream p-5 sm:p-6 animate-[grow-up_0.22s_ease-out]">
        <div className="flex items-center justify-between mb-4">
          <p className="text-lg font-extrabold text-cocoa-700">✏️ 手动添加单词</p>
          <button
            type="button"
            onClick={onClose}
            className="w-11 h-11 flex items-center justify-center rounded-2xl hover:bg-sakura-100 text-cocoa-500"
            aria-label="关闭"
          >
            <Icon name="close" size={20} />
          </button>
        </div>

        {/* 模式切换 */}
        <div className="flex items-center gap-2 rounded-2xl bg-white border-2 border-sakura-100 p-1.5 mb-4">
          {(
            [
              { k: 'quick', label: '⚡ 快速一行式' },
              { k: 'detail', label: '📝 详细填写' },
            ] as const
          ).map((m) => (
            <button
              key={m.k}
              type="button"
              onClick={() => {
                setMode(m.k);
                setError(null);
              }}
              className={`flex-1 rounded-xl px-3 py-2.5 text-sm font-extrabold transition-all min-h-[44px] ${
                mode === m.k ? 'bg-gradient-to-b from-butter-300 to-butter-400 text-white' : 'text-cocoa-500'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-4 rounded-2xl bg-rose-50 border-2 border-rose-100 px-4 py-3 text-sm font-bold text-rose-600">
            {error}
          </div>
        )}

        {mode === 'quick' ? (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-cocoa-500 leading-relaxed">
              一行一个，用竖线分开：
              <code className="mx-1 px-1.5 py-0.5 rounded-lg bg-white border border-sakura-200 font-extrabold text-cocoa-600">
                单词|音标|意思
              </code>
              （音标、意思可省略，会自动查本地词库补上）
            </p>
            <textarea
              rows={5}
              value={quickText}
              onChange={(e) => setQuickText(e.target.value)}
              placeholder={'apple|/ˈæpl/|苹果\nbanana|香蕉\ncat'}
              className="w-full rounded-2xl border-2 border-sakura-200 bg-white px-4 py-3.5 text-base font-semibold text-cocoa-700 placeholder:text-cocoa-300 outline-none focus:border-sakura-400 resize-none leading-relaxed"
              style={{ fontSize: 16 }}
            />
            <p className="text-xs font-bold text-cocoa-400">
              💡 没网也能用：填了「单词+意思」就直接入库，不用等联网查询
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <Field label="英文单词 *" value={detail.word} onChange={(v) => setDetail((d) => ({ ...d, word: v }))} placeholder="apple" />
            <Field label="中文意思 *" value={detail.translation} onChange={(v) => setDetail((d) => ({ ...d, translation: v }))} placeholder="苹果" />
            <Field label="音标（可选）" value={detail.phonetic} onChange={(v) => setDetail((d) => ({ ...d, phonetic: v }))} placeholder="/ˈæpl/" />
            <Field label="例句（可选）" value={detail.exampleEn} onChange={(v) => setDetail((d) => ({ ...d, exampleEn: v }))} placeholder="I like apples." />
          </div>
        )}

        <button
          type="button"
          onClick={() => void doAdd()}
          disabled={busy}
          className="mt-5 w-full rounded-2xl bg-gradient-to-b from-sky-400 to-sky-500 text-white px-4 py-3.5 text-base font-extrabold min-h-[56px] shadow-[0_4px_0_0_#2E9BD6] active:translate-y-0.5 active:shadow-none transition-all disabled:opacity-50"
        >
          {busy ? '添加中…' : '添加到单词库'}
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-bold text-cocoa-400 mb-1.5">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border-2 border-sakura-200 bg-white px-4 py-3 text-base font-semibold text-cocoa-700 placeholder:text-cocoa-300 outline-none focus:border-sakura-400 min-h-[52px]"
        style={{ fontSize: 16 }}
      />
    </div>
  );
}

export default ManualWordModal;
