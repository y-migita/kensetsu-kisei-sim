import { describe, expect, it } from 'vitest';
import { sunPosition } from '../sun';
import type { Building, Site } from '../types';
import { deemedBoundary, shadowPolygon, simulateShade } from './shade';

const site: Site = {
  width: 12,
  depth: 12,
  roadWidth: 6,
  isCornerLot: false,
  latitude: 35.68,
};

/** 高さ 12m (4階) の建物 — 日影規制対象規模 */
const building: Building = {
  width: 8,
  depth: 8,
  setbackSouth: 2,
  setbackWest: 2,
  floors: 4,
  floorHeight: 3,
  parapet: 0,
};

describe('deemedBoundary (施行令135条の12 道路緩和)', () => {
  it('幅員 10m 以下の道路は中心線をみなし境界線とする', () => {
    const b = deemedBoundary(site); // road 6m
    expect(b.maxZ).toBeCloseTo(6 + 3);
  });

  it('幅員 10m 超の道路は反対側から 5m 敷地側の線', () => {
    const b = deemedBoundary({ ...site, roadWidth: 14 });
    expect(b.maxZ).toBeCloseTo(6 + 14 - 5);
  });
});

describe('shadowPolygon', () => {
  it('南中時の影は建物の真北へ伸びる凸多角形', () => {
    const sun = sunPosition(35.68, 12);
    const hull = shadowPolygon(site, building, sun, 4);
    expect(hull).not.toBeNull();
    const minZ = Math.min(...hull!.map((p) => p[1]));
    const buildingNorth = 6 - 2 - 8; // -4
    // 影の先端は建物北面より北 (-Z) にある
    expect(minZ).toBeLessThan(buildingNorth);
    // 東西には (南中なので) 建物幅を超えない
    const xs = hull!.map((p) => p[0]);
    expect(Math.min(...xs)).toBeCloseTo(6 - 12 + 2, 5); // 西面 x = -4
    expect(Math.max(...xs)).toBeCloseTo(-4 + 8, 5);
  });

  it('建物高さが測定面以下なら影なし', () => {
    const sun = sunPosition(35.68, 12);
    const low: Building = { ...building, floors: 1 }; // 3m < 4m
    expect(shadowPolygon(site, low, sun, 4)).toBeNull();
  });
});

describe('simulateShade', () => {
  const result = simulateShade(site, building, 4, 35.68, {
    timeStepMinutes: 10,
    resolution: 1,
  });

  it('建物北側に日影が生じ、5-10m 帯の最大時間は正', () => {
    expect(result.maxHours5to10).toBeGreaterThan(0);
  });

  it('最大日影時間は検定時間帯 (8h) を超えない', () => {
    expect(result.maxHours5to10).toBeLessThanOrEqual(8);
    expect(result.maxHoursBeyond10).toBeLessThanOrEqual(8);
  });

  it('10m 超帯の最大時間は 5-10m 帯以下 (影は遠方ほど短時間)', () => {
    expect(result.maxHoursBeyond10).toBeLessThanOrEqual(result.maxHours5to10 + 1e-6);
  });

  it('建物南側 (道路側遠方) のセルはほぼ日影にならない', () => {
    const { grid } = result;
    // 敷地南端から道路を挟んで南へ 15m の点
    const x = 0;
    const z = 6 + 15;
    const i = Math.floor((x - grid.originX) / grid.resolution);
    const j = Math.floor((z - grid.originZ) / grid.resolution);
    expect(grid.hours[j * grid.cols + i]).toBe(0);
  });

  it('東西対称の建物では日影分布もほぼ東西対称', () => {
    const centered: Building = { ...building, setbackWest: 2 }; // 敷地中央 (12-8)/2 = 2
    const r = simulateShade(site, centered, 4, 35.68, { timeStepMinutes: 10, resolution: 1 });
    const { grid } = r;
    // 建物中心 x=0 に対して対称な 2 点の時間差が小さい
    const zTest = -10;
    const j = Math.floor((zTest - grid.originZ) / grid.resolution);
    const iL = Math.floor((-6 - grid.originX) / grid.resolution);
    const iR = Math.floor((6 - grid.originX) / grid.resolution) - 1;
    const hL = grid.hours[j * grid.cols + iL];
    const hR = grid.hours[j * grid.cols + iR];
    expect(Math.abs(hL - hR)).toBeLessThan(0.5);
  });

  it('背の高い建物ほど日影時間は長い (単調性)', () => {
    const taller: Building = { ...building, floors: 8 };
    const r2 = simulateShade(site, taller, 4, 35.68, { timeStepMinutes: 10, resolution: 1 });
    expect(r2.maxHours5to10).toBeGreaterThanOrEqual(result.maxHours5to10 - 1e-6);
    expect(r2.maxHoursBeyond10).toBeGreaterThanOrEqual(result.maxHoursBeyond10 - 1e-6);
  });

  it('北海道 (9〜15時) は検定時間帯が短く、最大日影時間は 6h 以下かつ全国帯以下', () => {
    const hk = simulateShade(site, building, 4, 43.06, {
      timeStepMinutes: 10,
      resolution: 1,
      timeRange: [9, 15],
    });
    expect(hk.timeRange).toEqual([9, 15]);
    expect(hk.maxHours5to10).toBeLessThanOrEqual(6);
    const full = simulateShade(site, building, 4, 43.06, { timeStepMinutes: 10, resolution: 1 });
    expect(hk.maxHours5to10).toBeLessThanOrEqual(full.maxHours5to10 + 1e-6);
  });
});
