/**
 * 英国 (イングランド) の建築・計画規制検定エンジン
 *
 * - BRE 209 "Site Layout Planning for Daylight and Sunlight" の 25°テスト
 * - 各地方計画庁 (LPA) の SPD で広く採用される 45°ルール (立面)
 * - GPDO 2015 Schedule 2 Part 1 Class A (戸建住宅の後方増築の許可不要開発)
 * - Nationally Described Space Standard (NDSS) の住戸面積下限
 *
 * 注: 英国の計画制度は裁量型 (discretionary) であり、日本の集団規定のような
 * 一義的な適合/不適合ではない。ここでの fail は「指針超過 = 詳細検討・
 * 計画許可協議が必要」を意味する。各チェックの detail に明記する。
 */

import { deriveGeometry, fmt, margin } from '../geometry';
import type { Building, CheckResult, Site } from '../types';

export type UkHouseType = 'detached' | 'semi-detached' | 'terraced';

export const UK_HOUSE_TYPES: { id: UkHouseType; name: string }[] = [
  { id: 'detached', name: '戸建 (Detached)' },
  { id: 'semi-detached', name: '二戸建 (Semi-detached)' },
  { id: 'terraced', name: '連棟 (Terraced)' },
];

export interface UkParams {
  houseType: UkHouseType;
  /** Article 2(3) 指定地 (保全地区・国立公園等) — 拡大 PD 不可 */
  isDesignatedLand: boolean;
  /** オリジナル住宅の奥行 [m] (道路側から)。建物奥行がこれを超える部分を後方増築とみなす */
  originalDepth: number;
  /** 隣地の最寄り居室窓: 側面境界線からの水平距離 [m] (45°ルール) */
  neighbourWindowDist: number;
  /** 隣地窓の中心高さ [m] */
  neighbourWindowHeight: number;
  /** 道路向かい建物の窓: 道路反対側境界からの後退距離 [m] (25°テスト) */
  oppositeWindowSetback: number;
  /** 向かい窓の中心高さ [m] (BRE 標準は最下階窓中心 ≈ 1.6m) */
  oppositeWindowHeight: number;
  /** 住戸数 (0 = 空間基準チェックなし) */
  dwellingCount: number;
}

export const TAN_25 = Math.tan((25 * Math.PI) / 180);

/* ------------------------------------------------------------------ */
/* BRE 209 25° テスト (道路向かいの既存窓への採光)                        */
/* ------------------------------------------------------------------ */

export interface DaylightPlane {
  /** 平面の起点座標 (南側: z / 側面: x) */
  origin: number;
  /** 起点高さ [m] */
  baseHeight: number;
  /** 勾配 (水平 1 に対する立上り) */
  slope: number;
}

/** 25°テストの斜面: 向かい窓中心から敷地へ向かって 25° で立ち上がる */
export function ukPlane25(site: Site, p: UkParams): DaylightPlane {
  return {
    origin: site.depth / 2 + site.roadWidth + p.oppositeWindowSetback,
    baseHeight: p.oppositeWindowHeight,
    slope: TAN_25,
  };
}

export function check25Degree(site: Site, b: Building, p: UkParams): CheckResult {
  const g = deriveGeometry(site, b);
  const plane = ukPlane25(site, p);
  // 窓から建物南面までの水平距離
  const dist = plane.origin - g.south;
  const allowed = plane.baseHeight + plane.slope * dist;
  const ok = g.height <= allowed + 1e-9;
  return {
    id: 'uk-25deg',
    name: '25°テスト (既存窓への採光)',
    nameEn: 'BRE 25° daylight test',
    legalBasis: 'BRE 209 (2022) §2.2 初期検討',
    status: ok ? 'pass' : 'fail',
    actual: `${fmt(g.height, 2)}m`,
    limit: `${fmt(allowed, 2)}m (南面位置)`,
    detail:
      `向かい窓中心 (高さ ${fmt(p.oppositeWindowHeight, 1)}m・水平距離 ${fmt(dist, 1)}m) から仰角 25° を超えると` +
      `既存居室の昼光が損なわれるおそれ。超過時は ADF 等の詳細検証が必要 (不許可を直ちに意味しない)`,
    margin: margin(g.height, allowed),
  };
}

