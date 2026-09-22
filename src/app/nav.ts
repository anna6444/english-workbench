/**
 * 导航配置 —— 学生端模块导航（含新增的柯基乐园）。
 *
 * 单独抽成配置的好处：侧边栏、底部 Tab、首页模块宫格、
 * 路由表都从这一份数据生成，加新模块只改这里。
 *
 * 铁律：学生端导航不再包含任何管理入口 ——
 * 家长视图 / 辅导视图有独立的 Shell 与路由守卫，学生根本到不了。
 */

import type { IconName } from '@/components/Icon';

export interface NavItem {
  /** 路由路径 */
  path: string;
  /** 模块中文名 */
  label: string;
  /** 一句话说明（首页宫格用） */
  desc: string;
  icon: IconName;
  /** 主题色（Tailwind 颜色名，用于卡片底色） */
  tone: NavTone;
  /** 是否放进移动端底部 Tab（最多 5 个） */
  mobileTab?: boolean;
}

export type NavTone = 'sky' | 'grass' | 'sun' | 'candy' | 'grape';

/** 各色调对应的 Tailwind 类（sky/emerald/amber/pink/violet 已在主题里暖色化） */
export const TONE_CLASS: Record<
  NavTone,
  { bg: string; softBg: string; text: string; border: string; ring: string }
> = {
  sky: {
    bg: 'bg-sky-500',
    softBg: 'bg-sky-50',
    text: 'text-sky-700',
    border: 'border-sky-200',
    ring: 'ring-sky-300',
  },
  grass: {
    bg: 'bg-emerald-500',
    softBg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    ring: 'ring-emerald-300',
  },
  sun: {
    bg: 'bg-amber-500',
    softBg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    ring: 'ring-amber-300',
  },
  candy: {
    bg: 'bg-pink-500',
    softBg: 'bg-pink-50',
    text: 'text-pink-700',
    border: 'border-pink-200',
    ring: 'ring-pink-300',
  },
  grape: {
    bg: 'bg-violet-500',
    softBg: 'bg-violet-50',
    text: 'text-violet-700',
    border: 'border-violet-200',
    ring: 'ring-violet-300',
  },
};

/** 学生端模块（含 3D 柯基养成乐园） */
export const STUDENT_NAV: (NavItem & { path: string })[] = [
  { path: '/', label: '学习首页', desc: '今天学什么', icon: 'home', tone: 'sky', mobileTab: true },
  { path: '/units', label: '单元学习', desc: '跟着课本走', icon: 'book', tone: 'grass', mobileTab: true },
  { path: '/vocabulary', label: '我的单词库', desc: '查过的词都在这', icon: 'cards', tone: 'sun', mobileTab: true },
  { path: '/corgi', label: '柯基乐园', desc: '喂养我的小狗', icon: 'paw', tone: 'candy', mobileTab: true },
  { path: '/exam', label: '考试挑战', desc: '单元小测', icon: 'target', tone: 'sun', mobileTab: true },
  { path: '/listening', label: '听力电台', desc: '慢慢听，慢慢说', icon: 'headphone', tone: 'grape' },
  { path: '/reading', label: '阅读世界', desc: '读绘本学句子', icon: 'bookOpen', tone: 'candy' },
  { path: '/writing', label: '写作工坊', desc: '看图写句子', icon: 'pencil', tone: 'grass' },
  { path: '/wrongbook', label: '错题本', desc: '消灭小怪兽', icon: 'shield', tone: 'candy' },
  { path: '/progress', label: '学习进度', desc: '看看我多棒', icon: 'chart', tone: 'grape' },
];

/** 移动端底部 Tab（5 个） */
export const MOBILE_TABS = STUDENT_NAV.filter((n) => n.mobileTab);

/** 取某条路径对应的模块配置（用于高亮当前项） */
export function findNavByPath(path: string): NavItem | undefined {
  return STUDENT_NAV.find((n) => n.path === path);
}
