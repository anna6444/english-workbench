/**
 * 单词编辑弹窗（模块二 2.1/2.2：单词库每词编辑按钮 + 移动到文件夹）。
 *
 * 可改：翻译 / 音标 / 例句 / 词性 / emoji / 所属文件夹。
 * 「单词本身」不可改（改词会引发重复检测与练习记录归因混乱）。
 */

import { useEffect, useState } from 'react';
import type { VocabFolder, VocabularyWord } from '@/types';
import { Icon } from '@/components/Icon';
import { useRepositories } from '@/repositories/RepositoriesProvider';

export function WordEditModal({
  word,
  folders,
  onClose,
  onSaved,
}: {
  word: VocabularyWord;
  folders: VocabFolder[];
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const repos = useRepositories();
  const [translation, setTranslation] = useState(word.translation);
  const [phonetic, setPhonetic] = useState(word.phonetic);
  const [exampleEn, setExampleEn] = useState(word.exampleEn ?? '');
  const [exampleZh, setExampleZh] = useState(word.exampleZh ?? '');
  const [imageEmoji, setImageEmoji] = useState(word.imageEmoji);
  const [folderId, setFolderId] = useState(word.folderId ?? '');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setTranslation(word.translation);
    setPhonetic(word.phonetic);
    setExampleEn(word.exampleEn ?? '');
    setExampleZh(word.exampleZh ?? '');
    setImageEmoji(word.imageEmoji);
    setFolderId(word.folderId ?? '');
  }, [word]);

  async function doSave() {
    if (!translation.trim()) return;
    setBusy(true);
    try {
      await repos.vocabulary.updateForStudent(word.studentId, word.id, {
        translation: translation.trim(),
        phonetic: phonetic.trim() || '/—/',
        exampleEn: exampleEn.trim() || undefined,
        exampleZh: exampleZh.trim() || undefined,
        imageEmoji: imageEmoji || '📘',
        folderId: folderId || null,
      });
      onSaved(`「${word.word}」已保存`);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-cocoa-700/45" onClick={busy ? undefined : onClose} aria-hidden="true" />
      <div className="relative w-full sm:max-w-md max-h-[88vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-cream p-5 sm:p-6 animate-[grow-up_0.22s_ease-out]">
        <div className="flex items-center justify-between mb-4">
          <p className="text-lg font-extrabold text-cocoa-700">
            ✏️ 编辑「{word.word}」
          </p>
          <button
            type="button"
            onClick={onClose}
            className="w-11 h-11 flex items-center justify-center rounded-2xl hover:bg-sakura-100 text-cocoa-500"
            aria-label="关闭"
          >
            <Icon name="close" size={20} />
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex gap-3">
            <div className="w-20">
              <label className="block text-xs font-bold text-cocoa-400 mb-1.5">图标</label>
              <input
                value={imageEmoji}
                onChange={(e) => setImageEmoji(e.target.value.slice(0, 2))}
                className="w-full rounded-2xl border-2 border-sakura-200 bg-white px-2 py-3 text-center text-lg outline-none focus:border-sakura-400"
                style={{ fontSize: 16 }}
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-bold text-cocoa-400 mb-1.5">
                中文意思 *
              </label>
              <input
                value={translation}
                onChange={(e) => setTranslation(e.target.value)}
                className="w-full rounded-2xl border-2 border-sakura-200 bg-white px-4 py-3 text-base font-semibold text-cocoa-700 outline-none focus:border-sakura-400 min-h-[52px]"
                style={{ fontSize: 16 }}
              />
            </div>
          </div>

          <Field label="音标" value={phonetic} onChange={setPhonetic} placeholder="/ˈæpl/" />
          <Field label="英文例句" value={exampleEn} onChange={setExampleEn} placeholder="I like apples." />
          <Field label="例句翻译" value={exampleZh} onChange={setExampleZh} placeholder="我喜欢苹果。" />

          <div>
            <label className="block text-xs font-bold text-cocoa-400 mb-1.5">所属文件夹</label>
            <select
              value={folderId}
              onChange={(e) => setFolderId(e.target.value)}
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
        </div>

        <button
          type="button"
          onClick={() => void doSave()}
          disabled={busy || !translation.trim()}
          className="mt-5 w-full rounded-2xl bg-gradient-to-b from-sky-400 to-sky-500 text-white px-4 py-3.5 text-base font-extrabold min-h-[56px] shadow-[0_4px_0_0_#2E9BD6] active:translate-y-0.5 active:shadow-none transition-all disabled:opacity-50"
        >
          {busy ? '保存中…' : '保存'}
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

export default WordEditModal;