/* ------------------------------------------------------------------ */
/* 45° ルール (隣地窓への影響 — LPA 設計指針)                             */
/* ------------------------------------------------------------------ */

/** 45°ルールの斜面 (東西それぞれの隣地窓中心から敷地へ 45°) */
export function ukPlanes45(site: Site, p: UkParams): { east: DaylightPlane; west: DaylightPlane } {
  return {
    east: {
      origin: site.width / 2 + p.neighbourWindowDist,
      baseHeight: p.neighbourWindowHeight,
      slope: 1,
    },
    west: {
      origin: -(site.width / 2 + p.neighbourWindowDist),
      baseHeight: p.neighbourWindowHeight,
      slope: 1,
    },
  };
}

export function check45Degree(site: Site, b: Building, p: UkParams): CheckResult {
  const g = deriveGeometry(site, b);
  const planes = ukPlanes45(site, p);
  const distEast = planes.east.origin - g.east;
  const distWest = g.west - planes.west.origin;
  const allowedEast = p.neighbourWindowHeight + distEast;
  const allowedWest = p.neighbourWindowHeight + distWest;
  const worst = Math.min(allowedEast, allowedWest);
  const worstLabel = allowedEast <= allowedWest ? '東側' : '西側';
  const ok = g.height <= worst + 1e-9;
  return {
    id: 'uk-45deg',
    name: '45°ルール (隣地窓への影響)',
    nameEn: '45-degree rule',
    legalBasis: 'LPA 設計指針 (BRE 209 に基づく慣行)',
    status: ok ? 'pass' : 'fail',
    actual: `${fmt(g.height, 2)}m`,
    limit: `${fmt(worst, 2)}m (${worstLabel})`,
    detail:
      `隣地窓中心 (高さ ${fmt(p.neighbourWindowHeight, 1)}m) からの立面 45° 線。` +
      `東側 距離 ${fmt(distEast, 1)}m → ${fmt(allowedEast, 2)}m / 西側 距離 ${fmt(distWest, 1)}m → ${fmt(allowedWest, 2)}m。` +
      `簡略化した立面テストであり、正式には平面 45° と併用して判断される`,
    margin: margin(g.height, worst),
  };
}

/* ------------------------------------------------------------------ */
/* GPDO 2015 Part 1 Class A — 後方増築の許可不要開発 (PD)                 */
/* ------------------------------------------------------------------ */

/** 後方増築とみなす部分の奥行 [m] */
export function extensionDepth(b: Building, p: UkParams): number {
  return Math.max(0, b.depth - p.originalDepth);
}

/** Class A の標準奥行限度と拡大限度 (prior approval) [m] */
export function pdDepthLimits(p: UkParams): { standard: number; enlarged: number | null } {
  const standard = p.houseType === 'detached' ? 4 : 3;
  const enlarged = p.isDesignatedLand ? null : p.houseType === 'detached' ? 8 : 6;
  return { standard, enlarged };
}

export function checkPdDepth(_site: Site, b: Building, p: UkParams): CheckResult {
  const ext = extensionDepth(b, p);
  const { standard, enlarged } = pdDepthLimits(p);
  const base = {
    id: 'uk-pd-depth',
    name: 'PD: 後方増築の奥行',
    nameEn: 'PD rear extension depth',
    legalBasis: 'GPDO 2015 Sch.2 Pt.1 Class A.1(f)',
  };
  if (ext <= 0) {
    return {
      ...base,
      status: 'na',
      actual: '増築なし',
      limit: `${standard}m`,
      detail: `建物奥行 ${fmt(b.depth, 1)}m がオリジナル住宅の奥行 ${fmt(p.originalDepth, 1)}m 以下のため増築部分なし`,
    };
  }
  if (ext <= standard + 1e-9) {
    return {
      ...base,
      status: 'pass',
      actual: `${fmt(ext, 2)}m`,
      limit: `${standard}m`,
      detail: `${p.houseType === 'detached' ? '戸建' : '非戸建'}の単層後方増築は ${standard}m まで許可不要`,
      margin: margin(ext, standard),
    };
  }
  if (enlarged !== null && ext <= enlarged + 1e-9 && b.floors === 1) {
    return {
      ...base,
      status: 'info',
      actual: `${fmt(ext, 2)}m`,
      limit: `${standard}m (事前届出で ${enlarged}m)`,
      detail: `標準限度 ${standard}m 超・拡大限度 ${enlarged}m 以内 — 近隣協議手続 (prior approval) を経れば許可不要開発になり得る`,
      margin: margin(ext, enlarged),
    };
  }
  return {
    ...base,
    status: 'fail',
    actual: `${fmt(ext, 2)}m`,
    limit: enlarged !== null && b.floors === 1 ? `${standard}m (事前届出で ${enlarged}m)` : `${standard}m`,
    detail:
      `限度超過 — 許可不要開発 (PD) の対象外となり、計画許可 (planning permission) の申請が必要` +
      (p.isDesignatedLand ? ' (指定地のため拡大限度は利用不可)' : ''),
    margin: margin(ext, enlarged !== null && b.floors === 1 ? enlarged : standard),
  };
}

