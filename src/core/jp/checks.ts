/**
 * 日本の形態規制検定エンジン (建築基準法)
 *
 * - 建蔽率: 53条
 * - 容積率: 52条 (前面道路幅員による低減を含む)
 * - 絶対高さ制限: 55条 (低層住居専用地域等)
 * - 道路斜線: 56条1項1号・別表第3 (セットバック緩和 56条2項, 幅員12m以上の勾配緩和 56条3項)
 * - 隣地斜線: 56条1項2号 (後退緩和を含む)
 * - 北側斜線: 56条1項3号
 *
 * すべて純関数。建物は敷地内の単純直方体を仮定する。
 */

import { deriveGeometry, fmt, margin } from '../geometry';
import type { Building, CheckResult, Site } from '../types';
import {
  JP_ZONES,
  shadeRuleOptions,
  type FireResistance,
  type FireZone,
  type JpZone,
  type JpZoneId,
} from './zoning';

export interface JpParams {
  zone: JpZoneId;
  /** 指定建蔽率 [%] */
  coverageLimit: number;
  /** 指定容積率 [%] */
  farLimit: number;
  fireZone: FireZone;
  fireResistance: FireResistance;
  /** 低層住専等の絶対高さ制限 [m] (都市計画で 10m or 12m) */
  lowRiseHeightLimit: 10 | 12;
  /** 日影規制の対象区域として条例指定されているか */
  shadeDesignated: boolean;
  /** 別表第4 の号区分 (shadeRuleOptions のインデックス) */
  shadeRuleIndex: number;
  /** 日影の測定面高さ [m] */
  shadeMeasureHeight: number;
  /** 北海道の区域内か (日影規制: 9〜15時・緩和された許容時間) */
  hokkaido: boolean;
}

export function zoneOf(p: JpParams): JpZone {
  return JP_ZONES[p.zone];
}

/* ------------------------------------------------------------------ */
/* 建蔽率 (53条)                                                        */
/* ------------------------------------------------------------------ */

/** 割増・適用除外を考慮した建蔽率の限度 [%] */
export function effectiveCoverageLimit(site: Site, p: JpParams): number {
  const fireproofBonus =
    (p.fireZone === 'fire' && p.fireResistance === 'fireproof') ||
    (p.fireZone === 'quasi-fire' && p.fireResistance !== 'none');

  // 53条6項1号: 建蔽率80%区域内の防火地域内の耐火建築物等は建蔽率制限を適用しない
  if (p.coverageLimit === 80 && p.fireZone === 'fire' && p.fireResistance === 'fireproof') {
    return 100;
  }
  let limit = p.coverageLimit;
  if (site.isCornerLot) limit += 10; // 53条3項2号 (特定行政庁指定の角地)
  if (fireproofBonus) limit += 10; // 53条3項1号
  return Math.min(limit, 100);
}

export function checkCoverage(site: Site, b: Building, p: JpParams): CheckResult {
  const g = deriveGeometry(site, b);
  const siteArea = site.width * site.depth;
  const actualPct = (g.footprintArea / siteArea) * 100;
  const limitPct = effectiveCoverageLimit(site, p);
  const bonuses: string[] = [];
  if (site.isCornerLot) bonuses.push('角地 +10%');
  if (p.fireZone === 'fire' && p.fireResistance === 'fireproof')
    bonuses.push(p.coverageLimit === 80 ? '80%区域×防火地域×耐火建築物 → 制限なし' : '防火地域×耐火 +10%');
  else if (p.fireZone === 'quasi-fire' && p.fireResistance !== 'none') bonuses.push('準防火地域×(準)耐火 +10%');

  return {
    id: 'jp-coverage',
    name: '建蔽率',
    nameEn: 'Building coverage ratio',
    legalBasis: '建築基準法53条',
    status: actualPct <= limitPct + 1e-9 ? 'pass' : 'fail',
    actual: `${fmt(actualPct, 1)}% (${fmt(g.footprintArea, 1)}m²)`,
    limit: `${fmt(limitPct, 0)}%`,
    detail:
      `敷地面積 ${fmt(siteArea, 1)}m² × ${fmt(limitPct, 0)}% = 許容建築面積 ${fmt((siteArea * limitPct) / 100, 1)}m²` +
      (bonuses.length ? ` / 割増: ${bonuses.join('、')}` : ''),
    margin: margin(actualPct, limitPct),
  };
}

/* ------------------------------------------------------------------ */
/* 容積率 (52条)                                                        */
/* ------------------------------------------------------------------ */

