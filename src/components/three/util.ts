import * as THREE from 'three';

/**
 * 2 列の点列 (左端・右端) からリボン状の BufferGeometry を作る。
 * pairs[i] = [左端点, 右端点]。隣接ペア間を 2 枚の三角形で張る。
 */
export function stripGeometry(pairs: Array<[THREE.Vector3, THREE.Vector3]>): THREE.BufferGeometry {
  const positions: number[] = [];
  for (let i = 0; i < pairs.length - 1; i++) {
    const [a0, b0] = pairs[i];
    const [a1, b1] = pairs[i + 1];
    positions.push(a0.x, a0.y, a0.z, b0.x, b0.y, b0.z, a1.x, a1.y, a1.z);
    positions.push(b0.x, b0.y, b0.z, b1.x, b1.y, b1.z, a1.x, a1.y, a1.z);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.computeVertexNormals();
  return geo;
}

/** 規制面の配色 */
export const OVERLAY_COLORS = {
  roadSlant: '#f59e0b',
  adjacentSlant: '#38bdf8',
  northSlant: '#f472b6',
  absHeight: '#a78bfa',
  uk25: '#34d399',
  uk45: '#fbbf24',
} as const;
