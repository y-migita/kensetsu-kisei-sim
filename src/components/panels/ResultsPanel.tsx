import { useState } from 'react';
import { fmt } from '../../core/geometry';
import { maximizeFar } from '../../core/jp';
import type { CheckResult, CheckStatus } from '../../core/types';
import type { Results } from '../../hooks/useResults';
import { useAppStore } from '../../store';

const STATUS_STYLE: Record<CheckStatus, { label: string; cls: string }> = {
  pass: { label: '適合', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  fail: { label: '不適合', cls: 'bg-red-500/15 text-red-400 border-red-500/30' },
  na: { label: '対象外', cls: 'bg-slate-600/20 text-slate-500 border-slate-600/30' },
  info: { label: '参考', cls: 'bg-sky-500/15 text-sky-400 border-sky-500/30' },
};

function MarginBar({ margin }: { margin: number }) {
  const clamped = Math.max(-1, Math.min(1, margin));
  const pct = Math.abs(clamped) * 50;
  return (
    <div className="h-1 bg-slate-800 rounded-full overflow-hidden flex">
      <div className="w-1/2 flex justify-end">
        {clamped < 0 && <div className="h-full bg-red-500/80 rounded-l" style={{ width: `${pct * 2}%` }} />}
      </div>
      <div className="w-1/2">
        {clamped >= 0 && <div className="h-full bg-emerald-500/70 rounded-r" style={{ width: `${pct * 2}%` }} />}
      </div>
    </div>
  );
}

function CheckRow({ result }: { result: CheckResult }) {
  const s = STATUS_STYLE[result.status];
  return (
    <details className="group border-b border-slate-800/70 px-4 py-2.5 open:bg-slate-900/40">
      <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <div className="flex items-center gap-2">
          <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded border ${s.cls}`}>
            {s.label}
          </span>
          <span className="text-sm text-slate-200 flex-1 truncate">{result.name}</span>
          <span className="text-slate-600 text-xs group-open:rotate-90 transition-transform">▸</span>
        </div>
        <div className="mt-1.5 flex items-baseline gap-3 text-xs tabular-nums">
          <span className="text-slate-400">
            計画 <span className="text-slate-200">{result.actual}</span>
          </span>
          <span className="text-slate-400">
            限度 <span className="text-slate-200">{result.limit}</span>
          </span>
        </div>
        {result.margin !== undefined && (
          <div className="mt-1.5">
            <MarginBar margin={result.margin} />
          </div>
        )}
      </summary>
      <div className="mt-2 text-xs leading-relaxed text-slate-400">
        <p>{result.detail}</p>
        <p className="mt-1 text-slate-500">根拠: {result.legalBasis}</p>
      </div>
    </details>
  );
}

type OptimizationMessage =
  | { type: 'success'; farPct: number; notes: string[] }
  | { type: 'error'; text: string }
  | null;

export function ResultsPanel({ results }: { results: Results }) {
  const country = useAppStore((s) => s.display.country);
  const site = useAppStore((s) => s.site);
  const [busy, setBusy] = useState(false);
  const [optimizationMessage, setOptimizationMessage] = useState<OptimizationMessage>(null);
  const { geometry: g, jpResults, ukResults, placementErrors } = results;
  const active = country === 'jp' ? jpResults : ukResults;

  const failCount = active.filter((r) => r.status === 'fail').length;
  const passCount = active.filter((r) => r.status === 'pass').length;
  const siteArea = site.width * site.depth;

  const handleMaximizeFar = () => {
    setBusy(true);
    setTimeout(() => {
      try {
        const { site: currentSite, jp, building, setBuilding } = useAppStore.getState();
        const result = maximizeFar(currentSite, jp, building);
        if (result.feasible && result.building) {
          setBuilding({
            width: result.building.width,
            depth: result.building.depth,
            setbackSouth: result.building.setbackSouth,
            setbackWest: result.building.setbackWest,
            floors: result.building.floors,
          });
          setOptimizationMessage({ type: 'success', farPct: result.farPct, notes: result.notes });
        } else {
          setOptimizationMessage({ type: 'error', text: '適合解が見つかりません' });
        }
      } finally {
        setBusy(false);
      }
    }, 30);
  };

  return (
    <div className="h-full flex flex-col">
      {/* サマリー */}
      <div className="px-4 py-3 border-b border-slate-800">
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
          <Stat label="敷地面積" value={`${fmt(siteArea, 1)} m²`} />
          <Stat label="建築面積" value={`${fmt(g.footprintArea, 1)} m²`} />
          <Stat label="延べ面積" value={`${fmt(g.totalFloorArea, 1)} m²`} />
          <Stat label="最高高さ" value={`${fmt(g.height, 2)} m`} />
          <Stat label="建蔽率 (計画)" value={`${fmt((g.footprintArea / siteArea) * 100, 1)} %`} />
          <Stat label="容積率 (計画)" value={`${fmt((g.totalFloorArea / siteArea) * 100, 1)} %`} />
        </div>
        {country === 'jp' && (
          <div className="mt-3 border-t border-slate-800 pt-3">
            <button
              type="button"
              disabled={busy}
              onClick={handleMaximizeFar}
              className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
            >
              {busy ? '最適化中…' : '容積率を最大化'}
            </button>
            {optimizationMessage?.type === 'success' && (
              <div className="mt-2 space-y-0.5 text-[11px] text-slate-400">
                <p className="tabular-nums">達成容積率 {fmt(optimizationMessage.farPct, 1)}%</p>
                {optimizationMessage.notes.map((note) => (
                  <p key={note}>{note}</p>
                ))}
              </div>
            )}
            {optimizationMessage?.type === 'error' && (
              <p className="mt-2 text-[11px] text-red-400">{optimizationMessage.text}</p>
            )}
          </div>
        )}
      </div>

      {placementErrors.length > 0 && (
        <div className="mx-4 mt-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          {placementErrors.map((e) => (
            <p key={e}>⚠ {e}</p>
          ))}
        </div>
      )}

      {/* 判定ヘッダ */}
      <div className="px-4 py-2.5 flex items-center gap-2 border-b border-slate-800">
        <h2 className="text-sm font-semibold text-slate-200">
          {country === 'jp' ? '🇯🇵 建築基準法 集団規定' : '🇬🇧 Planning / PD 検定'}
        </h2>
        <div className="ml-auto flex gap-1.5 text-[10px] font-bold">
          <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400">適合 {passCount}</span>
          <span
            className={`px-1.5 py-0.5 rounded ${failCount > 0 ? 'bg-red-500/20 text-red-400' : 'bg-slate-700/40 text-slate-500'}`}
          >
            不適合 {failCount}
          </span>
        </div>
      </div>

      {/* チェック一覧 */}
      <div className="flex-1 overflow-y-auto">
        {active.map((r) => (
          <CheckRow key={r.id} result={r} />
        ))}
        <p className="px-4 py-3 text-[10px] leading-relaxed text-slate-600">
          本ツールは単純化した検討モデルによる参考値を示すものであり、建築確認・計画許可の判断に代わるものではありません。
          実務では特定行政庁・LPA への確認と有資格者による検討が必要です。
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-200 tabular-nums">{value}</span>
    </div>
  );
}
