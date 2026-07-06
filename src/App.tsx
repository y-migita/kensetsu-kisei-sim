import { InputPanel } from './components/panels/InputPanel';
import { ResultsPanel } from './components/panels/ResultsPanel';
import { Viewport } from './components/Viewport';
import { useResults } from './hooks/useResults';
import { PRESETS } from './presets';
import { useAppStore, type CountryMode } from './store';

function PresetSelect() {
  const setSite = useAppStore((s) => s.setSite);
  const setBuilding = useAppStore((s) => s.setBuilding);
  const setJp = useAppStore((s) => s.setJp);
  const setUk = useAppStore((s) => s.setUk);
  return (
    <select
      className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-sky-500"
      value=""
      onChange={(e) => {
        const p = PRESETS.find((x) => x.id === e.target.value);
        if (!p) return;
        setSite(p.site);
        setBuilding(p.building);
        setJp(p.jp);
        setUk(p.uk);
      }}
    >
      <option value="" disabled>
        プリセット読込…
      </option>
      {PRESETS.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  );
}

function CountryToggle() {
  const country = useAppStore((s) => s.display.country);
  const setDisplay = useAppStore((s) => s.setDisplay);
  const opts: { id: CountryMode; label: string }[] = [
    { id: 'jp', label: '🇯🇵 日本 (建築基準法)' },
    { id: 'uk', label: '🇬🇧 英国 (Planning/PD)' },
  ];
  return (
    <div className="flex rounded-lg border border-slate-700 overflow-hidden">
      {opts.map((o) => (
        <button
          key={o.id}
          onClick={() => setDisplay({ country: o.id })}
          className={`px-3 py-1.5 text-xs font-medium transition-colors ${
            country === o.id
              ? 'bg-sky-600 text-white'
              : 'bg-slate-900 text-slate-400 hover:text-slate-200'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function App() {
  const results = useResults();
  return (
    <div className="h-screen flex flex-col bg-slate-950 text-slate-200">
      <header className="flex items-center gap-4 px-4 py-2.5 border-b border-slate-800 shrink-0">
        <div>
          <h1 className="text-sm font-bold tracking-wide">建設規制シミュレーター</h1>
          <p className="text-[10px] text-slate-500">
            JP/UK Building Regulation Simulator — 形態規制の3Dインタラクティブ検証
          </p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <PresetSelect />
          <CountryToggle />
          <a
            href="https://github.com/y-migita/kensetsu-kisei-sim"
            target="_blank"
            rel="noreferrer"
            className="text-xs text-slate-500 hover:text-slate-300"
          >
            GitHub ↗
          </a>
        </div>
      </header>
      <div className="flex-1 flex min-h-0">
        <aside className="w-72 shrink-0 border-r border-slate-800 bg-slate-950">
          <InputPanel />
        </aside>
        <main className="flex-1 min-w-0">
          <Viewport results={results} />
        </main>
        <aside className="w-[22rem] shrink-0 border-l border-slate-800 bg-slate-950">
          <ResultsPanel results={results} />
        </aside>
      </div>
    </div>
  );
}
