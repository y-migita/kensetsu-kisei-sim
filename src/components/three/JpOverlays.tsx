import { useMemo } from 'react';
import * as THREE from 'three';
import {
  adjacentSlantBoundaries,
  roadSlantSpec,
  zoneOf,
  type JpParams,
} from '../../core/jp';
import type { Building, BuildingGeometry, Site } from '../../core/types';
import type { DisplayState } from '../../store';
import { OVERLAY_COLORS, stripGeometry } from './util';

interface Props {
  site: Site;
  building: Building;
  geometry: BuildingGeometry;
  jp: JpParams;
  display: DisplayState;
}

const PLANE_OPACITY = 0.22;

/** 道路斜線制限面 (56条1項1号) — みなし反対側境界線から適用距離まで */
function RoadSlantPlane({ site, building, jp }: Props) {
  const spec = roadSlantSpec(site, building, jp);
  const geo = useMemo(() => {
    const x0 = -site.width / 2 - 2;
    const x1 = site.width / 2 + 2;
    const L = spec.applicableDistance;
    const samples: [number, number][] = [[0, 0]];
    if (spec.steepFrom !== null && spec.steepFrom < L) {
      samples.push([spec.steepFrom, spec.slope * spec.steepFrom]);
      samples.push([spec.steepFrom, 1.5 * spec.steepFrom]); // 56条3項による勾配切替の段差
      samples.push([L, 1.5 * L]);
    } else {
      samples.push([L, spec.slope * L]);
    }
    const pairs = samples.map(
      ([d, h]) =>
        [new THREE.Vector3(x0, h, spec.oppositeZ - d), new THREE.Vector3(x1, h, spec.oppositeZ - d)] as [
          THREE.Vector3,
          THREE.Vector3,
        ],
    );
    return stripGeometry(pairs);
  }, [site.width, spec.oppositeZ, spec.slope, spec.steepFrom, spec.applicableDistance]);

  return (
    <mesh geometry={geo}>
      <meshBasicMaterial
        color={OVERLAY_COLORS.roadSlant}
        transparent
        opacity={PLANE_OPACITY}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}

/** 隣地斜線制限面 (56条1項2号) — 北・東・西の各境界 (後退緩和込み) */
function AdjacentSlantPlanes({ site, building, geometry, jp }: Props) {
  const zone = zoneOf(jp);
  const geo = useMemo(() => {
    if (!zone.adjacentSlant) return null;
    const { base, slope } = zone.adjacentSlant;
    const capH = Math.max(geometry.height + 6, base + 8);
    const run = (capH - base) / slope;
    const boundaries = adjacentSlantBoundaries(site, building, jp);
    const dist = Object.fromEntries(boundaries.map((b) => [b.label, Math.max(0, b.distance)]));

    const parts: THREE.BufferGeometry[] = [];
    const zSpan: [number, number] = [-site.depth / 2 - 2, site.depth / 2 + 2];
    const xSpan: [number, number] = [-site.width / 2 - 2, site.width / 2 + 2];

    // 東西: x = ±(W/2 + 後退距離) から内側へ勾配
    for (const side of ['東側', '西側'] as const) {
      const sign = side === '東側' ? 1 : -1;
      const x = sign * (site.width / 2 + dist[side]);
      const wall: Array<[THREE.Vector3, THREE.Vector3]> = [
        [new THREE.Vector3(x, 0, zSpan[0]), new THREE.Vector3(x, 0, zSpan[1])],
        [new THREE.Vector3(x, base, zSpan[0]), new THREE.Vector3(x, base, zSpan[1])],
        [
          new THREE.Vector3(x - sign * run, capH, zSpan[0]),
          new THREE.Vector3(x - sign * run, capH, zSpan[1]),
        ],
      ];
      parts.push(stripGeometry(wall));
    }
    // 北側: z = -(D/2 + 後退距離) から南へ勾配
    {
      const z = -(site.depth / 2 + dist['北側']);
      parts.push(
        stripGeometry([
          [new THREE.Vector3(xSpan[0], 0, z), new THREE.Vector3(xSpan[1], 0, z)],
          [new THREE.Vector3(xSpan[0], base, z), new THREE.Vector3(xSpan[1], base, z)],
          [new THREE.Vector3(xSpan[0], capH, z + run), new THREE.Vector3(xSpan[1], capH, z + run)],
        ]),
      );
    }
    return parts;
  }, [zone, site, building, geometry.height, jp]);

  if (!geo) return null;
  return (
    <group>
      {geo.map((g, i) => (
        <mesh key={i} geometry={g}>
          <meshBasicMaterial
            color={OVERLAY_COLORS.adjacentSlant}
            transparent
            opacity={PLANE_OPACITY * 0.7}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}

/** 北側斜線制限面 (56条1項3号) — 北側境界線から真北方向 (緩和なし) */
function NorthSlantPlane({ site, geometry, jp }: Props) {
  const zone = zoneOf(jp);
  const base = zone.northSlantBase;
  const geo = useMemo(() => {
    if (base === null) return null;
    const capH = Math.max(geometry.height + 4, base + 7);
    const run = (capH - base) / 1.25;
    const x0 = -site.width / 2 - 2;
    const x1 = site.width / 2 + 2;
    const z = -site.depth / 2;
    return stripGeometry([
      [new THREE.Vector3(x0, 0, z), new THREE.Vector3(x1, 0, z)],
      [new THREE.Vector3(x0, base, z), new THREE.Vector3(x1, base, z)],
      [new THREE.Vector3(x0, capH, z + run), new THREE.Vector3(x1, capH, z + run)],
    ]);
  }, [base, site.width, site.depth, geometry.height]);

  if (!geo) return null;
  return (
    <mesh geometry={geo}>
      <meshBasicMaterial
        color={OVERLAY_COLORS.northSlant}
        transparent
        opacity={PLANE_OPACITY}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}

/** 絶対高さ制限面 (55条) — 低層系のみ */
function AbsHeightPlane({ site, jp }: Props) {
  const zone = zoneOf(jp);
  if (zone.category !== 'low-rise') return null;
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, jp.lowRiseHeightLimit, 0]}
    >
      <planeGeometry args={[site.width + 4, site.depth + 4]} />
      <meshBasicMaterial
        color={OVERLAY_COLORS.absHeight}
        transparent
        opacity={PLANE_OPACITY}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}

/** 日本の規制面オーバーレイ一式 */
export function JpOverlays(props: Props) {
  const { display, jp } = props;
  const zone = zoneOf(jp);
  // 中高層×日影規制指定では北側斜線は適用除外 (56条1項3号かっこ書)
  const northApplies =
    zone.northSlantBase !== null && !(zone.category === 'mid-rise' && jp.shadeDesignated);
  return (
    <group>
      {display.showRoadSlant && <RoadSlantPlane {...props} />}
      {display.showAdjacentSlant && <AdjacentSlantPlanes {...props} />}
      {display.showNorthSlant && northApplies && <NorthSlantPlane {...props} />}
      {display.showAbsHeight && <AbsHeightPlane {...props} />}
    </group>
  );
}
