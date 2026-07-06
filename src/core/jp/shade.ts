/**
 * 日影規制シミュレーション (建築基準法56条の2・別表第4)
 *
 * 冬至日の真太陽時 8時〜16時について、測定水平面 (敷地地盤 + 1.5m / 4m / 6.5m)
 * 上の各点が建物の影に入る累積時間を数値積分で求め、
 * みなし敷地境界線から 5m 超〜10m 以内 / 10m 超 の各範囲の最大日影時間を検定する。
 *
 * 緩和 (施行令135条の12第3項1号):
 *   敷地が道路に接する場合、幅員 ≤10m なら道路中心線を、
 *   幅員 >10m なら道路の反対側の境界線から敷地側へ 5m の線を敷地境界線とみなす。
 */

import { deriveGeometry } from '../geometry';
import { shadowOffset, sunPosition, type SunPosition } from '../sun';
import type { Building, Site } from '../types';
import type { ShadeRule } from './zoning';

export interface ShadeGrid {
  /** グリッド原点 (最小 x, 最小 z) */
  originX: number;
  originZ: number;
  /** セル寸法 [m] */
  resolution: number;
  cols: number;
  rows: number;
  /** 各セルの累積日影時間 [h] (row-major: z 方向 → x 方向) */
  hours: Float32Array;
  /** 各セルの規制区分: 0=規制対象外(敷地内・5m未満), 1=5-10m帯, 2=10m超帯 */
  band: Uint8Array;
}

export interface ShadeSimResult {
  grid: ShadeGrid;
  /** 5m超〜10m帯の最大日影時間 [h] */
  maxHours5to10: number;
  /** 10m超帯の最大日影時間 [h] */
  maxHoursBeyond10: number;
  /** みなし敷地境界の南端 z 座標 (道路緩和適用後) */
  deemedSouthZ: number;
  /** 検定した時間帯 [真太陽時] */
  timeRange: [number, number];
}

/** みなし敷地境界 (道路緩和適用後) の矩形 */
export function deemedBoundary(site: Site) {
  const southZ =
    site.depth / 2 + (site.roadWidth <= 10 ? site.roadWidth / 2 : site.roadWidth - 5);
  return {
    minX: -site.width / 2,
    maxX: site.width / 2,
    minZ: -site.depth / 2,
    maxZ: southZ,
  };
}

/** 点から矩形境界までの最短距離 (矩形内は 0) */
function distToRect(
  x: number,
  z: number,
  r: { minX: number; maxX: number; minZ: number; maxZ: number },
): number {
  const dx = Math.max(r.minX - x, 0, x - r.maxX);
  const dz = Math.max(r.minZ - z, 0, z - r.maxZ);
  return Math.hypot(dx, dz);
}

/** Andrew の単調鎖による凸包 (点数 ≤ 8 程度を想定) */
function convexHull(points: [number, number][]): [number, number][] {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length <= 2) return pts;
  const cross = (o: [number, number], a: [number, number], b: [number, number]) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: [number, number][] = [];
  for (const pt of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], pt) <= 0)
      lower.pop();
    lower.push(pt);
  }
  const upper: [number, number][] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const pt = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], pt) <= 0)
      upper.pop();
    upper.push(pt);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

/** 凸多角形の内外判定 (境界上は内側扱い) */
function pointInConvex(hull: [number, number][], x: number, z: number): boolean {
  if (hull.length < 3) return false;
  for (let i = 0; i < hull.length; i++) {
    const [ax, az] = hull[i];
    const [bx, bz] = hull[(i + 1) % hull.length];
    if ((bx - ax) * (z - az) - (bz - az) * (x - ax) < -1e-9) return false;
  }
  return true;
}

/**
 * ある太陽位置での建物 (直方体) の影の凸多角形を測定面上に求める。
 * 影 = 建物の平面形の 4 頂点 (測定面高さ以下は自明に自己遮蔽) と
 * 最高高さの 4 頂点の投影の凸包。建物高さ ≤ 測定面高さなら null。
 */
export function shadowPolygon(
  site: Site,
  b: Building,
  sun: SunPosition,
  measureHeight: number,
): [number, number][] | null {
  const g = deriveGeometry(site, b);
  if (g.height <= measureHeight) return null;
  const offset = shadowOffset(sun, g.height, measureHeight);
  if (offset === null) return null;
  const corners: [number, number][] = [
    [g.west, g.north],
    [g.east, g.north],
    [g.east, g.south],
    [g.west, g.south],
  ];
  const pts: [number, number][] = [
    ...corners,
    ...corners.map(([x, z]): [number, number] => [x + offset[0], z + offset[1]]),
  ];
  return convexHull(pts);
}

