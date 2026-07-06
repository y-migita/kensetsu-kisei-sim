import { describe, expect, it } from 'vitest';
import type { Building, Site } from '../types';
import {
  TAN_25,
  check25Degree,
  check45Degree,
  checkPdCoverage,
  checkPdDepth,
  checkPdEaves,
  checkPdHeight,
  checkSpaceStandard,
  extensionDepth,
  pdDepthLimits,
  ukPlane25,
  type UkParams,
} from './checks';

const site: Site = {
  width: 10,
  depth: 20,
  roadWidth: 6,
  isCornerLot: false,
  latitude: 51.5, // ロンドン
};

/** 幅 6m・奥行 12m・2 階建 (階高 2.7m) の住宅 */
const building: Building = {
  width: 6,
  depth: 12,
  setbackSouth: 3,
  setbackWest: 2,
  floors: 2,
  floorHeight: 2.7,
  parapet: 0,
};

const params: UkParams = {
  houseType: 'semi-detached',
  isDesignatedLand: false,
  originalDepth: 10,
  neighbourWindowDist: 1,
  neighbourWindowHeight: 1.6,
  oppositeWindowSetback: 3,
  oppositeWindowHeight: 1.6,
  dwellingCount: 1,
};

describe('BRE 25° テスト', () => {
  it('窓から建物南面までの距離に応じた許容高さ', () => {
    // 距離 = 道路 6 + 向かい後退 3 + 自後退 3 = 12m → 1.6 + tan25 × 12 ≈ 7.20m
    const r = check25Degree(site, building, params);
    const expected = 1.6 + TAN_25 * 12; // ≈ 7.196m
    expect(expected).toBeCloseTo(7.2, 1);
    expect(r.limit).toContain('7.2');
    // 高さ 5.4m ≤ 7.20m → pass
    expect(r.status).toBe('pass');
  });

  it('高い建物は指針超過', () => {
    const tall = { ...building, floors: 4 }; // 10.8m > 7.2m
    expect(check25Degree(site, tall, params).status).toBe('fail');
  });

  it('斜面パラメータ: 起点は道路反対側 + 向かい建物の後退距離', () => {
    const plane = ukPlane25(site, params);
    expect(plane.origin).toBeCloseTo(10 + 6 + 3);
    expect(plane.slope).toBeCloseTo(Math.tan((25 * Math.PI) / 180));
  });
});

describe('45° ルール', () => {
  it('隣地窓からの距離に応じた許容高さ (worst 側で判定)', () => {
    // 東側: 境界余り = 10 - 2 - 6 = 2m → 距離 3m → 許容 4.6m
    // 西側: 2m → 距離 3m → 許容 4.6m
    const r = check45Degree(site, building, params);
    expect(r.status).toBe('fail'); // 5.4m > 4.6m
    expect(r.limit).toContain('4.6');
  });

  it('十分離れていれば適合', () => {
    const narrow = { ...building, width: 4, setbackWest: 3 }; // 両側 3m → 距離 4m → 許容 5.6m
    expect(check45Degree(site, narrow, params).status).toBe('pass');
  });
});

