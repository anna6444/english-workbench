/**
 * ProceduralCorgi —— 程序化生成的卡通柯基（GLB 模型缺失时的兜底方案）。
 *
 * 建模思路（皮克斯/汪汪队质感的关键）：
 *   - 全部使用圆润几何体（球/胶囊/圆锥），无硬边
 *   - meshToonMaterial + 3 阶渐变贴图 → 赛璐璐卡通着色
 *   - 大耳朵 + 短腿 + 蓬松尾巴 + 白色柯基眉 —— 柯基特征拉满
 *
 * 动画（全部 useFrame 手写，零动画库依赖）：
 *   idle   呼吸起伏 + 摇尾巴 + 随机歪头
 *   jump   跳一下（squash & stretch）
 *   nuzzle 蹭一蹭（身体左右摆）
 *   sit    坐下（后仰）
 *   shake  握手（右前爪伸出+抖动）
 *   spin   转圈
 *
 * 交互：
 *   - 点击头部 / 身体 → onZoneClick 分区回调
 *   - 瞳孔跟随鼠标/手指（eyeL/eyeR rotation lerp 指针方向）
 */

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ANIM_DURATION, type AnimCommand } from './animCommand';

export type CorgiZone = 'head' | 'body';

export interface ProceduralCorgiProps {
  /** 动画命令（nonce 递增触发） */
  command: AnimCommand;
  /** 点击分区回调：head=头部（跳跃+爱心+汪汪），body=身体（蹭蹭+语音） */
  onZoneClick: (zone: CorgiZone) => void;
  /** 佩戴饰品：'bow' | 'hat' | null */
  equippedAccessory: string | null;
}

/* ── 柯基配色 ── */
const C = {
  orange: '#F2A45C',
  orangeDeep: '#E08A3C',
  cream: '#FFF6EC',
  ink: '#33261F',
  nose: '#4A342A',
  pink: '#F9A8C0',
  blush: '#FFA9BC',
  bow: '#FF5F87',
  hat: '#7B8FD4',
};

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

