/**
 * 太陽位置計算 (日影規制用)
 *
 * 日影規制 (建築基準法56条の2) は「冬至日の真太陽時 8時〜16時」を対象とする。
 * 真太陽時では時角 H = 15° × (t - 12) がそのまま使えるため、均時差の補正は不要。
 */

/** 冬至の太陽赤緯 [度] */
export const WINTER_SOLSTICE_DECLINATION = -23.44;

export interface SunPosition {
  /** 太陽高度 [rad] (地平線上 > 0) */
  altitude: number;
  /** 太陽方位 [rad] — 真南 = 0, 西回りが正 (午後は正) */
  azimuth: number;
}

/**
 * 緯度・赤緯・真太陽時から太陽位置を求める。
 * @param latitudeDeg 緯度 [度]
 * @param solarTime 真太陽時 [時] (12 = 南中)
 * @param declinationDeg 赤緯 [度] (既定: 冬至)
 */
export function sunPosition(
  latitudeDeg: number,
  solarTime: number,
  declinationDeg: number = WINTER_SOLSTICE_DECLINATION,
): SunPosition {
  const lat = (latitudeDeg * Math.PI) / 180;
  const dec = (declinationDeg * Math.PI) / 180;
  const hourAngle = ((solarTime - 12) * 15 * Math.PI) / 180;

  const sinAlt =
    Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(hourAngle);
  const altitude = Math.asin(sinAlt);

  // 方位角 (真南基準・西回り正): tan(A) = sin(H) / (cos(H)·sin(φ) − tan(δ)·cos(φ))
  const azimuth = Math.atan2(
    Math.sin(hourAngle),
    Math.cos(hourAngle) * Math.sin(lat) - Math.tan(dec) * Math.cos(lat),
  );
  return { altitude, azimuth };
}

/**
 * 太陽へ向かう単位ベクトル (シーン座標系: +X=東, -Z=北, +Y=上)。
 * 方位 0 (真南) → (0, sinAlt, cosAlt)。午後 (西回り正) → -X 側へ。
 */
export function sunDirection(pos: SunPosition): [number, number, number] {
  const { altitude, azimuth } = pos;
  return [
    -Math.sin(azimuth) * Math.cos(altitude),
    Math.sin(altitude),
    Math.cos(azimuth) * Math.cos(altitude),
  ];
}

/**
 * 高さ h の点が測定面 (高さ planeH) に落とす影の水平オフセット [m]。
 * 影は太陽と反対方向へ伸びる。太陽が地平線下なら null。
 */
export function shadowOffset(
  pos: SunPosition,
  pointHeight: number,
  planeHeight: number,
): [number, number] | null {
  if (pos.altitude <= 0.001) return null;
  const dh = pointHeight - planeHeight;
  if (dh <= 0) return [0, 0];
  const len = dh / Math.tan(pos.altitude);
  const dir = sunDirection(pos);
  const horiz = Math.hypot(dir[0], dir[2]);
  if (horiz < 1e-9) return [0, 0];
  // 太陽方向の水平成分の逆向き
  return [(-dir[0] / horiz) * len, (-dir[2] / horiz) * len];
}
