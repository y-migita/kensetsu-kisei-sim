import type { Building, BuildingGeometry, Site } from './types';

/**
 * 建物パラメータと敷地から幾何量を導出する。
 * 建物は敷地内の単純直方体と仮定 (セットバック緩和・斜線検定はこの外形に対して行う)。
 */
export function deriveGeometry(site: Site, b: Building): BuildingGeometry {
  const south = site.depth / 2 - b.setbackSouth;
  const north = south - b.depth;
  const west = -site.width / 2 + b.setbackWest;
  const east = west + b.width;
  const height = b.floors * b.floorHeight + b.parapet;
  return {
    height,
    eavesHeight: b.floors * b.floorHeight,
    footprintArea: b.width * b.depth,
    totalFloorArea: b.width * b.depth * b.floors,
    south,
    north,
    west,
    east,
    setbackNorth: north - -site.depth / 2,
    setbackEast: site.width / 2 - east,
  };
}

/** 建物が敷地内に収まっているかの検証 (収まらない場合は警告表示に使う) */
export function validatePlacement(site: Site, b: Building): string[] {
  const g = deriveGeometry(site, b);
  const errors: string[] = [];
  if (b.width <= 0 || b.depth <= 0) errors.push('建物の幅・奥行は正の値としてください');
  if (g.setbackEast < 0) errors.push('建物が敷地の東側境界線を越えています');
  if (g.setbackNorth < 0) errors.push('建物が敷地の北側境界線を越えています');
  if (b.setbackSouth < 0 || b.setbackWest < 0) errors.push('後退距離は 0 以上としてください');
  return errors;
}

/** 余裕率: (許容 - 計画) / 許容。正なら適合、負なら超過。 */
export function margin(actual: number, limit: number): number {
  if (limit === 0) return actual === 0 ? 0 : -1;
  return (limit - actual) / limit;
}

/** 数値の表示整形 (有効数字を保ちつつ末尾ゼロを削る) */
export function fmt(v: number, digits = 2): string {
  return Number(v.toFixed(digits)).toLocaleString('ja-JP', {
    maximumFractionDigits: digits,
  });
}
