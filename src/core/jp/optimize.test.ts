import { describe, expect, it } from 'vitest';
import { validatePlacement } from '../geometry';
import type { Building, Site } from '../types';
import { runJpChecks } from './index';
import { maximizeFar } from './optimize';
import {
  SHADE_SIM_RESOLUTION,
  SHADE_SIM_TIME_STEP_MINUTES,
  shadeTimeRange,
  simulateShade,
  type ShadeSimResult,
} from './shade';
import { isShadeTargetBuilding, type JpParams } from './checks';

const site: Site = {
  width: 12,
  depth: 18,
  roadWidth: 6,
  isCornerLot: false,
  latitude: 35.68,
};

const building: Building = {
  width: 8,
  depth: 10,
  setbackSouth: 2,
  setbackWest: 2,
  floors: 3,
  floorHeight: 3,
  parapet: 0,
};

const jp: JpParams = {
  zone: 'r1-mid',
  coverageLimit: 60,
  farLimit: 200,
  fireZone: 'none',
  fireResistance: 'none',
  lowRiseHeightLimit: 10,
  shadeDesignated: true,
  shadeRuleIndex: 1,
  shadeMeasureHeight: 4,
  hokkaido: false,
};

function fineShadeSim(site: Site, b: Building, p: JpParams): ShadeSimResult | null {
  if (!isShadeTargetBuilding(site, b, p)) return null;
  return simulateShade(site, b, p.shadeMeasureHeight, site.latitude, {
    resolution: SHADE_SIM_RESOLUTION,
    timeStepMinutes: SHADE_SIM_TIME_STEP_MINUTES,
    timeRange: shadeTimeRange(p.hokkaido),
  });
}

function expectNoFail(site: Site, b: Building, p: JpParams) {
  const results = runJpChecks(site, b, p, fineShadeSim(site, b, p));
  expect(results.filter((r) => r.status === 'fail').map((r) => r.id)).toEqual([]);
}

describe('容積率最大化', () => {
  it('デフォルト構成で容積率200%に到達し4階を選ぶ', () => {
    const result = maximizeFar(site, jp, building);
    expect(result.feasible).toBe(true);
    expect(result.farPct).toBeCloseTo(200, 1);
    expect(result.building?.floors).toBe(4);
    expect(result.building).not.toBeNull();
    expectNoFail(site, result.building!, jp);
  });

  it('最適解は全チェックと配置検証を満たす', () => {
    const result = maximizeFar(site, jp, building);
    expect(result.feasible).toBe(true);
    expect(result.building).not.toBeNull();
    expectNoFail(site, result.building!, jp);
    expect(validatePlacement(site, result.building!)).toEqual([]);
  });

  it('日影指定なしでは北側斜線を復活させたうえで適合解を返す', () => {
    const p = { ...jp, shadeDesignated: false };
    const result = maximizeFar(site, p, building);
    expect(result.feasible).toBe(true);
    expect(result.building).not.toBeNull();
    expectNoFail(site, result.building!, p);
  });

  it('低層住居専用地域では絶対高さ制限により3階以下を選ぶ', () => {
    const p = { ...jp, zone: 'r1-low' as const, lowRiseHeightLimit: 10 as const };
    const result = maximizeFar(site, p, building);
    expect(result.feasible).toBe(true);
    expect(result.building?.floors).toBeLessThanOrEqual(3);
    expectNoFail(site, result.building!, p);
  });

  it('角地の建蔽率割増により達成容積率は低下しない', () => {
    const tight = maximizeFar(site, jp, building);
    const corner = maximizeFar({ ...site, isCornerLot: true }, jp, building);
    expect(tight.feasible).toBe(true);
    expect(corner.feasible).toBe(true);
    expect(corner.farPct).toBeGreaterThanOrEqual(tight.farPct - 1e-6);
  });

  it('道路幅員低減後の容積率160%を上限にする', () => {
    const narrowRoad = { ...site, roadWidth: 4 };
    const result = maximizeFar(narrowRoad, jp, building);
    expect(result.feasible).toBe(true);
    expect(result.farPct).toBeLessThanOrEqual(160 + 1e-6);
    expect(result.farCapPct).toBe(160);
    expectNoFail(narrowRoad, result.building!, jp);
  });

  it('粗グリッド全列挙のpass解は逆算結果を超えない', () => {
    const p = { ...jp, shadeDesignated: false };
    const optimized = maximizeFar(site, p, building);
    expect(optimized.feasible).toBe(true);

    let gridMaxFar = 0;
    for (let floors = 1; floors <= 8; floors++) {
      for (let width = 1; width <= site.width; width++) {
        for (let depth = 1; depth <= site.depth; depth++) {
          for (let setbackSouth = 0; setbackSouth <= site.depth; setbackSouth += 0.5) {
            const candidate: Building = {
              ...building,
              width,
              depth,
              setbackSouth,
              setbackWest: (site.width - width) / 2,
              floors,
            };
            if (validatePlacement(site, candidate).length > 0) continue;
            const results = runJpChecks(site, candidate, p, null);
            if (results.some((r) => r.status === 'fail')) continue;
            gridMaxFar = Math.max(gridMaxFar, (width * depth * floors * 100) / (site.width * site.depth));
          }
        }
      }
    }

    expect(gridMaxFar).toBeLessThanOrEqual(optimized.farPct + 1e-6);
  }, 20000);

  it('厳しい日影規制値では日影を含めて適合する奥行に制限する', () => {
    const wideRoad = { ...site, roadWidth: 12 };
    const p = { ...jp, farLimit: 500, shadeRuleIndex: 0 };
    const result = maximizeFar(wideRoad, p, building);
    expect(result.feasible).toBe(true);
    expect(result.notes.some((note) => note.includes('日影規制'))).toBe(true);
    expectNoFail(wideRoad, result.building!, p);
  });
});
