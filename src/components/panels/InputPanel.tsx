import {
  JP_ZONES,
  JP_ZONE_LIST,
  shadeRuleOptions,
  zoneOf,
  type JpZoneId,
} from '../../core/jp';
import { UK_HOUSE_TYPES, type UkHouseType } from '../../core/uk';
import { useAppStore } from '../../store';
import { NumberField, Section, SelectField, ToggleField } from './controls';

const LATITUDE_PRESETS = [
  { value: 43.06, label: '札幌 (43.06°N)' },
  { value: 35.68, label: '東京 (35.68°N)' },
  { value: 34.69, label: '大阪 (34.69°N)' },
  { value: 33.59, label: '福岡 (33.59°N)' },
  { value: 51.51, label: 'ロンドン (51.51°N)' },
  { value: 53.48, label: 'マンチェスター (53.48°N)' },
];

/** 最も近い選択肢に丸める */
function nearest(options: number[], v: number): number {
  return options.reduce((a, c) => (Math.abs(c - v) < Math.abs(a - v) ? c : a));
}

function JpSection() {
  const jp = useAppStore((s) => s.jp);
  const setJp = useAppStore((s) => s.setJp);
  const zone = zoneOf(jp);
  const rules = shadeRuleOptions(zone);

  const onZoneChange = (id: JpZoneId) => {
    const z = JP_ZONES[id];
    setJp({
      zone: id,
      coverageLimit: nearest(z.coverageOptions, jp.coverageLimit),
      farLimit: nearest(z.farOptions, jp.farLimit),
      shadeMeasureHeight: z.shadeMeasureHeights[0] ?? 4,
      shadeRuleIndex: 0,
    });
  };

  return (
    <>
      <Section title="用途地域・指定 (日本)">
        <SelectField
          label="用途地域 (都市計画法8条)"
          value={jp.zone}
          options={JP_ZONE_LIST.map((z) => ({ value: z.id, label: z.name }))}
          onChange={onZoneChange}
        />
        <div className="grid grid-cols-2 gap-2">
          <SelectField
            label="指定建蔽率"
            value={jp.coverageLimit}
            options={zone.coverageOptions.map((v) => ({ value: v, label: `${v}%` }))}
            onChange={(v) => setJp({ coverageLimit: v })}
          />
          <SelectField
            label="指定容積率"
            value={jp.farLimit}
            options={zone.farOptions.map((v) => ({ value: v, label: `${v}%` }))}
            onChange={(v) => setJp({ farLimit: v })}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <SelectField
            label="防火地域の指定"
            value={jp.fireZone}
            options={[
              { value: 'none' as const, label: '指定なし' },
              { value: 'quasi-fire' as const, label: '準防火地域' },
              { value: 'fire' as const, label: '防火地域' },
            ]}
            onChange={(v) => setJp({ fireZone: v })}
          />
          <SelectField
            label="建物の耐火性能"
            value={jp.fireResistance}
            options={[
              { value: 'none' as const, label: 'その他' },
              { value: 'quasi-fireproof' as const, label: '準耐火建築物' },
              { value: 'fireproof' as const, label: '耐火建築物' },
            ]}
            onChange={(v) => setJp({ fireResistance: v })}
          />
        </div>
        {zone.category === 'low-rise' && (
          <SelectField
            label="絶対高さ制限 (55条)"
            value={jp.lowRiseHeightLimit}
            options={[
              { value: 10 as const, label: '10m' },
              { value: 12 as const, label: '12m' },
            ]}
            onChange={(v) => setJp({ lowRiseHeightLimit: v })}
          />
        )}
      </Section>
      {zone.shadeApplicable && (
        <Section title="日影規制 (56条の2)">
          <ToggleField
            label="対象区域の指定あり (条例)"
            checked={jp.shadeDesignated}
            onChange={(v) => setJp({ shadeDesignated: v })}
          />
          {jp.shadeDesignated && (
            <>
              <SelectField
                label="規制値 (別表第4)"
                value={jp.shadeRuleIndex}
                options={rules.map((r, i) => ({
                  value: i,
                  label: `(${['一', '二', '三'][i]}) 5-10m: ${r.limit5to10}h / 10m超: ${r.limitBeyond10}h`,
                }))}
                onChange={(v) => setJp({ shadeRuleIndex: v })}
              />
              <SelectField
                label="測定面の高さ"
                value={jp.shadeMeasureHeight}
                options={zone.shadeMeasureHeights.map((h) => ({ value: h, label: `GL + ${h}m` }))}
                onChange={(v) => setJp({ shadeMeasureHeight: v })}
              />
            </>
          )}
        </Section>
      )}
    </>
  );
}

