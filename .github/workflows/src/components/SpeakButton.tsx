/**
 * 朗读按钮 —— 全站语音的统一入口。
 *
 * 两种形态：
 *   - SpeakButton：标准朗读（rate 0.8，中考听力风格音色）
 *   - 慢速朗读用 <SpeakButton slow />
 *
 * 细节：
 *   - 正在朗读时按钮有呼吸高亮，孩子知道「它在说话」
 *   - 触摸后主动 unlock()，绕过 iOS 必须由用户手势触发的限制
 *   - 语音不可用时静默隐藏（而不是弹一堆报错）
 */

import { useGlobalSpeech } from '@/services/speech/SpeechProvider';
import { Icon } from './Icon';

export interface SpeakButtonProps {
  /** 要朗读的文本，通常传英文 */
  text: string;
  /** 慢速模式（rate 0.4），用于跟读练习 */
  slow?: boolean;
  /** 中文朗读模式 */
  zh?: boolean;
  size?: 'sm' | 'md' | 'lg';
  tone?: 'sky' | 'grass' | 'sun' | 'candy' | 'grape' | 'plain';
  label?: string;
  block?: boolean;
  className?: string;
}

const TONE: Record<string, string> = {
  sky: 'bg-sky-500 text-white hover:bg-sky-600',
  grass: 'bg-emerald-500 text-white hover:bg-emerald-600',
  sun: 'bg-amber-500 text-white hover:bg-amber-600',
  candy: 'bg-pink-500 text-white hover:bg-pink-600',
  grape: 'bg-violet-500 text-white hover:bg-violet-600',
  plain: 'bg-white text-slate-600 border-2 border-slate-200 hover:bg-slate-50',
};

const SIZE: Record<string, string> = {
  sm: 'min-h-[48px] min-w-[48px] px-3.5 rounded-2xl text-sm gap-1.5',
  md: 'min-h-[58px] min-w-[58px] px-5 rounded-2xl text-base gap-2',
  lg: 'min-h-[72px] min-w-[72px] px-7 rounded-3xl text-lg gap-2.5',
};

export function SpeakButton({
  text,
  slow = false,
  zh = false,
  size = 'md',
  tone = 'sky',
  label,
  block,
  className = '',
}: SpeakButtonProps) {
  const speech = useGlobalSpeech();

  // 浏览器不支持语音合成 → 不显示按钮，避免点了没反应的挫败感
  if (!speech.supported || !text.trim()) return null;

  const iconSize = size === 'lg' ? 26 : size === 'md' ? 22 : 18;
  const playing = speech.speaking && speech.currentText === text;

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    // iOS 必须在用户手势里解锁
    speech.unlock();
    if (playing) {
      speech.stop();
      return;
    }
    if (zh) speech.speakZh(text);
    else if (slow) speech.speakSlow(text);
    else speech.speakStandard(text);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={`${slow ? '慢速' : ''}朗读 ${text}`}
      className={[
        'inline-flex items-center justify-center font-bold transition-all duration-150 select-none',
        'active:scale-95',
        TONE[tone],
        SIZE[size],
        block ? 'w-full' : '',
        playing ? 'speaking-pulse ring-4 ring-white/60' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <Icon name={slow ? 'volumeSlow' : 'volume'} size={iconSize} />
      {label && <span>{label}</span>}
    </button>
  );
}

/**
 * 单词卡上的双喇叭组合：标准 + 慢速。
 * 这是「标准发音与慢速朗读引擎」在 UI 上的落点。
 */
export function SpeakPair({
  text,
  size = 'md',
  className = '',
}: {
  text: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const speech = useGlobalSpeech();
  if (!speech.supported) return null;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <SpeakButton text={text} slow={false} size={size} tone="sky" label="读一遍" />
      <SpeakButton text={text} slow size={size} tone="plain" label="慢慢读" />
    </div>
  );
}
