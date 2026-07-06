/**
 * 用途地域 (都市計画法8条・9条) と、それに紐づく形態規制パラメータ。
 * 数値は建築基準法 52条 (容積率)・53条 (建蔽率)・55条 (絶対高さ)・
 * 56条 (斜線制限, 別表第3)・56条の2 (日影規制, 別表第4) に基づく。
 */

export type JpZoneId =
  | 'r1-low' // 第一種低層住居専用地域
  | 'r2-low' // 第二種低層住居専用地域
  | 'rural' // 田園住居地域
  | 'r1-mid' // 第一種中高層住居専用地域
  | 'r2-mid' // 第二種中高層住居専用地域
  | 'r1' // 第一種住居地域
  | 'r2' // 第二種住居地域
  | 'quasi-res' // 準住居地域
  | 'neigh-com' // 近隣商業地域
  | 'commercial' // 商業地域
  | 'quasi-ind' // 準工業地域
  | 'industrial' // 工業地域
  | 'ind-only'; // 工業専用地域

export type ZoneCategory = 'low-rise' | 'mid-rise' | 'residential' | 'commercial' | 'industrial';

export interface JpZone {
  id: JpZoneId;
  name: string;
  nameEn: string;
  category: ZoneCategory;
  /** 指定可能な建蔽率 [%] (53条1項) */
  coverageOptions: number[];
  /** 指定可能な容積率 [%] (52条1項) */
  farOptions: number[];
  /** 前面道路幅員による容積率低減係数 (52条2項) */
  roadFarFactor: 0.4 | 0.6;
  /** 道路斜線の勾配 (別表第3) */
  roadSlantSlope: 1.25 | 1.5;
  /** 隣地斜線: 立上り [m] + 勾配 (56条1項2号)。低層系は絶対高さ制限のため null */
  adjacentSlant: { base: 20 | 31; slope: 1.25 | 2.5 } | null;
  /** 北側斜線: 立上り [m] (56条1項3号)。対象外の地域は null */
  northSlantBase: 5 | 10 | null;
  /** 日影規制の対象になり得るか (別表第4) */
  shadeApplicable: boolean;
  /** 日影規制の測定面高さの選択肢 [m] (別表第4) */
  shadeMeasureHeights: number[];
}

