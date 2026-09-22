/**
 * 单词库 —— 查词 + 文件夹管理 + OCR 导入 + 闪卡学习（模块二主页面）。
 *
 * v2 结构（多级文件夹）：
 *   首页（根目录）：只展示文件夹卡片 + 「未分类」入口 + 查词/拍照/手动入口
 *   文件夹页：面包屑 + 子文件夹 + 单词列表 + 「开始学习」（闪卡 = 今日打卡任务）
 *
 * 查词保留两段式：离线秒出 → 在线补全（这是本应用的王牌体验，不动）。
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { VocabFolder, VocabularyWord } from '@/types';
import {
  Button,
  Card,
  Chip,
  EmptyState,
  ErrorNote,
  ProgressBar,
  SectionTitle,
  StatCard,
} from '@/components/ui';
import { Icon } from '@/components/Icon';
import { SpeakPair } from '@/components/SpeakButton';
import { useRepositories } from '@/repositories/RepositoriesProvider';
import { useSession } from '@/app/AuthProvider';
import { useWordLookup } from '@/services/lookup/useWordLookup';
import { offlineWordCount } from '@/services/lookup/offlineDictionary';
import { OcrImportModal } from './vocab/OcrImportModal';
import { ManualWordModal } from './vocab/ManualWordModal';
import { WordEditModal } from './vocab/WordEditModal';
import { FlashcardStudy } from './vocab/FlashcardStudy';

type FilterKey = 'all' | 'learning' | 'mastered';

/** 页面视图：首页（根目录） / 文件夹内（folderId=null 表示「未分类」） / 闪卡学习 */
type View =
  | { mode: 'root' }
  | { mode: 'folder'; folderId: string | null }
  | { mode: 'study'; folderId: string | null };

