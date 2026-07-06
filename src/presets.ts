import type { Building, Site } from './core/types';
import type { JpParams } from './core/jp';
import type { UkParams } from './core/uk';

export interface Preset {
  id: string;
  name: string;
  site: Partial<Site>;
  building: Partial<Building>;
  jp: Partial<JpParams>;
  uk: Partial<UkParams>;
}

/** 代表的な検討シナリオ */
export const PRESETS: Preset[] = [
  {
    id: 'low-rise-house',
    name: '低層住宅地の戸建 (2階)',
    site: { width: 12, depth: 18, roadWidth: 4, isCornerLot: false },
    building: { width: 8, depth: 9, setbackSouth: 3, setbackWest: 2, floors: 2, floorHeight: 2.9, parapet: 0 },
    jp: { zone: 'r1-low', coverageLimit: 50, farLimit: 100, fireZone: 'none', fireResistance: 'none', lowRiseHeightLimit: 10, shadeDesignated: true, shadeRuleIndex: 0, shadeMeasureHeight: 1.5 },
    uk: { houseType: 'detached', originalDepth: 7, dwellingCount: 1 },
  },
  {
    id: 'mid-rise-mansion',
    name: '中高層のマンション (7階)',
    site: { width: 20, depth: 30, roadWidth: 8, isCornerLot: false },
    building: { width: 14, depth: 16, setbackSouth: 4, setbackWest: 3, floors: 7, floorHeight: 3, parapet: 0.6 },
    jp: { zone: 'r1-mid', coverageLimit: 60, farLimit: 300, fireZone: 'quasi-fire', fireResistance: 'fireproof', shadeDesignated: true, shadeRuleIndex: 1, shadeMeasureHeight: 4 },
    uk: { houseType: 'detached', originalDepth: 16, dwellingCount: 14 },
  },
  {
    id: 'commercial-office',
    name: '商業地のオフィス (10階)',
    site: { width: 15, depth: 20, roadWidth: 12, isCornerLot: true },
    building: { width: 12, depth: 15, setbackSouth: 1.5, setbackWest: 1.5, floors: 10, floorHeight: 3.5, parapet: 1 },
    jp: { zone: 'commercial', coverageLimit: 80, farLimit: 600, fireZone: 'fire', fireResistance: 'fireproof', shadeDesignated: false },
    uk: { houseType: 'detached', originalDepth: 15, dwellingCount: 0 },
  },
  {
    id: 'narrow-3story',
    name: '狭小地の3階建 (準防火)',
    site: { width: 5, depth: 13, roadWidth: 4, isCornerLot: false },
    building: { width: 4, depth: 8, setbackSouth: 1, setbackWest: 0.5, floors: 3, floorHeight: 2.8, parapet: 0 },
    jp: { zone: 'r1', coverageLimit: 60, farLimit: 200, fireZone: 'quasi-fire', fireResistance: 'quasi-fireproof', shadeDesignated: true, shadeRuleIndex: 0, shadeMeasureHeight: 4 },
    uk: { houseType: 'terraced', originalDepth: 6, dwellingCount: 1 },
  },
];
