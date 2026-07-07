import { fmt } from '../geometry';
import type { Building, Site } from '../types';
import {
  checkAbsoluteHeight,
  checkAdjacentSlant,
  checkCoverage,
  checkFar,
  checkNorthSlant,
  checkRoadSlant,
  effectiveCoverageLimit,
  effectiveFarLimit,
  isShadeTargetBuilding,
  roadSlantApplicableDistance,
  type JpParams,
} from './checks';
import {
  SHADE_SIM_RESOLUTION,
  SHADE_SIM_TIME_STEP_MINUTES,
  shadeCompliance,
  shadeTimeRange,
  simulateShade,
  type ShadeSimResult,
} from './shade';
import { JP_ZONES, shadeRuleOptions } from './zoning';

const EPS = 1e-6;
const HARD_FLOOR_CAP = 200;
const SHADE_DEPTH_PRECISION = 0.01;
const SHADE_MIN_DEPTH = 0.5;

export interface FarOptimization {
  feasible: boolean;
  /** 最適化後の建物 (floorHeight/parapet は base の値を維持)。infeasible 時 null */
  building: Building | null;
  /** 達成容積率 [%] */
  farPct: number;
  /** 容積率の限度 (前面道路低減後) [%] */
  farCapPct: number;
  /** UI 表示用の説明 (日本語、binding 制約など) */
  notes: string[];
}

interface Candidate {
  floors: number;
  building: Building;
  upperFar: number;
  maxDepth: number;
}

interface AcceptedCandidate {
  building: Building;
  farPct: number;
  maxDepth: number;
  shadeReduced: boolean;
}

function minRoadSetback(site: Site, p: JpParams, h: number, farCapPct: number): number {
  const zone = JP_ZONES[p.zone];
  const applicableDistance = roadSlantApplicableDistance(zone, farCapPct);
  const slope = zone.roadSlantSlope;
  // 56条3項: checks.ts の roadSlantSpec と同じ条件。
  const steepFrom =
    site.roadWidth >= 12 && (zone.category === 'mid-rise' || zone.category === 'residential')
      ? site.roadWidth * 1.25
      : null;
  const distNeeded =
    steepFrom === null
      ? h / slope
      : h <= slope * steepFrom
        ? h / slope
        : Math.max(steepFrom, h / 1.5);
  const sSlope = Math.max(0, (distNeeded - site.roadWidth) / 2) + EPS;
  const sEscape = Math.max(0, (applicableDistance - site.roadWidth) / 2 + EPS);
  return Math.min(sSlope, sEscape);
}

function minNorthSetback(p: JpParams, h: number, dAdj: number): number {
  const zone = JP_ZONES[p.zone];
  const northSlant =
    zone.northSlantBase !== null && !(zone.category === 'mid-rise' && p.shadeDesignated)
      ? h <= zone.northSlantBase
        ? 0
        : (h - zone.northSlantBase) / 1.25 + EPS
      : 0;
  return Math.max(northSlant, dAdj);
}

function minAdjacentSetback(p: JpParams, h: number): number {
  const adjacent = JP_ZONES[p.zone].adjacentSlant;
  if (adjacent === null) return 0;
  if (h <= adjacent.base + 1e-9) return 0;
  return (h - adjacent.base) / (2 * adjacent.slope) + EPS;
}

function runShade(site: Site, b: Building, p: JpParams): ShadeSimResult {
  return simulateShade(site, b, p.shadeMeasureHeight, site.latitude, {
    resolution: SHADE_SIM_RESOLUTION,
    timeStepMinutes: SHADE_SIM_TIME_STEP_MINUTES,
    timeRange: shadeTimeRange(p.hokkaido),
  });
}

function shadePasses(site: Site, b: Building, p: JpParams, sim: ShadeSimResult | null): boolean {
  if (!isShadeTargetBuilding(site, b, p)) return true;
  if (!sim) return false;
  const rules = shadeRuleOptions(JP_ZONES[p.zone], p.hokkaido);
  const rule = rules[Math.min(p.shadeRuleIndex, rules.length - 1)];
  if (!rule) return false;
  const comp = shadeCompliance(sim, rule);
  return comp.ok5to10 && comp.okBeyond10;
}

function statutoryChecksPass(site: Site, b: Building, p: JpParams, sim: ShadeSimResult | null): boolean {
  return (
    [
      checkCoverage(site, b, p),
      checkFar(site, b, p),
      checkAbsoluteHeight(site, b, p),
      checkRoadSlant(site, b, p),
      checkAdjacentSlant(site, b, p),
      checkNorthSlant(site, b, p),
    ].every((r) => r.status !== 'fail') && shadePasses(site, b, p, sim)
  );
}

