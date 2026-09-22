/**
 * 图标组件 —— 全内联 SVG，零外链。
 *
 * 为什么不用 emoji 做图标：emoji 在不同系统（iOS / Android / Windows /
 * 各种 Android 定制 ROM）长得完全不一样，有的甚至缺字变成方框。
 * 界面图标必须可控，所以一律手写 SVG。
 *
 * 风格：线性 + 圆头端点，粗一点（strokeWidth 2.2）更适合低龄儿童辨识。
 */

import type { SVGProps } from 'react';

export type IconName =
  | 'home'
  | 'book'
  | 'bookOpen'
  | 'cards'
  | 'headphone'
  | 'pencil'
  | 'target'
  | 'shield'
  | 'chart'
  | 'users'
  | 'clipboard'
  | 'star'
  | 'volume'
  | 'volumeSlow'
  | 'search'
  | 'check'
  | 'close'
  | 'arrowRight'
  | 'arrowLeft'
  | 'refresh'
  | 'menu'
  | 'download'
  | 'upload'
  | 'trash'
  | 'user'
  | 'lightning'
  | 'plus'
  | 'info'
  | 'lock'
  | 'paw'
  | 'bone'
  | 'ball'
  | 'heart'
  | 'mic'
  | 'shoppingBag';

interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName;
  /** 尺寸（px），默认 24 */
  size?: number;
  /** 线宽，默认 2.2（儿童向偏粗） */
  strokeWidth?: number;
}

