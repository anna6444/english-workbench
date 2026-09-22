/**
 * 基础 UI 组件库 —— 全部遵循「大按钮、卡通化、减文字」的低龄设计原则。
 *
 * 尺寸约定（移动端优先）：
 *   - 主按钮高度 ≥ 72px（kid 尺寸），远超 44px 无障碍下限
 *   - 正文 ≥ 16px，避免 iOS 聚焦时自动放大
 *   - 圆角走 kid 系列（20~28px），营造柔和的卡通感
 */

import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

/* ─────────────────────────── 按钮 ─────────────────────────── */

export type ButtonTone = 'sky' | 'grass' | 'sun' | 'candy' | 'grape' | 'plain' | 'danger';

const BTN_TONE: Record<ButtonTone, string> = {
  sky: 'bg-sky-500 text-white hover:bg-sky-600 active:bg-sky-700 shadow-[0_5px_0_0_#0369a1]',
  grass:
    'bg-emerald-500 text-white hover:bg-emerald-600 active:bg-emerald-700 shadow-[0_5px_0_0_#047857]',
  sun: 'bg-amber-500 text-white hover:bg-amber-600 active:bg-amber-700 shadow-[0_5px_0_0_#b45309]',
  candy:
    'bg-pink-500 text-white hover:bg-pink-600 active:bg-pink-700 shadow-[0_5px_0_0_#be185d]',
  grape:
    'bg-violet-500 text-white hover:bg-violet-600 active:bg-violet-700 shadow-[0_5px_0_0_#6d28d9]',
  plain:
    'bg-white text-slate-700 hover:bg-slate-50 active:bg-slate-100 border-2 border-slate-200',
  danger:
    'bg-rose-50 text-rose-600 hover:bg-rose-100 active:bg-rose-200 border-2 border-rose-200',
};

export type ButtonSize = 'sm' | 'md' | 'lg';

const BTN_SIZE: Record<ButtonSize, string> = {
  sm: 'min-h-[52px] px-5 text-base rounded-2xl gap-2',
  md: 'min-h-[64px] px-7 text-lg rounded-2xl gap-2.5',
  lg: 'min-h-[76px] px-9 text-xl rounded-3xl gap-3',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: ButtonTone;
  size?: ButtonSize;
  icon?: IconName;
  iconRight?: IconName;
  block?: boolean;
  /** 按下时下沉效果（卡通按钮手感） */
  pressable?: boolean;
}

