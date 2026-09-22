import { SCHEMA_VERSION } from '../keys';

interface Migration {
  from: number;
  to: number;
  up: () => void;
}

/**
 * 有序迁移链。当前只有 v1（初始版本），所以列表为空。
 *
 * 未来加字段/改结构时，往这里追加一条即可，例如：
 *   { from: 1, to: 2, up: migrateV1ToV2 }
 * 老的用户数据会被自动搬过来，不需要让他们重来。
 */
const MIGRATIONS: Migration[] = [];

const META_VERSION_KEY = 'egw:meta:version';

export function runMigrations(): void {
  const raw = window.localStorage.getItem(META_VERSION_KEY);
  // 全新安装（没有任何版本记录）视为已是最新，无需迁移
  const current = raw === null ? SCHEMA_VERSION : Number(raw);

  if (!Number.isFinite(current) || current >= SCHEMA_VERSION) {
    window.localStorage.setItem(META_VERSION_KEY, String(SCHEMA_VERSION));
    return;
  }

  let v = current;
  while (v < SCHEMA_VERSION) {
    const step = MIGRATIONS.find((m) => m.from === v);
    if (!step) {
      console.error(`[Migrate] 缺少 v${v} → v${v + 1} 的迁移脚本，中止迁移`);
      break;
    }
    try {
      step.up();
      v = step.to;
      console.info(`[Migrate] 已升级到 v${v}`);
    } catch (e) {
      console.error(`[Migrate] v${step.from} → v${step.to} 失败，中止`, e);
      break;
    }
  }

  window.localStorage.setItem(META_VERSION_KEY, String(v));
}
