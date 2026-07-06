/**
 * 日本規制チェックの統合エントリポイント。
 */

import { deriveGeometry, fmt, margin } from '../geometry';
import type { Building, CheckResult, Site } from '../types';
import {
  checkAbsoluteHeight,
  checkAdjacentSlant,
  checkCoverage,
  checkFar,
  checkNorthSlant,
  checkRoadSlant,
  isShadeTargetBuilding,
  zoneOf,
  type JpParams,
} from './checks';
import { shadeCompliance, simulateShade, type ShadeSimResult } from './shade';
import { shadeRuleOptions } from './zoning';

export * from './checks';
export * from './shade';
export * from './zoning';

/** 日影規制の検定結果を組み立てる */
export function checkShade(
  site: Site,
  b: Building,
  p: JpParams,
  sim: ShadeSimResult | null,
): CheckResult {
  const zone = zoneOf(p);
  const g = deriveGeometry(site, b);
  const base = {
    id: 'jp-shade',
    name: '日影規制',
    nameEn: 'Sunlight shadow regulation',
    legalBasis: '建築基準法56条の2・別表第4',
  };
  if (!zone.shadeApplicable) {
    return {
      ...base,
      status: 'na',
      actual: '—',
      limit: '—',
      detail: `${zone.name}は日影規制の対象地域とならない (別表第4)`,
    };
  }
  if (!p.shadeDesignated) {
    return {
      ...base,
      status: 'na',
      actual: '—',
      limit: '—',
      detail: '地方公共団体の条例による対象区域の指定なしとして扱う',
    };
  }
  if (!isShadeTargetBuilding(site, b, p)) {
    const cond =
      zone.category === 'low-rise'
        ? '軒高 7m 超または地上 3 階以上'
        : '高さ 10m 超';
    return {
      ...base,
      status: 'pass',
      actual: zone.category === 'low-rise' ? `軒高 ${fmt(g.eavesHeight, 2)}m・${b.floors}階` : `高さ ${fmt(g.height, 2)}m`,
      limit: `対象規模 (${cond}) 未満`,
      detail: '対象規模未満のため日影規制の検定は不要',
      margin: 1,
    };
  }
  if (!sim) {
    return {
      ...base,
      status: 'info',
      actual: '計算中',
      limit: '—',
      detail: '日影シミュレーションを実行中',
    };
  }
  const rules = shadeRuleOptions(zone, p.hokkaido);
  const rule = rules[Math.min(p.shadeRuleIndex, rules.length - 1)];
  const comp = shadeCompliance(sim, rule);
  const ok = comp.ok5to10 && comp.okBeyond10;
  const worstMargin = Math.min(
    margin(sim.maxHours5to10, rule.limit5to10),
    margin(sim.maxHoursBeyond10, rule.limitBeyond10),
  );
  return {
    ...base,
    status: ok ? 'pass' : 'fail',
    actual: `5-10m帯 ${fmt(sim.maxHours5to10, 1)}h / 10m超 ${fmt(sim.maxHoursBeyond10, 1)}h`,
    limit: `${fmt(rule.limit5to10, 1)}h / ${fmt(rule.limitBeyond10, 1)}h`,
    detail:
      `冬至日 真太陽時 ${p.hokkaido ? '9〜15時 (北海道)' : '8〜16時'}、測定面 GL+${p.shadeMeasureHeight}m、緯度 ${fmt(site.latitude, 2)}°。` +
      `道路緩和 (施行令135条の12) 適用済み`,
    margin: worstMargin,
  };
}

/**
 * 全チェックを実行する。日影シミュレーションは重いため、
 * 呼び出し側で計算済みの結果を渡す (null なら「計算中」扱い)。
 */
export function runJpChecks(
  site: Site,
  b: Building,
  p: JpParams,
  shadeSim: ShadeSimResult | null,
): CheckResult[] {
  return [
    checkCoverage(site, b, p),
    checkFar(site, b, p),
    checkAbsoluteHeight(site, b, p),
    checkRoadSlant(site, b, p),
    checkAdjacentSlant(site, b, p),
    checkNorthSlant(site, b, p),
    checkShade(site, b, p, shadeSim),
  ];
}

/** 日影シミュレーションが必要か (対象建物のときだけ実行してコストを抑える) */
export function needsShadeSim(site: Site, b: Building, p: JpParams): boolean {
  return isShadeTargetBuilding(site, b, p);
}

export { simulateShade };
