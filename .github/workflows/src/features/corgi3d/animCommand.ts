/**
 * 柯基动画命令 —— 页面 → 3D 场景的单向指令流。
 *
 * 铁律（防渲染环路）：页面只发命令（nonce 递增），3D 组件在 useFrame
 * 内消费，绝 不 回 调 页 面 的 渲 染 函 数。数据流严格单向。
 */

export type AnimType = 'idle' | 'jump' | 'nuzzle' | 'sit' | 'shake' | 'spin';

export interface AnimCommand {
  type: AnimType;
  /** 命令序号，递增才触发（同 type 连发也能重放） */
  nonce: number;
}

export const IDLE_COMMAND: AnimCommand = { type: 'idle', nonce: 0 };

/** 各动画时长（秒），到时自动回 idle */
export const ANIM_DURATION: Record<AnimType, number> = {
  idle: Infinity,
  jump: 0.7,
  nuzzle: 0.9,
  sit: 1.8,
  shake: 1.4,
  spin: 1.2,
};
