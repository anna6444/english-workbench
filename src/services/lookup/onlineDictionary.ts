/**
 * 在线词典 —— 词典 API + 翻译 API 的并发编排。
 *
 * ⚠️ 三条硬性要求（针对「等待慢、页面卡死」的痛点）：
 *   1. 必须 Promise.allSettled 并发，严禁顺序 await 排队
 *   2. 必须 AbortController 硬超时（默认 3s），到点立刻放弃
 *   3. 超时 / 查不到都必须 resolve 出结果（带 unavailable 标记），
 *      绝不允许 reject 把 UI 锁死
 *
 * 两个数据源：
 *   - 词典：https://api.dictionaryapi.dev/api/v2/entries/en/{word}
 *     取音标 / 词性 / 释义 / 例句
 *   - 翻译：https://api.mymemory.translated.net/get?q={word}&langpair=en|zh-CN
 *     取中文翻译
 *
 * 两个源互相独立，任一失败只影响自己那部分字段。
 */

import type { LookupDraft } from '../../types';

/** 超时上限：3 秒。到点即放弃，让用户马上拿到「暂无翻译」的结果。 */
export const LOOKUP_TIMEOUT_MS = 3000;

const DICT_ENDPOINT = 'https://api.dictionaryapi.dev/api/v2/entries/en/';
const TRANSLATE_ENDPOINT = 'https://api.mymemory.translated.net/get';

/** 单次请求的结果信封：永远 resolve，用 ok 区分成败 */
interface FetchEnvelope<T> {
  ok: boolean;
  data?: T;
  reason?: 'timeout' | 'network' | 'http' | 'parse' | 'empty';
}

/**
 * 带硬超时的 fetch —— 本模块的核心基础设施。
 * 超时与网络错误统一转成 envelope，绝不 throw。
 */
async function fetchWithTimeout(
  url: string,
  timeoutMs: number,
): Promise<FetchEnvelope<unknown>> {
  // AbortController 是超时机制的唯一实现方式，
  // 用 Promise.race 只能"忽略"结果、无法真正掐断连接。
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      return { ok: false, reason: 'http' };
    }
    const data = await res.json();
    if (data === null || data === undefined) {
      return { ok: false, reason: 'empty' };
    }
    return { ok: true, data };
  } catch (err) {
    if (timedOut) {
      return { ok: false, reason: 'timeout' };
    }
    // AbortError 之外的错误一律按网络问题处理
    if (err instanceof Error && err.name === 'AbortError') {
      return { ok: false, reason: 'timeout' };
    }
    return { ok: false, reason: 'network' };
  } finally {
    clearTimeout(timer);
  }
}

/* ─────────────────────────── 词典解析 ─────────────────────────── */

interface DictPhonetic {
  text?: string;
}

interface DictDefinition {
  definition?: string;
  example?: string;
}

interface DictMeaning {
  partOfSpeech?: string;
  definitions?: DictDefinition[];
}

interface DictEntry {
  word?: string;
  phonetic?: string;
  phonetics?: DictPhonetic[];
  meanings?: DictMeaning[];
}

export interface DictResult {
  phonetic: string;
  partOfSpeech: string;
  definition: string;
  example: string;
}

/**
 * 从词典 API 的返回体里抽出我们需要的四个字段。
 * 返回体结构松散（phonetics 数组里可能多条、有的没 text），逐层兜底。
 */
export function parseDictPayload(payload: unknown): DictResult | null {
  if (!Array.isArray(payload) || payload.length === 0) return null;

  const entries = payload as DictEntry[];
  // 优先选带音标的那条 entry
  const entry =
    entries.find((e) => e.phonetic || (e.phonetics || []).some((p) => p?.text)) ??
    entries[0];
  if (!entry) return null;

  let phonetic = entry.phonetic ?? '';
  if (!phonetic) {
    const hit = (entry.phonetics ?? []).find((p) => p && typeof p.text === 'string' && p.text);
    phonetic = hit?.text ?? '';
  }

  const meaning = (entry.meanings ?? []).find((m) => m && (m.definitions ?? []).length > 0);
  const def = meaning?.definitions?.find((d) => d && d.definition);

  return {
    phonetic,
    partOfSpeech: meaning?.partOfSpeech ?? '',
    definition: def?.definition ?? '',
    example: def?.example ?? '',
  };
}

/* ─────────────────────────── 翻译解析 ─────────────────────────── */

interface TranslatePayload {
  responseData?: { translatedText?: string };
  responseStatus?: number | string;
  matches?: unknown;
}

