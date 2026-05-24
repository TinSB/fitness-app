import { GitBranch, HardDrive, Cloud, Check, AlertTriangle, ChevronRight } from 'lucide-react';
import { classNames } from '../engines/engineUtils';
import { ActionButton } from '../ui/ActionButton';
import { Card } from '../ui/Card';
import { useUiTheme } from '../uiOs/theme/UiThemeProvider';

export type ConflictResolutionState = 'none' | 'review_required' | 'local_selected' | 'cloud_selected';

export interface ConflictItem {
  id: string;
  field: string;
  localValue: string;
  cloudValue: string;
  localTimestamp?: string;
  cloudTimestamp?: string;
}

export interface ConflictReviewProps {
  conflictCount: number;
  conflictItems: ConflictItem[];
  selectedResolution: ConflictResolutionState;
  onKeepLocal?: () => void;
  onUseCloud?: () => void;
  onReviewDetail?: (itemId: string) => void;
  onDismiss?: () => void;
}

const stateConfig: Record<ConflictResolutionState, { label: string; tone: 'slate' | 'emerald' | 'amber' | 'rose' }> = {
  none: { label: '无冲突', tone: 'slate' },
  review_required: { label: '需要确认', tone: 'amber' },
  local_selected: { label: '已选择本地', tone: 'emerald' },
  cloud_selected: { label: '已选择云端', tone: 'emerald' },
};

interface ConflictItemRowProps {
  item: ConflictItem;
  isDark: boolean;
  onReviewDetail?: (itemId: string) => void;
}

function ConflictItemRow({ item, isDark, onReviewDetail }: ConflictItemRowProps) {
  return (
    <button
      type="button"
      onClick={() => onReviewDetail?.(item.id)}
      className={classNames(
        'flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition',
        isDark ? 'bg-white/[0.04] hover:bg-white/[0.08] active:bg-white/[0.10]' : 'bg-slate-50 hover:bg-slate-100 active:bg-slate-100'
      )}
    >
      <div className="flex-1 min-w-0">
        <p
          className={classNames(
            'text-sm font-medium truncate',
            isDark ? 'text-white' : 'text-slate-900'
          )}
        >
          {item.field}
        </p>
        <div className="mt-1 flex items-center gap-2">
          <span
            className={classNames(
              'inline-flex items-center gap-1 text-xs',
              isDark ? 'text-white/50' : 'text-slate-500'
            )}
          >
            <HardDrive className="h-3 w-3" />
            <span className="truncate max-w-20">{item.localValue}</span>
          </span>
          <span className={classNames('text-xs', isDark ? 'text-white/30' : 'text-slate-300')}>vs</span>
          <span
            className={classNames(
              'inline-flex items-center gap-1 text-xs',
              isDark ? 'text-white/50' : 'text-slate-500'
            )}
          >
            <Cloud className="h-3 w-3" />
            <span className="truncate max-w-20">{item.cloudValue}</span>
          </span>
        </div>
      </div>
      <ChevronRight
        className={classNames(
          'h-4 w-4 shrink-0',
          isDark ? 'text-white/30' : 'text-slate-400'
        )}
      />
    </button>
  );
}

export function ConflictReview({
  conflictCount,
  conflictItems,
  selectedResolution,
  onKeepLocal,
  onUseCloud,
  onReviewDetail,
  onDismiss,
}: ConflictReviewProps) {
  const { resolvedTheme } = useUiTheme();
  const isDark = resolvedTheme === 'dark';
  const config = stateConfig[selectedResolution];
  const hasConflicts = conflictCount > 0 || selectedResolution === 'review_required';

  return (
    <Card
      tone={config.tone}
      padded
      className="space-y-4"
      data-testid="ironpath-conflict-review"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={classNames(
              'flex h-10 w-10 items-center justify-center rounded-full',
              isDark ? 'bg-white/10' : 'bg-slate-100'
            )}
          >
            {hasConflicts ? (
              <GitBranch
                className={classNames(
                  'h-5 w-5',
                  selectedResolution === 'review_required'
                    ? (isDark ? 'text-amber-300' : 'text-amber-600')
                    : (isDark ? 'text-white/70' : 'text-slate-500')
                )}
              />
            ) : (
              <Check className={classNames('h-5 w-5', isDark ? 'text-emerald-400' : 'text-emerald-600')} />
            )}
          </div>
          <div>
            <h3
              className={classNames(
                'text-base font-semibold',
                isDark ? 'text-white' : 'text-slate-900'
              )}
            >
              查看冲突
            </h3>
            <p
              className={classNames(
                'text-sm',
                isDark ? 'text-white/60' : 'text-slate-500'
              )}
            >
              {conflictCount > 0 ? `${conflictCount} 项冲突` : config.label}
            </p>
          </div>
        </div>
      </div>

      {/* Resolution status */}
      {(selectedResolution === 'local_selected' || selectedResolution === 'cloud_selected') && (
        <div
          className={classNames(
            'flex items-center gap-2 rounded-lg px-3 py-2',
            isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'
          )}
        >
          <Check className={classNames('h-4 w-4', isDark ? 'text-emerald-400' : 'text-emerald-600')} />
          <p
            className={classNames(
              'text-sm',
              isDark ? 'text-emerald-300' : 'text-emerald-700'
            )}
          >
            {selectedResolution === 'local_selected' ? '已选择保留本地数据' : '已选择使用云端数据'}
          </p>
        </div>
      )}

      {/* Conflict items list */}
      {conflictItems.length > 0 && selectedResolution === 'review_required' && (
        <div className="space-y-2">
          {conflictItems.slice(0, 3).map((item) => (
            <ConflictItemRow
              key={item.id}
              item={item}
              isDark={isDark}
              onReviewDetail={onReviewDetail}
            />
          ))}
          {conflictItems.length > 3 && (
            <p
              className={classNames(
                'text-center text-xs',
                isDark ? 'text-white/40' : 'text-slate-400'
              )}
            >
              还有 {conflictItems.length - 3} 项
            </p>
          )}
        </div>
      )}

      {/* Actions */}
      {selectedResolution === 'review_required' && (
        <div className="flex flex-wrap gap-2">
          {onKeepLocal && (
            <ActionButton
              variant="secondary"
              size="md"
              onClick={onKeepLocal}
              data-testid="ironpath-conflict-keep-local"
            >
              <HardDrive className="h-4 w-4" />
              <span>保留本地</span>
            </ActionButton>
          )}

          {onUseCloud && (
            <ActionButton
              variant="secondary"
              size="md"
              onClick={onUseCloud}
              data-testid="ironpath-conflict-use-cloud"
            >
              <Cloud className="h-4 w-4" />
              <span>使用云端</span>
            </ActionButton>
          )}

          {onDismiss && (
            <ActionButton variant="ghost" size="md" onClick={onDismiss}>
              <span>稍后再说</span>
            </ActionButton>
          )}
        </div>
      )}
    </Card>
  );
}
