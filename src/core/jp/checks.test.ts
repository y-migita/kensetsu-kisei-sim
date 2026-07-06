import { describe, expect, it } from 'vitest';
import { deriveGeometry } from '../geometry';
import type { Building, Site } from '../types';
import {
  adjacentSlantBoundaries,
  checkAbsoluteHeight,
  checkAdjacentSlant,
  checkCoverage,
  checkFar,
  checkNorthSlant,
  checkRoadSlant,
  effectiveCoverageLimit,
  effectiveFarLimit,
  isShadeTargetBuilding,
  roadSlantAllowedHeight,
  roadSlantApplicableDistance,
  roadSlantSpec,
  type JpParams,
} from './checks';
import { JP_ZONES } from './zoning';

/** 敷地 10m × 15m、前面道路 4m (南)、東京 */
const site: Site = {
  width: 10,
  depth: 15,
  roadWidth: 4,
  isCornerLot: false,
  latitude: 35.68,
};

/** 建物 6m × 8m、道路から 2m・西から 2m 後退、3階 (階高 3m) */
const building: Building = {
  width: 6,
  depth: 8,
  setbackSouth: 2,
  setbackWest: 2,
  floors: 3,
  floorHeight: 3,
  parapet: 0,
};

const baseParams: JpParams = {
  zone: 'r1',
  coverageLimit: 60,
  farLimit: 200,
  fireZone: 'none',
  fireResistance: 'none',
  lowRiseHeightLimit: 10,
  shadeDesignated: true,
  shadeRuleIndex: 0,
  shadeMeasureHeight: 4,
};

describe('deriveGeometry', () => {
  it('面と後退距離を正しく導出する', () => {
    const g = deriveGeometry(site, building);
    expect(g.south).toBeCloseTo(15 / 2 - 2); // 5.5
    expect(g.north).toBeCloseTo(5.5 - 8); // -2.5
    expect(g.west).toBeCloseTo(-5 + 2); // -3
    expect(g.east).toBeCloseTo(-3 + 6); // 3
    expect(g.setbackNorth).toBeCloseTo(-2.5 - -7.5); // 5
    expect(g.setbackEast).toBeCloseTo(5 - 3); // 2
    expect(g.height).toBe(9);
    expect(g.footprintArea).toBe(48);
    expect(g.totalFloorArea).toBe(144);
  });
});

describe('建蔽率 (53条)', () => {
  it('基本: 48/150 = 32% ≤ 60% で適合', () => {
    const r = checkCoverage(site, building, baseParams);
    expect(r.status).toBe('pass');
    expect(r.actual).toContain('32');
  });

  it('角地は +10%', () => {
    expect(effectiveCoverageLimit({ ...site, isCornerLot: true }, baseParams)).toBe(70);
  });

  it('防火地域 × 耐火建築物は +10%', () => {
    expect(
      effectiveCoverageLimit(site, { ...baseParams, fireZone: 'fire', fireResistance: 'fireproof' }),
    ).toBe(70);
  });

  it('準防火地域 × 準耐火建築物も +10% (2019年改正)', () => {
    expect(
      effectiveCoverageLimit(site, {
        ...baseParams,
        fireZone: 'quasi-fire',
        fireResistance: 'quasi-fireproof',
      }),
    ).toBe(70);
  });

  it('80%区域 × 防火地域 × 耐火建築物は制限なし (53条6項1号)', () => {
    expect(
      effectiveCoverageLimit(site, {
        ...baseParams,
        coverageLimit: 80,
        fireZone: 'fire',
        fireResistance: 'fireproof',
      }),
    ).toBe(100);
  });

  it('角地 + 耐火でも 100% を超えない', () => {
    expect(
      effectiveCoverageLimit(
        { ...site, isCornerLot: true },
        { ...baseParams, coverageLimit: 80, fireZone: 'quasi-fire', fireResistance: 'fireproof' },
      ),
    ).toBe(100);
  });

  it('超過は fail', () => {
    const r = checkCoverage(site, { ...building, width: 10, depth: 10 }, baseParams);
    expect(r.status).toBe('fail'); // 100/150 = 66.7% > 60%
  });
});

describe('容積率 (52条)', () => {
  it('前面道路 4m の住居系は 4 × 0.4 = 160% に制限', () => {
    expect(effectiveFarLimit(site, baseParams)).toBeCloseTo(160);
  });

  it('前面道路 4m の商業系は 4 × 0.6 = 240% だが指定 200% が勝つ', () => {
    expect(effectiveFarLimit(site, { ...baseParams, zone: 'commercial', farLimit: 200 })).toBe(200);
  });

  it('幅員 12m 以上は道路幅員による低減なし', () => {
    expect(effectiveFarLimit({ ...site, roadWidth: 12 }, baseParams)).toBe(200);
  });

  it('144/150 = 96% ≤ 160% で適合', () => {
    const r = checkFar(site, building, baseParams);
    expect(r.status).toBe('pass');
  });

  it('5階建 (240/150 = 160%) はちょうど適合、6階建は超過', () => {
    expect(checkFar(site, { ...building, floors: 5 }, baseParams).status).toBe('pass');
    expect(checkFar(site, { ...building, floors: 6 }, baseParams).status).toBe('fail');
  });
});

