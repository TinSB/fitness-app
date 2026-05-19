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
    <SettingsGroupCard>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-emerald-200" data-theme-text="accentText">应用偏好</p>
          <h3 className="mt-1 text-lg font-bold" data-theme-text="cardTitle">主题与单位</h3>
        </div>
        <StatusBadge state="info">系统 / 浅色 / 深色</StatusBadge>
      </div>

      <div className="mt-4 space-y-4">
        <div>
          <div className="mb-2 text-xs font-semibold tracking-wide" data-theme-text="mutedText">主题</div>
          <SegmentedControl options={themeOptions} value={theme.selectedThemeMode} onChange={onThemeChange} ariaLabel="主题偏好" />
        </div>

        <div>
          <div className="mb-2 text-xs font-semibold tracking-wide" data-theme-text="mutedText">单位</div>
          <SegmentedControl options={unitOptions} value={unitSettings.weightUnit} onChange={onUnitChange} ariaLabel="单位偏好" />
        </div>
      </div>
    </SettingsGroupCard>
  );
}
