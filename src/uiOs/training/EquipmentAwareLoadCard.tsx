import { classNames } from '../../engines/engineUtils';
import { resolveThemeSurface } from '../theme/themeSurfaceModel';
import { useUiTheme } from '../theme/UiThemeProvider';

export type EquipmentLoadType = 'barbell' | 'dumbbell' | 'machine-stack' | 'plate-loaded' | 'smith' | 'unknown';
export type EquipmentLoadCardState = 'default' | 'warning' | 'blocked';

export type EquipmentAwareLoadCardProps = {
  type?: EquipmentLoadType;
  mainDisplay: string;
  reps?: number | string;
  subInfo?: string;
  note?: string;
  state?: EquipmentLoadCardState;
  className?: string;
  compact?: boolean;
};

const typeLabels: Record<EquipmentLoadType, string> = {
  barbell: '杠铃',
  dumbbell: '哑铃',
  'machine-stack': '器械',
  'plate-loaded': '挂片器械',
  smith: '史密斯架',
  unknown: '未知器械',
};

const stateGradients: Record<EquipmentLoadCardState, string> = {
  default: 'from-emerald-500/12 via-emerald-500/6 to-transparent',
  warning: 'from-amber-500/12 via-amber-500/6 to-transparent',
  blocked: 'from-red-500/12 via-red-500/6 to-transparent',
};

export function EquipmentAwareLoadCard({
  type = 'barbell',
  mainDisplay,
  reps,
  subInfo,
  note,
  state = 'default',
  className = '',
  compact = false,
}: EquipmentAwareLoadCardProps) {
  const { selectedThemeMode, resolvedTheme } = useUiTheme();
  const surface = resolveThemeSurface('training_hero', selectedThemeMode, { systemPrefersDark: resolvedTheme === 'dark' });
  const isDark = surface.resolvedMode === 'dark';
  const repText = reps === undefined || reps === null ? '' : String(reps).trim();
  const primaryDisplay = repText ? `${mainDisplay} × ${repText}` : mainDisplay;
  return (
    <section
      className={classNames('relative overflow-hidden rounded-3xl bg-gradient-to-b', compact ? 'p-4' : 'p-6', surface.className, surface.textClassName, stateGradients[state], className)}
      style={{ border: isDark ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid rgba(226, 232, 240, 1)' }}
      aria-label="Equipment-aware load card"
      data-theme-surface="training_hero"
      data-theme-mode={surface.resolvedMode}
    >
      <div className={classNames('flex items-center gap-2', compact ? 'mb-2' : 'mb-5')}>
        <span className={classNames('text-xs uppercase tracking-widest font-medium', isDark ? 'text-white/35' : 'text-slate-500')}>{typeLabels[type]}</span>
      </div>

      <div className={classNames(compact ? 'mb-2' : 'mb-4')}>
        <span
          className={classNames(compact ? 'text-2xl font-bold' : 'text-5xl font-extralight', isDark ? 'text-white' : 'text-slate-950', 'tracking-tight')}
          style={{ fontFeatureSettings: '"tnum"' }}
          data-focus-primary-load-label="true"
          data-equipment-primary-load-label="true"
        >
          {primaryDisplay}
        </span>
      </div>

      {subInfo ? <p className={classNames(compact ? 'text-sm' : 'text-base', isDark ? 'text-white/62' : 'text-slate-600', 'mb-2')}>{subInfo}</p> : null}
      {note ? <p className={classNames('text-sm leading-relaxed', isDark ? 'text-white/35' : 'text-slate-500')}>{note}</p> : null}
    </section>
  );
}