export function checkPdHeight(site: Site, b: Building, p: UkParams): CheckResult {
  const g = deriveGeometry(site, b);
  const ext = extensionDepth(b, p);
  const base = {
    id: 'uk-pd-height',
    name: 'PD: 増築部の高さ',
    nameEn: 'PD extension height',
    legalBasis: 'GPDO 2015 Sch.2 Pt.1 Class A.1(g)-(i)',
  };
  if (ext <= 0) {
    return { ...base, status: 'na', actual: '増築なし', limit: '—', detail: '増築部分なし' };
  }
  if (b.floors === 1) {
    const ok = g.height <= 4 + 1e-9;
    return {
      ...base,
      status: ok ? 'pass' : 'fail',
      actual: `${fmt(g.height, 2)}m`,
      limit: '4m',
      detail: '単層の後方増築は最高高さ 4m まで',
      margin: margin(g.height, 4),
    };
  }
  // 2 層以上の後方増築: 奥行 3m 以内かつ後方境界から 7m 以上離す (A.1(h))
  const rearDist = g.setbackNorth;
  const okDepth = ext <= 3 + 1e-9;
  const okRear = rearDist >= 7 - 1e-9;
  return {
    ...base,
    status: okDepth && okRear ? 'pass' : 'fail',
    actual: `奥行 ${fmt(ext, 2)}m・後方境界まで ${fmt(rearDist, 2)}m`,
    limit: '奥行 3m 以内かつ後方境界から 7m 以上',
    detail: '2 層以上の後方増築の条件 (A.1(h))。屋根高さは既存屋根以下等の条件もある',
    margin: Math.min(margin(ext, 3), margin(7, Math.max(rearDist, 1e-9))),
  };
}

export function checkPdEaves(site: Site, b: Building, p: UkParams): CheckResult {
  const g = deriveGeometry(site, b);
  const ext = extensionDepth(b, p);
  const base = {
    id: 'uk-pd-eaves',
    name: 'PD: 境界 2m 以内の軒高',
    nameEn: 'PD eaves near boundary',
    legalBasis: 'GPDO 2015 Sch.2 Pt.1 Class A.1(g)',
  };
  if (ext <= 0) {
    return { ...base, status: 'na', actual: '増築なし', limit: '—', detail: '増築部分なし' };
  }
  const nearBoundary = b.setbackWest < 2 || g.setbackEast < 2;
  if (!nearBoundary) {
    return {
      ...base,
      status: 'pass',
      actual: `側面境界まで ${fmt(Math.min(b.setbackWest, g.setbackEast), 2)}m`,
      limit: '境界 2m 以内なら軒高 3m',
      detail: '側面境界から 2m 超離れているため軒高制限は適用されない',
      margin: 1,
    };
  }
  const ok = g.eavesHeight <= 3 + 1e-9;
  return {
    ...base,
    status: ok ? 'pass' : 'fail',
    actual: `軒高 ${fmt(g.eavesHeight, 2)}m`,
    limit: '3m',
    detail: `増築部が側面境界から 2m 以内にあるため軒高 3m 以下とする必要がある`,
    margin: margin(g.eavesHeight, 3),
  };
}