function UkSection() {
  const uk = useAppStore((s) => s.uk);
  const setUk = useAppStore((s) => s.setUk);
  return (
    <>
      <Section title="許可不要開発 PD (英国)">
        <SelectField
          label="住宅形式"
          value={uk.houseType}
          options={UK_HOUSE_TYPES.map((t) => ({ value: t.id as UkHouseType, label: t.name }))}
          onChange={(v) => setUk({ houseType: v })}
        />
        <ToggleField
          label="指定地 (保全地区等 / Art.2(3))"
          checked={uk.isDesignatedLand}
          onChange={(v) => setUk({ isDesignatedLand: v })}
        />
        <NumberField
          label="オリジナル住宅の奥行 (道路側から)"
          value={uk.originalDepth}
          min={4}
          max={20}
          step={0.5}
          unit="m"
          onChange={(v) => setUk({ originalDepth: v })}
        />
        <NumberField
          label="住戸数 (NDSS 概算検定)"
          value={uk.dwellingCount}
          min={0}
          max={20}
          step={1}
          unit="戸"
          onChange={(v) => setUk({ dwellingCount: v })}
        />
      </Section>
      <Section title="日照・採光の基準点 (BRE 209)">
        <NumberField
          label="隣地窓: 境界からの距離"
          value={uk.neighbourWindowDist}
          min={0}
          max={10}
          step={0.5}
          unit="m"
          onChange={(v) => setUk({ neighbourWindowDist: v })}
        />
        <NumberField
          label="隣地窓: 中心高さ"
          value={uk.neighbourWindowHeight}
          min={0.8}
          max={6}
          step={0.1}
          unit="m"
          onChange={(v) => setUk({ neighbourWindowHeight: v })}
        />
        <NumberField
          label="向かい窓: 道路反対側からの後退"
          value={uk.oppositeWindowSetback}
          min={0}
          max={15}
          step={0.5}
          unit="m"
          onChange={(v) => setUk({ oppositeWindowSetback: v })}
        />
        <NumberField
          label="向かい窓: 中心高さ"
          value={uk.oppositeWindowHeight}
          min={0.8}
          max={6}
          step={0.1}
          unit="m"
          onChange={(v) => setUk({ oppositeWindowHeight: v })}
        />
      </Section>
    </>
  );
}

export function InputPanel() {
  const site = useAppStore((s) => s.site);
  const building = useAppStore((s) => s.building);
  const country = useAppStore((s) => s.display.country);
  const setSite = useAppStore((s) => s.setSite);
  const setBuilding = useAppStore((s) => s.setBuilding);

  return (
    <div className="h-full overflow-y-auto">
      <Section title="敷地">
        <NumberField label="間口 (東西)" value={site.width} min={6} max={60} step={0.5} unit="m" onChange={(v) => setSite({ width: v })} />
        <NumberField label="奥行 (南北)" value={site.depth} min={6} max={60} step={0.5} unit="m" onChange={(v) => setSite({ depth: v })} />
        <NumberField label="前面道路の幅員 (南側)" value={site.roadWidth} min={2} max={20} step={0.5} unit="m" onChange={(v) => setSite({ roadWidth: v })} />
        {country === 'jp' && (
          <ToggleField label="角地 (建蔽率 +10%)" checked={site.isCornerLot} onChange={(v) => setSite({ isCornerLot: v })} />
        )}
        <SelectField
          label="緯度 (日影・日照計算)"
          value={site.latitude}
          options={LATITUDE_PRESETS}
          onChange={(v) => setSite({ latitude: v })}
        />
      </Section>
      <Section title="建物 (直方体ボリューム)">
        <NumberField label="幅 (東西)" value={building.width} min={2} max={50} step={0.5} unit="m" onChange={(v) => setBuilding({ width: v })} />
        <NumberField label="奥行 (南北)" value={building.depth} min={2} max={50} step={0.5} unit="m" onChange={(v) => setBuilding({ depth: v })} />
        <NumberField label="道路境界からの後退 (南)" value={building.setbackSouth} min={0} max={20} step={0.5} unit="m" onChange={(v) => setBuilding({ setbackSouth: v })} />
        <NumberField label="西側境界からの後退" value={building.setbackWest} min={0} max={20} step={0.5} unit="m" onChange={(v) => setBuilding({ setbackWest: v })} />
        <NumberField label="階数" value={building.floors} min={1} max={20} step={1} unit="F" onChange={(v) => setBuilding({ floors: v })} />
        <NumberField label="階高" value={building.floorHeight} min={2.4} max={5} step={0.1} unit="m" onChange={(v) => setBuilding({ floorHeight: v })} />
        <NumberField label="パラペット等の立上り" value={building.parapet} min={0} max={2} step={0.1} unit="m" onChange={(v) => setBuilding({ parapet: v })} />
      </Section>
      {country === 'jp' ? <JpSection /> : <UkSection />}
    </div>
  );
}