export function ProceduralCorgi({ command, onZoneClick, equippedAccessory }: ProceduralCorgiProps) {
  const rootRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const tailRef = useRef<THREE.Group>(null);
  const pawRef = useRef<THREE.Group>(null);
  const eyeLRef = useRef<THREE.Group>(null);
  const eyeRRef = useRef<THREE.Group>(null);

  /* 卡通渐变贴图（3 阶色阶 → 赛璐璐感） */
  const gradientMap = useMemo(() => {
    const data = new Uint8Array([90, 170, 255]);
    const tex = new THREE.DataTexture(data, 3, 1, THREE.RedFormat);
    tex.minFilter = THREE.NearestFilter;
    tex.magFilter = THREE.NearestFilter;
    tex.needsUpdate = true;
    return tex;
  }, []);

  /* 动画状态机（ref 而非 state —— 渲染函数绝不回头 setState，防环路） */
  const anim = useRef<{ type: AnimCommand['type']; start: number }>({ type: 'idle', start: 0 });

  useEffect(() => {
    if (command.nonce > 0) {
      anim.current = { type: command.type, start: -1 };
    }
  }, [command]);

  /* 歪头节奏 */
  const tiltTarget = useRef(0);
  const nextTiltAt = useRef(2);

  useFrame((state, delta) => {
    const root = rootRef.current;
    const body = bodyRef.current;
    const head = headRef.current;
    const tail = tailRef.current;
    const paw = pawRef.current;
    if (!root || !body || !head || !tail) return;

    const t = state.clock.elapsedTime;

    /* 动画进度：start=-1 表示该命令尚未对齐到帧时钟 */
    if (anim.current.start < 0) anim.current.start = t;
    const type = anim.current.type;
    let p = 0;
    if (type !== 'idle') {
      const el = t - anim.current.start;
      const dur = ANIM_DURATION[type];
      if (el >= dur) {
        anim.current = { type: 'idle', start: t };
      } else {
        p = el / dur;
      }
    }
    const active = anim.current.type;

    /* ── 基础重置（每帧从干净状态叠加，避免残影漂移） ── */
    root.position.y = 0.05;
    root.rotation.set(0, 0, 0);
    body.rotation.set(0, 0, 0);
    body.position.set(0, 0.55, 0);
    head.position.set(0, 0.55, 0.72);
    if (paw) paw.rotation.set(0, 0, 0);

    /* ── idle：呼吸 + 摇尾 + 歪头 ── */
    const breathe = Math.sin(t * 2.4) * 0.02;
    body.scale.set(1 + breathe * 0.6, 1 + breathe, 1 + breathe * 0.4);

    tail.rotation.y = Math.sin(t * 9) * 0.6;
    tail.rotation.x = 0.45 + Math.sin(t * 4.5) * 0.12;

    if (t > nextTiltAt.current) {
      tiltTarget.current = [-0.24, 0, 0, 0.24][Math.floor(Math.random() * 4)];
      nextTiltAt.current = t + 3 + Math.random() * 3.5;
    }

    /* ── 命令动画叠加 ── */
    if (active === 'jump') {
      const s = Math.sin(p * Math.PI);
      root.position.y = 0.05 + s * 0.85;
      root.rotation.x = -s * 0.12;
      // squash & stretch
      const sq = p < 0.2 ? 1 - (0.2 - p) * 0.9 : p > 0.85 ? 1 - (p - 0.85) * 1.4 : 1;
      body.scale.y *= sq;
      body.scale.x *= 2 - sq;
      head.rotation.z = tiltTarget.current;
    } else if (active === 'nuzzle') {
      root.rotation.z = Math.sin(p * Math.PI * 4) * 0.11;
      body.rotation.z = -Math.sin(p * Math.PI * 4) * 0.06;
      head.rotation.z = tiltTarget.current + Math.sin(p * Math.PI * 4 + 0.8) * 0.16;
      tail.rotation.y = Math.sin(t * 16) * 0.8; // 开心加速摇
    } else if (active === 'sit') {
      const ease = smooth(Math.min(1, p * 3.2));
      const backEase = p > 0.82 ? smooth(Math.min(1, (p - 0.82) / 0.18)) : 0;
      const k = ease * (1 - backEase);
      body.rotation.x = -0.5 * k;
      root.position.y = 0.05 - 0.16 * k;
      head.position.y = 0.55 + 0.1 * k;
      head.rotation.z = tiltTarget.current * (1 - k) + 0.12 * k;
    } else if (active === 'shake' && paw) {
      const out = smooth(Math.min(1, p * 4));
      const back = p > 0.75 ? smooth(Math.min(1, (p - 0.75) / 0.25)) : 0;
      const k = out * (1 - back);
      paw.rotation.x = -1.35 * k;
      paw.position.z = 0.28 + 0.3 * k;
      paw.rotation.z = Math.sin(p * Math.PI * 8) * 0.22 * k;
      head.rotation.z = tiltTarget.current * (1 - k) + (-0.15) * k;
      tail.rotation.y = Math.sin(t * 14) * 0.7;
    } else if (active === 'spin') {
      root.rotation.y = smooth(p) * Math.PI * 2;
      tail.rotation.y = Math.sin(t * 15) * 0.8;
    } else {
      /* idle：缓慢回正视角 */
      head.rotation.z = lerp(head.rotation.z, tiltTarget.current, 1 - Math.pow(0.001, delta));
    }

    /* ── 瞳孔跟随指针（永远生效，卡通灵魂） ── */
    const px = state.pointer.x;
    const py = state.pointer.y;
    const follow = 1 - Math.pow(0.0001, delta);
    for (const eye of [eyeLRef.current, eyeRRef.current]) {
      if (!eye) continue;
      eye.rotation.y = lerp(eye.rotation.y, THREE.MathUtils.clamp(px, -1, 1) * 0.45, follow);
      eye.rotation.x = lerp(eye.rotation.x, THREE.MathUtils.clamp(-py, -1, 1) * 0.3, follow);
    }
  });

  /* 公共材质 props */
  const toon = (color: string): { color: string; gradientMap: THREE.DataTexture } => ({
    color,
    gradientMap,
  });

  return (
    <group ref={rootRef} position={[0, 0.05, 0]}>
      {/* ───── 身体（点击 → 蹭蹭） ───── */}
      <group
        ref={bodyRef}
        position={[0, 0.55, 0]}
        onPointerDown={(e) => {
          e.stopPropagation();
          onZoneClick('body');
        }}
      >
        {/* 躯干（水平胶囊） */}
        <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
          <capsuleGeometry args={[0.4, 0.55, 8, 20]} />
          <meshToonMaterial {...toon(C.orange)} />
        </mesh>
        {/* 白肚皮 */}
        <mesh position={[0, -0.1, 0.02]} rotation={[Math.PI / 2, 0, 0]}>
          <capsuleGeometry args={[0.31, 0.5, 8, 18]} />
          <meshToonMaterial {...toon(C.cream)} />
        </mesh>
        {/* 胸前白毛 */}
        <mesh position={[0, -0.04, 0.34]}>
          <sphereGeometry args={[0.27, 20, 16]} />
          <meshToonMaterial {...toon(C.cream)} />
        </mesh>

        {/* 蓬松尾巴 */}
        <group ref={tailRef} position={[0, 0.32, -0.52]}>
          <mesh position={[0, 0.06, -0.06]} scale={[1, 0.85, 1.35]}>
            <sphereGeometry args={[0.15, 16, 14]} />
            <meshToonMaterial {...toon(C.cream)} />
          </mesh>
          <mesh position={[0, 0.14, -0.18]}>
            <sphereGeometry args={[0.1, 14, 12]} />
            <meshToonMaterial {...toon(C.orange)} />
          </mesh>
        </group>

        {/* 四条小短腿（白色） */}
        {[
          { pos: [-0.23, -0.42, 0.26] },
          { pos: [0.23, -0.42, 0.26], paw: true },
          { pos: [-0.25, -0.42, -0.28] },
          { pos: [0.25, -0.42, -0.28] },
        ].map((leg, i) => (
          <group key={i} ref={leg.paw ? pawRef : undefined} position={leg.pos as [number, number, number]}>
            <mesh castShadow position={[0, -0.08, 0]}>
              <capsuleGeometry args={[0.085, 0.16, 6, 12]} />
              <meshToonMaterial {...toon(C.cream)} />
            </mesh>
            <mesh position={[0, -0.19, 0.02]} scale={[1, 0.6, 1.2]}>
              <sphereGeometry args={[0.09, 12, 10]} />
              <meshToonMaterial {...toon(C.cream)} />
            </mesh>
          </group>
        ))}
      </group>

      {/* ───── 头部（点击 → 跳跃+爱心+汪汪） ───── */}
      <group
        ref={headRef}
        position={[0, 0.55, 0.72]}
        onPointerDown={(e) => {
          e.stopPropagation();
          onZoneClick('head');
        }}
      >
        {/* 头 */}
        <mesh castShadow>
          <sphereGeometry args={[0.34, 24, 20]} />
          <meshToonMaterial {...toon(C.orange)} />
        </mesh>
        {/* 口鼻（白） */}
        <mesh position={[0, -0.09, 0.24]} scale={[1, 0.85, 1]}>
          <sphereGeometry args={[0.18, 18, 14]} />
          <meshToonMaterial {...toon(C.cream)} />
        </mesh>
        {/* 鼻子 */}
        <mesh position={[0, -0.03, 0.4]}>
          <sphereGeometry args={[0.055, 12, 10]} />
          <meshToonMaterial {...toon(C.nose)} />
        </mesh>
        {/* 微笑小嘴 */}
        <mesh position={[0, -0.12, 0.37]} rotation={[-1.35, 0, Math.PI]}>
          <torusGeometry args={[0.075, 0.013, 8, 14, Math.PI]} />
          <meshBasicMaterial color={C.ink} />
        </mesh>

        {/* 眼睛（瞳孔跟随指针） */}
        <group ref={eyeLRef} position={[-0.14, 0.06, 0.27]}>
          <mesh>
            <sphereGeometry args={[0.072, 14, 12]} />
            <meshBasicMaterial color="#FFFFFF" />
          </mesh>
          <mesh position={[0, 0, 0.045]}>
            <sphereGeometry args={[0.046, 12, 10]} />
            <meshBasicMaterial color={C.ink} />
          </mesh>
          <mesh position={[0.016, 0.02, 0.078]}>
            <sphereGeometry args={[0.015, 8, 8]} />
            <meshBasicMaterial color="#FFFFFF" />
          </mesh>
        </group>
        <group ref={eyeRRef} position={[0.14, 0.06, 0.27]}>
          <mesh>
            <sphereGeometry args={[0.072, 14, 12]} />
            <meshBasicMaterial color="#FFFFFF" />
          </mesh>
          <mesh position={[0, 0, 0.045]}>
            <sphereGeometry args={[0.046, 12, 10]} />
            <meshBasicMaterial color={C.ink} />
          </mesh>
          <mesh position={[0.016, 0.02, 0.078]}>
            <sphereGeometry args={[0.015, 8, 8]} />
            <meshBasicMaterial color="#FFFFFF" />
          </mesh>
        </group>

        {/* 柯基白眉点 */}
        <mesh position={[-0.14, 0.19, 0.28]}>
          <sphereGeometry args={[0.038, 10, 8]} />
          <meshToonMaterial {...toon(C.cream)} />
        </mesh>
        <mesh position={[0.14, 0.19, 0.28]}>
          <sphereGeometry args={[0.038, 10, 8]} />
          <meshToonMaterial {...toon(C.cream)} />
        </mesh>

        {/* 大耳朵（柯基灵魂） */}
        <group position={[-0.19, 0.3, -0.02]} rotation={[0, 0, 0.22]}>
          <mesh castShadow>
            <coneGeometry args={[0.12, 0.32, 16]} />
            <meshToonMaterial {...toon(C.orange)} />
          </mesh>
          <mesh position={[0, -0.015, 0.035]} scale={[0.72, 0.8, 0.6]}>
            <coneGeometry args={[0.12, 0.32, 16]} />
            <meshToonMaterial {...toon(C.pink)} />
          </mesh>
        </group>
        <group position={[0.19, 0.3, -0.02]} rotation={[0, 0, -0.22]}>
          <mesh castShadow>
            <coneGeometry args={[0.12, 0.32, 16]} />
            <meshToonMaterial {...toon(C.orange)} />
          </mesh>
          <mesh position={[0, -0.015, 0.035]} scale={[0.72, 0.8, 0.6]}>
            <coneGeometry args={[0.12, 0.32, 16]} />
            <meshToonMaterial {...toon(C.pink)} />
          </mesh>
        </group>

        {/* 腮红 */}
        <mesh position={[-0.22, -0.08, 0.24]} scale={[1, 0.62, 0.4]}>
          <sphereGeometry args={[0.05, 10, 8]} />
          <meshBasicMaterial color={C.blush} transparent opacity={0.85} />
        </mesh>
        <mesh position={[0.22, -0.08, 0.24]} scale={[1, 0.62, 0.4]}>
          <sphereGeometry args={[0.05, 10, 8]} />
          <meshBasicMaterial color={C.blush} transparent opacity={0.85} />
        </mesh>

        {/* ── 佩戴饰品：蝴蝶结 ── */}
        {equippedAccessory === 'bow' && (
          <group position={[0, 0.4, 0.06]} rotation={[0.25, 0, 0]}>
            <mesh>
              <sphereGeometry args={[0.05, 10, 8]} />
              <meshToonMaterial {...toon(C.bow)} />
            </mesh>
            <mesh position={[-0.09, 0.02, 0]} rotation={[0, 0, Math.PI / 2]}>
              <coneGeometry args={[0.06, 0.13, 12]} />
              <meshToonMaterial {...toon(C.bow)} />
            </mesh>
            <mesh position={[0.09, 0.02, 0]} rotation={[0, 0, -Math.PI / 2]}>
              <coneGeometry args={[0.06, 0.13, 12]} />
              <meshToonMaterial {...toon(C.bow)} />
            </mesh>
          </group>
        )}

        {/* ── 佩戴饰品：小礼帽 ── */}
        {equippedAccessory === 'hat' && (
          <group position={[0, 0.42, 0]} rotation={[0.12, 0, 0.06]}>
            <mesh>
              <cylinderGeometry args={[0.1, 0.11, 0.17, 18]} />
              <meshToonMaterial {...toon(C.hat)} />
            </mesh>
            <mesh position={[0, -0.075, 0]}>
              <cylinderGeometry args={[0.2, 0.2, 0.03, 20]} />
              <meshToonMaterial {...toon(C.hat)} />
            </mesh>
            <mesh position={[0, -0.02, 0]}>
              <cylinderGeometry args={[0.115, 0.115, 0.05, 18]} />
              <meshToonMaterial color="#FFF3F5" gradientMap={gradientMap} />
            </mesh>
          </group>
        )}
      </group>
    </group>
  );
}

export default ProceduralCorgi;
