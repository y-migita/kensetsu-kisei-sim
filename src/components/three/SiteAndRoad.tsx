import { Html, Line, Text } from '@react-three/drei';
import { useMemo } from 'react';
import * as THREE from 'three';
import type { Site } from '../../core/types';
import { fmt } from '../../core/geometry';

/** 北向き矢印 (ローカル +Y = 真北) */
const northArrowShape = new THREE.Shape([
  new THREE.Vector2(0, 1.2),
  new THREE.Vector2(-0.6, -0.6),
  new THREE.Vector2(0, -0.2),
  new THREE.Vector2(0.6, -0.6),
]);

/** 敷地・前面道路・境界線・方位・寸法ラベル */
export function SiteAndRoad({ site }: { site: Site }) {
  const hw = site.width / 2;
  const hd = site.depth / 2;

  const boundaryPoints = useMemo(
    () =>
      [
        [-hw, 0.02, -hd],
        [hw, 0.02, -hd],
        [hw, 0.02, hd],
        [-hw, 0.02, hd],
        [-hw, 0.02, -hd],
      ] as [number, number, number][],
    [hw, hd],
  );

  const centerlinePoints = useMemo(
    () =>
      [
        [-hw - 20, 0.02, hd + site.roadWidth / 2],
        [hw + 20, 0.02, hd + site.roadWidth / 2],
      ] as [number, number, number][],
    [hw, hd, site.roadWidth],
  );

  return (
    <group>
      {/* 地盤 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]} receiveShadow>
        <planeGeometry args={[400, 400]} />
        <meshStandardMaterial color="#131c28" />
      </mesh>

      {/* 敷地 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[site.width, site.depth]} />
        <meshStandardMaterial color="#1e2c3f" />
      </mesh>
      <Line points={boundaryPoints} color="#94a3b8" lineWidth={1.5} dashed dashSize={0.5} gapSize={0.3} />

      {/* 前面道路 (南側) */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.02, hd + site.roadWidth / 2]}
        receiveShadow
      >
        <planeGeometry args={[site.width + 40, site.roadWidth]} />
        <meshStandardMaterial color="#28303c" />
      </mesh>
      <Line points={centerlinePoints} color="#8b95a5" lineWidth={1} dashed dashSize={1.5} gapSize={1.2} />

      {/* 方位 (真北 = -Z): 地面に描く北向き矢印 */}
      <group position={[-hw - 5, 0.02, -hd - 3]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.5, 1.7, 48]} />
          <meshBasicMaterial color="#64748b" />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, -0.6]}>
          <shapeGeometry args={[northArrowShape]} />
          <meshBasicMaterial color="#e2e8f0" />
        </mesh>
        <Text
          position={[0, 0.02, -2.6]}
          rotation={[-Math.PI / 2, 0, 0]}
          fontSize={1.1}
          color="#e2e8f0"
          anchorX="center"
          anchorY="middle"
        >
          N
        </Text>
      </group>

      {/* 寸法ラベル */}
      <Html center position={[0, 0.2, hd + site.roadWidth / 2]} className="pointer-events-none select-none">
        <div className="dim-label">道路 {fmt(site.roadWidth, 1)}m</div>
      </Html>
      <Html center position={[0, 0.2, -hd - 1.6]} className="pointer-events-none select-none">
        <div className="dim-label">間口 {fmt(site.width, 1)}m</div>
      </Html>
      <Html center position={[hw + 2.2, 0.2, 0]} className="pointer-events-none select-none">
        <div className="dim-label">奥行 {fmt(site.depth, 1)}m</div>
      </Html>
    </group>
  );
}