describe('絶対高さ制限 (55条)', () => {
  it('低層住専で高さ 9m ≤ 10m は適合', () => {
    const r = checkAbsoluteHeight(site, building, { ...baseParams, zone: 'r1-low' });
    expect(r.status).toBe('pass');
  });

  it('低層住専で高さ 12m > 10m は不適合、指定 12m なら適合', () => {
    const tall = { ...building, floors: 4 }; // 12m
    expect(checkAbsoluteHeight(site, tall, { ...baseParams, zone: 'r1-low' }).status).toBe('fail');
    expect(
      checkAbsoluteHeight(site, tall, { ...baseParams, zone: 'r1-low', lowRiseHeightLimit: 12 })
        .status,
    ).toBe('pass');
  });

  it('低層系以外は対象外', () => {
    expect(checkAbsoluteHeight(site, building, baseParams).status).toBe('na');
  });
});

describe('道路斜線 (56条・別表第3)', () => {
  it('適用距離: 住居系 容積率160% → 20m / 商業 500% → 25m', () => {
    expect(roadSlantApplicableDistance(JP_ZONES['r1'], 160)).toBe(20);
    expect(roadSlantApplicableDistance(JP_ZONES['commercial'], 500)).toBe(25);
    expect(roadSlantApplicableDistance(JP_ZONES['commercial'], 1300)).toBe(50);
    expect(roadSlantApplicableDistance(JP_ZONES['industrial'], 300)).toBe(25);
  });

  it('後退なし: 許容高さ = 1.25 × 道路幅員 (住居系)', () => {
    const b0 = { ...building, setbackSouth: 0 };
    const spec = roadSlantSpec(site, b0, baseParams);
    const g = deriveGeometry(site, b0);
    expect(roadSlantAllowedHeight(spec, spec.oppositeZ - g.south)).toBeCloseTo(1.25 * 4);
  });

  it('後退 2m: 許容高さ = 1.25 × (4 + 2×2) = 10m (セットバック緩和)', () => {
    const spec = roadSlantSpec(site, building, baseParams);
    const g = deriveGeometry(site, building);
    expect(roadSlantAllowedHeight(spec, spec.oppositeZ - g.south)).toBeCloseTo(10);
  });

  it('高さ 9m の建物は後退 2m で適合、後退 0m で不適合 (許容 5m)', () => {
    expect(checkRoadSlant(site, building, baseParams).status).toBe('pass');
    expect(checkRoadSlant(site, { ...building, setbackSouth: 0 }, baseParams).status).toBe('fail');
  });

  it('商業系の勾配は 1.5', () => {
    const p = { ...baseParams, zone: 'commercial' as const, farLimit: 400 };
    const b0 = { ...building, setbackSouth: 0 };
    const spec = roadSlantSpec(site, b0, p);
    expect(roadSlantAllowedHeight(spec, 4)).toBeCloseTo(6);
  });

  it('幅員 12m 以上の住居系: 1.25W 以遠は勾配 1.5 (56条3項)', () => {
    const wideRoad = { ...site, roadWidth: 12 };
    const spec = roadSlantSpec(wideRoad, building, { ...baseParams, zone: 'r1-mid' });
    expect(spec.steepFrom).toBe(15);
    expect(roadSlantAllowedHeight(spec, 14)).toBeCloseTo(1.25 * 14);
    expect(roadSlantAllowedHeight(spec, 16)).toBeCloseTo(1.5 * 16);
  });

  it('低層住専には 56条3項の緩和は適用されない', () => {
    const wideRoad = { ...site, roadWidth: 12 };
    const spec = roadSlantSpec(wideRoad, building, { ...baseParams, zone: 'r1-low' });
    expect(spec.steepFrom).toBeNull();
  });

  it('適用距離の外側にある建物は制限を受けない', () => {
    const deepSite: Site = { ...site, depth: 60 };
    const farBack = { ...building, setbackSouth: 30 }; // 水平距離 4 + 60 = 64m > 20m
    const r = checkRoadSlant(deepSite, farBack, baseParams);
    expect(r.status).toBe('pass');
    expect(r.limit).toContain('適用距離外');
  });
});

