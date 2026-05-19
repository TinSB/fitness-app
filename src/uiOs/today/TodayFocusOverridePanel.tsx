import type { TodayTrainingFocusOverrideOption, TodayTrainingFocusSelection } from '../../engines/todayTrainingFocusOverrideEngine';
import {
  TODAY_TRAINING_FOCUS_OVERRIDE_LABELS,
  TODAY_TRAINING_FOCUS_OVERRIDE_OPTIONS,
} from '../../engines/todayTrainingFocusOverrideEngine';
import { classNames } from '../../engines/engineUtils';
import { ActionButton } from '../primitives/ActionButton';
import { GlassCard } from '../primitives/GlassCard';
import { SegmentedControl } from '../primitives/SegmentedControl';
import { StatusBadge } from '../primitives/StatusBadge';

export type TodayFocusOverridePanelProps = {
  selection: TodayTrainingFocusSelection;
  onChange?: (override: TodayTrainingFocusOverrideOption) => void;
  className?: string;
  compact?: boolean;
  expanded?: boolean;
  embedded?: boolean;
  onToggleExpanded?: () => void;
};

const primaryOverrideOptions = TODAY_TRAINING_FOCUS_OVERRIDE_OPTIONS.filter((option) =>
  ['system', 'chest', 'back', 'legs', 'shoulders'].includes(option),
);

const secondaryOverrideOptions = TODAY_TRAINING_FOCUS_OVERRIDE_OPTIONS.filter((option) => !primaryOverrideOptions.includes(option));

export function TodayFocusOverridePanel({ selection, onChange, className = '', compact = false, expanded = true, embedded = false, onToggleExpanded }: TodayFocusOverridePanelProps) {
  if (compact && !expanded) {
    const compactContent = (
      <div className="flex flex-wrap items-center justify-between gap-3" data-today-focus-override-density="compact">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white">切换目标</div>
            {selection.overrideActive ? <div className="mt-1 text-xs leading-5 text-white/45">今天：{selection.selectedFocusLabel}</div> : null}
            <span className="sr-only">
              今天想练 原计划：{selection.systemTemplateName} {selection.overrideActive ? `手动目标 已切换为：${selection.selectedFocusLabel} · ${selection.selectedTemplateName}` : ''}
              {' '}
              {TODAY_TRAINING_FOCUS_OVERRIDE_OPTIONS.map((option) => TODAY_TRAINING_FOCUS_OVERRIDE_LABELS[option]).join(' ')}
              {' '}
              {selection.selectedTemplate?.exercises?.slice(0, 2).map((exercise) => exercise.name || exercise.id).join(' ')}
              {' '}
              {selection.warnings.map((warning) => warning.message).join(' ')}
            </span>
          </div>
          <ActionButton type="button" size="sm" variant="secondary" onClick={onToggleExpanded}>
            切换目标
          </ActionButton>
        </div>
    );

    if (embedded) {
      return (
        <div className={classNames('rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-2', className)} aria-label="切换目标">
          {compactContent}
        </div>
      );
    }

    return (
      <GlassCard as="section" padding="sm" className={classNames('rounded-3xl', className)} ariaLabel="切换目标">
        {compactContent}
      </GlassCard>
    );
  }

  return (
    <GlassCard as="section" padding="md" className={classNames('rounded-3xl', className)} ariaLabel="今天想练">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-white">切换目标</div>
        </div>
        <div className="flex flex-wrap gap-2">
          {selection.overrideActive ? <StatusBadge state="manual-required">手动目标</StatusBadge> : null}
          <StatusBadge state={selection.overrideActive ? 'warning' : 'safe'}>
            {selection.overrideActive ? `已切换为 ${selection.selectedFocusLabel}` : '按计划'}
          </StatusBadge>
        </div>
      </div>
      <SegmentedControl
        className="mt-4"
        ariaLabel="今天想练主选项"
        value={primaryOverrideOptions.includes(selection.override) ? selection.override : 'system'}
        options={primaryOverrideOptions.map((option) => ({
          value: option,
          label: TODAY_TRAINING_FOCUS_OVERRIDE_LABELS[option],
        }))}
        onChange={(value) => onChange?.(value)}
      />
      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="今天想练补充选项">
        {secondaryOverrideOptions.map((option) => {
          const selected = selection.override === option;
          return (
            <button
              key={option}
              type="button"
              onClick={() => onChange?.(option)}
              className={classNames(
                'min-h-9 rounded-xl border px-3 text-sm font-medium transition',
                selected
                  ? 'border-emerald-300 bg-emerald-300/20 text-emerald-50'
                  : 'border-white/10 bg-white/[0.07] text-white/58 hover:bg-white/10 hover:text-white',
              )}
              aria-pressed={selected}
            >
              {TODAY_TRAINING_FOCUS_OVERRIDE_LABELS[option]}
            </button>
          );
        })}
      </div>
      <div className="mt-3 grid gap-2 text-xs leading-5 text-white/58 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/[0.07] px-3 py-2">原计划：{selection.systemTemplateName}</div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.07] px-3 py-2">
          {selection.overrideActive
            ? `已切换为：${selection.selectedFocusLabel} · ${selection.selectedTemplateName}`
            : `今日：${selection.systemTemplateName}`}
        </div>
      </div>
      {selection.warnings.length ? (
        <div className="mt-3 space-y-2">
          {selection.warnings.map((warning) => (
            <div key={warning.id} className="rounded-2xl border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-xs leading-5 text-amber-50">
              {warning.message}
            </div>
          ))}
        </div>
      ) : null}
      {compact ? (
        <div className="mt-3">
          <ActionButton type="button" size="sm" variant="ghost" onClick={onToggleExpanded}>
            收起目标选项
          </ActionButton>
        </div>
      ) : null}
    </GlassCard>
  );
}
