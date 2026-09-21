/**
 * 3D 性能检测 —— 移动端弱设备自动降级。
 *
 * 两条线：
 *   1. 静态检测：进入页面时按 CPU 核数 / 内存 / 屏幕尺寸预判
 *   2. 运行时检测：CorgiScene 内 FPS 看门狗（持续 <28fps 触发页面降级）
 */

interface NavigatorWithMemory extends Navigator {
  deviceMemory?: number;
}

/** 静态弱设备判定 */
export function detectLowPerfDevice(): boolean {
  try {
    const nav = navigator as NavigatorWithMemory;
    const cores = nav.hardwareConcurrency ?? 4;
    const mem = nav.deviceMemory ?? 4;
    const smallScreen =
      typeof matchMedia !== 'undefined' && matchMedia('(max-width: 768px)').matches;
    return cores <= 3 || mem <= 2 || (smallScreen && cores <= 4);
  } catch {
    return false;
  }
}
