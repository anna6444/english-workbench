/**
 * CorgiScene —— 柯基乐园的 3D 舞台。
 *
 * 编排：
 *   Canvas（透明背景，页面给奶油渐变）
 *     ├─ 灯光（环境光 + 平行光；低配关阴影）
 *     ├─ 地面（薄荷草地 / 豪华狗窝模式换暖色垫子+小屋）
 *     ├─ 柯基（GLB 优先，ErrorBoundary 兜底程序化柯基）
 *     ├─ 爱心粒子
 *     ├─ 语音气泡（drei Html，挂在头顶）
 *     ├─ OrbitControls（拖拽旋转，限制角度）
 *     └─ FPS 看门狗（持续 <28fps → 通知页面降级）
 */

import { Component, Suspense, useMemo, useRef, useState, type ReactNode } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { ContactShadows, Float, Html, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { GlbCorgi } from './GlbCorgi';
import { ProceduralCorgi, type CorgiZone } from './ProceduralCorgi';
import { HeartParticles } from './HeartParticles';
import type { AnimCommand } from './animCommand';

export interface CorgiSceneProps {
  /** 动画命令 */
  command: AnimCommand;
  /** 爱心爆发 nonce（>0 时触发） */
  heartsNonce: number;
  /** 点击分区 */
  onZoneClick: (zone: CorgiZone) => void;
  /** 佩戴饰品 */
  equippedAccessory: string | null;
  /** 豪华狗窝（场景升级） */
  hasLuxuryNest: boolean;
  /** 气泡文本（null 隐藏） */
  bubble: string | null;
  /** 低画质模式（设备检测或运行时降级） */
  lowPerf: boolean;
  /** 运行时帧率过低回调（页面用来开启降级提示） */
  onLowFps?: () => void;
  /** 家长设置的强制 2D（模块一 1.4：老旧设备降级开关，优先于 WebGL 探测） */
  force2D?: boolean;
  /** 连续学习 30 天解锁的飞行背景（模块三 3.1：小院变天空云海） */
  flying?: boolean;
}

/* ───────── GLB 加载失败 → 程序化柯基兜底 ───────── */

class GLBErrorBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err: unknown) {
    console.info('[CorgiScene] GLB 模型不可用，已切换程序化柯基（方案 B）', err);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/* ───────── WebGL 完全不可用 → 2D 互动兜底 ─────────
 * 极老旧设备（WebGL 创建失败）不崩页：大号柯基 emoji + 同样的点击互动 +
 * 气泡 + 全部养成功能（喂养/玩耍/商城/语音指令照常工作）。
 */

class WebGLBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err: unknown) {
    console.warn('[CorgiScene] WebGL 不可用，已切换 2D 互动模式', err);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function Fallback2DCorgi({
  bubble,
  onZoneClick,
}: {
  bubble: string | null;
  onZoneClick: (zone: CorgiZone) => void;
}) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center select-none">
      {bubble && (
        <div className="mb-4 rounded-2xl border-[2.5px] border-sakura-300 bg-white px-4 py-2 text-[17px] font-extrabold text-cocoa-700 shadow-soft">
          {bubble}
        </div>
      )}
      <button
        type="button"
        onClick={() => onZoneClick('head')}
        className="text-[120px] leading-none transition-transform hover:scale-105 active:scale-95 animate-[wiggle_2.2s_ease-in-out_infinite]"
        aria-label="摸摸柯基的头"
      >
        🐶
      </button>
      <p className="mt-3 rounded-full bg-white/85 backdrop-blur px-4 py-1.5 text-xs font-bold text-cocoa-500">
        这台设备暂时打不开 3D 小院，点柯基一样能玩～
      </p>
    </div>
  );
}

/* ───────── FPS 看门狗 ───────── */

function FpsWatchdog({ onLowFps, enabled }: { onLowFps?: () => void; enabled: boolean }) {
  const acc = useRef({ frames: 0, elapsed: 0, fired: false });
  useFrame((_, delta) => {
    if (!enabled || !onLowFps || acc.current.fired) return;
    acc.current.frames += 1;
    acc.current.elapsed += delta;
    if (acc.current.elapsed >= 3) {
      const fps = acc.current.frames / acc.current.elapsed;
      if (fps < 28) {
        acc.current.fired = true;
        onLowFps();
      }
      acc.current.frames = 0;
      acc.current.elapsed = 0;
    }
  });
  return null;
}

/* ───────── 地面与狗窝 ───────── */

