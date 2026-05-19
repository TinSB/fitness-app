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
          <p className="text-sm font-semibold text-emerald-200">应用偏好</p>
          <h3 className="mt-1 text-lg font-bold text-white">主题与单位</h3>
          <p className="mt-1 text-sm leading-6 text-white/55">
            主题只影响本次界面显示，不会改变训练记录。Focus Mode 会保持沉浸深色。
          </p>
        </div>
        <StatusBadge state="info">系统 / 浅色 / 深色</StatusBadge>
      </div>

      <div className="mt-4 space-y-4">
        <div>
          <div className="mb-2 text-xs font-semibold tracking-wide text-white/40">主题</div>
          <SegmentedControl options={themeOptions} value={theme.selectedThemeMode} onChange={onThemeChange} ariaLabel="主题偏好" />
          <p className="mt-2 text-xs leading-5 text-white/45">
            当前显示为 {theme.resolvedTheme === 'dark' ? '深色' : '浅色'}；Focus Mode 保持沉浸深色。
          </p>
        </div>

        <div>
          <div className="mb-2 text-xs font-semibold tracking-wide text-white/40">单位</div>
          <SegmentedControl options={unitOptions} value={unitSettings.weightUnit} onChange={onUnitChange} ariaLabel="单位偏好" />
          <p className="mt-2 text-xs leading-5 text-white/45">
            单位只影响界面显示和输入，不会改写历史记录。
          </p>
        </div>
      </div>
    </SettingsGroupCard>
  );
}
