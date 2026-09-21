/**
 * 拍照/上传 OCR 识别服务（模块二 2.1）。
 *
 * 技术选型：tesseract.js v5 纯前端本地识别 ——
 *   - 不调任何付费/密钥 API，离线可用（铁律：零外链、免费）
 *   - wasm 核心 + 语言包全部本地打包在 public/ocr/，首次加载约 24MB，
 *     之后浏览器缓存；JS 主包按需动态 import（不打开识别弹窗就不下载）
 *
 * 用法：recognizeEnglishWords(file) → ['apple', 'banana', ...]
 *   只返回「纯英文字母组合」，中文/数字/符号/OCR 噪声全部过滤。
 */

/** OCR 资产基路径（Vite 的 BASE_URL 下） */
const OCR_BASE = `${import.meta.env.BASE_URL}ocr`;

type TesseractWorker = {
  recognize: (image: File | Blob) => Promise<{ data: { text: string } }>;
  setLogger: (cb: (m: { status: string; progress: number }) => void) => void;
  terminate: () => Promise<void>;
};

/** worker 单例：识别弹窗多次打开只初始化一次 */
let workerPromise: Promise<TesseractWorker> | null = null;

async function getWorker(onStatus?: (s: string, p: number) => void): Promise<TesseractWorker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      // 动态 import：路由级懒加载，不用 OCR 就不下载 400KB JS
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('eng', 1, {
        // 三件套全部指向本地 public/ocr（离线可用）
        workerPath: `${OCR_BASE}/worker.min.js`,
        corePath: `${OCR_BASE}/core`,
        langPath: `${OCR_BASE}/lang-data`,
      });
      return worker as unknown as TesseractWorker;
    })();
    // 初始化失败时清空单例，允许重试
    workerPromise.catch(() => {
      workerPromise = null;
    });
  }
  const worker = await workerPromise;
  if (onStatus) {
    worker.setLogger((m) => {
      if (m.status && typeof m.progress === 'number') {
        onStatus(m.status, m.progress);
      }
    });
  }
  return worker;
}

/** OCR 常见噪声：单字母重复（I1、l1、o0）、过短、非字母占比高 */
function isNoise(token: string): boolean {
  if (token.length < 2) return true;
  // 全是同一个字母（"llll"、"ii"）—— OCR 对空白/线条的误识别
  if (/^(.)\1+$/.test(token)) return true;
  // 纯元音/纯辅音的长串多为噪声（如 "xkqz"），真词几乎不会这样
  const vowels = (token.match(/[aeiouy]/g) ?? []).length;
  if (token.length >= 4 && vowels === 0) return true;
  return false;
}

/**
 * 识别图片中的英文单词（模块二 2.1 核心）。
 *
 * @param image 用户拍照/上传的图片文件
 * @param onProgress 进度回调（status + 0~1），UI 展示「正在识别 60%」
 * @returns 规范化（小写、去重、过滤噪声）的单词数组
 */
export async function recognizeEnglishWords(
  image: File | Blob,
  onProgress?: (s: string, p: number) => void,
): Promise<string[]> {
  const worker = await getWorker(onProgress);
  const { data } = await worker.recognize(image);
  const text = data.text ?? '';

  // 只保留英文字母组合（允许撇号和连字符：don't, ice-cream）
  const tokens = text.match(/[A-Za-z][A-Za-z'-]{1,}/g) ?? [];

  const seen = new Set<string>();
  const words: string[] = [];
  for (const t of tokens) {
    const w = t.toLowerCase().replace(/^['-]+|['-]+$/g, '');
    if (!w || isNoise(w) || seen.has(w)) continue;
    seen.add(w);
    words.push(w);
  }
  return words;
}

/** 释放 worker（页面卸载时可调用，不调也会随页面回收） */
export async function disposeOcr(): Promise<void> {
  if (workerPromise) {
    try {
      const w = await workerPromise;
      await w.terminate();
    } catch {
      /* 忽略 */
    }
    workerPromise = null;
  }
}