export function VocabularyPage() {
  const repos = useRepositories();
  const sid = useSession().currentStudentId;
  const lookup = useWordLookup();

  const [words, setWords] = useState<VocabularyWord[]>([]);
  const [folders, setFolders] = useState<VocabFolder[]>([]);
  const [view, setView] = useState<View>({ mode: 'root' });
  const [input, setInput] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [loading, setLoading] = useState(true);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [units, setUnits] = useState<Record<string, string>>({});

  /* ── 弹窗 ── */
  const [ocrOpen, setOcrOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [editWord, setEditWord] = useState<VocabularyWord | null>(null);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderEmoji, setNewFolderEmoji] = useState('');
  const [renameFolder, setRenameFolder] = useState<VocabFolder | null>(null);
  const [renameName, setRenameName] = useState('');
  const [renameEmoji, setRenameEmoji] = useState('');

  /* ── 拉取（词 + 文件夹） ── */
  const reload = useCallback(
    async (sidArg: string) => {
      const [list, folderList] = await Promise.all([
        repos.vocabulary.listByStudent(sidArg),
        repos.folder.listByStudent(sidArg),
      ]);
      setWords(list.sort((a, b) => b.createdAt - a.createdAt));
      setFolders(folderList);
    },
    [repos],
  );

  useEffect(() => {
    if (!sid) return;
    let alive = true;
    void (async () => {
      const [unitList] = await Promise.all([repos.unit.list()]);
      await reload(sid);
      if (!alive) return;
      const map: Record<string, string> = {};
      for (const u of unitList) map[u.id] = u.titleZh;
      setUnits(map);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [sid, reload, repos.unit]);

  /* ── 查词：落库（保留原有两段式逻辑） ── */
  async function handleLookup() {
    const w = input.trim();
    if (!w || !sid) return;
    lookup.lookup(w);
  }

  useEffect(() => {
    if (lookup.phase !== 'done' || !lookup.draft || !sid) return;
    const d = lookup.draft;
    let alive = true;
    void (async () => {
      const existing = await repos.vocabulary.findByWord(sid, d.word);
      if (!alive) return;
      if (existing) {
        const patch: Partial<VocabularyWord> = {};
        if (d.translation && d.translation !== '暂无翻译' && existing.translation !== d.translation)
          patch.translation = d.translation;
        if (d.phonetic && d.phonetic !== '/—/' && existing.phonetic !== d.phonetic)
          patch.phonetic = d.phonetic;
        if (d.exampleEn && existing.exampleEn !== d.exampleEn) patch.exampleEn = d.exampleEn;
        if (Object.keys(patch).length > 0) {
          await repos.vocabulary.updateForStudent(sid, existing.id, patch);
          setSaveMsg(`「${d.word}」的资料已更新`);
        }
      } else {
        await repos.vocabulary.addBatch(sid, [
          {
            word: d.word,
            translation: d.translation,
            phonetic: d.phonetic,
            syllables: d.syllables,
            pos: d.pos,
            exampleEn: d.exampleEn,
            exampleZh: d.exampleZh,
            imageEmoji: d.imageEmoji,
            lookupStatus: d.lookupStatus,
            lookupSource: d.lookupSource,
            isMastered: false,
            practiceCount: 0,
            correctCount: 0,
            correctStreak: 0,
          },
        ]);
        setSaveMsg(`「${d.word}」已加入单词库`);
      }
      await reload(sid);
      window.setTimeout(() => alive && setSaveMsg(null), 2600);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lookup.phase]);

  /* ── 文件夹工具 ── */

  /** 词数：某文件夹直接包含（不含子文件夹） */
  function directCount(folderId: string | null): number {
    return words.filter((w) => (w.folderId ?? null) === folderId).length;
  }

  /** 递归收集：某文件夹及其全部子孙文件夹的词（「开始学习」用） */
  function collectWordsDeep(folderId: string): VocabularyWord[] {
    const ids = new Set<string>([folderId]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const f of folders) {
        if (f.parentFolderId && ids.has(f.parentFolderId) && !ids.has(f.id)) {
          ids.add(f.id);
          changed = true;
        }
      }
    }
    return words.filter((w) => w.folderId && ids.has(w.folderId));
  }

  /** 面包屑链：顶层 → … → 当前 */
  function folderChain(folderId: string): VocabFolder[] {
    const chain: VocabFolder[] = [];
    let cur = folders.find((f) => f.id === folderId);
    while (cur) {
      chain.unshift(cur);
      cur = cur.parentFolderId ? folders.find((f) => f.id === cur!.parentFolderId) : undefined;
    }
    return chain;
  }

  const topFolders = useMemo(() => folders.filter((f) => !f.parentFolderId), [folders]);
  const rootWords = useMemo(() => words.filter((w) => !w.folderId), [words]);

  /* ── 文件夹操作 ── */
  async function doCreateFolder() {
    if (!sid || !newFolderName.trim()) return;
    await repos.folder.createFolder(sid, {
      name: newFolderName.trim(),
      emoji: newFolderEmoji.trim() || undefined,
      parentFolderId: view.mode === 'folder' && view.folderId ? view.folderId : null,
    });
    setNewFolderOpen(false);
    setNewFolderName('');
    setNewFolderEmoji('');
    setSaveMsg('文件夹建好啦');
    await reload(sid);
    window.setTimeout(() => setSaveMsg(null), 2200);
  }

  async function doRenameFolder() {
    if (!sid || !renameFolder) return;
    await repos.folder.updateFolder(sid, renameFolder.id, {
      name: renameName.trim() || undefined,
      emoji: renameEmoji.trim() || undefined,
    });
    setRenameFolder(null);
    await reload(sid);
  }

  async function doDeleteFolder(f: VocabFolder) {
    if (!sid) return;
    const ok = window.confirm(
      `删除文件夹「${f.name}」？\n\n里面的 ${directCount(f.id)} 个单词不会删除，会移到上一级。`,
    );
    if (!ok) return;
    await repos.folder.removeFolder(sid, f.id);
    if (view.mode === 'folder' && view.folderId === f.id) {
      setView({ mode: 'root' });
    }
    await reload(sid);
  }

  /* ── 单词操作 ── */
  async function toggleMastered(w: VocabularyWord) {
    if (!sid) return;
    await repos.vocabulary.setMastered(sid, w.id, !w.isMastered);
    await reload(sid);
  }

  async function removeWord(w: VocabularyWord) {
    if (!sid) return;
    await repos.vocabulary.removeForStudent(sid, w.id);
    setWords((prev) => prev.filter((x) => x.id !== w.id));
  }

  /* ── 当前文件夹视图数据 ── */
  const currentFolder =
    view.mode !== 'root' && view.folderId ? folders.find((f) => f.id === view.folderId) : undefined;
  const viewFolderId = view.mode === 'folder' || view.mode === 'study' ? view.folderId : null;
  const subFolders = folders.filter((f) =>
    viewFolderId ? f.parentFolderId === viewFolderId : !f.parentFolderId,
  );
  const folderWords = words.filter((w) => (w.folderId ?? null) === viewFolderId);
  const studiedWords =
    view.mode === 'study' && view.folderId ? collectWordsDeep(view.folderId) : [];
  const masteredCount = words.filter((w) => w.isMastered).length;

  const filtered = useMemo(() => {
    if (filter === 'mastered') return folderWords.filter((w) => w.isMastered);
    if (filter === 'learning') return folderWords.filter((w) => !w.isMastered);
    return folderWords;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folderWords, filter]);

  /* ═══════════════ 闪卡学习模式（全屏） ═══════════════ */
  if (view.mode === 'study' && sid) {
    return (
      <FlashcardStudy
        words={studiedWords}
        folderName={currentFolder?.name ?? '未分类'}
        folderEmoji={currentFolder?.emoji ?? '📥'}
        onExit={() => setView({ mode: 'folder', folderId: view.folderId })}
        onFinished={() => void reload(sid)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* ═══════════════ 首页：查词 + 文件夹 ═══════════════ */}
      {view.mode === 'root' && (
        <>
          <section>
            <SectionTitle icon="search" title="添加新单词" />
            <Card className="p-5 sm:p-6">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300">
                    <Icon name="search" size={22} />
                  </span>
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handleLookup();
                    }}
                    placeholder="输入英文单词，比如 apple"
                    autoComplete="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    className="w-full rounded-2xl border-2 border-slate-200 bg-white pl-12 pr-4 py-3.5 text-base font-semibold text-slate-700 placeholder:text-slate-300 placeholder:font-normal outline-none focus:border-sky-400 transition-colors min-h-[58px]"
                  />
                </div>
                <Button
                  tone="sky"
                  size="md"
                  icon="search"
                  onClick={() => void handleLookup()}
                  disabled={!input.trim() || lookup.isEnhancing}
                  className="sm:w-36"
                >
                  {lookup.isEnhancing ? '查询中' : '查一查'}
                </Button>
              </div>

              {/* 拍照 / 手动入口 */}
              <div className="grid grid-cols-2 gap-3 mt-3.5">
                <button
                  type="button"
                  onClick={() => setOcrOpen(true)}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-violet-50 border-2 border-violet-200 px-4 py-3 text-sm font-extrabold text-violet-600 min-h-[52px] hover:border-violet-300 active:translate-y-0.5 transition-all"
                >
                  <span className="text-lg select-none">📷</span>
                  拍照识别单词
                </button>
                <button
                  type="button"
                  onClick={() => setManualOpen(true)}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-50 border-2 border-emerald-200 px-4 py-3 text-sm font-extrabold text-emerald-600 min-h-[52px] hover:border-emerald-300 active:translate-y-0.5 transition-all"
                >
                  <span className="text-lg select-none">✏️</span>
                  手动输入（免网络）
                </button>
              </div>

              <p className="mt-3.5 text-xs text-slate-400 font-semibold">
                本地已收录 {offlineWordCount()} 个常用词，输入后立刻就能看到；生词会自动联网补全。
              </p>

              {lookup.draft && (
                <div className="mt-5 animate-grow-up">
                  <LookupResultCard
                    draft={lookup.draft}
                    phase={lookup.phase}
                    offlineHit={lookup.offlineHit}
                    elapsedMs={lookup.elapsedMs}
                    error={lookup.error}
                  />
                </div>
              )}
            </Card>
          </section>

          {saveMsg && (
            <div className="flex items-center gap-2.5 rounded-2xl bg-emerald-50 border-2 border-emerald-100 px-4 py-3 text-sm text-emerald-700 font-bold animate-grow-up">
              <Icon name="check" size={18} />
              {saveMsg}
            </div>
          )}

          {/* 概览 */}
          <section className="grid grid-cols-3 gap-3.5">
            <StatCard label="全部单词" value={words.length} unit="个" emoji="📚" tone="sky" />
            <StatCard label="已掌握" value={masteredCount} unit="个" emoji="✅" tone="grass" />
            <StatCard
              label="文件夹"
              value={folders.length}
              unit="个"
              emoji="🗂️"
              tone="sun"
            />
          </section>

          {/* 文件夹网格（首页主体） */}
          <section>
            <SectionTitle icon="cards" title="我的词库" />
            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-32 rounded-3xl bg-white animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5">
                {/* 未分类（根目录单词的家） */}
                {rootWords.length > 0 && (
                  <FolderCard
                    emoji="📥"
                    name="未分类"
                    count={rootWords.length}
                    sub="查词进来的词"
                    onClick={() => setView({ mode: 'folder', folderId: null })}
                  />
                )}
                {topFolders.map((f) => (
                  <FolderCard
                    key={f.id}
                    emoji={f.emoji}
                    name={f.name}
                    count={directCount(f.id)}
                    sub={`含 ${folders.filter((x) => x.parentFolderId === f.id).length} 个子文件夹`}
                    onClick={() => setView({ mode: 'folder', folderId: f.id })}
                  />
                ))}
                {/* 新建文件夹 */}
                <button
                  type="button"
                  onClick={() => setNewFolderOpen(true)}
                  className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-sakura-300 bg-white/60 p-5 min-h-[128px] transition-all hover:border-sakura-400 hover:bg-white active:translate-y-0.5"
                >
                  <span className="text-3xl mb-2 select-none">➕</span>
                  <span className="text-sm font-extrabold text-cocoa-500">新建文件夹</span>
                  <span className="text-[11px] font-bold text-cocoa-400 mt-0.5">
                    如「三年级上册」「动物」
                  </span>
                </button>
              </div>
            )}
          </section>
        </>
      )}

      {/* ═══════════════ 文件夹视图 ═══════════════ */}
      {view.mode === 'folder' && (
        <>
          {/* 面包屑 + 返回 */}
          <section>
            <div className="flex items-center gap-2 flex-wrap mb-3">
              <button
                type="button"
                onClick={() => setView({ mode: 'root' })}
                className="inline-flex items-center gap-1.5 rounded-2xl bg-white border-2 border-sakura-100 px-3.5 py-2.5 text-xs font-extrabold text-cocoa-500 min-h-[44px] hover:border-sakura-300 transition-colors"
              >
                <Icon name="arrowLeft" size={16} />
                我的词库
              </button>
              {viewFolderId &&
                folderChain(viewFolderId).map((f) => (
                  <span key={f.id} className="text-xs font-extrabold text-cocoa-400">
                    / {f.emoji} {f.name}
                  </span>
                ))}
              {!viewFolderId && (
                <span className="text-xs font-extrabold text-cocoa-400">/ 📥 未分类</span>
              )}
            </div>

            {/* 文件夹标题卡 */}
            <Card className="p-5 sm:p-6">
              <div className="flex items-center gap-4 flex-wrap">
                <span className="text-4xl select-none">{currentFolder?.emoji ?? '📥'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xl font-extrabold text-cocoa-700">
                    {currentFolder?.name ?? '未分类'}
                  </p>
                  <p className="text-xs font-bold text-cocoa-400 mt-1">
                    直接包含 {folderWords.length} 个单词
                    {currentFolder && ` · 子文件夹 ${subFolders.length} 个`}
                  </p>
                </div>
                {currentFolder && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setRenameFolder(currentFolder);
                        setRenameName(currentFolder.name);
                        setRenameEmoji(currentFolder.emoji);
                      }}
                      className="rounded-2xl bg-sakura-50 border-2 border-sakura-100 px-4 py-2.5 text-xs font-extrabold text-cocoa-600 min-h-[44px] hover:border-sakura-300 transition-colors"
                    >
                      ✏️ 改名
                    </button>
                    <button
                      type="button"
                      onClick={() => void doDeleteFolder(currentFolder)}
                      className="rounded-2xl bg-rose-50 border-2 border-rose-100 px-4 py-2.5 text-xs font-extrabold text-rose-500 min-h-[44px] hover:border-rose-200 transition-colors"
                    >
                      🗑️ 删除
                    </button>
                  </div>
                )}
              </div>

              {/* 开始学习（今日打卡任务入口） */}
              {(() => {
                const pool =
                  viewFolderId && currentFolder
                    ? collectWordsDeep(viewFolderId)
                    : folderWords;
                const learnable = pool.filter((w) => !w.isMastered);
                if (pool.length === 0) return null;
                return (
                  <div className="mt-4 rounded-3xl bg-gradient-to-r from-sky-50 to-violet-50 border-2 border-sky-100 p-4 flex items-center gap-3.5 flex-wrap">
                    <span className="text-3xl select-none">🎯</span>
                    <div className="flex-1 min-w-[140px]">
                      <p className="text-sm font-extrabold text-cocoa-700">
                        开始学习 · 今日打卡任务
                      </p>
                      <p className="text-xs font-bold text-cocoa-400 mt-0.5">
                        {pool.length} 个词待复习，其中 {learnable.length} 个还没掌握；
                        学会的词会 +1 ⭐ 并喂饱柯基
                      </p>
                    </div>
                    <Button
                      tone="sky"
                      size="md"
                      icon="arrowRight"
                      onClick={() => setView({ mode: 'study', folderId: viewFolderId })}
                    >
                      开始学习
                    </Button>
                  </div>
                );
              })()}
            </Card>
          </section>

          {/* 子文件夹 */}
          {subFolders.length > 0 && (
            <section>
              <SectionTitle icon="cards" title="子文件夹" />
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5">
                {subFolders.map((f) => (
                  <FolderCard
                    key={f.id}
                    emoji={f.emoji}
                    name={f.name}
                    count={directCount(f.id)}
                    onClick={() => setView({ mode: 'folder', folderId: f.id })}
                  />
                ))}
                <button
                  type="button"
                  onClick={() => setNewFolderOpen(true)}
                  className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-sakura-300 bg-white/60 p-5 min-h-[110px] transition-all hover:border-sakura-400 hover:bg-white active:translate-y-0.5"
                >
                  <span className="text-2xl mb-1 select-none">➕</span>
                  <span className="text-xs font-extrabold text-cocoa-500">新建子文件夹</span>
                </button>
              </div>
            </section>
          )}

          {/* 单词列表 */}
          <section>
            <SectionTitle
              icon="cards"
              title="单词列表"
              extra={
                <div className="flex items-center rounded-2xl bg-slate-100 p-1">
                  {(
                    [
                      { k: 'all', label: '全部' },
                      { k: 'learning', label: '学习中' },
                      { k: 'mastered', label: '已掌握' },
                    ] as { k: FilterKey; label: string }[]
                  ).map((o) => (
                    <button
                      key={o.k}
                      type="button"
                      onClick={() => setFilter(o.k)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all min-h-[40px] ${
                        filter === o.k ? 'bg-white text-sky-600 shadow-sm' : 'text-slate-500'
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              }
            />

            {filtered.length === 0 ? (
              <Card>
                <EmptyState
                  emoji="📖"
                  title={folderWords.length === 0 ? '这个文件夹还是空的' : '这里没有符合条件的单词'}
                  desc={
                    folderWords.length === 0
                      ? '回到首页拍照识别、手动输入或查词，单词就会住进来。'
                      : '换个筛选条件看看。'
                  }
                />
              </Card>
            ) : (
              <div className="space-y-3">
                {filtered.map((w) => (
                  <WordRow
                    key={w.id}
                    word={w}
                    unitName={w.unitId ? units[w.unitId] : undefined}
                    folderName={
                      w.folderId ? folders.find((f) => f.id === w.folderId)?.name : undefined
                    }
                    onToggleMastered={() => void toggleMastered(w)}
                    onRemove={() => void removeWord(w)}
                    onEdit={() => setEditWord(w)}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {/* ═══════════════ 弹窗群 ═══════════════ */}

      {/* 拍照 OCR */}
      {ocrOpen && sid && (
        <OcrImportModal
          sid={sid}
          folders={folders}
          defaultFolderId={view.mode === 'folder' ? view.folderId : null}
          onClose={() => setOcrOpen(false)}
          onImported={async (msg) => {
            setSaveMsg(msg);
            await reload(sid);
            window.setTimeout(() => setSaveMsg(null), 3200);
          }}
        />
      )}

      {/* 手动建词 */}
      {manualOpen && sid && (
        <ManualWordModal
          sid={sid}
          onClose={() => setManualOpen(false)}
          onAdded={async (msg) => {
            setSaveMsg(msg);
            await reload(sid);
            window.setTimeout(() => setSaveMsg(null), 2600);
          }}
        />
      )}

      {/* 编辑单词 */}
      {editWord && (
        <WordEditModal
          word={editWord}
          folders={folders}
          onClose={() => setEditWord(null)}
          onSaved={async (msg) => {
            setSaveMsg(msg);
            if (sid) await reload(sid);
            window.setTimeout(() => setSaveMsg(null), 2600);
          }}
        />
      )}

      {/* 新建文件夹 */}
      {newFolderOpen && (
        <SmallModal title="📁 新建文件夹" onClose={() => setNewFolderOpen(false)}>
          <div className="flex gap-3">
            <div className="w-20">
              <label className="block text-xs font-bold text-cocoa-400 mb-1.5">图标</label>
              <input
                value={newFolderEmoji}
                onChange={(e) => setNewFolderEmoji(e.target.value.slice(0, 2))}
                placeholder="📁"
                className="w-full rounded-2xl border-2 border-sakura-200 bg-white px-2 py-3 text-center text-lg outline-none focus:border-sakura-400"
                style={{ fontSize: 16 }}
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-bold text-cocoa-400 mb-1.5">名称</label>
              <input
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void doCreateFolder();
                }}
                maxLength={16}
                placeholder="三年级上册"
                autoFocus
                className="w-full rounded-2xl border-2 border-sakura-200 bg-white px-4 py-3 text-base font-semibold text-cocoa-700 placeholder:text-cocoa-300 outline-none focus:border-sakura-400 min-h-[52px]"
                style={{ fontSize: 16 }}
              />
            </div>
          </div>
          <button
            type="button"
            onClick={() => void doCreateFolder()}
            disabled={!newFolderName.trim()}
            className="mt-4 w-full rounded-2xl bg-gradient-to-b from-pink-400 to-pink-500 text-white px-4 py-3.5 text-base font-extrabold min-h-[56px] shadow-[0_4px_0_0_#DB4E73] active:translate-y-0.5 active:shadow-none transition-all disabled:opacity-50"
          >
            建好啦
          </button>
        </SmallModal>
      )}

      {/* 重命名文件夹 */}
      {renameFolder && (
        <SmallModal title="✏️ 修改文件夹" onClose={() => setRenameFolder(null)}>
          <div className="flex gap-3">
            <div className="w-20">
              <label className="block text-xs font-bold text-cocoa-400 mb-1.5">图标</label>
              <input
                value={renameEmoji}
                onChange={(e) => setRenameEmoji(e.target.value.slice(0, 2))}
                className="w-full rounded-2xl border-2 border-sakura-200 bg-white px-2 py-3 text-center text-lg outline-none focus:border-sakura-400"
                style={{ fontSize: 16 }}
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-bold text-cocoa-400 mb-1.5">名称</label>
              <input
                value={renameName}
                onChange={(e) => setRenameName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void doRenameFolder();
                }}
                maxLength={16}
                autoFocus
                className="w-full rounded-2xl border-2 border-sakura-200 bg-white px-4 py-3 text-base font-semibold text-cocoa-700 outline-none focus:border-sakura-400 min-h-[52px]"
                style={{ fontSize: 16 }}
              />
            </div>
          </div>
          <button
            type="button"
            onClick={() => void doRenameFolder()}
            className="mt-4 w-full rounded-2xl bg-gradient-to-b from-pink-400 to-pink-500 text-white px-4 py-3.5 text-base font-extrabold min-h-[56px] shadow-[0_4px_0_0_#DB4E73] active:translate-y-0.5 active:shadow-none transition-all"
          >
            保存
          </button>
        </SmallModal>
      )}
    </div>
  );
}

/* ───────────────────────── 文件夹卡片 ───────────────────────── */

function FolderCard({
  emoji,
  name,
  count,
  sub,
  onClick,
}: {
  emoji: string;
  name: string;
  count: number;
  sub?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-start rounded-3xl bg-white border-2 border-sakura-100 p-4 text-left transition-all hover:border-sakura-300 hover:-translate-y-0.5 active:translate-y-0 min-h-[128px] shadow-soft"
    >
      <span className="text-4xl leading-none select-none mb-2.5">{emoji}</span>
      <p className="text-base font-extrabold text-cocoa-700 truncate w-full">{name}</p>
      <p className="text-xs font-bold text-cocoa-400 mt-1">
        {count} 个单词{sub ? ` · ${sub}` : ''}
      </p>
    </button>
  );
}

/* ───────────────────────── 查词结果卡（保留原王牌体验） ───────────────────────── */

function LookupResultCard({
  draft,
  phase,
  offlineHit,
  elapsedMs,
  error,
}: {
  draft: ReturnType<typeof useWordLookup>['draft'] & object;
  phase: 'idle' | 'partial' | 'done';
  offlineHit: boolean;
  elapsedMs: number;
  error: string | null;
}) {
  const d = draft;
  const enhancing = phase === 'partial';
  const isPlaceholder = (v?: string) => !v || v === '暂无翻译' || v === '/—/';

  return (
    <div
      className={`rounded-3xl border-2 p-5 sm:p-6 transition-colors ${
        enhancing ? 'border-sky-200 bg-sky-50/60' : 'border-emerald-200 bg-emerald-50/50'
      }`}
    >
      <div className="flex items-center gap-2.5 mb-4 text-xs font-extrabold">
        {enhancing ? (
          <>
            <span className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-bounce"
                  style={{ animationDelay: `${i * 0.12}s` }}
                />
              ))}
            </span>
            <span className="text-sky-600">
              {offlineHit ? '本地词库已命中，正在补全更多资料…' : '正在联网查询中…'}
            </span>
          </>
        ) : (
          <>
            <Icon name="check" size={15} className="text-emerald-600" />
            <span className="text-emerald-700">
              {d.lookupStatus === 'online'
                ? `已联网补全（${elapsedMs}ms）`
                : d.lookupStatus === 'failed'
                  ? '联网没查到，已保留本地资料'
                  : '本地词库资料'}
            </span>
          </>
        )}
      </div>

      <div className="flex items-start gap-4 sm:gap-5">
        <span className="text-5xl sm:text-6xl leading-none select-none shrink-0">
          {d.imageEmoji}
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h3 className="text-3xl font-extrabold text-slate-800 break-all">{d.word}</h3>
            {d.pos && <Chip tone="slate" size="sm">{d.pos}</Chip>}
            {enhancing && <span className="text-xs font-bold text-sky-500">补全中…</span>}
          </div>

          <p
            className={`text-base font-semibold mt-1.5 ${
              isPlaceholder(d.phonetic) ? 'text-slate-300' : 'text-slate-500'
            }`}
          >
            {d.phonetic}
          </p>

          {d.syllables.length > 1 && (
            <div className="flex items-center flex-wrap gap-1.5 mt-3">
              <span className="text-xs font-bold text-slate-400 mr-1">拼读</span>
              {d.syllables.map((s, i) => (
                <span
                  key={i}
                  className="inline-flex items-center rounded-xl bg-white border-2 border-slate-200 px-2.5 py-1 text-sm font-extrabold text-slate-600"
                >
                  {s}
                </span>
              ))}
            </div>
          )}

          <p
            className={`text-xl font-extrabold mt-3.5 ${
              isPlaceholder(d.translation) ? 'text-slate-300' : 'text-slate-800'
            }`}
          >
            {d.translation}
          </p>

          {d.exampleEn && (
            <div className="mt-4 rounded-2xl bg-white border-2 border-slate-100 p-4">
              <p className="text-base font-bold text-slate-700">{d.exampleEn}</p>
              {d.exampleZh && (
                <p className="text-sm text-slate-400 font-semibold mt-1.5">{d.exampleZh}</p>
              )}
            </div>
          )}

          <div className="mt-4">
            <SpeakPair text={d.word} size="md" />
          </div>

          {error && (
            <div className="mt-3.5">
              <ErrorNote>{error}</ErrorNote>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── 单词行（+ 编辑按钮） ───────────────────────── */

function WordRow({
  word,
  unitName,
  folderName,
  onToggleMastered,
  onRemove,
  onEdit,
}: {
  word: VocabularyWord;
  unitName?: string;
  folderName?: string;
  onToggleMastered: () => void;
  onRemove: () => void;
  onEdit: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start gap-3.5">
        <span className="text-4xl leading-none select-none shrink-0 mt-0.5">
          {word.imageEmoji}
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
            <span className="text-xl font-extrabold text-slate-800 break-all">
              {word.word}
            </span>
            {word.isMastered ? (
              <Chip tone="grass" size="sm">
                <Icon name="check" size={12} />
                已掌握
              </Chip>
            ) : (
              <Chip tone="sun" size="sm">
                学习中
              </Chip>
            )}
          </div>

          <p className="text-sm font-semibold text-slate-400 mt-1">
            {word.phonetic}　{word.translation}
          </p>

          {(unitName || folderName) && (
            <p className="text-xs font-semibold text-slate-300 mt-1.5">
              {folderName ? `📁 ${folderName}` : ''}
              {folderName && unitName ? ' · ' : ''}
              {unitName ? `来自「${unitName}」` : ''}
            </p>
          )}

          {expanded && (
            <div className="mt-3.5 space-y-3 animate-grow-up">
              {word.syllables.length > 1 && (
                <div className="flex items-center flex-wrap gap-1.5">
                  <span className="text-xs font-bold text-slate-400 mr-1">拼读</span>
                  {word.syllables.map((s, i) => (
                    <span
                      key={i}
                      className="rounded-xl bg-slate-50 border-2 border-slate-100 px-2.5 py-1 text-sm font-extrabold text-slate-600"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              )}
              {word.exampleEn && (
                <div className="rounded-2xl bg-slate-50 p-3.5">
                  <p className="text-base font-bold text-slate-700">{word.exampleEn}</p>
                  {word.exampleZh && (
                    <p className="text-sm text-slate-400 font-semibold mt-1">
                      {word.exampleZh}
                    </p>
                  )}
                </div>
              )}
              <div className="flex items-center gap-3 text-xs font-bold text-slate-400">
                <span>练习 {word.practiceCount} 次</span>
                <span>答对 {word.correctCount} 次</span>
                {!word.isMastered && word.correctStreak > 0 && (
                  <span>连对 {word.correctStreak} 次</span>
                )}
              </div>
              {!word.isMastered && (
                <div className="space-y-1.5">
                  <p className="text-xs font-bold text-slate-400">
                    再连对 {Math.max(0, 3 - word.correctStreak)} 次就掌握啦
                  </p>
                  <ProgressBar percent={(word.correctStreak / 3) * 100} tone="grass" height={8} />
                </div>
              )}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="w-11 h-11 flex items-center justify-center rounded-2xl hover:bg-slate-100 text-slate-400 shrink-0"
          aria-label={expanded ? '收起' : '展开'}
          aria-expanded={expanded}
        >
          <Icon name="arrowRight" size={20} className={expanded ? 'rotate-90' : ''} />
        </button>
      </div>

      <div className="flex items-center flex-wrap gap-2.5 mt-4 pl-0 sm:pl-[58px]">
        <SpeakPair text={word.word} size="sm" />
        <Button tone="plain" size="sm" icon="pencil" onClick={onEdit}>
          编辑
        </Button>
        <Button
          tone={word.isMastered ? 'plain' : 'grass'}
          size="sm"
          icon={word.isMastered ? 'close' : 'check'}
          onClick={onToggleMastered}
        >
          {word.isMastered ? '取消掌握' : '标记掌握'}
        </Button>
        <Button tone="danger" size="sm" icon="trash" onClick={onRemove}>
          删除
        </Button>
      </div>
    </Card>
  );
}

/* ───────────────────────── 小弹窗容器 ───────────────────────── */

function SmallModal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-cocoa-700/45" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl bg-cream p-5 sm:p-6 animate-[grow-up_0.22s_ease-out]">
        <div className="flex items-center justify-between mb-4">
          <p className="text-lg font-extrabold text-cocoa-700">{title}</p>
          <button
            type="button"
            onClick={onClose}
            className="w-11 h-11 flex items-center justify-center rounded-2xl hover:bg-sakura-100 text-cocoa-500"
            aria-label="关闭"
          >
            <Icon name="close" size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default VocabularyPage;