/**
 * 从翻译 API 返回体里抽中文。
 * 注意：接口偶尔会原样把英文返回（说明没翻出来），这种要判定为失败。
 */
export function parseTranslatePayload(payload: unknown, word: string): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as TranslatePayload;
  const raw = p.responseData?.translatedText;
  if (typeof raw !== 'string') return null;

  const text = raw.trim();
  if (!text) return null;

  // 没翻出来时接口会把原词返回，或返回一串英文解释
  if (text.toLowerCase() === word.toLowerCase()) return null;
  // 一句纯英文（无任何中文）说明翻译未生效
  if (!/[\u4e00-\u9fa5]/.test(text)) return null;

  // 中文简体化处理：去首尾标点
  return text.replace(/^[\s"'“”「」]+|[\s"'“”「」]+$/g, '');
}

/* ─────────────────────────── 主入口 ─────────────────────────── */

export interface OnlineLookupResult {
  /** 中文翻译，取不到为 undefined */
  translation?: string;
  /** 音标（含斜杠），取不到为 undefined */
  phonetic?: string;
  partOfSpeech?: string;
  definition?: string;
  example?: string;
  /** 是否至少拿到了一项有效数据 */
  ok: boolean;
  /** 实际耗时（毫秒），用于 UI 展示与调优 */
  elapsedMs: number;
}

/**
 * 并发查询一个单词。
 *
 * 关键点：两个请求在同一时刻发出，总耗时 ≈ max(单个耗时) 而不是 sum。
 * 即便单词错拼、接口挂了、网络断了，本函数也会在 ≤3s 内 resolve。
 */
export async function lookupOnline(
  rawWord: string,
  timeoutMs: number = LOOKUP_TIMEOUT_MS,
): Promise<OnlineLookupResult> {
  const word = rawWord.trim().toLowerCase();
  const started = Date.now();

  if (!word) {
    return { ok: false, elapsedMs: 0 };
  }

  const dictUrl = `${DICT_ENDPOINT}${encodeURIComponent(word)}`;
  const transUrl = `${TRANSLATE_ENDPOINT}?q=${encodeURIComponent(word)}&langpair=en|zh-CN`;

  // ✅ 并发发起，绝不用 await 一个个来
  const [dictRes, transRes] = await Promise.allSettled([
    fetchWithTimeout(dictUrl, timeoutMs),
    fetchWithTimeout(transUrl, timeoutMs),
  ]);

  let dict: DictResult | null = null;
  if (dictRes.status === 'fulfilled' && dictRes.value.ok) {
    dict = parseDictPayload(dictRes.value.data);
  }

  let translation: string | null = null;
  if (transRes.status === 'fulfilled' && transRes.value.ok) {
    translation = parseTranslatePayload(transRes.value.data, word);
  }

  const result: OnlineLookupResult = {
    translation: translation ?? undefined,
    phonetic: dict?.phonetic || undefined,
    partOfSpeech: dict?.partOfSpeech || undefined,
    definition: dict?.definition || undefined,
    example: dict?.example || undefined,
    ok: Boolean(translation || dict?.phonetic || dict?.definition),
    elapsedMs: Date.now() - started,
  };

  return result;
}

/**
 * 把在线结果合并进一个草稿对象。
 * 只覆盖「在线能提供、且当前还是占位」的字段，不覆盖离线已有的好数据。
 */
export function mergeOnlineIntoDraft(
  draft: LookupDraft,
  online: OnlineLookupResult,
): LookupDraft {
  const isPlaceholder = (v?: string) =>
    !v || v === '暂无翻译' || v === '/—/' || v === '/ - /';

  const merged: LookupDraft = {
    ...draft,
    translation: isPlaceholder(draft.translation)
      ? online.translation ?? draft.translation
      : draft.translation,
    phonetic: isPlaceholder(draft.phonetic)
      ? online.phonetic ?? draft.phonetic
      : draft.phonetic,
    pos: draft.pos || online.partOfSpeech || undefined,
    exampleEn: draft.exampleEn || online.example || undefined,
  };

  // 只要在线拿回了任何一项有效数据，就算在线补全成功
  if (online.ok) {
    merged.lookupStatus = 'online';
    merged.lookupSource = draft.lookupSource === 'offline' ? 'mixed' : 'dictionaryapi';
  } else if (draft.lookupStatus === 'partial') {
    // 在线也没救回来，标记为失败但数据仍可用（占位数据）
    merged.lookupStatus = 'failed';
  }

  return merged;
}
