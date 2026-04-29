import type { CoachAction } from '../engines/coachActionEngine';
import type { CoachActionView } from '../presenters/coachActionPresenter';
import { ActionButton } from './ActionButton';
import { Card } from './Card';
import { StatusBadge } from './StatusBadge';

type CoachActionCardProps = {
  action: CoachActionView;
  compact?: boolean;
  onPrimary?: (action: CoachAction) => void;
  onSecondary?: (action: CoachAction) => void;
  onDetail?: (action: CoachAction) => void;
};

export function CoachActionCard({ action, compact = false, onPrimary, onSecondary, onDetail }: CoachActionCardProps) {
  return (
    <Card className={compact ? 'space-y-3 p-3' : 'space-y-3'}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className={compact ? 'text-sm font-semibold text-slate-950' : 'text-base font-semibold text-slate-950'}>{action.title}</h3>
            <StatusBadge tone={action.priorityTone}>{action.priorityLabel}</StatusBadge>
            <StatusBadge tone={action.statusTone}>{action.statusLabel}</StatusBadge>
          </div>
          <p className="mt-1 text-sm leading-6 text-slate-600">{action.description}</p>
        </div>
        <StatusBadge tone="slate">{action.sourceLabel}</StatusBadge>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
        {action.requiresConfirmation ? <StatusBadge tone="amber">需要确认</StatusBadge> : <StatusBadge tone="emerald">只查看</StatusBadge>}
        {action.reversible ? <StatusBadge tone="sky">可撤销</StatusBadge> : null}
      </div>

      <div className={compact ? 'grid gap-2 sm:grid-cols-[1fr_auto_auto]' : 'grid gap-2 sm:grid-cols-[1fr_auto_auto]'}>
        <ActionButton type="button" size={compact ? 'sm' : 'md'} variant="primary" fullWidth disabled={!onPrimary} onClick={() => onPrimary?.(action.action)}>
          {action.primaryLabel}
        </ActionButton>
        <ActionButton type="button" size={compact ? 'sm' : 'md'} variant="secondary" disabled={!onSecondary} onClick={() => onSecondary?.(action.action)}>
          {action.secondaryLabel}
        </ActionButton>
        <ActionButton type="button" size={compact ? 'sm' : 'md'} variant="ghost" disabled={!onDetail} onClick={() => onDetail?.(action.action)}>
          {action.detailLabel}
        </ActionButton>
      </div>
    </Card>
  );
}
