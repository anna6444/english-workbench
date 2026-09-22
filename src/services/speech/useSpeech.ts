import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { selectBestVoice } from './voiceSelector';

/** 标准朗读语速（中考听力风格，比正常语速慢一点） */
export const STANDARD_RATE = 0.8;
/** 慢速跟读语速 */
export const SLOW_RATE = 0.4;
/** 中文朗读语速（比英文稍快，因为孩子中文母语） */
export const ZH_RATE = 0.85;

export interface SpeakOptions {
  rate?: number;
  pitch?: number;
  lang?: string;
  /** 开始发声 */
  onStart?: () => void;
  /** 正常结束 */
  onEnd?: () => void;
  /** 出错（含被 cancel 打断） */
  onError?: (e: SpeechSynthesisErrorEvent) => void;
}

export interface UseSpeechReturn {
  /** 朗读（可自定义语速等） */
  speak: (text: string, opts?: SpeakOptions) => void;
  /** 标准语速朗读（0.8） */
  speakStandard: (text: string) => void;
  /** 慢速跟读（0.4） */
  speakSlow: (text: string) => void;
  /** 用中文音色朗读（古诗、提示语） */
  speakZh: (text: string, rate?: number) => void;
  /** 依次朗读多段文本 */
  speakSequence: (items: string[], rate?: number, gapMs?: number) => void;
  stop: () => void;
  /** 当前是否正在发声 */
  speaking: boolean;
  /** 当前正在读的文本，用于给对应按钮加高亮 */
  currentText: string | null;
  /** 浏览器是否支持语音合成 */
  supported: boolean;
  /** 音色是否已加载完成（未完成时发音可能不是最优音色） */
  voiceReady: boolean;
  /** 当前选中的音色名 */
  voiceName: string | null;
  /**
   * 解锁语音：iOS Safari 要求首次 speak 必须在用户手势的同步调用栈里，
   * 否则会被静默拦截。在首次点击时调用一次即可。
   */
  unlock: () => void;
}

/**
 * 统一语音引擎 Hook。
 *
 * 设计要点：
 * 1. 音色加载三保险：getVoices() 首调 + voiceschanged 事件 + 轮询兜底
 *    （部分 Android WebView 不触发 voiceschanged 事件）
 * 2. 每次 speak 前先 cancel()，避免连续点击导致声音叠加
 * 3. 组件卸载 / 页面切后台时停止发声，避免路由切换后声音还在读
 */
