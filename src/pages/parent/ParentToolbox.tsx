/**
 * 家长工具箱 —— ParentViewPage 的管理区块（模块一 1.2 / 1.3 / 1.4）。
 *
 * 四张卡片：
 *   1. 星星管理：手动调整（±N 附理由，必填）+ 调整记录
 *   2. 奖励商城：自定义现实奖品的增删改（名称/emoji/星星数/上下架）+ 兑换记录兑现
 *   3. 数据备份：导出 JSON 快照 / 导入覆盖恢复（带二次确认）
 *   4. 体验设置：强制 2D 模式（老旧设备跳过 3D 渲染）
 *
 * 设计：独立组件 + onChanged 回调 —— 操作完成后通知父页刷新仪表盘，
 * 避免工具箱直接改父页 state（保持单向数据流）。
 */

import { useEffect, useRef, useState } from 'react';
import type { RewardState, SystemSettings } from '@/types';
import { DAILY_STAR_CAP } from '@/types';
import { Button, Card, Chip, SectionTitle } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { useRepositories } from '@/repositories/RepositoriesProvider';
import { useAuth } from '@/app/AuthProvider';
import {
  buildBackup,
  downloadBackup,
  importBackup,
  parseBackupText,
} from '@/services/backup/backupService';

export function ParentToolbox({
  reward,
  studentName,
  onChanged,
}: {
  reward: RewardState;
  studentName: string;
  /** 任一工具操作成功后回调（父页重新拉取仪表盘数据） */
  onChanged: () => void;
}) {
  const repos = useRepositories();
  const { currentStudent } = useAuth();
  const sid = currentStudent?.id;

  const [toolTab, setToolTab] = useState<'stars' | 'shop' | 'backup' | 'settings'>('stars');
  const [toast, setToast] = useState<string | null>(null);

  function showToast(text: string) {
    setToast(text);
    window.setTimeout(() => setToast((cur) => (cur === text ? null : cur)), 3000);
  }

  if (!sid || !currentStudent) return null;

  return (
    <section>
      <SectionTitle
        icon="clipboard"
        title="家长工具箱"
        extra={<Chip tone="sun" size="sm">{studentName}</Chip>}
      />

      {/* Tab 切换 */}
      <div className="flex items-center gap-2 rounded-2xl bg-white border-2 border-sakura-100 p-1.5 mb-4 overflow-x-auto">
        {(
          [
            { k: 'stars', label: '⭐ 星星管理' },
            { k: 'shop', label: '🎁 奖励商城' },
            { k: 'backup', label: '💾 数据备份' },
            { k: 'settings', label: '⚙️ 体验设置' },
          ] as { k: typeof toolTab; label: string }[]
        ).map((t) => (
          <button
            key={t.k}
            type="button"
            onClick={() => setToolTab(t.k)}
            className={`px-4 py-2.5 rounded-xl text-sm font-extrabold whitespace-nowrap transition-all min-h-[44px] ${
              toolTab === t.k
                ? 'bg-gradient-to-b from-butter-300 to-butter-400 text-white shadow-sm'
                : 'text-cocoa-500 hover:bg-sakura-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {toolTab === 'stars' && <StarsCard reward={reward} sid={sid} onChanged={onChanged} showToast={showToast} />}
      {toolTab === 'shop' && <ShopCard reward={reward} sid={sid} onChanged={onChanged} showToast={showToast} />}
      {toolTab === 'backup' && (
        <BackupCard parentId={currentStudent.parentId} parentName={currentStudent.name} showToast={showToast} />
      )}
      {toolTab === 'settings' && <SettingsCard onChanged={onChanged} showToast={showToast} />}

      {/* Toast */}
      {toast && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-24 z-50 rounded-2xl bg-cocoa-700/90 text-white px-5 py-3 text-sm font-bold shadow-soft-lg animate-grow-up max-w-[88vw] text-center">
          {toast}
        </div>
      )}
    </section>
  );
}

/* ───────────────────────── 1. 星星管理 ───────────────────────── */

function StarsCard({
  reward,
  sid,
  onChanged,
  showToast,
}: {
  reward: RewardState;
  sid: string;
  onChanged: () => void;
  showToast: (t: string) => void;
}) {
  const repos = useRepositories();
  const [delta, setDelta] = useState('5');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const todayStars = reward.dailyStars[todayKey()] ?? 0;

  async function doAdjust(sign: 1 | -1) {
    const n = Math.abs(parseInt(delta, 10));
    if (!n || Number.isNaN(n)) {
      showToast('请填写调整的星星数');
      return;
    }
    if (!reason.trim()) {
      showToast('请填写调整理由（孩子也能看到哦）');
      return;
    }
    setBusy(true);
    try {
      await repos.reward.adjustStars(sid, sign * n, reason.trim(), '家长');
      showToast(`${sign > 0 ? '补发' : '扣回'} ${n} 颗星星成功`);
      setReason('');
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-5 sm:p-6 space-y-5">
      <div className="grid grid-cols-2 gap-3.5">
        <div className="rounded-2xl bg-butter-50 border-2 border-butter-200 p-4 text-center">
          <p className="text-xs font-bold text-cocoa-500 mb-1">当前星星</p>
          <p className="text-3xl font-extrabold text-amber-600">{reward.stars}</p>
        </div>
        <div className="rounded-2xl bg-sky-50 border-2 border-sky-100 p-4 text-center">
          <p className="text-xs font-bold text-cocoa-500 mb-1">今日学习获得</p>
          <p className="text-3xl font-extrabold text-sky-600">
            {todayStars}
            <span className="text-sm text-cocoa-400"> / {DAILY_STAR_CAP} 上限</span>
          </p>
        </div>
      </div>
      <p className="text-xs font-bold text-cocoa-400 leading-relaxed">
        <Icon name="info" size={14} className="inline mr-1 -mt-0.5" />
        防沉迷保护：孩子每天通过学习最多获得 {DAILY_STAR_CAP} 颗星星。家长手动补发不受此限制，但会记录在下方明细中。
      </p>

      <div className="rounded-3xl bg-sakura-50 border-2 border-sakura-100 p-4 space-y-3">
        <p className="text-sm font-extrabold text-cocoa-600">手动调整星星</p>
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[120px]">
            <label className="text-xs font-bold text-cocoa-400">数量</label>
            <input
              type="number"
              value={delta}
              onChange={(e) => setDelta(e.target.value)}
              min={1}
              max={999}
              className="w-full mt-1 rounded-2xl border-2 border-sakura-200 bg-white px-4 py-3 text-base font-bold text-cocoa-700 outline-none focus:border-sakura-400"
              style={{ fontSize: 16 }}
            />
          </div>
          <div className="flex-[2] min-w-[180px]">
            <label className="text-xs font-bold text-cocoa-400">理由（必填）</label>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="例如：主动帮忙做家务 / 作业拖拉扣回"
              maxLength={40}
              className="w-full mt-1 rounded-2xl border-2 border-sakura-200 bg-white px-4 py-3 text-base font-semibold text-cocoa-700 placeholder:text-cocoa-300 placeholder:font-normal outline-none focus:border-sakura-400"
              style={{ fontSize: 16 }}
            />
          </div>
        </div>
        <div className="flex gap-3">
          <Button tone="grass" size="md" onClick={() => void doAdjust(1)} disabled={busy}>
            + 补发星星
          </Button>
          <Button tone="danger" size="md" onClick={() => void doAdjust(-1)} disabled={busy}>
            − 扣回星星
          </Button>
        </div>
      </div>

      {/* 调整记录 */}
      {reward.adjustments.length > 0 && (
        <div>
          <p className="text-sm font-extrabold text-cocoa-600 mb-2.5">最近调整记录</p>
          <div className="space-y-2">
            {reward.adjustments.slice(0, 8).map((a) => (
              <div key={a.id} className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3">
                <span
                  className={`text-lg font-extrabold w-14 text-right ${
                    a.delta > 0 ? 'text-emerald-600' : 'text-rose-500'
                  }`}
                >
                  {a.delta > 0 ? `+${a.delta}` : a.delta}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-cocoa-600 truncate">{a.reason}</p>
                  <p className="text-xs text-cocoa-400 font-semibold">
                    {a.adjustedBy} · {new Date(a.createdAt).toLocaleString('zh-CN', {
                      month: 'numeric',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

/* ───────────────────────── 2. 奖励商城编辑 ───────────────────────── */

function ShopCard({
  reward,
  sid,
  onChanged,
  showToast,
}: {
  reward: RewardState;
  sid: string;
  onChanged: () => void;
  showToast: (t: string) => void;
}) {
  const repos = useRepositories();
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('🎁');
  const [cost, setCost] = useState('20');
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCost, setEditCost] = useState('');

  async function doAdd() {
    const n = parseInt(cost, 10);
    if (!name.trim() || !n || n < 1) {
      showToast('请填写奖品名称和星星数');
      return;
    }
    setBusy(true);
    try {
      await repos.reward.addShopItem(sid, { name: name.trim(), emoji, cost: n });
      showToast(`「${name.trim()}」已上架`);
      setName('');
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function doRemove(itemId: string, itemName: string) {
    if (!window.confirm(`确定删除奖品「${itemName}」吗？（已兑换的记录会保留）`)) return;
    await repos.reward.removeShopItem(sid, itemId);
    showToast('已删除');
    onChanged();
  }

  async function doSaveCost(itemId: string) {
    const n = parseInt(editCost, 10);
    if (!n || n < 1) {
      showToast('星星数要大于 0');
      return;
    }
    await repos.reward.updateShopItem(sid, itemId, { cost: n });
    setEditingId(null);
    showToast('星星数已更新');
    onChanged();
  }

  async function doToggle(itemId: string, enabled: boolean) {
    await repos.reward.updateShopItem(sid, itemId, { enabled: !enabled });
    onChanged();
  }

  async function doFulfill(recordId: string) {
    await repos.reward.fulfillRedeem(sid, recordId);
    showToast('已标记兑现 ✅');
    onChanged();
  }

  const pending = reward.redeemed.filter((r) => r.status === 'pending');

  return (
    <Card className="p-5 sm:p-6 space-y-5">
      <p className="text-sm font-semibold text-cocoa-500 leading-relaxed">
        在这里设置「现实奖励」：孩子用积攒的星星兑换（如看一集动画片），
        兑换后需要你确认兑现 —— 让星星变成看得见的动力。
      </p>

      {/* 新增表单 */}
      <div className="rounded-3xl bg-sakura-50 border-2 border-sakura-100 p-4">
        <p className="text-sm font-extrabold text-cocoa-600 mb-3">新增奖品</p>
        <div className="flex flex-wrap gap-3">
          <div className="w-20">
            <label className="text-xs font-bold text-cocoa-400">图标</label>
            <input
              value={emoji}
              onChange={(e) => setEmoji(e.target.value.slice(0, 2))}
              className="w-full mt-1 rounded-2xl border-2 border-sakura-200 bg-white px-3 py-3 text-center text-lg outline-none focus:border-sakura-400"
              style={{ fontSize: 16 }}
            />
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="text-xs font-bold text-cocoa-400">奖品名称</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="看一集动画片"
              maxLength={20}
              className="w-full mt-1 rounded-2xl border-2 border-sakura-200 bg-white px-4 py-3 text-base font-semibold text-cocoa-700 placeholder:text-cocoa-300 outline-none focus:border-sakura-400"
              style={{ fontSize: 16 }}
            />
          </div>
          <div className="w-24">
            <label className="text-xs font-bold text-cocoa-400">星星数</label>
            <input
              type="number"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              min={1}
              className="w-full mt-1 rounded-2xl border-2 border-sakura-200 bg-white px-3 py-3 text-base font-bold text-cocoa-700 outline-none focus:border-sakura-400"
              style={{ fontSize: 16 }}
            />
          </div>
        </div>
        <Button tone="sky" size="md" className="mt-3" onClick={() => void doAdd()} disabled={busy}>
          上架奖品
        </Button>
      </div>

      {/* 奖品列表 */}
      {reward.customShop.length === 0 ? (
        <p className="text-sm font-bold text-cocoa-400 text-center py-4">
          还没有奖品，先添加一个吧～
        </p>
      ) : (
        <div className="space-y-2.5">
          {reward.customShop.map((item) => (
            <div
              key={item.id}
              className={`flex items-center gap-3 rounded-2xl border-2 px-4 py-3 ${
                item.enabled ? 'bg-white border-sakura-100' : 'bg-slate-50 border-slate-200 opacity-60'
              }`}
            >
              <span className="text-2xl select-none">{item.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-extrabold text-cocoa-700 truncate">{item.name}</p>
                {editingId === item.id ? (
                  <div className="flex items-center gap-2 mt-1.5">
                    <input
                      type="number"
                      value={editCost}
                      onChange={(e) => setEditCost(e.target.value)}
                      className="w-20 rounded-xl border-2 border-sakura-200 px-2 py-1.5 text-sm font-bold text-cocoa-700 outline-none focus:border-sakura-400"
                      style={{ fontSize: 16 }}
                    />
                    <button
                      type="button"
                      onClick={() => void doSaveCost(item.id)}
                      className="rounded-xl bg-emerald-500 text-white px-3 py-1.5 text-xs font-extrabold min-h-[36px]"
                    >
                      保存
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="rounded-xl bg-slate-100 text-cocoa-500 px-3 py-1.5 text-xs font-extrabold min-h-[36px]"
                    >
                      取消
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(item.id);
                      setEditCost(String(item.cost));
                    }}
                    className="mt-0.5 text-sm font-extrabold text-amber-600 hover:text-amber-700"
                  >
                    ⭐ {item.cost} <span className="text-xs font-bold text-cocoa-400">（点击修改）</span>
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => void doToggle(item.id, item.enabled)}
                  className={`rounded-xl px-3 py-2 text-xs font-extrabold min-h-[40px] ${
                    item.enabled ? 'bg-sky-100 text-sky-600' : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  {item.enabled ? '下架' : '上架'}
                </button>
                <button
                  type="button"
                  onClick={() => void doRemove(item.id, item.name)}
                  className="rounded-xl bg-rose-100 text-rose-500 px-3 py-2 text-xs font-extrabold min-h-[40px]"
                >
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 待兑现 */}
      {pending.length > 0 && (
        <div>
          <p className="text-sm font-extrabold text-cocoa-600 mb-2.5">
            待兑现兑换（{pending.length}）
          </p>
          <div className="space-y-2">
            {pending.map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-3 rounded-2xl bg-butter-50 border-2 border-butter-200 px-4 py-3"
              >
                <span className="text-2xl select-none">{r.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-extrabold text-cocoa-700">{r.itemName}</p>
                  <p className="text-xs text-cocoa-400 font-semibold">
                    花费 {r.cost} ⭐ ·{' '}
                    {new Date(r.redeemedAt).toLocaleString('zh-CN', {
                      month: 'numeric',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void doFulfill(r.id)}
                  className="rounded-xl bg-emerald-500 text-white px-4 py-2.5 text-xs font-extrabold min-h-[44px]"
                >
                  已兑现 ✅
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

/* ───────────────────────── 3. 数据备份 ───────────────────────── */

function BackupCard({
  parentId,
  parentName,
  showToast,
}: {
  parentId: string;
  parentName: string;
  showToast: (t: string) => void;
}) {
  const repos = useRepositories();
  const fileRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);

  async function doExport() {
    setExporting(true);
    try {
      const students = await repos.student.listByParent(parentId);
      const data = await buildBackup(repos, students, parentName);
      downloadBackup(data);
      showToast(`已导出 ${students.length} 个孩子的数据（含 ${data.questions.length} 道题）`);
    } catch (e) {
      console.error('[Backup] 导出失败', e);
      showToast('导出失败，请重试');
    } finally {
      setExporting(false);
    }
  }

  async function doImport(file: File) {
    setImporting(true);
    try {
      const text = await file.text();
      const data = parseBackupText(text);
      const ok = window.confirm(
        `确定用这份备份覆盖当前数据吗？\n\n` +
          `备份时间：${new Date(data.exportedAt).toLocaleString('zh-CN')}\n` +
          `包含 ${data.students.length} 个孩子、${data.questions.length} 道题\n\n` +
          `⚠️ 当前数据将被替换，此操作不可撤销`,
      );
      if (!ok) return;
      const stats = await importBackup(repos, data);
      showToast(`恢复成功：${stats.students} 个孩子 / ${stats.words} 个单词 / ${stats.questions} 道题`);
      // 数据已整体替换，刷新页面让所有视图重新加载
      window.setTimeout(() => window.location.reload(), 1200);
    } catch (e) {
      console.error('[Backup] 导入失败', e);
      showToast(e instanceof Error ? e.message : '导入失败，请检查文件格式');
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <Card className="p-5 sm:p-6 space-y-5">
      <p className="text-sm font-semibold text-cocoa-500 leading-relaxed">
        把全部孩子的单词库、错题本、星星、柯基养成数据打包成一个 JSON 文件。
        换设备、清浏览器缓存前记得先导出一份。
      </p>

      <div className="grid sm:grid-cols-2 gap-3.5">
        <button
          type="button"
          onClick={() => void doExport()}
          disabled={exporting}
          className="flex flex-col items-center rounded-3xl bg-sky-50 border-2 border-sky-200 p-5 transition-all hover:border-sky-300 active:translate-y-0.5 disabled:opacity-60 min-h-[110px]"
        >
          <span className="text-4xl mb-2 select-none">📤</span>
          <span className="text-base font-extrabold text-sky-600">
            {exporting ? '打包中…' : '导出备份'}
          </span>
          <span className="text-xs font-bold text-cocoa-400 mt-1">下载 JSON 文件到本机</span>
        </button>

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={importing}
          className="flex flex-col items-center rounded-3xl bg-emerald-50 border-2 border-emerald-200 p-5 transition-all hover:border-emerald-300 active:translate-y-0.5 disabled:opacity-60 min-h-[110px]"
        >
          <span className="text-4xl mb-2 select-none">📥</span>
          <span className="text-base font-extrabold text-emerald-600">
            {importing ? '恢复中…' : '导入恢复'}
          </span>
          <span className="text-xs font-bold text-cocoa-400 mt-1">选择备份文件，覆盖当前数据</span>
        </button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void doImport(f);
        }}
      />

      <p className="text-xs font-bold text-cocoa-400 leading-relaxed">
        <Icon name="info" size={14} className="inline mr-1 -mt-0.5" />
        导入是「整体覆盖」：恢复后回到备份那一刻的快照。账号密码不在备份里（安全考虑），如账号异常请用内置账号重新登录。
      </p>
    </Card>
  );
}

/* ───────────────────────── 4. 体验设置 ───────────────────────── */

function SettingsCard({
  onChanged,
  showToast,
}: {
  onChanged: () => void;
  showToast: (t: string) => void;
}) {
  const repos = useRepositories();
  const [settings, setSettings] = useState<SystemSettings | null>(null);

  useEffect(() => {
    void repos.settings.getSettings().then(setSettings);
  }, [repos]);

  async function doToggleForce2D() {
    if (!settings) return;
    const next = await repos.settings.updateSettings({ force2D: !settings.force2D });
    setSettings(next);
    showToast(next.force2D ? '已开启强制 2D（柯基页不再加载 3D）' : '已关闭强制 2D（恢复 3D 渲染）');
    onChanged();
  }

  if (!settings) {
    return <div className="h-28 rounded-3xl bg-white animate-pulse" />;
  }

  return (
    <Card className="p-5 sm:p-6 space-y-5">
      <div className="flex items-center justify-between gap-4 rounded-3xl bg-slate-50 border-2 border-slate-100 p-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-extrabold text-cocoa-700">强制 2D 模式</p>
          <p className="text-xs font-semibold text-cocoa-400 mt-1 leading-relaxed">
            老旧手机/平板打开柯基乐园卡顿或闪退时开启：跳过 3D 渲染，直接用轻量 2D 柯基。
          </p>
        </div>
        {/* 大号开关（≥44px 触控区） */}
        <button
          type="button"
          role="switch"
          aria-checked={settings.force2D}
          onClick={() => void doToggleForce2D()}
          className={`relative w-16 h-9 rounded-full transition-colors shrink-0 ${
            settings.force2D ? 'bg-emerald-500' : 'bg-slate-300'
          }`}
        >
          <span
            className={`absolute top-1 w-7 h-7 rounded-full bg-white shadow transition-all ${
              settings.force2D ? 'left-8' : 'left-1'
            }`}
          />
        </button>
      </div>

      <p className="text-xs font-bold text-cocoa-400">
        <Icon name="info" size={14} className="inline mr-1 -mt-0.5" />
        设置对所有孩子全局生效，保存在本机浏览器里。
      </p>
    </Card>
  );
}

/* ───────────────────────── 工具 ───────────────────────── */

function todayKey(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export default ParentToolbox;