export function Button({
  tone = 'sky',
  size = 'md',
  icon,
  iconRight,
  block,
  pressable = true,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  const iconSize = size === 'lg' ? 28 : size === 'md' ? 24 : 20;

  return (
    <button
      className={[
        'inline-flex items-center justify-center font-bold',
        'transition-all duration-100 select-none',
        'disabled:opacity-45 disabled:cursor-not-allowed disabled:shadow-none',
        BTN_TONE[tone],
        BTN_SIZE[size],
        block ? 'w-full' : '',
        pressable
          ? 'active:translate-y-[3px] active:shadow-none'
          : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {icon && <Icon name={icon} size={iconSize} />}
      {children}
      {iconRight && <Icon name={iconRight} size={iconSize} />}
    </button>
  );
}

/* ─────────────────────────── 卡片 ─────────────────────────── */

interface CardProps {
  children: ReactNode;
  className?: string;
  /** 是否可点击（加 hover 抬升） */
  interactive?: boolean;
  onClick?: () => void;
}

export function Card({ children, className = '', interactive, onClick }: CardProps) {
  const base = 'bg-white rounded-3xl border-2 border-sakura-100 shadow-soft';
  if (!interactive) {
    return <div className={`${base} ${className}`}>{children}</div>;
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${base} text-left w-full transition-all duration-150 hover:-translate-y-1 hover:shadow-soft-lg active:translate-y-0 ${className}`}
    >
      {children}
    </button>
  );
}

/** 区块标题 */
export function SectionTitle({
  icon,
  title,
  extra,
}: {
  icon?: IconName;
  title: string;
  extra?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 mb-4">
      <h2 className="flex items-center gap-2.5 text-xl font-extrabold text-slate-800">
        {icon && <Icon name={icon} size={24} className="text-sky-500" />}
        {title}
      </h2>
      {extra}
    </div>
  );
}

/* ─────────────────────────── 状态占位 ─────────────────────────── */

export function EmptyState({
  emoji = '🐣',
  title,
  desc,
  action,
}: {
  emoji?: string;
  title: string;
  desc?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6">
      <div className="text-6xl mb-4 select-none">{emoji}</div>
      <p className="text-lg font-bold text-slate-700">{title}</p>
      {desc && <p className="text-base text-slate-500 mt-2 max-w-sm leading-relaxed">{desc}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function LoadingState({ text = '马上就好…' }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-14">
      <div className="flex gap-2 mb-4">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-3.5 h-3.5 rounded-full bg-sky-400 animate-bounce"
            style={{ animationDelay: `${i * 0.14}s` }}
          />
        ))}
      </div>
      <p className="text-base text-slate-500">{text}</p>
    </div>
  );
}

/* ─────────────────────────── 数据小件 ─────────────────────────── */

/** 星星数量展示 */
export function StarCount({ value, size = 20 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-extrabold text-amber-500">
      <Icon name="star" size={size} />
      <span>{value}</span>
    </span>
  );
}

/** 数据卡片：大数字 + 小标签 */
export function StatCard({
  label,
  value,
  unit,
  emoji,
  tone = 'sky',
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  emoji?: string;
  tone?: 'sky' | 'grass' | 'sun' | 'candy' | 'grape';
}) {
  const bg: Record<string, string> = {
    sky: 'bg-sky-50 border-sky-100',
    grass: 'bg-emerald-50 border-emerald-100',
    sun: 'bg-amber-50 border-amber-100',
    candy: 'bg-pink-50 border-pink-100',
    grape: 'bg-violet-50 border-violet-100',
  };
  const color: Record<string, string> = {
    sky: 'text-sky-600',
    grass: 'text-emerald-600',
    sun: 'text-amber-600',
    candy: 'text-pink-600',
    grape: 'text-violet-600',
  };

  return (
    <div className={`rounded-3xl border-2 p-5 ${bg[tone]}`}>
      <div className="flex items-center gap-2 mb-2">
        {emoji && <span className="text-xl">{emoji}</span>}
        <span className="text-sm font-bold text-slate-500">{label}</span>
      </div>
      <div className={`text-3xl font-extrabold ${color[tone]} leading-none`}>
        {value}
        {unit && <span className="text-base font-bold ml-1">{unit}</span>}
      </div>
    </div>
  );
}

/** 进度条 */
export function ProgressBar({
  percent,
  tone = 'sky',
  height = 12,
}: {
  percent: number;
  tone?: 'sky' | 'grass' | 'sun' | 'candy' | 'grape';
  height?: number;
}) {
  const safe = Math.max(0, Math.min(100, Math.round(percent)));
  const fill: Record<string, string> = {
    sky: 'bg-sky-400',
    grass: 'bg-emerald-400',
    sun: 'bg-amber-400',
    candy: 'bg-pink-400',
    grape: 'bg-violet-400',
  };
  return (
    <div
      className="w-full bg-slate-100 rounded-full overflow-hidden"
      style={{ height }}
      role="progressbar"
      aria-valuenow={safe}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={`h-full rounded-full transition-all duration-500 ${fill[tone]}`}
        style={{ width: `${safe}%` }}
      />
    </div>
  );
}

/** 标签胶囊 */
export function Chip({
  children,
  tone = 'slate',
  size = 'md',
}: {
  children: ReactNode;
  tone?: 'slate' | 'sky' | 'grass' | 'sun' | 'candy' | 'grape' | 'rose';
  size?: 'sm' | 'md';
}) {
  const tones: Record<string, string> = {
    slate: 'bg-slate-100 text-slate-600',
    sky: 'bg-sky-100 text-sky-700',
    grass: 'bg-emerald-100 text-emerald-700',
    sun: 'bg-amber-100 text-amber-700',
    candy: 'bg-pink-100 text-pink-700',
    grape: 'bg-violet-100 text-violet-700',
    rose: 'bg-rose-100 text-rose-700',
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-bold ${tones[tone]} ${
        size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-sm'
      }`}
    >
      {children}
    </span>
  );
}

/** 徽章展示 */
export function BadgeItem({
  emoji,
  name,
  desc,
  earned,
}: {
  emoji: string;
  name: string;
  desc: string;
  earned: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center text-center p-4 rounded-3xl border-2 transition-all ${
        earned
          ? 'bg-amber-50 border-amber-200'
          : 'bg-slate-50 border-slate-100 opacity-45 grayscale'
      }`}
      title={desc}
    >
      <span className="text-4xl mb-2 select-none">{emoji}</span>
      <span className="text-sm font-extrabold text-slate-700 leading-tight">{name}</span>
      <span className="text-xs text-slate-400 mt-1 leading-tight">{desc}</span>
    </div>
  );
}

/** 页面级错误提示 */
export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-2xl bg-rose-50 border-2 border-rose-100 px-4 py-3 text-sm text-rose-600 font-semibold">
      <Icon name="info" size={18} className="mt-0.5 shrink-0" />
      <span className="leading-relaxed">{children}</span>
    </div>
  );
}