describe('隣地斜線 (56条1項2号)', () => {
  it('高さ 20m 以下は立上り以下で自明に適合 (住居系)', () => {
    const r = checkAdjacentSlant(site, building, baseParams);
    expect(r.status).toBe('pass');
  });

  it('後退緩和込みの許容高さ: 20 + 1.25 × 2d', () => {
    const bs = adjacentSlantBoundaries(site, building, baseParams);
    const north = bs.find((x) => x.label === '北側')!;
    expect(north.distance).toBeCloseTo(5);
    expect(north.allowed).toBeCloseTo(20 + 1.25 * 10);
    const east = bs.find((x) => x.label === '東側')!;
    expect(east.allowed).toBeCloseTo(20 + 1.25 * 4);
  });

  it('高さ 25m・東側後退 2m → 許容 25m でちょうど適合、後退 1.5m なら不適合', () => {
    const bigSite: Site = { ...site, width: 20, depth: 30 };
    const tall: Building = { ...building, floors: 10, floorHeight: 2.5, setbackWest: 2, width: 16 };
    // setbackEast = 20 - 2 - 16 = 2m → 許容 20 + 1.25×4 = 25m
    expect(checkAdjacentSlant(bigSite, tall, baseParams).status).toBe('pass');
    const closer: Building = { ...tall, width: 16.5 }; // setbackEast = 1.5 → 許容 23.75
    expect(checkAdjacentSlant(bigSite, closer, baseParams).status).toBe('fail');
  });

  it('商業系は 31m + 2.5 勾配', () => {
    const bigSite: Site = { ...site, width: 20, depth: 30 };
    const tall: Building = { ...building, floors: 12, floorHeight: 3 }; // 36m
    const bs = adjacentSlantBoundaries(bigSite, tall, { ...baseParams, zone: 'commercial' });
    const west = bs.find((x) => x.label === '西側')!;
    expect(west.allowed).toBeCloseTo(31 + 2.5 * 4);
  });

  it('低層住専は対象外', () => {
    expect(checkAdjacentSlant(site, building, { ...baseParams, zone: 'r1-low' }).status).toBe('na');
  });
});

describe('北側斜線 (56条1項3号)', () => {
  it('低層住専: 5m + 1.25 × 真北距離', () => {
    // setbackNorth = 5m → 許容 11.25m、高さ 9m は適合
    const r = checkNorthSlant(site, building, { ...baseParams, zone: 'r1-low' });
    expect(r.status).toBe('pass');
    expect(r.limit).toContain('11.25');
  });

  it('低層住専: 北側いっぱいに寄せた 3 階建は不適合', () => {
    const north = { ...building, setbackSouth: 7, depth: 8 }; // setbackNorth = 0 → 許容 5m
    const r = checkNorthSlant(site, north, { ...baseParams, zone: 'r1-low' });
    expect(r.status).toBe('fail');
  });

  it('中高層住専: 日影規制指定区域では適用除外', () => {
    const r = checkNorthSlant(site, building, { ...baseParams, zone: 'r1-mid', shadeDesignated: true });
    expect(r.status).toBe('na');
  });

  it('中高層住専 (日影規制なし): 10m + 1.25 × 距離', () => {
    const r = checkNorthSlant(site, building, {
      ...baseParams,
      zone: 'r1-mid',
      shadeDesignated: false,
    });
    expect(r.status).toBe('pass');
    expect(r.limit).toContain('16.25');
  });

  it('住居地域・商業地域は対象外', () => {
    expect(checkNorthSlant(site, building, baseParams).status).toBe('na');
    expect(checkNorthSlant(site, building, { ...baseParams, zone: 'commercial' }).status).toBe('na');
  });
});

describe('日影規制の対象判定 (56条の2)', () => {
  it('低層系: 軒高 7m 超または 3 階以上で対象', () => {
    const p = { ...baseParams, zone: 'r1-low' as const };
    expect(isShadeTargetBuilding(site, building, p)).toBe(true); // 3階
    expect(isShadeTargetBuilding(site, { ...building, floors: 2 }, p)).toBe(false); // 軒高6m・2階
    expect(
      isShadeTargetBuilding(site, { ...building, floors: 2, floorHeight: 3.6 }, p),
    ).toBe(true); // 軒高 7.2m
  });

  it('中高層系以上: 高さ 10m 超で対象', () => {
    expect(isShadeTargetBuilding(site, building, baseParams)).toBe(false); // 9m
    expect(isShadeTargetBuilding(site, { ...building, floors: 4 }, baseParams)).toBe(true); // 12m
  });

  it('商業地域は対象外', () => {
    expect(
      isShadeTargetBuilding(site, { ...building, floors: 10 }, { ...baseParams, zone: 'commercial' }),
    ).toBe(false);
  });
});