function Ground({ luxury, lowPerf }: { luxury: boolean; lowPerf: boolean }) {
  const gradientMap = useMemo(() => {
    const data = new Uint8Array([110, 190, 255]);
    const tex = new THREE.DataTexture(data, 3, 1, THREE.RedFormat);
    tex.minFilter = THREE.NearestFilter;
    tex.magFilter = THREE.NearestFilter;
    tex.needsUpdate = true;
    return tex;
  }, []);

  return (
    <group>
      {/* 草地圆台 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow={!lowPerf}>
        <circleGeometry args={[2.7, 40]} />
        <meshToonMaterial color={luxury ? '#FFD9E2' : '#C8EEDC'} gradientMap={gradientMap} />
      </mesh>
      {/* 草地描边圈 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <ringGeometry args={[2.7, 2.95, 40]} />
        <meshBasicMaterial color={luxury ? '#FFC3D3' : '#A9E3C8'} />
      </mesh>

      {/* 小装饰：草丛 / 花（豪华狗窝换花圃） */}
      {[
        [-1.9, 0, -0.9],
        [1.8, 0, -1.2],
        [-1.5, 0, 1.4],
        [2.1, 0, 0.9],
      ].map((pos, i) => (
        <group key={i} position={pos as [number, number, number]}>
          <mesh position={[0, 0.12, 0]} scale={[1, 1, 0.7]}>
            <sphereGeometry args={[0.14, 10, 8]} />
            <meshToonMaterial color={luxury ? '#FFB7C9' : '#8FD9AE'} gradientMap={gradientMap} />
          </mesh>
          {luxury && (
            <mesh position={[0, 0.26, 0]}>
              <sphereGeometry args={[0.06, 8, 8]} />
              <meshBasicMaterial color={['#FF7FA8', '#FFD45C', '#FF9FB8', '#FFB84D'][i % 4]} />
            </mesh>
          )}
        </group>
      ))}

      {/* 豪华狗窝：小屋（屋顶 + 墙 + 门洞贴片） */}
      {luxury && (
        <group position={[-1.75, 0, 0.35]} rotation={[0, 0.5, 0]}>
          <mesh position={[0, 0.3, 0]} castShadow={!lowPerf}>
            <boxGeometry args={[0.9, 0.6, 0.8]} />
            <meshToonMaterial color="#FFE3B8" gradientMap={gradientMap} />
          </mesh>
          <mesh position={[0, 0.75, 0]} rotation={[0, Math.PI / 4, 0]}>
            <coneGeometry args={[0.75, 0.5, 4]} />
            <meshToonMaterial color="#FF9F7A" gradientMap={gradientMap} />
          </mesh>
          {/* 门洞 */}
          <mesh position={[0, 0.18, 0.41]}>
            <circleGeometry args={[0.2, 16]} />
            <meshBasicMaterial color="#8A6A4F" />
          </mesh>
          {/* 骨头招牌 */}
          <mesh position={[0, 0.52, 0.42]}>
            <circleGeometry args={[0.1, 14]} />
            <meshBasicMaterial color="#FFF6EC" />
          </mesh>
        </group>
      )}
    </group>
  );
}

/* ───────── WebGL 支持预探测 ─────────
 * 渲染 Canvas 前先探测（惰性一次）：无 WebGL 的设备直接走 2D 模式，
 * 避免 Canvas 在渲染 pass 中抛错吞掉上层组件的状态更新（React 已知行为）。
 * WebGLBoundary 保留作二道防线（上下文运行时丢失等）。
 */

function useWebGLSupport(): boolean {
  const [ok] = useState(() => {
    try {
      const c = document.createElement('canvas');
      return !!(
        window.WebGLRenderingContext &&
        (c.getContext('webgl') || c.getContext('experimental-webgl'))
      );
    } catch {
      return false;
    }
  });
  return ok;
}

/* ───────── 云朵（飞行背景用） ───────── */

function Cloud({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  const gradientMap = useMemo(() => {
    const data = new Uint8Array([235, 245, 255]);
    const tex = new THREE.DataTexture(data, 3, 1, THREE.RedFormat);
    tex.minFilter = THREE.NearestFilter;
    tex.magFilter = THREE.NearestFilter;
    tex.needsUpdate = true;
    return tex;
  }, []);
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[0.42, 12, 10]} />
        <meshToonMaterial color="#FFFFFF" gradientMap={gradientMap} />
      </mesh>
      <mesh position={[0.38, -0.06, 0.05]}>
        <sphereGeometry args={[0.3, 12, 10]} />
        <meshToonMaterial color="#FDF7FF" gradientMap={gradientMap} />
      </mesh>
      <mesh position={[-0.36, -0.05, -0.04]}>
        <sphereGeometry args={[0.27, 12, 10]} />
        <meshToonMaterial color="#FDF7FF" gradientMap={gradientMap} />
      </mesh>
    </group>
  );
}