describe('PD Class A: 増築奥行', () => {
  it('奥行限度: 戸建 4m (拡大 8m) / その他 3m (拡大 6m)', () => {
    expect(pdDepthLimits(params)).toEqual({ standard: 3, enlarged: 6 });
    expect(pdDepthLimits({ ...params, houseType: 'detached' })).toEqual({
      standard: 4,
      enlarged: 8,
    });
    expect(pdDepthLimits({ ...params, isDesignatedLand: true }).enlarged).toBeNull();
  });

  it('増築部分 = 建物奥行 - オリジナル奥行', () => {
    expect(extensionDepth(building, params)).toBe(2);
    expect(extensionDepth({ ...building, depth: 9 }, params)).toBe(0);
  });

  it('semi-detached 2m 増築は PD 適合', () => {
    expect(checkPdDepth(site, building, params).status).toBe('pass');
  });

  it('4m 増築 (単層) は事前届出対象 (info)', () => {
    const b1 = { ...building, depth: 14, floors: 1 };
    expect(checkPdDepth(site, b1, params).status).toBe('info');
  });

  it('4m 増築 (2階建) は PD 対象外 (fail)', () => {
    const b2 = { ...building, depth: 14 };
    expect(checkPdDepth(site, b2, params).status).toBe('fail');
  });

  it('7m 増築は拡大限度も超過', () => {
    const b3 = { ...building, depth: 17, floors: 1 };
    expect(checkPdDepth(site, b3, params).status).toBe('fail');
  });

  it('増築なしなら対象外', () => {
    expect(checkPdDepth(site, { ...building, depth: 10 }, params).status).toBe('na');
  });
});

describe('PD Class A: 高さ・軒高', () => {
  it('単層増築は高さ 4m まで', () => {
    const b1 = { ...building, floors: 1, floorHeight: 3.5 };
    expect(checkPdHeight(site, b1, params).status).toBe('pass');
    const b2 = { ...building, floors: 1, floorHeight: 4.5 };
    expect(checkPdHeight(site, b2, params).status).toBe('fail');
  });

  it('2 層増築: 奥行 3m 以内かつ後方境界 7m 以上で適合', () => {
    // building: ext 2m ≤ 3m, setbackNorth = 20/2 - (-...) → south=7, north=-5, 境界-10 → 5m < 7m → fail
    expect(checkPdHeight(site, building, params).status).toBe('fail');
    const shallower: Building = { ...building, depth: 11, setbackSouth: 2 };
    // south = 8, north = -3, setbackNorth = 7 → pass (ext 1m ≤ 3m)
    expect(checkPdHeight(site, shallower, params).status).toBe('pass');
  });

  it('境界 2m 以内の増築は軒高 3m まで', () => {
    const near = { ...building, setbackWest: 1 };
    expect(checkPdEaves(site, near, params).status).toBe('fail'); // 軒高 5.4m
    const singleLow = { ...near, floors: 1, floorHeight: 2.8 };
    expect(checkPdEaves(site, singleLow, params).status).toBe('pass');
  });

  it('境界から 2m 超なら軒高制限なし', () => {
    const away: Building = { ...building, width: 5, setbackWest: 2.5 };
    // 東側余り = 10 - 2.5 - 5 = 2.5m
    expect(checkPdEaves(site, away, params).status).toBe('pass');
  });
});

describe('PD Class A: 敷地被覆率', () => {
  it('curtilage (オリジナル住宅除く) の 50% 以下', () => {
    // curtilage = 200 - 6×10 = 140m², 増築 6×2 = 12m² → 8.6% pass
    const r = checkPdCoverage(site, building, params);
    expect(r.status).toBe('pass');
    expect(r.actual).toContain('8.6');
  });

  it('大規模増築は超過', () => {
    const big: Building = { ...building, width: 9, depth: 19, setbackSouth: 0.5, setbackWest: 0.5 };
    // curtilage = 200 - 90 = 110, 増築 = 9×9 = 81 → 73.6% fail
    expect(checkPdCoverage(site, big, params).status).toBe('fail');
  });
});

describe('NDSS 住戸面積基準', () => {
  it('GIA/戸 が 37m² 以上なら適合', () => {
    // 6×12×2 = 144m² / 1戸
    expect(checkSpaceStandard(site, building, params).status).toBe('pass');
  });

  it('過密な住戸割りは不適合', () => {
    expect(checkSpaceStandard(site, building, { ...params, dwellingCount: 4 }).status).toBe('fail'); // 36m²
  });

  it('住戸数 0 は対象外', () => {
    expect(checkSpaceStandard(site, building, { ...params, dwellingCount: 0 }).status).toBe('na');
  });
});
