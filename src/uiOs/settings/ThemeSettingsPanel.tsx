import type { UnitSettings, WeightUnit } from '../../models/training-model';
import type { ThemePreferenceMode, ThemePreferenceResult } from '../../engines/themePreferenceModel';
import { SegmentedControl } from '../primitives/SegmentedControl';
import { StatusBadge } from '../primitives/StatusBadge';
import { SettingsGroupCard } from './SettingsGroupCard';

export type ThemeSettingsPanelProps = {
  theme: ThemePreferenceResult;
  unitSettings: UnitSettings;
  onThemeChange: (mode: ThemePreferenceMode) => void;
  onUnitChange: (unit: WeightUnit) => void;
};

const themeOptions = [
  { value: 'system', label: '系统' },
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' },
] as const;

const unitOptions = [
  { value: 'kg', label: 'kg 公斤' },
  { value: 'lb', label: 'lb 磅' },
] as const;

export function ThemeSettingsPanel({ theme, unitSettings, onThemeChange, onUnitChange }: ThemeSettingsPanelProps) {
  return (
    <SettingsGroupCard tone="dark" className="text-white">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white/55">App Preferences</p>
          <h3 className="mt-1 text-lg font-bold text-white">主题与单位</h3>
          <p className="mt-1 text-sm leading-6 text-white/55">
            主题是 UI-only / session-local；不会写入 AppData，也不会改变训练数据。Focus Mode 可继续使用 immersive dark。
          </p>
        </div>
        <StatusBadge state="info">system / light / dark</StatusBadge>
      </div>

      <div className="mt-4 space-y-4">
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/40">Theme</div>
          <SegmentedControl options={themeOptions} value={theme.selectedThemeMode} onChange={onThemeChange} ariaLabel="Theme preference" />
          <p className="mt-2 text-xs leading-5 text-white/45">
            当前解析为 {theme.resolvedTheme}；Focus Mode immersive dark: {theme.focusModeUsesImmersiveDark ? 'enabled' : 'disabled'}。
          </p>
        </div>

        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/40">Units</div>
          <SegmentedControl options={unitOptions} value={unitSettings.weightUnit} onChange={onUnitChange} ariaLabel="Unit preference" />
          <p className="mt-2 text-xs leading-5 text-white/45">
            单位只影响界面显示和输入；历史训练内部仍按 kg 标准化保存。
          </p>
        </div>
      </div>
    </SettingsGroupCard>
  );
}