/** 前面道路幅員による低減を考慮した容積率の限度 [%] (52条2項) */
export function effectiveFarLimit(site: Site, p: JpParams): number {
  const zone = zoneOf(p);
  if (site.roadWidth >= 12) return p.farLimit;
  const roadLimit = site.roadWidth * zone.roadFarFactor * 100;
  return Math.min(p.farLimit, roadLimit);
}

export function checkFar(site: Site, b: Building, p: JpParams): CheckResult {
  const zone = zoneOf(p);
  const g = deriveGeometry(site, b);
  const siteArea = site.width * site.depth;
  const actualPct = (g.totalFloorArea / siteArea) * 100;
  const limitPct = effectiveFarLimit(site, p);
  const roadLimited = limitPct < p.farLimit;

  return {
    id: 'jp-far',
    name: '容積率',
    nameEn: 'Floor area ratio',
    legalBasis: '建築基準法52条',
    status: actualPct <= limitPct + 1e-9 ? 'pass' : 'fail',
    actual: `${fmt(actualPct, 1)}% (${fmt(g.totalFloorArea, 1)}m²)`,
    limit: `${fmt(limitPct, 0)}%`,
    detail: roadLimited
      ? `前面道路 ${fmt(site.roadWidth, 1)}m × ${zone.roadFarFactor} = ${fmt(limitPct, 0)}% が指定容積率 ${fmt(p.farLimit, 0)}% を下回るため道路幅員で制限 (52条2項)`
      : `指定容積率 ${fmt(p.farLimit, 0)}% を適用 (前面道路 ${fmt(site.roadWidth, 1)}m)`,
    margin: margin(actualPct, limitPct),
  };
}

/* ------------------------------------------------------------------ */
/* 絶対高さ制限 (55条)                                                  */
/* ------------------------------------------------------------------ */

export function checkAbsoluteHeight(site: Site, b: Building, p: JpParams): CheckResult {
  const zone = zoneOf(p);
  const g = deriveGeometry(site, b);
  const applicable = zone.category === 'low-rise';
  if (!applicable) {
    return {
      id: 'jp-abs-height',
      name: '絶対高さ制限',
      nameEn: 'Absolute height limit',
      legalBasis: '建築基準法55条',
      status: 'na',
      actual: `${fmt(g.height, 2)}m`,
      limit: '—',
      detail: '低層住居専用地域・田園住居地域以外では適用されない',
    };
  }
  return {
    id: 'jp-abs-height',
    name: '絶対高さ制限',
    nameEn: 'Absolute height limit',
    legalBasis: '建築基準法55条',
    status: g.height <= p.lowRiseHeightLimit + 1e-9 ? 'pass' : 'fail',
    actual: `${fmt(g.height, 2)}m`,
    limit: `${p.lowRiseHeightLimit}m`,
    detail: `${zone.name}では最高高さ ${p.lowRiseHeightLimit}m (都市計画指定) 以下とする`,
    margin: margin(g.height, p.lowRiseHeightLimit),
  };
}

/* ------------------------------------------------------------------ */
/* 道路斜線 (56条1項1号・別表第3)                                        */
/* ------------------------------------------------------------------ */

/** 別表第3による適用距離 [m]。容積率の限度 (前面道路低減後) で決まる。 */
export function roadSlantApplicableDistance(zone: JpZone, farLimitPct: number): number {
  if (zone.category === 'commercial') {
    // (二) 近隣商業・商業
    if (farLimitPct <= 400) return 20;
    if (farLimitPct <= 600) return 25;
    if (farLimitPct <= 800) return 30;
    if (farLimitPct <= 1000) return 35;
    if (farLimitPct <= 1100) return 40;
    if (farLimitPct <= 1200) return 45;
    return 50;
  }
  if (zone.category === 'industrial') {
    // (三) 準工業・工業・工業専用は 3 区分のみ (300% 超は一律 30m)
    if (farLimitPct <= 200) return 20;
    if (farLimitPct <= 300) return 25;
    return 30;
  }
  // (一) 住居系
  if (farLimitPct <= 200) return 20;
  if (farLimitPct <= 300) return 25;
  if (farLimitPct <= 400) return 30;
  return 35;
}

export interface RoadSlantSpec {
  /** 緩和後のみなし反対側境界線の z 座標 (敷地座標系) */
  oppositeZ: number;
  /** 基本勾配 */
  slope: number;
  /** 56条3項適用時: 勾配が 1.5 に切り替わる反対側境界線からの水平距離 [m] (非適用は null) */
  steepFrom: number | null;
  /** 適用距離 [m] */
  applicableDistance: number;
  /** 後退距離 [m] */
  setback: number;
}

/**
 * 道路斜線の平面パラメータを求める。
 * セットバック緩和 (56条2項): 建物を道路境界線から a 後退させた場合、
 * 反対側境界線が a だけ外側にあるものとみなす。
 */
