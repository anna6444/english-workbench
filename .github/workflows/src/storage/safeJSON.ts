/**
 * 容错 JSON 解析：脏数据只告警，不让整个应用白屏。
 * localStorage 里的数据可能被用户手动改过、被旧版本写过、
 * 或被浏览器截断 —— 任何一条都不能让首页打不开。
 */

export function safeParse<T>(raw: string | null): T | undefined {
  if (raw === null) return undefined;
  try {
    const v = JSON.parse(raw) as T;
    return v === null ? undefined : v;
  } catch {
    console.warn('[Storage] JSON 解析失败，已忽略该条数据（不阻断渲染）');
    return undefined;
  }
}

export function safeStringify(value: unknown): string | undefined {
  try {
    return JSON.stringify(value);
  } catch (e) {
    // 循环引用 / BigInt 等
    console.error('[Storage] 序列化失败', e);
    return undefined;
  }
}

/** 判断是否为配额超限错误 */
export function isQuotaError(e: unknown): boolean {
  if (!(e instanceof DOMException)) return false;
  return (
    e.name === 'QuotaExceededError' ||
    e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    e.code === 22
  );
}
