/**
 * 建設規制シミュレーター 共通型定義
 *
 * 座標系 (three.js の右手系に一致):
 *   +X = 東, -X = 西
 *   -Z = 真北, +Z = 南
 *   +Y = 鉛直上方
 * 敷地は原点中心の矩形。前面道路は敷地の南側 (z = depth/2 〜 depth/2 + roadWidth)。
 */

/** 敷地条件 */
export interface Site {
  /** 間口 — 東西方向の敷地幅 [m] */
  width: number;
  /** 奥行 — 南北方向の敷地奥行 [m] */
  depth: number;
  /** 前面道路の幅員 [m] (敷地南側に接道) */
  roadWidth: number;
  /** 角地か (建蔽率 +10% 特例 / 建築基準法53条3項2号) */
  isCornerLot: boolean;
  /** 緯度 [度] — 日影計算に使用 (東京 ≈ 35.68) */
  latitude: number;
}

/** 建物 (単純直方体ボリューム) */
export interface Building {
  /** 建物幅 — 東西方向 [m] */
  width: number;
  /** 建物奥行 — 南北方向 [m] */
  depth: number;
  /** 南側 (道路境界線) からの後退距離 [m] */
  setbackSouth: number;
  /** 西側隣地境界線からの後退距離 [m] */
  setbackWest: number;
  /** 地上階数 */
  floors: number;
  /** 階高 [m] */
  floorHeight: number;
  /** 軒高と最高高さの差 (パラペット等) [m] — 0 なら軒高 = 最高高さ */
  parapet: number;
}

/** 建物の導出済み幾何量 */
export interface BuildingGeometry {
  /** 最高高さ [m] */
  height: number;
  /** 軒高 [m] */
  eavesHeight: number;
  /** 建築面積 [m²] */
  footprintArea: number;
  /** 延べ面積 [m²] (全階同一平面と仮定) */
  totalFloorArea: number;
  /** 建物南面の z 座標 */
  south: number;
  /** 建物北面の z 座標 */
  north: number;
  /** 建物西面の x 座標 */
  west: number;
  /** 建物東面の x 座標 */
  east: number;
  /** 北側隣地境界線からの後退距離 [m] */
  setbackNorth: number;
  /** 東側隣地境界線からの後退距離 [m] */
  setbackEast: number;
}

/** 検定結果のステータス */
export type CheckStatus = 'pass' | 'fail' | 'na' | 'info';

/** 個別規制の検定結果 */
export interface CheckResult {
  /** 一意 ID (例: 'jp-coverage') */
  id: string;
  /** 規制名 (日本語) */
  name: string;
  /** 規制名 (英語) */
  nameEn: string;
  /** 根拠法令・基準 */
  legalBasis: string;
  status: CheckStatus;
  /** 計画値 (表示用文字列) */
  actual: string;
  /** 許容値 (表示用文字列) */
  limit: string;
  /** 判定の補足説明 */
  detail: string;
  /** 余裕率 [-1..1] 正=適合余裕, 負=超過率。na/info では undefined */
  margin?: number;
}