export function roadSlantSpec(site: Site, b: Building, p: JpParams): RoadSlantSpec {
  const zone = zoneOf(p);
  const setback = Math.max(0, b.setbackSouth);
  const oppositeZ = site.depth / 2 + site.roadWidth + setback;
  const farLimit = effectiveFarLimit(site, p);
  // 56条3項: 中高層・住居系で前面道路幅員 12m 以上の場合の勾配緩和
  const steepFrom =
    site.roadWidth >= 12 && (zone.category === 'mid-rise' || zone.category === 'residential')
      ? site.roadWidth * 1.25
      : null;
  return {
    oppositeZ,
    slope: zone.roadSlantSlope,
    steepFrom,
    applicableDistance: roadSlantApplicableDistance(zone, farLimit),
    setback,
  };
}

/**
 * みなし反対側境界線から水平距離 dist [m] の位置での道路斜線許容高さ [m]。
 * 適用距離を超える範囲は Infinity。
 */
export function roadSlantAllowedHeight(spec: RoadSlantSpec, dist: number): number {
  if (dist > spec.applicableDistance) return Infinity;
  if (dist <= 0) return 0;
  if (spec.steepFrom !== null && dist >= spec.steepFrom) return 1.5 * dist;
  return spec.slope * dist;
}

export function checkRoadSlant(site: Site, b: Building, p: JpParams): CheckResult {
  const g = deriveGeometry(site, b);
  const spec = roadSlantSpec(site, b, p);
  // 許容高さは道路から離れるほど大きい単調非減少関数のため、建物南面が最も厳しい
  const distAtSouthFace = spec.oppositeZ - g.south; // = 道路幅員 + 2×後退距離
  const allowed = roadSlantAllowedHeight(spec, distAtSouthFace);
  const withinRange = distAtSouthFace <= spec.applicableDistance;

  const detail =
    `勾配 1:${spec.slope}${spec.steepFrom !== null ? ' (幅員12m以上のため一部 1:1.5, 56条3項)' : ''}、` +
    `後退距離 ${fmt(spec.setback, 2)}m によるみなし境界線緩和 (56条2項) 適用。` +
    `南面位置の水平距離 ${fmt(distAtSouthFace, 2)}m、適用距離 ${fmt(spec.applicableDistance, 0)}m (別表第3)`;

  if (!withinRange) {
    return {
      id: 'jp-road-slant',
      name: '道路斜線制限',
      nameEn: 'Road slant plane',
      legalBasis: '建築基準法56条1項1号・別表第3',
      status: 'pass',
      actual: `${fmt(g.height, 2)}m`,
      limit: '適用距離外',
      detail: detail + ' — 建物全体が適用距離の外側にあり制限を受けない',
      margin: 1,
    };
  }
  return {
    id: 'jp-road-slant',
    name: '道路斜線制限',
    nameEn: 'Road slant plane',
    legalBasis: '建築基準法56条1項1号・別表第3',
    status: g.height <= allowed + 1e-9 ? 'pass' : 'fail',
    actual: `${fmt(g.height, 2)}m`,
    limit: `${fmt(allowed, 2)}m (南面位置)`,
    detail,
    margin: margin(g.height, allowed),
  };
}

/* ------------------------------------------------------------------ */
/* 隣地斜線 (56条1項2号)                                                */
/* ------------------------------------------------------------------ */

export interface AdjacentSlantBoundary {
  /** 境界の名称 */
  label: '北側' | '東側' | '西側';
  /** 建物面から境界線までの距離 [m] */
  distance: number;
  /** 許容高さ [m] */
  allowed: number;
}

/**
 * 各隣地境界線に対する許容高さ。
 * 後退緩和: 立上り (20m/31m) を超える部分が境界線から d 後退している場合、
 * 境界線が d 外側にあるとみなす → 均一な直方体では実質 base + 勾配 × 2d。
 */
export function adjacentSlantBoundaries(
  site: Site,
  b: Building,
  p: JpParams,
): AdjacentSlantBoundary[] {
  const zone = zoneOf(p);
  if (!zone.adjacentSlant) return [];
  const g = deriveGeometry(site, b);
  const { base, slope } = zone.adjacentSlant;
  const calc = (distance: number) => {
    const d = Math.max(0, distance);
    return base + slope * 2 * d;
  };
  return [
    { label: '北側', distance: g.setbackNorth, allowed: calc(g.setbackNorth) },
    { label: '東側', distance: g.setbackEast, allowed: calc(g.setbackEast) },
    { label: '西側', distance: b.setbackWest, allowed: calc(b.setbackWest) },
  ];
}