export const JP_ZONES: Record<JpZoneId, JpZone> = {
  'r1-low': {
    id: 'r1-low',
    name: '第一種低層住居専用地域',
    nameEn: 'Category I low-rise residential',
    category: 'low-rise',
    coverageOptions: [30, 40, 50, 60],
    farOptions: [50, 60, 80, 100, 150, 200],
    roadFarFactor: 0.4,
    roadSlantSlope: 1.25,
    adjacentSlant: null,
    northSlantBase: 5,
    shadeApplicable: true,
    shadeMeasureHeights: [1.5],
  },
  'r2-low': {
    id: 'r2-low',
    name: '第二種低層住居専用地域',
    nameEn: 'Category II low-rise residential',
    category: 'low-rise',
    coverageOptions: [30, 40, 50, 60],
    farOptions: [50, 60, 80, 100, 150, 200],
    roadFarFactor: 0.4,
    roadSlantSlope: 1.25,
    adjacentSlant: null,
    northSlantBase: 5,
    shadeApplicable: true,
    shadeMeasureHeights: [1.5],
  },
  rural: {
    id: 'rural',
    name: '田園住居地域',
    nameEn: 'Rural residential',
    category: 'low-rise',
    coverageOptions: [30, 40, 50, 60],
    farOptions: [50, 60, 80, 100, 150, 200],
    roadFarFactor: 0.4,
    roadSlantSlope: 1.25,
    adjacentSlant: null,
    northSlantBase: 5,
    shadeApplicable: true,
    shadeMeasureHeights: [1.5],
  },
  'r1-mid': {
    id: 'r1-mid',
    name: '第一種中高層住居専用地域',
    nameEn: 'Category I mid/high-rise residential',
    category: 'mid-rise',
    coverageOptions: [30, 40, 50, 60],
    farOptions: [100, 150, 200, 300, 400, 500],
    roadFarFactor: 0.4,
    roadSlantSlope: 1.25,
    adjacentSlant: { base: 20, slope: 1.25 },
    northSlantBase: 10,
    shadeApplicable: true,
    shadeMeasureHeights: [4, 6.5],
  },
  'r2-mid': {
    id: 'r2-mid',
    name: '第二種中高層住居専用地域',
    nameEn: 'Category II mid/high-rise residential',
    category: 'mid-rise',
    coverageOptions: [30, 40, 50, 60],
    farOptions: [100, 150, 200, 300, 400, 500],
    roadFarFactor: 0.4,
    roadSlantSlope: 1.25,
    adjacentSlant: { base: 20, slope: 1.25 },
    northSlantBase: 10,
    shadeApplicable: true,
    shadeMeasureHeights: [4, 6.5],
  },
  r1: {
    id: 'r1',
    name: '第一種住居地域',
    nameEn: 'Category I residential',
    category: 'residential',
    coverageOptions: [50, 60, 80],
    farOptions: [100, 150, 200, 300, 400, 500],
    roadFarFactor: 0.4,
    roadSlantSlope: 1.25,
    adjacentSlant: { base: 20, slope: 1.25 },
    northSlantBase: null,
    shadeApplicable: true,
    shadeMeasureHeights: [4, 6.5],
  },
  r2: {
    id: 'r2',
    name: '第二種住居地域',
    nameEn: 'Category II residential',
    category: 'residential',
    coverageOptions: [50, 60, 80],
    farOptions: [100, 150, 200, 300, 400, 500],
    roadFarFactor: 0.4,
    roadSlantSlope: 1.25,
    adjacentSlant: { base: 20, slope: 1.25 },
    northSlantBase: null,
    shadeApplicable: true,
    shadeMeasureHeights: [4, 6.5],
  },
  'quasi-res': {
    id: 'quasi-res',
    name: '準住居地域',
    nameEn: 'Quasi-residential',
    category: 'residential',
    coverageOptions: [50, 60, 80],
    farOptions: [100, 150, 200, 300, 400, 500],
    roadFarFactor: 0.4,
    roadSlantSlope: 1.25,
    adjacentSlant: { base: 20, slope: 1.25 },
    northSlantBase: null,
    shadeApplicable: true,
    shadeMeasureHeights: [4, 6.5],
  },
  'neigh-com': {
    id: 'neigh-com',
    name: '近隣商業地域',
    nameEn: 'Neighbourhood commercial',
    category: 'commercial',
    coverageOptions: [60, 80],
    farOptions: [100, 150, 200, 300, 400, 500],
    roadFarFactor: 0.6,
    roadSlantSlope: 1.5,
    adjacentSlant: { base: 31, slope: 2.5 },
    northSlantBase: null,
    shadeApplicable: true,
    shadeMeasureHeights: [4, 6.5],
  },
  commercial: {
    id: 'commercial',
    name: '商業地域',
    nameEn: 'Commercial',
    category: 'commercial',
    coverageOptions: [80],
    farOptions: [200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200, 1300],
    roadFarFactor: 0.6,
    roadSlantSlope: 1.5,
    adjacentSlant: { base: 31, slope: 2.5 },
    northSlantBase: null,
    shadeApplicable: false,
    shadeMeasureHeights: [],
  },
  'quasi-ind': {
    id: 'quasi-ind',
    name: '準工業地域',
    nameEn: 'Quasi-industrial',
    category: 'industrial',
    coverageOptions: [50, 60, 80],
    farOptions: [100, 150, 200, 300, 400, 500],
    roadFarFactor: 0.6,
    roadSlantSlope: 1.5,
    adjacentSlant: { base: 31, slope: 2.5 },
    northSlantBase: null,
    shadeApplicable: true,
    shadeMeasureHeights: [4, 6.5],
  },
  industrial: {
    id: 'industrial',
    name: '工業地域',
    nameEn: 'Industrial',
    category: 'industrial',
    coverageOptions: [50, 60],
    farOptions: [100, 150, 200, 300, 400],
    roadFarFactor: 0.6,
    roadSlantSlope: 1.5,
    adjacentSlant: { base: 31, slope: 2.5 },
    northSlantBase: null,
    shadeApplicable: false,
    shadeMeasureHeights: [],
  },
  'ind-only': {
    id: 'ind-only',
    name: '工業専用地域',
    nameEn: 'Exclusive industrial',
    category: 'industrial',
    coverageOptions: [30, 40, 50, 60],
    farOptions: [100, 150, 200, 300, 400],
    roadFarFactor: 0.6,
    roadSlantSlope: 1.5,
    adjacentSlant: { base: 31, slope: 2.5 },
    northSlantBase: null,
    shadeApplicable: false,
    shadeMeasureHeights: [],
  },
};

export const JP_ZONE_LIST: JpZone[] = Object.values(JP_ZONES);

/** 防火地域の指定 */
export type FireZone = 'none' | 'quasi-fire' | 'fire';
/** 建物の耐火性能 */
export type FireResistance = 'none' | 'quasi-fireproof' | 'fireproof';

/** 日影規制の号区分 (別表第4) — (一)〜(三) に対応する許容時間 [h] */
export interface ShadeRule {
  /** 5m〜10m ラインの許容日影時間 [h] */
  limit5to10: number;
  /** 10m 超ラインの許容日影時間 [h] */
  limitBeyond10: number;
}

/**
 * 別表第4の号区分ごとの許容時間。
 * 低層系・中高層系: (一) 3h/2h, (二) 4h/2.5h, (三) 5h/3h
 * 住居・準住居・近商・準工: (一) 4h/2.5h, (二) 5h/3h
 */
export function shadeRuleOptions(zone: JpZone): ShadeRule[] {
  if (!zone.shadeApplicable) return [];
  if (zone.category === 'low-rise' || zone.category === 'mid-rise') {
    return [
      { limit5to10: 3, limitBeyond10: 2 },
      { limit5to10: 4, limitBeyond10: 2.5 },
      { limit5to10: 5, limitBeyond10: 3 },
    ];
  }
  return [
    { limit5to10: 4, limitBeyond10: 2.5 },
    { limit5to10: 5, limitBeyond10: 3 },
  ];
}
