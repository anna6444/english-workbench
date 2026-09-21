import { createContext, useContext, useEffect, type PropsWithChildren } from 'react';
import { useSpeech, type UseSpeechReturn } from './useSpeech';

const SpeechContext = createContext<UseSpeechReturn | null>(null);

/**
 * 全局语音单例。
 *
 * 为什么必须单例：若每个组件各自调用 useSpeech，它们会各持一个
 * utterance 状态，彼此 cancel 对方的播放，还会出现「A 按钮已停止但
 * 高亮还在」的错乱。全应用共用一份状态才一致。
 */
export function SpeechProvider({ children }: PropsWithChildren) {
  const speech = useSpeech();

  // 页面切到后台时停止发声，避免回到前台突然冒出声音
  useEffect(() => {
    const onHidden = () => {
      if (document.hidden) speech.stop();
    };
    document.addEventListener('visibilitychange', onHidden);
    return () => document.removeEventListener('visibilitychange', onHidden);
  }, [speech]);

  return <SpeechContext.Provider value={speech}>{children}</SpeechContext.Provider>;
}

export function useGlobalSpeech(): UseSpeechReturn {
  const ctx = useContext(SpeechContext);
  if (!ctx) {
    throw new Error('useGlobalSpeech 必须在 <SpeechProvider> 内部使用');
  }
  return ctx;
}

export * from './useSpeech';
export { selectBestVoice, describeVoice } from './voiceSelector';