export function checkAdjacentSlant(site: Site, b: Building, p: JpParams): CheckResult {
  const zone = zoneOf(p);
  const g = deriveGeometry(site, b);
  if (!zone.adjacentSlant) {
    return {
      id: 'jp-adjacent-slant',
      name: '隣地斜線制限',
      nameEn: 'Adjacent site slant plane',
      legalBasis: '建築基準法56条1項2号',
      status: 'na',
      actual: `${fmt(g.height, 2)}m`,
      limit: '—',
      detail: '低層住居専用地域・田園住居地域では絶対高さ制限が適用されるため対象外',
    };
  }
  const { base, slope } = zone.adjacentSlant;
  if (g.height <= base + 1e-9) {
    return {
      id: 'jp-adjacent-slant',
      name: '隣地斜線制限',
      nameEn: 'Adjacent site slant plane',
      legalBasis: '建築基準法56条1項2号',
      status: 'pass',
      actual: `${fmt(g.height, 2)}m`,
      limit: `立上り ${base}m 以下`,
      detail: `建物高さが立上り ${base}m 以下のため制限を受けない (勾配 1:${slope})`,
      margin: margin(g.height, base),
    };
  }
  const boundaries = adjacentSlantBoundaries(site, b, p);
  const worst = boundaries.reduce((a, c) => (c.allowed < a.allowed ? c : a));
  return {
    id: 'jp-adjacent-slant',
    name: '隣地斜線制限',
    nameEn: 'Adjacent site slant plane',
    legalBasis: '建築基準法56条1項2号',
    status: g.height <= worst.allowed + 1e-9 ? 'pass' : 'fail',
    actual: `${fmt(g.height, 2)}m`,
    limit: `${fmt(worst.allowed, 2)}m (${worst.label})`,
    detail:
      `${base}m + 1:${slope} × 後退距離×2 (後退緩和込み)。` +
      boundaries.map((x) => `${x.label} ${fmt(x.distance, 2)}m → 許容 ${fmt(x.allowed, 2)}m`).join(' / '),
    margin: margin(g.height, worst.allowed),
  };
}

/* ------------------------------------------------------------------ */
/* 北側斜線 (56条1項3号)                                                */
/* ------------------------------------------------------------------ */

export function checkNorthSlant(site: Site, b: Building, p: JpParams): CheckResult {
  const zone = zoneOf(p);
  const g = deriveGeometry(site, b);
  const commonId = {
    id: 'jp-north-slant',
    name: '北側斜線制限',
    nameEn: 'Northern boundary slant plane',
    legalBasis: '建築基準法56条1項3号',
  };
  if (zone.northSlantBase === null) {
    return {
      ...commonId,
      status: 'na',
      actual: `${fmt(g.height, 2)}m`,
      limit: '—',
      detail: '低層・中高層住居専用地域および田園住居地域以外では適用されない',
    };
  }
  // 中高層住専で日影規制の対象区域に指定されている場合は適用除外 (56条1項3号かっこ書)
  if (zone.category === 'mid-rise' && p.shadeDesignated) {
    return {
      ...commonId,
      status: 'na',
      actual: `${fmt(g.height, 2)}m`,
      limit: '—',
      detail: '中高層住居専用地域で日影規制の対象区域に指定されているため適用除外',
    };
  }
  // 真北方向の水平距離: 建物北面から北側隣地境界線まで (敷地は真北に整列と仮定)
  const allowed = zone.northSlantBase + 1.25 * Math.max(0, g.setbackNorth);
  return {
    ...commonId,
    status: g.height <= allowed + 1e-9 ? 'pass' : 'fail',
    actual: `${fmt(g.height, 2)}m`,
    limit: `${fmt(allowed, 2)}m`,
    detail: `${zone.northSlantBase}m + 1.25 × 真北方向水平距離 ${fmt(Math.max(0, g.setbackNorth), 2)}m (敷地は真北整列と仮定)`,
    margin: margin(g.height, allowed),
  };
}

/* ------------------------------------------------------------------ */
/* 日影規制の対象判定 (56条の2)                                          */
/* ------------------------------------------------------------------ */

/** 建物が日影規制の対象規模か (別表第4 (ろ) 欄) */
export function isShadeTargetBuilding(site: Site, b: Building, p: JpParams): boolean {
  const zone = zoneOf(p);
  const g = deriveGeometry(site, b);
  if (!zone.shadeApplicable || !p.shadeDesignated) return false;
  if (zone.category === 'low-rise') {
    return g.eavesHeight > 7 || b.floors >= 3;
  }
  return g.height > 10;
}

export { shadeRuleOptions };