/* ───────── 主场景 ───────── */

export function CorgiScene({
  command,
  heartsNonce,
  onZoneClick,
  equippedAccessory,
  hasLuxuryNest,
  bubble,
  lowPerf,
  onLowFps,
  force2D = false,
  flying = false,
}: CorgiSceneProps) {
  const webglOk = useWebGLSupport();

  /* 无 WebGL 或家长强制 2D：直接 2D 互动模式（不挂 Canvas，杜绝渲染期抛错） */
  if (!webglOk || force2D) {
    return <Fallback2DCorgi bubble={bubble} onZoneClick={onZoneClick} />;
  }

  /* 柯基本体：飞行解锁时悬浮 + 脚踩云朵 */
  const corgi = (
    <>
      <GLBErrorBoundary
        fallback={
          <ProceduralCorgi
            command={command}
            onZoneClick={onZoneClick}
            equippedAccessory={equippedAccessory}
          />
        }
      >
        <GlbCorgi
          command={command}
          onZoneClick={onZoneClick}
          equippedAccessory={equippedAccessory}
        />
      </GLBErrorBoundary>
    </>
  );

  return (
    <WebGLBoundary fallback={<Fallback2DCorgi bubble={bubble} onZoneClick={onZoneClick} />}>
      <Canvas
        dpr={lowPerf ? 1 : [1, 2]}
        shadows={!lowPerf}
        gl={{ antialias: !lowPerf, alpha: true }}
        camera={{ position: [0.6, 1.7, 4.4], fov: 42 }}
        style={{ touchAction: 'none' }}
      >
      <fog attach="fog" args={[flying ? '#E8F2FF' : '#FFF3E6', 9, 16]} />

      {/* 灯光：柔和暖光 */}
      <ambientLight intensity={0.95} color="#FFF6E8" />
      <directionalLight
        position={[3, 5.5, 4]}
        intensity={0.85}
        color="#FFF2DC"
        castShadow={!lowPerf}
        shadow-mapSize={lowPerf ? 256 : 1024}
      />
      <directionalLight position={[-3, 2, -2]} intensity={0.25} color="#FFE0EC" />

      <Suspense fallback={null}>
        {flying ? (
          /* 飞行模式：柯基悬浮在云海之上（连续学习 30 天解锁） */
          <Float speed={2.2} rotationIntensity={0.12} floatIntensity={0.9} floatingRange={[-0.15, 0.25]}>
            {corgi}
            {/* 脚下的云 */}
            <Cloud position={[0, -0.72, 0]} scale={0.85} />
          </Float>
        ) : (
          corgi
        )}
      </Suspense>

      <HeartParticles burstNonce={heartsNonce} />

      {/* 飞行背景：远处的云海；否则地面草地/狗窝 */}
      {flying ? (
        <group>
          <Cloud position={[-1.9, -0.55, -1.4]} scale={1.25} />
          <Cloud position={[2.0, -0.35, -1.1]} scale={1.05} />
          <Cloud position={[1.4, -0.75, 1.5]} scale={0.9} />
          <Cloud position={[-1.6, -0.9, 1.8]} scale={0.75} />
        </group>
      ) : (
        <Ground luxury={hasLuxuryNest} lowPerf={lowPerf} />
      )}

      {!lowPerf && !flying && <ContactShadows position={[0, 0.005, 0]} opacity={0.35} scale={4.5} blur={2.6} far={2} color="#B98F6A" />}

      {/* 语音气泡：挂在柯基头顶 */}
      {bubble && (
        <Html position={[0, 1.95, 0]} center distanceFactor={7} zIndexRange={[20, 0]}>
          <div
            style={{
              background: '#FFFFFF',
              border: '2.5px solid #FFC3D3',
              borderRadius: 18,
              padding: '8px 16px',
              fontSize: 17,
              fontWeight: 800,
              color: '#5C443D',
              whiteSpace: 'nowrap',
              boxShadow: '0 4px 14px rgba(0,0,0,0.10)',
              pointerEvents: 'none',
              userSelect: 'none',
            }}
          >
            {bubble}
          </div>
        </Html>
      )}

      <OrbitControls
        target={[0, 0.85, 0]}
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        minDistance={2.8}
        maxDistance={7}
        minPolarAngle={0.85}
        maxPolarAngle={1.62}
        minAzimuthAngle={-2.4}
        maxAzimuthAngle={2.4}
      />

      <FpsWatchdog onLowFps={onLowFps} enabled={!lowPerf} />
      </Canvas>
    </WebGLBoundary>
  );
}

export default CorgiScene;