export interface ShadeSimOptions {
  /** 時間積分の刻み [分] */
  timeStepMinutes?: number;
  /** グリッド解像度 [m] */
  resolution?: number;
  /** 境界から確保する検定範囲 [m] (10m ラインの外側) */
  extent?: number;
}

/**
 * 日影シミュレーション本体。
 * 各時刻ステップの中点で影多角形を作り、グリッドセル中心の内外判定で累積時間を積算する。
 */
export function simulateShade(
  site: Site,
  b: Building,
  measureHeight: number,
  latitude: number,
  options: ShadeSimOptions = {},
): ShadeSimResult {
  const timeStep = options.timeStepMinutes ?? 6;
  const resolution = options.resolution ?? 1;
  const extent = options.extent ?? 25;

  const bound = deemedBoundary(site);
  const minX = bound.minX - extent;
  const maxX = bound.maxX + extent;
  const minZ = bound.minZ - extent;
  const maxZ = bound.maxZ + extent;
  const cols = Math.ceil((maxX - minX) / resolution);
  const rows = Math.ceil((maxZ - minZ) / resolution);
  const hours = new Float32Array(cols * rows);
  const band = new Uint8Array(cols * rows);

  // 各セルの規制区分を先に分類
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const x = minX + (i + 0.5) * resolution;
      const z = minZ + (j + 0.5) * resolution;
      const d = distToRect(x, z, bound);
      band[j * cols + i] = d > 10 ? 2 : d > 5 ? 1 : 0;
    }
  }

  // 真太陽時 8:00〜16:00 を積分
  const tStart = 8;
  const tEnd = 16;
  const stepH = timeStep / 60;
  const nSteps = Math.round((tEnd - tStart) / stepH);
  for (let s = 0; s < nSteps; s++) {
    const t = tStart + (s + 0.5) * stepH;
    const sun = sunPosition(latitude, t);
    if (sun.altitude <= 0) continue;
    const hull = shadowPolygon(site, b, sun, measureHeight);
    if (!hull) continue;
    // 影多角形のバウンディングボックスでセル走査を絞る
    let hMinX = Infinity;
    let hMaxX = -Infinity;
    let hMinZ = Infinity;
    let hMaxZ = -Infinity;
    for (const [x, z] of hull) {
      hMinX = Math.min(hMinX, x);
      hMaxX = Math.max(hMaxX, x);
      hMinZ = Math.min(hMinZ, z);
      hMaxZ = Math.max(hMaxZ, z);
    }
    const i0 = Math.max(0, Math.floor((hMinX - minX) / resolution));
    const i1 = Math.min(cols - 1, Math.ceil((hMaxX - minX) / resolution));
    const j0 = Math.max(0, Math.floor((hMinZ - minZ) / resolution));
    const j1 = Math.min(rows - 1, Math.ceil((hMaxZ - minZ) / resolution));
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const x = minX + (i + 0.5) * resolution;
        const z = minZ + (j + 0.5) * resolution;
        if (pointInConvex(hull, x, z)) hours[j * cols + i] += stepH;
      }
    }
  }

  let maxHours5to10 = 0;
  let maxHoursBeyond10 = 0;
  for (let k = 0; k < hours.length; k++) {
    if (band[k] === 1) maxHours5to10 = Math.max(maxHours5to10, hours[k]);
    else if (band[k] === 2) maxHoursBeyond10 = Math.max(maxHoursBeyond10, hours[k]);
  }

  return {
    grid: { originX: minX, originZ: minZ, resolution, cols, rows, hours, band },
    maxHours5to10,
    maxHoursBeyond10,
    deemedSouthZ: bound.maxZ,
    timeRange: [tStart, tEnd],
  };
}

/** 日影シミュレーション結果と別表第4の許容時間との比較 */
export function shadeCompliance(result: ShadeSimResult, rule: ShadeRule) {
  return {
    ok5to10: result.maxHours5to10 <= rule.limit5to10 + 1e-6,
    okBeyond10: result.maxHoursBeyond10 <= rule.limitBeyond10 + 1e-6,
  };
}
