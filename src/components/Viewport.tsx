import { Canvas } from '@react-three/fiber';
import { useState } from 'react';
import { zoneOf } from '../core/jp';
import type { Results } from '../hooks/useResults';
import { useAppStore, type DisplayState } from '../store';
import { OVERLAY_COLORS } from './three/util';
import { Scene } from './three/Scene';

type OverlayKey =
  | 'showRoadSlant'
  | 'showAdjacentSlant'
  | 'showNorthSlant'
  | 'showAbsHeight'
  | 'showShade'
  | 'showUk25'
  | 'showUk45';

interface ChipDef {
  key: OverlayKey;
  label: string;
  color: string;
}

function OverlayChips() {
  const display = useAppStore((s) => s.display);
  const setDisplay = useAppStore((s) => s.setDisplay);
  const jp = useAppStore((s) => s.jp);
  const zone = zoneOf(jp);

  const chips: ChipDef[] =
    display.country === 'jp'
      ? [
          { key: 'showRoadSlant', label: '道路斜線', color: OVERLAY_COLORS.roadSlant },
          ...(zone.adjacentSlant
            ? [{ key: 'showAdjacentSlant' as const, label: '隣地斜線', color: OVERLAY_COLORS.adjacentSlant }]
            : []),
          ...(zone.northSlantBase !== null && !(zone.category === 'mid-rise' && jp.shadeDesignated)
            ? [{ key: 'showNorthSlant' as const, label: '北側斜線', color: OVERLAY_COLORS.northSlant }]
            : []),
          ...(zone.category === 'low-rise'
            ? [{ key: 'showAbsHeight' as const, label: '絶対高さ', color: OVERLAY_COLORS.absHeight }]
            : []),
          ...(zone.shadeApplicable && jp.shadeDesignated
            ? [{ key: 'showShade' as const, label: '等時間日影', color: '#f97316' }]
            : []),
        ]
      : [
          { key: 'showUk25', label: '25°テスト', color: OVERLAY_COLORS.uk25 },
          { key: 'showUk45', label: '45°ルール', color: OVERLAY_COLORS.uk45 },
        ];

  return (
    <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 max-w-[70%]">
      {chips.map((c) => {
        const on = display[c.key];
        return (
          <button
            key={c.key}
            onClick={() => setDisplay({ [c.key]: !on } as Partial<DisplayState>)}
            className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border backdrop-blur transition-colors ${
              on
                ? 'bg-slate-800/80 border-slate-600 text-slate-200'
                : 'bg-slate-900/60 border-slate-800 text-slate-500'
            }`}
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: c.color, opacity: on ? 1 : 0.3 }}
            />
            {c.label}
          </button>
        );
      })}
      <button
        onClick={() => setDisplay({ showFloorLines: !display.showFloorLines })}
        className={`text-xs px-2.5 py-1 rounded-full border backdrop-blur transition-colors ${
          display.showFloorLines
            ? 'bg-slate-800/80 border-slate-600 text-slate-200'
            : 'bg-slate-900/60 border-slate-800 text-slate-500'
        }`}
      >
        階割
      </button>
    </div>
  );
}

function SunControl() {
  const display = useAppStore((s) => s.display);
  const setDisplay = useAppStore((s) => s.setDisplay);
  const h = Math.floor(display.sunTime);
  const m = Math.round((display.sunTime - h) * 60);
  return (
    <div className="absolute bottom-3 left-3 flex items-center gap-2.5 bg-slate-900/75 backdrop-blur border border-slate-700/60 rounded-lg px-3 py-2">
      <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
        <input
          type="checkbox"
          className="accent-amber-400"
          checked={display.showSunShadow}
          onChange={(e) => setDisplay({ showSunShadow: e.target.checked })}
        />
        冬至の太陽
      </label>
      {display.showSunShadow && (
        <>
          <input
            type="range"
            min={8}
            max={16}
            step={0.25}
            value={display.sunTime}
            onChange={(e) => setDisplay({ sunTime: Number(e.target.value) })}
            className="w-36 accent-amber-400"
          />
          <span className="text-xs tabular-nums text-amber-300 w-14">
            {h}:{String(m).padStart(2, '0')} 真太陽時
          </span>
        </>
      )}
    </div>
  );
}

export function Viewport({ results }: { results: Results }) {
  const [ready, setReady] = useState(false);
  return (
    <div className="relative h-full min-w-0">
      <Canvas
        shadows
        camera={{ position: [26, 22, 38], fov: 40 }}
        dpr={[1, 2]}
        onCreated={() => setReady(true)}
      >
        <Scene results={results} />
      </Canvas>
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0b1220]">
          <div className="text-center">
            <div className="mx-auto mb-3 w-8 h-8 rounded-full border-2 border-slate-700 border-t-sky-400 animate-spin" />
            <p className="text-xs text-slate-500">3Dシーンを初期化中…</p>
          </div>
        </div>
      )}
      <OverlayChips />
      <SunControl />
    </div>
  );
}
