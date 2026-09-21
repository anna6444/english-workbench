/**
 * GlbCorgi —— GLB 模型版柯基（首选方案 A）。
 *
 * 从 public/models/corgi.glb 加载高质量卡通柯基模型。
 * 模型获取（免费，二选一）：
 *   1. Poly Pizza（CC0 低多边形）搜索 "corgi"：https://poly.pizza/search/corgi
 *   2. Quaternius「Animated Animals」动画动物包（CC0）：https://quaternius.com/packs/animatedanimals.html
 *   3. Sketchfab 筛选可下载 + CC 授权的 "corgi" 模型，导出 GLB
 * 下载后放到 public/models/corgi.glb 即自动启用；文件缺失或加载失败
 * 会由外层 ErrorBoundary 兜底切换到程序化柯基（方案 B），功能不受影响。
 *
 * 动画映射（尽力而为，找不到就保持静态+待机变换）：
 *   idle → 模型自带动画（若有）
 *   jump/sit/shake/spin/nuzzle → 找同名 clip，找不到则用整体变换近似
 */

import { useEffect, useMemo, useRef } from 'react';
import { useAnimations, useGLTF } from '@react-three/drei';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { ANIM_DURATION, type AnimCommand } from './animCommand';
import type { ProceduralCorgiProps } from './ProceduralCorgi';

export const CORGI_GLB_URL = '/models/corgi.glb';

/** 模型动画名 → 命令的模糊匹配表（不同模型的命名习惯） */
const CLIP_ALIASES: Record<string, string[]> = {
  idle: ['idle', 'Idle', 'rest', 'Standing'],
  jump: ['jump', 'Jump', 'hop'],
  sit: ['sit', 'Sit', 'sit_down'],
  shake: ['shake', 'Shake', 'hand', 'paw'],
  spin: ['spin', 'Spin', 'turn', 'roll'],
  nuzzle: ['nuzzle', 'pet', 'Petting', 'happy'],
};

function findClip(animations: THREE.AnimationClip[], type: string): THREE.AnimationClip | null {
  const aliases = CLIP_ALIASES[type] ?? [];
  for (const name of aliases) {
    const hit = animations.find((c) => c.name === name);
    if (hit) return hit;
  }
  for (const name of aliases) {
    const hit = animations.find((c) => c.name.toLowerCase().includes(name.toLowerCase()));
    if (hit) return hit;
  }
  return null;
}

export function GlbCorgi({ command, onZoneClick, equippedAccessory }: ProceduralCorgiProps) {
  const { scene, animations } = useGLTF(CORGI_GLB_URL);

  /* 克隆场景（避免污染缓存的原始模型） */
  const cloned = useMemo(() => scene.clone(true), [scene]);

  /* 归一化尺寸：把模型缩放到 ~1.4 单位高，站在地面上 */
  const fitted = useMemo(() => {
    const box = new THREE.Box3().setFromObject(cloned);
    const size = new THREE.Vector3();
    box.getSize(size);
    const h = Math.max(size.y, 0.001);
    const scale = 1.4 / h;
    cloned.scale.setScalar(scale);
    const box2 = new THREE.Box3().setFromObject(cloned);
    cloned.position.y = -box2.min.y; // 底面贴地
    return cloned;
  }, [cloned]);

  const { actions } = useAnimations(animations, fitted);
  const rootRef = useRef<THREE.Group>(null);
  const anim = useRef<{ type: AnimCommand['type']; start: number }>({ type: 'idle', start: 0 });

  useEffect(() => {
    if (command.nonce > 0) {
      anim.current = { type: command.type, start: -1 };
    }
  }, [command]);

  /* 命令 → 模型动画切换（由 command nonce 驱动，单向数据流） */
  useEffect(() => {
    const type = command.nonce > 0 ? command.type : 'idle';
    const idle = findClip(animations, 'idle') ?? animations[0];
    if (type === 'idle') {
      const idleAction = idle ? actions[idle.name] : undefined;
      if (idleAction) {
        Object.values(actions).forEach((a) => a?.fadeOut(0.2));
        idleAction.reset().fadeIn(0.2).play();
      }
      return;
    }
    const clip = findClip(animations, type);
    const clipAction = clip ? actions[clip.name] : undefined;
    if (clipAction) {
      Object.values(actions).forEach((a) => a?.fadeOut(0.15));
      clipAction.reset().fadeIn(0.15).play();
    }
  }, [command, animations, actions]);

  useFrame((state) => {
    const root = rootRef.current;
    if (!root) return;
    const t = state.clock.elapsedTime;
    if (anim.current.start < 0) anim.current.start = t;

    const type = anim.current.type;
    let p = 0;
    if (type !== 'idle') {
      const el = t - anim.current.start;
      const dur = ANIM_DURATION[type];
      if (el >= dur) anim.current = { type: 'idle', start: t };
      else p = el / dur;
    }
    const active = anim.current.type;

    /* 整体近似变换（模型自带动画时也叠加，效果更明显） */
    root.position.y = 0;
    root.rotation.set(0, 0, 0);
    if (active === 'jump') {
      root.position.y = Math.sin(p * Math.PI) * 0.7;
    } else if (active === 'nuzzle') {
      root.rotation.z = Math.sin(p * Math.PI * 4) * 0.08;
    } else if (active === 'spin') {
      root.rotation.y = p * Math.PI * 2;
    } else if (active === 'sit') {
      const k = Math.min(1, p * 3);
      root.position.y = -0.1 * k;
    }
  });

  return (
    <group ref={rootRef}>
      <primitive
        object={fitted}
        onPointerDown={(e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          onZoneClick('body');
        }}
      />
      {/* 头顶点击区（模型头顶的不可见球，保证「点头部」体验一致） */}
      <mesh
        position={[0, 1.55, 0.1]}
        visible={false}
        onPointerDown={(e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          onZoneClick('head');
        }}
      >
        <sphereGeometry args={[0.55, 8, 8]} />
      </mesh>
      {/* 饰品帽/蝴蝶结直接挂头顶 */}
      {equippedAccessory === 'bow' && (
        <group position={[0, 1.62, 0.28]} rotation={[0.3, 0, 0]}>
          <mesh>
            <sphereGeometry args={[0.06, 10, 8]} />
            <meshToonMaterial color="#FF5F87" />
          </mesh>
          <mesh position={[-0.11, 0.02, 0]} rotation={[0, 0, Math.PI / 2]}>
            <coneGeometry args={[0.07, 0.16, 12]} />
            <meshToonMaterial color="#FF5F87" />
          </mesh>
          <mesh position={[0.11, 0.02, 0]} rotation={[0, 0, -Math.PI / 2]}>
            <coneGeometry args={[0.07, 0.16, 12]} />
            <meshToonMaterial color="#FF5F87" />
          </mesh>
        </group>
      )}
      {equippedAccessory === 'hat' && (
        <group position={[0, 1.66, 0.1]} rotation={[0.12, 0, 0.06]}>
          <mesh>
            <cylinderGeometry args={[0.12, 0.13, 0.2, 18]} />
            <meshToonMaterial color="#7B8FD4" />
          </mesh>
          <mesh position={[0, -0.09, 0]}>
            <cylinderGeometry args={[0.24, 0.24, 0.035, 20]} />
            <meshToonMaterial color="#7B8FD4" />
          </mesh>
        </group>
      )}
    </group>
  );
}

export default GlbCorgi;
