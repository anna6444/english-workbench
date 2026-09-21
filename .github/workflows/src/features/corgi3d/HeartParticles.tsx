/**
 * 爱心粒子 —— 点击柯基头部时喷出的卡通爱心。
 *
 * 实现要点：
 *   - 15 个心形 mesh 的对象池，burst 时全部激活（随机初速/延迟）
 *   - useFrame 更新位置与透明度，寿命尽即隐藏
 *   - 触发方式：监听 burstNonce（页面递增 nonce → 组件重放），单向数据流
 */

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface Particle {
  alive: boolean;
  delay: number;
  age: number;
  life: number;
  vx: number;
  vy: number;
  origin: [number, number, number];
}

const COUNT = 15;

function makeHeartGeometry(): THREE.ShapeGeometry {
  const s = new THREE.Shape();
  const x = 0;
  const y = 0;
  s.moveTo(x + 0.25, y + 0.25);
  s.bezierCurveTo(x + 0.25, y + 0.25, x + 0.2, y, x, y);
  s.bezierCurveTo(x - 0.3, y, x - 0.3, y + 0.35, x - 0.3, y + 0.35);
  s.bezierCurveTo(x - 0.3, y + 0.55, x - 0.15, y + 0.77, x + 0.25, y + 0.95);
  s.bezierCurveTo(x + 0.6, y + 0.77, x + 0.8, y + 0.55, x + 0.8, y + 0.35);
  s.bezierCurveTo(x + 0.8, y + 0.35, x + 0.8, y, x + 0.5, y);
  s.bezierCurveTo(x + 0.35, y, x + 0.25, y + 0.25, x + 0.25, y + 0.25);
  const geo = new THREE.ShapeGeometry(s, 12);
  geo.center();
  geo.scale(0.32, 0.32, 0.32);
  return geo;
}

export function HeartParticles({ burstNonce }: { burstNonce: number }) {
  const geo = useMemo(() => makeHeartGeometry(), []);
  const groupRef = useRef<THREE.Group>(null);
  const partsRef = useRef<Particle[]>([]);
  const lastNonce = useRef(burstNonce);

  /* nonce 变化 → 重置粒子池 */
  useEffect(() => {
    if (burstNonce === lastNonce.current) return;
    lastNonce.current = burstNonce;
    const g = groupRef.current;
    if (!g) return;
    partsRef.current = [];
    g.children.forEach((child, i) => {
      const mesh = child as THREE.Mesh;
      mesh.visible = false;
      partsRef.current.push({
        alive: true,
        delay: i * 0.045 + Math.random() * 0.05,
        age: 0,
        life: 0.9 + Math.random() * 0.35,
        vx: (Math.random() - 0.5) * 0.9,
        vy: 1.1 + Math.random() * 0.7,
        origin: [(Math.random() - 0.5) * 0.5, 1.45, 0.35 + Math.random() * 0.15],
      });
    });
  }, [burstNonce]);

  useFrame((_, delta) => {
    const g = groupRef.current;
    if (!g || partsRef.current.length === 0) return;
    const d = Math.min(delta, 0.05);

    g.children.forEach((child, i) => {
      const p = partsRef.current[i];
      if (!p || !p.alive) return;
      const mesh = child as THREE.Mesh;
      const mat = mesh.material as THREE.MeshBasicMaterial;

      if (p.delay > 0) {
        p.delay -= d;
        if (p.delay > 0) return;
        mesh.visible = true;
        mesh.position.set(...p.origin);
      }

      p.age += d;
      if (p.age >= p.life) {
        p.alive = false;
        mesh.visible = false;
        return;
      }

      mesh.position.x += p.vx * d;
      mesh.position.y += p.vy * d;
      p.vy -= 0.4 * d; // 轻微重力，让轨迹是先升后飘
      const k = 1 - p.age / p.life;
      mat.opacity = Math.min(1, k * 1.8);
      const s = 0.7 + 0.5 * Math.sin(Math.min(1, p.age / 0.25) * Math.PI * 0.5);
      mesh.scale.setScalar(s);
      mesh.rotation.z = Math.sin(p.age * 5) * 0.2;
    });
  });

  return (
    <group ref={groupRef}>
      {Array.from({ length: COUNT }).map((_, i) => (
        <mesh key={i} geometry={geo} visible={false} renderOrder={10}>
          <meshBasicMaterial
            color={i % 3 === 0 ? '#FF6F9C' : i % 3 === 1 ? '#FF8FB0' : '#FFB6C9'}
            transparent
            opacity={1}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
}