function finalizeCandidate(site: Site, p: JpParams, candidate: Candidate): AcceptedCandidate | null {
  let building = candidate.building;
  let sim: ShadeSimResult | null = null;
  let shadeReduced = false;

  if (isShadeTargetBuilding(site, building, p)) {
    sim = runShade(site, building, p);
    if (!shadePasses(site, building, p, sim)) {
      if (building.depth < SHADE_MIN_DEPTH) return null;

      const minDepthBuilding = { ...building, depth: SHADE_MIN_DEPTH };
      const minDepthSim = runShade(site, minDepthBuilding, p);
      if (!shadePasses(site, minDepthBuilding, p, minDepthSim)) return null;

      let lo = SHADE_MIN_DEPTH;
      let hi = building.depth;
      let loSim = minDepthSim;
      while (hi - lo > SHADE_DEPTH_PRECISION) {
        const mid = (lo + hi) / 2;
        const midBuilding = { ...building, depth: mid };
        const midSim = runShade(site, midBuilding, p);
        if (shadePasses(site, midBuilding, p, midSim)) {
          lo = mid;
          loSim = midSim;
        } else {
          hi = mid;
        }
      }

      building = { ...building, depth: lo };
      sim = loSim;
      shadeReduced = true;
    }
  }

  if (!statutoryChecksPass(site, building, p, sim)) return null;
  const farPct = ((building.width * building.depth * building.floors) / (site.width * site.depth)) * 100;
  return { building, farPct, maxDepth: candidate.maxDepth, shadeReduced };
}

function near(a: number, b: number): boolean {
  return Math.abs(a - b) <= 1e-6;
}

function buildNotes(
  accepted: AcceptedCandidate,
  siteArea: number,
  covCap: number,
  farCap: number,
  farCapPct: number,
): string[] {
  const { building, maxDepth, shadeReduced } = accepted;
  const footprint = building.width * building.depth;
  const capNotes: string[] = [];
  if (near(footprint, farCap / building.floors)) {
    capNotes.push(`指定容積率の限度 ${fmt(farCapPct, 0)}% に到達`);
  }
  if (near(footprint, covCap)) {
    capNotes.push('建蔽率の限度が支配的');
  }
  if (near(footprint, building.width * maxDepth)) {
    capNotes.push('斜線制限により建物規模が制限');
  }

  if (shadeReduced) {
    return [...capNotes.slice(0, 2), `日影規制により奥行を ${fmt(building.depth, 1)}m に制限`];
  }
  return capNotes.length > 0
    ? capNotes.slice(0, 3)
    : [`容積率 ${fmt((footprint * building.floors * 100) / siteArea, 1)}% まで拡大`];
}

export function maximizeFar(site: Site, p: JpParams, base: Building): FarOptimization {
  const farCapPct = effectiveFarLimit(site, p);
  const siteArea = site.width * site.depth;
  if (siteArea <= 0 || base.floorHeight <= 0) {
    return { feasible: false, building: null, farPct: 0, farCapPct, notes: ['適合解が見つかりません'] };
  }

  const zone = JP_ZONES[p.zone];
  const covCap = (siteArea * effectiveCoverageLimit(site, p)) / 100;
  const farCap = (siteArea * farCapPct) / 100;
  const candidates: Candidate[] = [];

  for (let floors = 1; floors <= HARD_FLOOR_CAP; floors++) {
    const h = floors * base.floorHeight + base.parapet;
    if (zone.category === 'low-rise' && h > p.lowRiseHeightLimit + 1e-9) break;

    const minSetbackSouth = minRoadSetback(site, p, h, farCapPct);
    const dAdj = minAdjacentSetback(p, h);
    const minSetbackNorth = minNorthSetback(p, h, dAdj);
    const widthMax = site.width - 2 * dAdj;
    const depthMax = site.depth - minSetbackSouth - minSetbackNorth;
    if (widthMax <= 0 || depthMax <= 0) break;

    const footprint = Math.min(widthMax * depthMax, covCap, farCap / floors);
    if (footprint <= 0) continue;

    const building: Building = {
      ...base,
      width: widthMax,
      depth: footprint / widthMax,
      setbackSouth: minSetbackSouth,
      setbackWest: (site.width - widthMax) / 2,
      floors,
    };
    candidates.push({
      floors,
      building,
      upperFar: (footprint * floors * 100) / siteArea,
      maxDepth: depthMax,
    });
  }

  // 容積率上限で頭打ちの階数群は upperFar が理論上同値だが float 丸めでずれるため ε 比較で階数最少を優先
  candidates.sort((a, b) =>
    Math.abs(b.upperFar - a.upperFar) > 1e-9 ? b.upperFar - a.upperFar : a.floors - b.floors,
  );

  let best: AcceptedCandidate | null = null;
  for (const candidate of candidates) {
    if (best && candidate.upperFar <= best.farPct + 1e-9) break;
    const accepted = finalizeCandidate(site, p, candidate);
    if (!accepted) continue;
    if (!best || accepted.farPct > best.farPct + 1e-9) best = accepted;
  }

  if (!best) {
    return { feasible: false, building: null, farPct: 0, farCapPct, notes: ['適合解が見つかりません'] };
  }

  return {
    feasible: true,
    building: best.building,
    farPct: best.farPct,
    farCapPct,
    notes: buildNotes(best, siteArea, covCap, farCap, farCapPct),
  };
}
