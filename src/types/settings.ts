/**
 * 全局设置（家长/老师可改，学生端只读生效）。
 * 存全局 key（不分学生），因为「强制 2D」这类性能开关通常按设备/家庭统一。
 */

export interface SystemSettings {
  /**
   * 强制 2D 模式：跳过 WebGL 探测，柯基页直接用 2D 兜底渲染。
   * 场景：老旧手机/平板打开 3D 就卡甚至闪退，家长一键降级。
   */
  force2D: boolean;
  /** 设置最后更新时间 */
  updatedAt: number;
}

export const DEFAULT_SETTINGS: SystemSettings = {
  force2D: false,
  updatedAt: 0,
};
