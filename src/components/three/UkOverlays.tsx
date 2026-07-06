import { useMemo } from 'react';
import * as THREE from 'three';
import { ukPlane25, ukPlanes45, type UkParams } from '../../core/uk';
import type { BuildingGeometry, Site } from '../../core/types';
import type { DisplayState } from '../../store';
import { OVERLAY_COLORS, stripGeometry } from './util';

interface Props {
  site: Site;
  geometry: BuildingGeometry;
  uk: UkParams;
  display: DisplayState;
}

const PLANE_OPACITY = 0.22;
const GHOST_COLOR = '#8494a8';

/** 窓マーカー (検討基準点) */
function WindowMarker({
  position,
  rotationY,
}: {
  position: [number, number, number];
  rotationY: number;
}) {
  return (
    <mesh position={position} rotation={[0, rotationY, 0]}>
      <planeGeometry args={[1.2, 1.2]} />
      <meshBasicMaterial color="#fde68a" side={THREE.DoubleSide} />
    </mesh>
  );
}

/** BRE 25° テスト面: 道路向かいの窓中心から敷地へ */
function Uk25Plane({ site, geometry, uk }: Props) {
  const plane = ukPlane25(site, uk);
  const geo = useMemo(() => {
    const capH = Math.max(geometry.height + 5, 12);
    const run = (capH - plane.baseHeight) / plane.slope;
    const x0 = -site.width / 2 - 2;
    const x1 = site.width / 2 + 2;
    return stripGeometry([
      [
        new THREE.Vector3(x0, plane.baseHeight, plane.origin),
        new THREE.Vector3(x1, plane.baseHeight, plane.origin),
      ],
      [
        new THREE.Vector3(x0, capH, plane.origin - run),
        new THREE.Vector3(x1, capH, plane.origin - run),
      ],
    ]);
  }, [site.width, plane.origin, plane.baseHeight, plane.slope, geometry.height]);

  return (
    <group>
      <mesh geometry={geo}>
        <meshBasicMaterial
          color={OVERLAY_COLORS.uk25}
          transparent
          opacity={PLANE_OPACITY}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {/* 向かいの既存建物 (ゴースト) と基準窓 */}
      <mesh position={[0, 3.5, plane.origin + 4]}>
        <boxGeometry args={[site.width + 6, 7, 8]} />
        <meshBasicMaterial color={GHOST_COLOR} transparent opacity={0.12} depthWrite={false} />
      </mesh>
      <WindowMarker position={[0, plane.baseHeight, plane.origin - 0.02]} rotationY={0} />
    </group>
  );
}

/** 45° ルール面: 東西隣地の窓中心から敷地へ */
function Uk45Planes({ site, geometry, uk }: Props) {
  const planes = ukPlanes45(site, uk);
  const geo = useMemo(() => {
    const capH = Math.max(geometry.height + 5, 10);
    const z0 = -site.depth / 2 - 2;
    const z1 = site.depth / 2 + 2;
    const make = (origin: number, inward: 1 | -1) => {
      const run = capH - planes.east.baseHeight; // 勾配 1:1
      return stripGeometry([
        [
          new THREE.Vector3(origin, planes.east.baseHeight, z0),
          new THREE.Vector3(origin, planes.east.baseHeight, z1),
        ],
        [
          new THREE.Vector3(origin + inward * run, capH, z0),
          new THREE.Vector3(origin + inward * run, capH, z1),
        ],
      ]);
    };
    return [make(planes.east.origin, -1), make(planes.west.origin, 1)];
  }, [site.depth, planes.east.origin, planes.west.origin, planes.east.baseHeight, geometry.height]);

  return (
    <group>
      {geo.map((g, i) => (
        <mesh key={i} geometry={g}>
          <meshBasicMaterial
            color={OVERLAY_COLORS.uk45}
            transparent
            opacity={PLANE_OPACITY * 0.8}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      ))}
      {/* 隣家 (ゴースト) と基準窓 */}
      {([1, -1] as const).map((sign) => {
        const origin = sign === 1 ? planes.east.origin : planes.west.origin;
        return (
          <group key={sign}>
            <mesh position={[origin + sign * 3.5, 3.5, 0]}>
              <boxGeometry args={[7, 7, 10]} />
              <meshBasicMaterial color={GHOST_COLOR} transparent opacity={0.12} depthWrite={false} />
            </mesh>
            <WindowMarker
              position={[origin + sign * -0.02, planes.east.baseHeight, 0]}
              rotationY={Math.PI / 2}
            />
          </group>
        );
      })}
    </group>
  );
}

/** 英国の規制面オーバーレイ一式 */
export function UkOverlays(props: Props) {
  const { display } = props;
  return (
    <group>
      {display.showUk25 && <Uk25Plane {...props} />}
      {display.showUk45 && <Uk45Planes {...props} />}
    </group>
  );
}
