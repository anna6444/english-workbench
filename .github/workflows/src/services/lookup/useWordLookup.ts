/**
 * useWordLookup —— 查词状态机 Hook。
 *
 * 状态流转：
 *   idle ──查词──> partial ──在线返回──> done
 *                    │                    ▲
 *                    └──── 在线失败 ──────┘
 *
 * partial = 已有可用数据、界面已解锁，后台还在补全。
 * 这是解决「等待慢、卡死」体验痛点的关键中间态：
 * 用户不用等 API，第一段（离线/占位）一出来就能点朗读、能保存。
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { LookupDraft, LookupStatus } from '../../types';
import {
  enhanceDraftOnline,
  resolveDraftImmediately,
} from '../lookup/lookupService';
import type { OnlineLookupResult } from '../lookup/lookupService';

export type LookupPhase = 'idle' | 'partial' | 'done';

export interface WordLookupState {
  phase: LookupPhase;
  word: string;
  draft: LookupDraft | null;
  /** 离线词库是否命中（未命中时 UI 应提一句"这个词暂未收录，已联网查询"） */
  offlineHit: boolean;
  online: OnlineLookupResult | null;
  elapsedMs: number;
  error: string | null;
}

const INITIAL: WordLookupState = {
  phase: 'idle',
  word: '',
  draft: null,
  offlineHit: false,
  online: null,
  elapsedMs: 0,
  error: null,
};

export interface UseWordLookupResult extends WordLookupState {
  /** 发起查词。同步阶段立刻 setState，UI 不会卡 */
  lookup: (word: string) => void;
  reset: () => void;
  /** 是否处于"数据还没到齐但已经能用"的状态 */
  isPartial: boolean;
  /** 是否还在等在线结果（用于显示小转圈） */
  isEnhancing: boolean;
}

export function useWordLookup(): UseWordLookupResult {
  const [state, setState] = useState<WordLookupState>(INITIAL);

  // 记录当前进行中的查词的序号，用于丢弃过期结果（竞态防护）
  const seqRef = useRef(0);
  // 用于组件卸载时取消
  const abortRef = useRef<AbortController | null>(null);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const lookup = useCallback((rawWord: string) => {
    const word = rawWord.trim();
    if (!word) return;

    // 序号自增：任何更早发出的请求返回时都会被忽略
    seqRef.current += 1;
    const seq = seqRef.current;

    // 取消上一次仍在进行中的在线请求
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    /* ── 第一段：同步，立刻出结果 ── */
    const { draft, offlineHit } = resolveDraftImmediately(word);

    // 离线词库命中 = 音标/翻译/例句都齐全 → 对用户来说数据已经完整，
    // 直接进入 done，不再显示「补全中」。在线请求在后台静默跑，
    // 拿回更好的数据再悄悄替换（用户几乎感知不到，但也没有等待感）。
    // 只有离线未命中（占位数据）时才需要显式告诉用户「正在联网查询」。
    const dataComplete = offlineHit && draft.lookupStatus === 'offline';

    setState({
      phase: dataComplete ? 'done' : 'partial',
      word,
      draft,
      offlineHit,
      online: null,
      elapsedMs: 0,
      error: null,
    });

    /* ── 第二段：异步增强，永不 reject ── */
    void (async () => {
      const started = Date.now();
      try {
        const { draft: merged, online } = await enhanceDraftOnline(
          word,
          draft,
          controller.signal,
        );
        if (!aliveRef.current || seq !== seqRef.current) return; // 过期结果丢弃

        // 离线数据本来就不完整 → 在线失败时要如实告知，让用户知道为什么没查到
        const needNotice = !dataComplete && !online.ok;
        setState({
          phase: 'done',
          word,
          draft: merged,
          offlineHit,
          online,
          // dataComplete 时在线只是增强，不展示耗时（避免"用了 3 秒"的错觉）
          elapsedMs: dataComplete ? 0 : online.elapsedMs || Date.now() - started,
          error: needNotice ? '在线词库暂时不可用，已展示本地数据' : null,
        });
      } catch {
        // 理论上 enhanceDraftOnline 不会抛，这里做最后兜底：
        // 即便抛了也把第一段数据标记为 done，绝不让 UI 卡在 loading
        if (!aliveRef.current || seq !== seqRef.current) return;
        setState((prev) =>
          prev.word === word
            ? {
                ...prev,
                phase: 'done',
                error: '在线查询失败，已保留本地数据',
              }
            : prev,
        );
      }
    })();
  }, []);

  const reset = useCallback(() => {
    seqRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    setState(INITIAL);
  }, []);

  return {
    ...state,
    lookup,
    reset,
    isPartial: state.phase === 'partial',
    isEnhancing: state.phase === 'partial' && state.draft !== null,
  };
}

/** 把草稿状态映射成落库用的 lookupStatus */
export function toStoredStatus(draft: LookupDraft): LookupStatus {
  return draft.lookupStatus;
}
