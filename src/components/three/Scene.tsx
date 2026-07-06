import { GizmoHelper, GizmoViewport, Grid, OrbitControls } from '@react-three/drei';
import { shadeRuleOptions, zoneOf } from '../../core/jp';
import { sunDirection, sunPosition } from '../../core/sun';
import type { Results } from '../../hooks/useResults';
import { useAppStore } from '../../store';
import { BuildingMass } from './BuildingMass';
import { JpOverlays } from './JpOverlays';
import { ShadeOverlay } from './ShadeOverlay';
import { SiteAndRoad } from './SiteAndRoad';
import { UkOverlays } from './UkOverlays';

/** 冬至の太陽光 (真太陽時プレビュー) */
function SunLight({ latitude, time }: { latitude: number; time: number }) {
  const pos = sunPosition(latitude, time);
  if (pos.altitude <= 0) return null;
  const dir = sunDirection(pos);
  return (
    <directionalLight
      position={[dir[0] * 70, dir[1] * 70, dir[2] * 70]}
      intensity={2.2}
      color="#fff3d6"
      castShadow
      shadow-mapSize={[2048, 2048]}
      shadow-camera-left={-60}
      shadow-camera-right={60}
      shadow-camera-top={60}
      shadow-camera-bottom={-60}
      shadow-camera-far={200}
      shadow-bias={-0.0004}
    />
  );
}

/** 3D シーン本体 (Canvas 内) */
export function Scene({ results }: { results: Results }) {
  const site = useAppStore((s) => s.site);
  const building = useAppStore((s) => s.building);
  const jp = useAppStore((s) => s.jp);
  const uk = useAppStore((s) => s.uk);
  const display = useAppStore((s) => s.display);
  const { geometry, jpResults, ukResults, shadeSim } = results;

  const activeResults = display.country === 'jp' ? jpResults : ukResults;
  const violating = activeResults.some((r) => r.status === 'fail');

  const zone = zoneOf(jp);
  const rules = shadeRuleOptions(zone);
  const shadeRule = rules[Math.min(jp.shadeRuleIndex, Math.max(rules.length - 1, 0))];

  return (
    <>
      <color attach="background" args={['#0b1220']} />
      <fog attach="fog" args={['#0b1220', 90, 260]} />
      <ambientLight intensity={display.showSunShadow ? 0.28 : 0.55} />
      <hemisphereLight args={['#b8c8e0', '#0f1722', display.showSunShadow ? 0.2 : 0.5]} />
      {display.showSunShadow ? (
        <SunLight latitude={site.latitude} time={display.sunTime} />
      ) : (
        <directionalLight position={[30, 45, 20]} intensity={1.1} castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-40} shadow-camera-right={40} shadow-camera-top={40} shadow-camera-bottom={-40} />
      )}

      <SiteAndRoad site={site} sunMode={display.showSunShadow} />
      <BuildingMass
        building={building}
        geometry={geometry}
        violating={violating}
        showFloorLines={display.showFloorLines}
      />

      {display.country === 'jp' && (
        <JpOverlays site={site} building={building} geometry={geometry} jp={jp} display={display} />
      )}
      {display.country === 'jp' && display.showShade && shadeSim && shadeRule && (
        <ShadeOverlay
          site={site}
          sim={shadeSim}
          rule={shadeRule}
          measureHeight={jp.shadeMeasureHeight}
        />
      )}
      {display.country === 'uk' && (
        <UkOverlays site={site} geometry={geometry} uk={uk} display={display} />
      )}

      <Grid
        position={[0, -0.03, 0]}
        args={[300, 300]}
        cellSize={1}
        cellThickness={0.4}
        cellColor="#1c2a3d"
        sectionSize={10}
        sectionThickness={0.8}
        sectionColor="#27405c"
        fadeDistance={140}
        fadeStrength={1.5}
        infiniteGrid
      />
      <OrbitControls
        makeDefault
        target={[0, Math.min(geometry.height / 2, 12), 0]}
        maxPolarAngle={Math.PI / 2 - 0.02}
        minDistance={5}
        maxDistance={180}
      />
      <GizmoHelper alignment="bottom-right" margin={[70, 70]}>
        <GizmoViewport labelColor="white" axisHeadScale={0.9} />
      </GizmoHelper>
    </>
  );
}
