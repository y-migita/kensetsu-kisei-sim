import { useMemo } from 'react';
import * as THREE from 'three';
import { distanceToDeemedBoundary, type ShadeSimResult } from '../../core/jp';
import type { ShadeRule } from '../../core/jp';
import type { Site } from '../../core/types';

interface Props {
  site: Site;
  sim: ShadeSimResult;
  rule: ShadeRule;
  measureHeight: number;
}

/**
 * 等時間日影図オーバーレイ。
 * 測定面高さの水平面に、累積日影時間の等時間区分と 5m/10m ラインを描画する。
 *  - 黄: 10m超帯の許容時間以上 / 橙: 5-10m帯の許容時間以上 / 赤: 帯内で許容超過
 */
export function ShadeOverlay({ site, sim, rule, measureHeight }: Props) {
  const texture = useMemo(() => {
    const { grid } = sim;
    const canvas = document.createElement('canvas');
    canvas.width = grid.cols;
    canvas.height = grid.rows;
    const ctx = canvas.getContext('2d')!;
    const img = ctx.createImageData(grid.cols, grid.rows);
    const put = (i: number, j: number, r: number, g: number, b: number, a: number) => {
      const k = (j * grid.cols + i) * 4;
      img.data[k] = r;
      img.data[k + 1] = g;
      img.data[k + 2] = b;
      img.data[k + 3] = a;
    };
    for (let j = 0; j < grid.rows; j++) {
      for (let i = 0; i < grid.cols; i++) {
        const h = grid.hours[j * grid.cols + i];
        const band = grid.band[j * grid.cols + i];
        const violated =
          (band === 1 && h > rule.limit5to10 + 1e-6) ||
          (band === 2 && h > rule.limitBeyond10 + 1e-6);
        if (violated) put(i, j, 239, 68, 68, 210);
        else if (h >= rule.limit5to10) put(i, j, 249, 115, 22, 140);
        else if (h >= rule.limitBeyond10) put(i, j, 250, 204, 21, 120);
        else if (h >= 1) put(i, j, 148, 163, 184, 55);
        // 5m / 10m 測定ライン
        const x = grid.originX + (i + 0.5) * grid.resolution;
        const z = grid.originZ + (j + 0.5) * grid.resolution;
        const d = distanceToDeemedBoundary(site, x, z);
        const onLine =
          Math.abs(d - 5) < grid.resolution * 0.6 || Math.abs(d - 10) < grid.resolution * 0.6;
        if (onLine) put(i, j, 226, 232, 240, 200);
      }
    }
    ctx.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [sim, rule, site]);

  const { grid } = sim;
  const w = grid.cols * grid.resolution;
  const d = grid.rows * grid.resolution;
  const cx = grid.originX + w / 2;
  const cz = grid.originZ + d / 2;

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, measureHeight + 0.03, cz]}>
      <planeGeometry args={[w, d]} />
      <meshBasicMaterial map={texture} transparent side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  );
}
