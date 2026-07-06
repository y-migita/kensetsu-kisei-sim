import { useDeferredValue, useMemo } from 'react';
import { deriveGeometry, validatePlacement } from '../core/geometry';
import { needsShadeSim, runJpChecks, simulateShade, type ShadeSimResult } from '../core/jp';
import { runUkChecks } from '../core/uk';
import { useAppStore } from '../store';

/**
 * 入力状態から全検定結果を導出する。
 * 日影シミュレーションは相対的に重いため useDeferredValue でスライダー操作を妨げない。
 * App で一度だけ呼び、props で配布する。
 */
export function useResults() {
  const site = useAppStore((s) => s.site);
  const building = useAppStore((s) => s.building);
  const jp = useAppStore((s) => s.jp);
  const uk = useAppStore((s) => s.uk);

  const dSite = useDeferredValue(site);
  const dBuilding = useDeferredValue(building);
  const dMeasureHeight = useDeferredValue(jp.shadeMeasureHeight);
  const shadeNeeded = needsShadeSim(dSite, dBuilding, jp);
  const hokkaido = jp.hokkaido;

  const shadeSim = useMemo<ShadeSimResult | null>(() => {
    if (!shadeNeeded) return null;
    return simulateShade(dSite, dBuilding, dMeasureHeight, dSite.latitude, {
      resolution: 0.5,
      timeStepMinutes: 6,
      timeRange: hokkaido ? [9, 15] : [8, 16],
    });
  }, [dSite, dBuilding, dMeasureHeight, shadeNeeded, hokkaido]);

  const jpResults = useMemo(
    () => runJpChecks(site, building, jp, shadeSim),
    [site, building, jp, shadeSim],
  );
  const ukResults = useMemo(() => runUkChecks(site, building, uk), [site, building, uk]);
  const geometry = useMemo(() => deriveGeometry(site, building), [site, building]);
  const placementErrors = useMemo(() => validatePlacement(site, building), [site, building]);

  return { geometry, jpResults, ukResults, shadeSim, placementErrors };
}

export type Results = ReturnType<typeof useResults>;