/** 各图标的 path 数据（24x24 viewBox） */
const PATHS: Record<IconName, string[]> = {
  home: ['M3 10.5 12 3l9 7.5', 'M5.5 9.5V20h13V9.5', 'M9.5 20v-5.5h5V20'],
  book: [
    'M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z',
    'M4 20.5A2.5 2.5 0 0 1 6.5 18H20v3H6.5A2.5 2.5 0 0 1 4 20.5z',
  ],
  bookOpen: [
    'M12 6.5C10.5 5 8.5 4.5 4 4.5v13c4.5 0 6.5.5 8 2 1.5-1.5 3.5-2 8-2v-13c-4.5 0-6.5.5-8 2z',
    'M12 6.5v13',
  ],
  cards: [
    'M7 8.5h10a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z',
    'M8.5 8.5V6a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v7',
    'M9 13h6',
  ],
  headphone: [
    'M4 15v-2.5a8 8 0 0 1 16 0V15',
    'M4 15h2.5a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H5.5A1.5 1.5 0 0 1 4 18.5z',
    'M20 15h-2.5a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1h1a1.5 1.5 0 0 0 1.5-1.5z',
  ],
  pencil: [
    'M4 20h4l10-10a2.83 2.83 0 0 0-4-4L4 16z',
    'M13.5 6.5 17.5 10.5',
  ],
  target: [
    'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
    'M12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9z',
    'M12 13.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z',
  ],
  shield: [
    'M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6z',
    'M9 12l2 2 4-4.5',
  ],
  chart: ['M4 20V4', 'M4 20h16', 'M8.5 20v-6', 'M13 20V9', 'M17.5 20v-9'],
  users: [
    'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
    'M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5',
    'M16 4.6a3.5 3.5 0 0 1 0 6.8',
    'M18 14.8c2 .8 3.3 2.6 3.3 5.2',
  ],
  clipboard: [
    'M9 4.5H7.5A1.5 1.5 0 0 0 6 6v13a1.5 1.5 0 0 0 1.5 1.5h9A1.5 1.5 0 0 0 18 19V6a1.5 1.5 0 0 0-1.5-1.5H15',
    'M9.5 3h5a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z',
    'M9.5 12h5', 'M9.5 16h3',
  ],
  star: [
    'M12 3.5 14.7 9l6 .9-4.35 4.2 1.05 6L12 17.3 6.6 20.1l1.05-6L3.3 9.9l6-.9z',
  ],
  volume: [
    'M5 9.5h3l4-3.5v12l-4-3.5H5z',
    'M15.5 9.5a3.5 3.5 0 0 1 0 5',
    'M18 7a7 7 0 0 1 0 10',
  ],
  volumeSlow: [
    'M5 9.5h3l4-3.5v12l-4-3.5H5z',
    'M15.5 10a2.5 2.5 0 0 1 0 4',
  ],
  search: ['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z', 'M21 21l-4.3-4.3'],
  check: ['M5 13l4.5 4.5L19 7'],
  close: ['M6 6l12 12', 'M18 6L6 18'],
  arrowRight: ['M5 12h13', 'M13 6l6 6-6 6'],
  arrowLeft: ['M19 12H6', 'M11 6l-6 6 6 6'],
  refresh: [
    'M20 12a8 8 0 1 1-2.6-5.9',
    'M20 4v4.5h-4.5',
  ],
  menu: ['M4 7h16', 'M4 12h16', 'M4 17h16'],
  download: ['M12 4v11', 'M7.5 11l4.5 4.5L16.5 11', 'M4.5 19.5h15'],
  upload: ['M12 15V4', 'M7.5 8l4.5-4.5L16.5 8', 'M4.5 19.5h15'],
  trash: [
    'M4.5 6.5h15',
    'M9.5 6.5V4.8a.8.8 0 0 1 .8-.8h3.4a.8.8 0 0 1 .8.8v1.7',
    'M6.5 6.5l1 12.7a.8.8 0 0 0 .8.8h7.4a.8.8 0 0 0 .8-.8l1-12.7',
    'M10.5 10.5v6', 'M13.5 10.5v6',
  ],
  user: ['M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M5 20.5c0-3.6 3.1-6 7-6s7 2.4 7 6'],
  lightning: ['M13.5 3 5.5 13.5h5L10 21l8.5-10.5h-5z'],
  plus: ['M12 5.5v13', 'M5.5 12h13'],
  info: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 11v5.5', 'M12 7.8v.2'],
  lock: [
    'M6.5 10.5h11a1.5 1.5 0 0 1 1.5 1.5v7a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19v-7a1.5 1.5 0 0 1 1.5-1.5z',
    'M8.5 10.5V7.8a3.5 3.5 0 0 1 7 0v2.7',
    'M12 14.5v2.5',
  ],
  /* 狗爪印：一掌三趾 */
  paw: [
    'M12 12.6c-2.6 0-4.7 1.7-4.7 3.8 0 1.6 1.2 2.8 2.8 2.8.7 0 1.2-.3 1.9-.3s1.2.3 1.9.3c1.6 0 2.8-1.2 2.8-2.8 0-2.1-2.1-3.8-4.7-3.8z',
    'M7.2 10.3a1.9 1.9 0 1 0 0-3.8 1.9 1.9 0 0 0 0 3.8z',
    'M12 9a1.9 1.9 0 1 0 0-3.8A1.9 1.9 0 0 0 12 9z',
    'M16.8 10.3a1.9 1.9 0 1 0 0-3.8 1.9 1.9 0 0 0 0 3.8z',
  ],
  /* 骨头 */
  bone: [
    'M8.5 15.5 15.5 8.5',
    'M7.2 13.2a2 2 0 1 1-2.4 2.4 2 2 0 1 1 2.4-2.4z',
    'M16.8 10.8a2 2 0 1 0 2.4-2.4 2 2 0 1 0-2.4 2.4z',
    'M6.6 17.4a2 2 0 1 0 3.2 2.4 2 2 0 0 0-3.2-2.4z',
    'M17.4 6.6a2 2 0 1 1-3.2-2.4 2 2 0 0 1 3.2 2.4z',
  ],
  /* 网球 */
  ball: [
    'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
    'M5.5 5.5c3 2.5 4.5 5 4.5 6.5s-1.5 6-4.5 6.5',
    'M18.5 5.5c-3 2.5-4.5 5-4.5 6.5s1.5 6 4.5 6.5',
  ],
  heart: [
    'M12 20.5s-7.5-4.6-9.3-9.2C1.4 7.9 3.6 4.5 7 4.5c2 0 3.6 1.1 5 3 1.4-1.9 3-3 5-3 3.4 0 5.6 3.4 4.3 6.8-1.8 4.6-9.3 9.2-9.3 9.2z',
  ],
  mic: [
    'M12 15.5a3.5 3.5 0 0 0 3.5-3.5V6a3.5 3.5 0 0 0-7 0v6a3.5 3.5 0 0 0 3.5 3.5z',
    'M5.5 11.5a6.5 6.5 0 0 0 13 0',
    'M12 18v3',
  ],
  shoppingBag: [
    'M6 8h12l1 12H5L6 8z',
    'M9 10.5V7a3 3 0 0 1 6 0v3.5',
  ],
};

/** 需要填充（而不是描边）的图标 */
const FILLED: IconName[] = ['star', 'lightning', 'heart'];

export function Icon({ name, size = 24, strokeWidth = 2.2, ...rest }: IconProps) {
  const paths = PATHS[name];
  const filled = FILLED.includes(name);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

export default Icon;