export function useSpeech(): UseSpeechReturn {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceReady, setVoiceReady] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [currentText, setCurrentText] = useState<string | null>(null);

  const unlockedRef = useRef(false);
  /** 顺序朗读的定时器句柄，卸载时需要清掉 */
  const seqTimers = useRef<number[]>([]);

  // ── 音色加载（三保险） ──
  useEffect(() => {
    if (!supported) return;

    let cancelled = false;

    const load = () => {
      const list = window.speechSynthesis.getVoices();
      if (cancelled || list.length === 0) return;
      setVoices(list);
      setVoiceReady(true);
    };

    // 保险 1：立即尝试
    load();

    // 保险 2：监听事件
    window.speechSynthesis.addEventListener('voiceschanged', load);

    // 保险 3：轮询兜底（某些 WebView 不触发事件）
    const poll = window.setInterval(() => {
      if (window.speechSynthesis.getVoices().length > 0) {
        load();
        window.clearInterval(poll);
      }
    }, 250);
    const pollStop = window.setTimeout(() => window.clearInterval(poll), 3000);

    return () => {
      cancelled = true;
      window.speechSynthesis.removeEventListener('voiceschanged', load);
      window.clearInterval(poll);
      window.clearTimeout(pollStop);
    };
  }, [supported]);

  const voice = useMemo(() => selectBestVoice(voices), [voices]);
  const zhVoice = useMemo(
    () => voices.find((v) => /zh[-_]CN/i.test(v.lang)) ?? voices.find((v) => /^zh/i.test(v.lang)) ?? null,
    [voices],
  );

  /** 清掉所有顺序朗读的待执行定时器 */
  const clearSeqTimers = useCallback(() => {
    seqTimers.current.forEach((t) => window.clearTimeout(t));
    seqTimers.current = [];
  }, []);

  const stop = useCallback(() => {
    if (!supported) return;
    clearSeqTimers();
    window.speechSynthesis.cancel();
    setSpeaking(false);
    setCurrentText(null);
  }, [supported, clearSeqTimers]);

  const speak = useCallback(
    (text: string, opts: SpeakOptions = {}) => {
      if (!supported || !text?.trim()) return;

      const synth = window.speechSynthesis;
      // 先取消上一条，避免叠加；也顺便清理顺序朗读
      clearSeqTimers();
      synth.cancel();

      const utter = new SpeechSynthesisUtterance(text.trim());
      utter.lang = opts.lang ?? 'en-US';
      utter.rate = opts.rate ?? STANDARD_RATE;
      // 音调略高一点，对孩子更亲和
      utter.pitch = opts.pitch ?? 1.05;
      utter.volume = 1;

      // 中文文本用中文音色，英文用优选出的英文音色
      const isZh = (opts.lang ?? 'en-US').startsWith('zh');
      const chosen = isZh ? zhVoice : voice;
      if (chosen) utter.voice = chosen;

      utter.onstart = () => {
        setSpeaking(true);
        setCurrentText(text);
        opts.onStart?.();
      };
      utter.onend = () => {
        setSpeaking(false);
        setCurrentText(null);
        opts.onEnd?.();
      };
      utter.onerror = (e) => {
        setSpeaking(false);
        setCurrentText(null);
        opts.onError?.(e);
      };

      synth.speak(utter);
    },
    [supported, voice, zhVoice, clearSeqTimers],
  );

  const speakStandard = useCallback(
    (text: string) => speak(text, { rate: STANDARD_RATE }),
    [speak],
  );

  const speakSlow = useCallback((text: string) => speak(text, { rate: SLOW_RATE }), [speak]);

  const speakZh = useCallback(
    (text: string, rate: number = ZH_RATE) =>
      speak(text, { rate, lang: 'zh-CN', pitch: 1 }),
    [speak],
  );

  /** 依次朗读多段文本（如逐句读古诗），间隔由 gapMs 控制 */
  const speakSequence = useCallback(
    (items: string[], rate: number = STANDARD_RATE, gapMs = 2200) => {
      if (!supported || !items.length) return;
      clearSeqTimers();
      window.speechSynthesis.cancel();

      let i = 0;
      const step = () => {
        if (i >= items.length) {
          setSpeaking(false);
          setCurrentText(null);
          return;
        }
        const text = items[i++];
        // 用队列方式排入，而不是 cancel —— 保证句子之间自然衔接
        const utter = new SpeechSynthesisUtterance(text);
        utter.lang = /[\u4e00-\u9fa5]/.test(text) ? 'zh-CN' : 'en-US';
        utter.rate = rate;
        utter.pitch = 1.05;
        const chosen = utter.lang.startsWith('zh') ? zhVoice : voice;
        if (chosen) utter.voice = chosen;
        utter.onstart = () => {
          setSpeaking(true);
          setCurrentText(text);
        };
        window.speechSynthesis.speak(utter);

        const t = window.setTimeout(step, gapMs);
        seqTimers.current.push(t);
      };
      step();
    },
    [supported, voice, zhVoice, clearSeqTimers],
  );

  /**
   * 手势解锁。iOS Safari 下第一次发声必须在用户点击的同步栈内，
   * 所以这里用一个极短的 utterance 把语音通道打开。
   */
  const unlock = useCallback(() => {
    if (!supported || unlockedRef.current) return;
    unlockedRef.current = true;
    try {
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      u.rate = 1;
      window.speechSynthesis.speak(u);
    } catch {
      /* 不影响后续使用 */
    }
  }, [supported]);

  // 组件卸载时停止发声
  useEffect(() => {
    return () => {
      if (supported) {
        seqTimers.current.forEach((t) => window.clearTimeout(t));
        window.speechSynthesis.cancel();
      }
    };
  }, [supported]);

  return {
    speak,
    speakStandard,
    speakSlow,
    speakZh,
    speakSequence,
    stop,
    speaking,
    currentText,
    supported,
    voiceReady,
    voiceName: voice?.name ?? null,
    unlock,
  };
}
