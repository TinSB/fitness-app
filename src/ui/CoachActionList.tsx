import React from 'react';
import type { CoachAction } from '../engines/coachActionEngine';
import type { CoachActionListViewModel, CoachActionView } from '../presenters/coachActionPresenter';
import { ActionButton } from './ActionButton';
import { CoachActionCard } from './CoachActionCard';

type CoachActionStatusFilter = 'pending' | 'applied' | 'dismissed' | 'expired' | 'failed';

type CoachActionListProps = {
  viewModel: CoachActionListViewModel;
  title?: string;
  description?: string;
  compact?: boolean;
  showStatusFilters?: boolean;
  onAction?: (action: CoachAction) => void;
  onDismiss?: (action: CoachAction) => void;
  onDetail?: (action: CoachAction) => void;
  emptyText?: string;
};

const statusTabs: Array<{ id: CoachActionStatusFilter; label: string }> = [
  { id: 'pending', label: '待处理' },
  { id: 'applied', label: '已采用' },
  { id: 'dismissed', label: '已忽略' },
  { id: 'expired', label: '已过期' },
  { id: 'failed', label: '未完成' },
];

const getItems = (viewModel: CoachActionListViewModel, status: CoachActionStatusFilter): CoachActionView[] => viewModel[status];

export function CoachActionList({
  viewModel,
  title = '教练建议',
  description = '建议只会引导你查看现有页面或生成草案，不会自动修改数据。',
  compact = false,
  showStatusFilters = false,
  onAction,
  onDismiss,
  onDetail,
  emptyText = '暂无需要处理的教练建议。',
}: CoachActionListProps) {
  const [activeStatus, setActiveStatus] = React.useState<CoachActionStatusFilter>('pending');
  const activeItems = showStatusFilters ? getItems(viewModel, activeStatus) : viewModel.pending;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className={compact ? 'text-base font-semibold text-slate-950' : 'text-lg font-semibold text-slate-950'}>{title}</h2>
          {description ? <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p> : null}
        </div>
      </div>

      {showStatusFilters ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {statusTabs.map((tab) => (
            <ActionButton
              key={tab.id}
              type="button"
              size="sm"
              variant={activeStatus === tab.id ? 'primary' : 'secondary'}
              onClick={() => setActiveStatus(tab.id)}
            >
              {tab.label}
            </ActionButton>
          ))}
        </div>
      ) : null}

      {activeItems.length ? (
        <div className="space-y-2">
          {activeItems.map((action) => (
            <CoachActionCard
              key={action.id}
              action={action}
              compact={compact}
              onPrimary={onAction}
              onSecondary={onDismiss}
              onDetail={onDetail || onAction}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-stone-50 px-3 py-3 text-sm leading-6 text-slate-600">{emptyText}</div>
      )}
    </section>
  );
}
