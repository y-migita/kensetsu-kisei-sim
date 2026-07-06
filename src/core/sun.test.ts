import { describe, expect, it } from 'vitest';
import { shadowOffset, sunDirection, sunPosition } from './sun';

const deg = (rad: number) => (rad * 180) / Math.PI;

describe('sunPosition (冬至・東京 35.68°N)', () => {
  it('南中時 (真太陽時12時) の太陽高度は 90 - 緯度 - 23.44°', () => {
    const pos = sunPosition(35.68, 12);
    expect(deg(pos.altitude)).toBeCloseTo(90 - 35.68 - 23.44, 1);
    expect(deg(pos.azimuth)).toBeCloseTo(0, 5);
  });

  it('真太陽時 8時の高度はおよそ 8.1°、方位は東寄り (負)', () => {
    const pos = sunPosition(35.68, 8);
    expect(Math.abs(deg(pos.altitude) - 8.1)).toBeLessThan(0.5);
    expect(deg(pos.azimuth)).toBeLessThan(-45);
  });

  it('午前と午後は南中に対して対称', () => {
    const am = sunPosition(35.68, 9);
    const pm = sunPosition(35.68, 15);
    expect(am.altitude).toBeCloseTo(pm.altitude, 10);
    expect(am.azimuth).toBeCloseTo(-pm.azimuth, 10);
  });
});

describe('sunDirection', () => {
  it('南中時は真南 (+Z) かつ上向き', () => {
    const dir = sunDirection(sunPosition(35.68, 12));
    expect(dir[0]).toBeCloseTo(0, 5);
    expect(dir[1]).toBeGreaterThan(0);
    expect(dir[2]).toBeGreaterThan(0);
  });

  it('午前は東 (+X) 側に太陽がある', () => {
    const dir = sunDirection(sunPosition(35.68, 9));
    expect(dir[0]).toBeGreaterThan(0);
  });
});

describe('shadowOffset', () => {
  it('南中時、高さ 10m の点の影は真北 (-Z) へ (10 - 面高) / tan(高度)', () => {
    const pos = sunPosition(35.68, 12);
    const off = shadowOffset(pos, 10, 0);
    expect(off).not.toBeNull();
    const expectedLen = 10 / Math.tan(pos.altitude);
    expect(off![0]).toBeCloseTo(0, 5);
    expect(off![1]).toBeCloseTo(-expectedLen, 5);
  });

  it('測定面より低い点は影を落とさない (オフセット 0)', () => {
    const pos = sunPosition(35.68, 12);
    expect(shadowOffset(pos, 3, 4)).toEqual([0, 0]);
  });

  it('太陽が地平線下なら null', () => {
    const pos = sunPosition(35.68, 0); // 真夜中
    expect(shadowOffset(pos, 10, 0)).toBeNull();
  });
});
