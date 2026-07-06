import { Edges, Html, Line } from '@react-three/drei';
import { useMemo } from 'react';
import { fmt } from '../../core/geometry';
import type { Building, BuildingGeometry } from '../../core/types';

interface Props {
  building: Building;
  geometry: BuildingGeometry;
  /** アクティブな規制体系で 1 つでも不適合があるか */
  violating: boolean;
  showFloorLines: boolean;
}

/** 建物ボリューム (直方体 + 階割線 + 高さラベル) */
export function BuildingMass({ building, geometry: g, violating, showFloorLines }: Props) {
  const cx = (g.west + g.east) / 2;
  const cz = (g.north + g.south) / 2;

  const floorLines = useMemo(() => {
    if (!showFloorLines) return [];
    const lines: [number, number, number][][] = [];
    for (let f = 1; f < building.floors; f++) {
      const y = f * building.floorHeight;
      lines.push([
        [g.west, y, g.north],
        [g.east, y, g.north],
        [g.east, y, g.south],
        [g.west, y, g.south],
        [g.west, y, g.north],
      ]);
    }
    return lines;
  }, [building.floors, building.floorHeight, g, showFloorLines]);

  return (
    <group>
      <mesh position={[cx, g.height / 2, cz]} castShadow receiveShadow>
        <boxGeometry args={[g.east - g.west, g.height, g.south - g.north]} />
        <meshStandardMaterial
          color={violating ? '#c1584f' : '#5b8ba8'}
          transparent
          opacity={0.92}
          roughness={0.7}
          metalness={0.05}
        />
        <Edges color={violating ? '#f87171' : '#9fc3d8'} lineWidth={1.5} />
      </mesh>
      {floorLines.map((pts, i) => (
        <Line key={i} points={pts} color="#9fb8c9" lineWidth={0.8} transparent opacity={0.5} />
      ))}
      <Html
        center
        position={[cx, g.height + 1.2, cz]}
        className="pointer-events-none select-none"
      >
        <div className={`dim-label ${violating ? '!text-red-300 !border-red-400/40' : ''}`}>
          H={fmt(g.height, 2)}m・{building.floors}F
        </div>
      </Html>
    </group>
  );
}