export function checkPdCoverage(site: Site, b: Building, p: UkParams): CheckResult {
  const ext = extensionDepth(b, p);
  const base = {
    id: 'uk-pd-coverage',
    name: 'PD: 敷地被覆率',
    nameEn: 'PD curtilage coverage',
    legalBasis: 'GPDO 2015 Sch.2 Pt.1 Class A.1(e)',
  };
  if (ext <= 0) {
    return { ...base, status: 'na', actual: '増築なし', limit: '50%', detail: '増築部分なし' };
  }
  // オリジナル住宅 = 建物幅 × originalDepth と近似
  const originalArea = b.width * Math.min(p.originalDepth, b.depth);
  const extensionArea = b.width * ext;
  const curtilage = site.width * site.depth - originalArea;
  const pct = (extensionArea / curtilage) * 100;
  const ok = pct <= 50 + 1e-9;
  return {
    ...base,
    status: ok ? 'pass' : 'fail',
    actual: `${fmt(pct, 1)}% (${fmt(extensionArea, 1)}m²)`,
    limit: '50%',
    detail: `オリジナル住宅を除く敷地 (curtilage) ${fmt(curtilage, 1)}m² に対する増築等の被覆率`,
    margin: margin(pct, 50),
  };
}

/* ------------------------------------------------------------------ */
/* NDSS — 全国標準住戸面積基準                                           */
/* ------------------------------------------------------------------ */

/** NDSS の最小 GIA (1人1寝室住戸・シャワーのみ) [m²] */
export const NDSS_MIN_GIA = 37;

export function checkSpaceStandard(site: Site, b: Building, p: UkParams): CheckResult {
  const g = deriveGeometry(site, b);
  const base = {
    id: 'uk-ndss',
    name: '住戸面積基準 (NDSS)',
    nameEn: 'Nationally Described Space Standard',
    legalBasis: 'DLUHC Technical housing standards (2015)',
  };
  if (p.dwellingCount <= 0) {
    return {
      ...base,
      status: 'na',
      actual: '—',
      limit: `${NDSS_MIN_GIA}m²/戸〜`,
      detail: '住戸数 0 のため対象外 (住戸数を設定すると概算検定を行う)',
    };
  }
  const giaPerDwelling = g.totalFloorArea / p.dwellingCount;
  const ok = giaPerDwelling >= NDSS_MIN_GIA;
  return {
    ...base,
    status: ok ? 'pass' : 'fail',
    actual: `${fmt(giaPerDwelling, 1)}m²/戸 (${p.dwellingCount}戸)`,
    limit: `${NDSS_MIN_GIA}m²/戸 以上`,
    detail:
      '最小住戸タイプ (1b1p) の下限との概算比較。実際の要求値は住戸タイプ・寝室数・階数で異なり、' +
      'ローカルプランで採用された場合に適用される',
    margin: ok ? (giaPerDwelling - NDSS_MIN_GIA) / giaPerDwelling : margin(NDSS_MIN_GIA, giaPerDwelling),
  };
}

/* ------------------------------------------------------------------ */
/* 制度差の情報表示                                                      */
/* ------------------------------------------------------------------ */

export function infoDiscretionary(site: Site, b: Building): CheckResult {
  const g = deriveGeometry(site, b);
  return {
    id: 'uk-discretionary',
    name: '計画許可 (裁量型審査)',
    nameEn: 'Planning permission (discretionary)',
    legalBasis: 'Town and Country Planning Act 1990 s.57',
    status: 'info',
    actual: `高さ ${fmt(g.height, 2)}m・${b.floors}階`,
    limit: '一義的な限度なし',
    detail:
      '英国には日本の斜線制限・容積率のような全国一律の形態規制はなく、PD の範囲を超える開発は' +
      'ローカルプランの方針と個別審査 (officer judgement) により判断される',
  };
}

/* ------------------------------------------------------------------ */

export function runUkChecks(site: Site, b: Building, p: UkParams): CheckResult[] {
  return [
    check25Degree(site, b, p),
    check45Degree(site, b, p),
    checkPdDepth(site, b, p),
    checkPdHeight(site, b, p),
    checkPdEaves(site, b, p),
    checkPdCoverage(site, b, p),
    checkSpaceStandard(site, b, p),
    infoDiscretionary(site, b),
  ];
}
