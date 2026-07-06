import { create } from 'zustand';
import type { JpParams } from './core/jp';
import type { UkParams } from './core/uk';
import type { Building, Site } from './core/types';

/** 表示中の規制体系 */
export type CountryMode = 'jp' | 'uk';

export interface DisplayState {
  country: CountryMode;
  /** 斜線制限面の表示 (日本) */
  showRoadSlant: boolean;
  showAdjacentSlant: boolean;
  showNorthSlant: boolean;
  showAbsHeight: boolean;
  /** 日影等時間図の表示 (日本) */
  showShade: boolean;
  /** 英国: 25°/45° 面の表示 */
  showUk25: boolean;
  showUk45: boolean;
  /** 太陽・影のプレビュー (冬至の真太陽時) */
  sunTime: number;
  showSunShadow: boolean;
  /** 階の分割線表示 */
  showFloorLines: boolean;
}

interface AppState {
  site: Site;
  building: Building;
  jp: JpParams;
  uk: UkParams;
  display: DisplayState;
  setSite: (patch: Partial<Site>) => void;
  setBuilding: (patch: Partial<Building>) => void;
  setJp: (patch: Partial<JpParams>) => void;
  setUk: (patch: Partial<UkParams>) => void;
  setDisplay: (patch: Partial<DisplayState>) => void;
}

export const useAppStore = create<AppState>((set) => ({
  site: {
    width: 12,
    depth: 18,
    roadWidth: 6,
    isCornerLot: false,
    latitude: 35.68,
  },
  building: {
    width: 8,
    depth: 10,
    setbackSouth: 2,
    setbackWest: 2,
    floors: 3,
    floorHeight: 3,
    parapet: 0,
  },
  jp: {
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
  },
  uk: {
    houseType: 'semi-detached',
    isDesignatedLand: false,
    originalDepth: 8,
    neighbourWindowDist: 1,
    neighbourWindowHeight: 1.6,
    oppositeWindowSetback: 3,
    oppositeWindowHeight: 1.6,
    dwellingCount: 2,
  },
  display: {
    country: 'jp',
    showRoadSlant: true,
    showAdjacentSlant: false,
    showNorthSlant: true,
    showAbsHeight: false,
    showShade: false,
    showUk25: true,
    showUk45: true,
    sunTime: 12,
    showSunShadow: false,
    showFloorLines: true,
  },
  setSite: (patch) => set((s) => ({ site: { ...s.site, ...patch } })),
  setBuilding: (patch) => set((s) => ({ building: { ...s.building, ...patch } })),
  setJp: (patch) => set((s) => ({ jp: { ...s.jp, ...patch } })),
  setUk: (patch) => set((s) => ({ uk: { ...s.uk, ...patch } })),
  setDisplay: (patch) => set((s) => ({ display: { ...s.display, ...patch } })),
}));
