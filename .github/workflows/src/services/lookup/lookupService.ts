/**
 * 查词编排层 —— 离线优先 + 在线增强的「两段式」策略。
 *
 * 为什么这么设计：
 *   在线词典 API 在弱网/被墙/限流时响应可能长达数秒甚至挂死。
 *   如果让用户一直盯着转圈等 API，体验是灾难性的。
 *
 *   所以拆成两段：
 *     第一段（同步，0ms）  ：离线词库命中 → 立刻返回完整草稿，UI 立刻可用
 *     第二段（异步，≤3s）  ：在线 API 并发拉取 → 拿到更好的数据再替换上去
 *
 *   用户感知到的永远是「秒出」，在线数据只是锦上添花。
 *   即便在线部分超时，草稿里也有离线数据或占位数据，不会锁死界面。
 */

import type { LookupDraft } from '../../types';
import {
  draftFromOffline,
  draftPlaceholder,
  lookupOffline,
  normalizeWord,
} from './offlineDictionary';
import { lookupOnline, mergeOnlineIntoDraft } from './onlineDictionary';
import type { OnlineLookupResult } from './onlineDictionary';

export { LOOKUP_TIMEOUT_MS } from './onlineDictionary';
export type { OnlineLookupResult } from './onlineDictionary';

/** 第一段结果：无论离线是否命中，永远同步拿到 */
export interface ImmediateDraft {
  draft: LookupDraft;
  /** 离线词库是否命中（决定要不要立刻提示"暂未收录"） */
  offlineHit: boolean;
}

/**
 * 第一段 —— 同步解析，供 UI 立即渲染。
 * 离线词库命中则数据完整；未命中则给出占位草稿（含音节切分和 emoji）。
 */
export function resolveDraftImmediately(rawWord: string): ImmediateDraft {
  const word = normalizeWord(rawWord);
  const entry = lookupOffline(word);
  if (entry) {
    return { draft: draftFromOffline(entry), offlineHit: true };
  }
  return { draft: draftPlaceholder(word || rawWord.trim()), offlineHit: false };
}

/**
 * 第二段 —— 异步在线增强。
 * 返回合并后的草稿，供 UI 覆盖第一段的内容。
 *
 * 注意：本函数永不 reject。无论超时、断网还是接口改版，
 * 都会在 ≤3s 内 resolve 出一个草稿（最差情况就是原样返回第一段的结果）。
 */
export async function enhanceDraftOnline(
  word: string,
  base: LookupDraft,
  signal?: AbortSignal,
): Promise<{ draft: LookupDraft; online: OnlineLookupResult }> {
  // 调用方主动取消（例如用户已切走）→ 直接返回原草稿
  if (signal?.aborted) {
    return {
      draft: base,
      online: { ok: false, elapsedMs: 0 },
    };
  }

  const online = await lookupOnline(word);

  return {
    draft: mergeOnlineIntoDraft(base, online),
    online,
  };
}

/**
 * 一站式查词（供非 React 场景或需要顺序语义的地方使用）。
 * 内部仍是「同步拿第一段 → await 第二段」，但 UI 层应当用
 * resolveDraftImmediately + enhanceDraftOnline 分开调用来实现秒开效果。
 */
export async function lookupWord(rawWord: string): Promise<LookupDraft> {
  const { draft } = resolveDraftImmediately(rawWord);
  const { draft: merged } = await enhanceDraftOnline(rawWord, draft);
  return merged;
}
