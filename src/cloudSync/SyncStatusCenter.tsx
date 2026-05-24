import { Cloud, CloudOff, CheckCircle2, AlertTriangle, RefreshCw, Loader2 } from 'lucide-react';
import { classNames } from '../engines/engineUtils';
import { ActionButton } from '../ui/ActionButton';
import { Card } from '../ui/Card';
import { useUiTheme } from '../uiOs/theme/UiThemeProvider';

export type SyncReadinessStatus = 'not_enabled' | 'ready' | 'needs_review' | 'unavailable';

export interface SyncStatusCenterProps {
  syncRuntimeEnabled: boolean;
  readinessStatus: SyncReadinessStatus;
  lastVerificationAt?: string | null;
  blockers?: string[];
  warnings?: string[];
  onEnableSync?: () => void;
  onViewDetails?: () => void;
}

const statusConfig: Record<SyncReadinessStatus, { label: string; tone: 'slate' | 'emerald' | 'amber' | 'rose'; Icon: typeof Cloud }> = {
  not_enabled: { label: '同步未开启', tone: 'slate', Icon: CloudOff },
  ready: { label: '同步就绪', tone: 'emerald', Icon: CheckCircle2 },
  needs_review: { label: '需要确认', tone: 'amber', Icon: AlertTriangle },
  unavailable: { label: '暂不可用', tone: 'rose', Icon: CloudOff },
};

function formatVerificationTime(isoString: string | null | undefined): string {
  if (!isoString) return '从未';
  try {
    const date = new Date(isoString);
    return date.toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '从未';
  }
}

export function SyncStatusCenter({
  syncRuntimeEnabled,
  readinessStatus,
  lastVerificationAt,
  blockers = [],
  warnings = [],
  onEnableSync,
  onViewDetails,
}: SyncStatusCenterProps) {
  const { resolvedTheme } = useUiTheme();
  const isDark = resolvedTheme === 'dark';
  const config = statusConfig[readinessStatus];
  const StatusIcon = config.Icon;

  return (
    <Card
      tone={config.tone}
      padded
      className="space-y-4"
      data-testid="ironpath-sync-status-center"
    >
      {/* Header with status pill */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={classNames(
              'flex h-10 w-10 items-center justify-center rounded-full',
              isDark ? 'bg-white/10' : 'bg-slate-100'
            )}
          >
            <StatusIcon
              className={classNames(
                'h-5 w-5',
                readinessStatus === 'ready' && (isDark ? 'text-emerald-300' : 'text-emerald-600'),
                readinessStatus === 'needs_review' && (isDark ? 'text-amber-300' : 'text-amber-600'),
                readinessStatus === 'unavailable' && (isDark ? 'text-rose-300' : 'text-rose-600'),
                readinessStatus === 'not_enabled' && (isDark ? 'text-white/50' : 'text-slate-400')
              )}
            />
          </div>
          <div>
            <h3
              className={classNames(
                'text-base font-semibold',
                isDark ? 'text-white' : 'text-slate-900'
              )}
            >
              同步状态
            </h3>
            <p
              className={classNames(
                'text-sm',
                isDark ? 'text-white/60' : 'text-slate-500'
              )}
              data-testid="ironpath-sync-status-message"
            >
              {config.label}
            </p>
          </div>
        </div>

        {/* Status pill */}
        <span
          className={classNames(
            'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium',
            readinessStatus === 'ready' && (isDark ? 'bg-emerald-400/15 text-emerald-300' : 'bg-emerald-100 text-emerald-700'),
            readinessStatus === 'needs_review' && (isDark ? 'bg-amber-400/15 text-amber-300' : 'bg-amber-100 text-amber-700'),
            readinessStatus === 'unavailable' && (isDark ? 'bg-rose-400/15 text-rose-300' : 'bg-rose-100 text-rose-700'),
            readinessStatus === 'not_enabled' && (isDark ? 'bg-white/10 text-white/60' : 'bg-slate-100 text-slate-500')
          )}
          data-testid="ironpath-sync-status-pill"
        >
          {syncRuntimeEnabled ? '已开启' : '未开启'}
        </span>
      </div>

      {/* Info messages */}
      <div className="space-y-2">
        <p
          className={classNames(
            'text-sm leading-relaxed',
            isDark ? 'text-white/70' : 'text-slate-600'
          )}
        >
          本地数据仍会保留
        </p>
        <p
          className={classNames(
            'text-sm leading-relaxed',
            isDark ? 'text-white/50' : 'text-slate-500'
          )}
        >
          不会自动覆盖本地训练记录
        </p>

        {lastVerificationAt && (
          <p
            className={classNames(
              'text-xs',
              isDark ? 'text-white/40' : 'text-slate-400'
            )}
          >
            上次检查：{formatVerificationTime(lastVerificationAt)}
          </p>
        )}
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div
          className={classNames(
            'space-y-1 rounded-lg px-3 py-2',
            isDark ? 'bg-amber-400/10' : 'bg-amber-50'
          )}
        >
          {warnings.map((warning, index) => (
            <p
              key={index}
              className={classNames(
                'text-sm',
                isDark ? 'text-amber-200' : 'text-amber-700'
              )}
            >
              {warning}
            </p>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        {!syncRuntimeEnabled && onEnableSync && (
          <ActionButton
            variant="primary"
            size="md"
            onClick={onEnableSync}
          >
            <Cloud className="h-4 w-4" />
            <span>开启同步</span>
          </ActionButton>
        )}

        {onViewDetails && (
          <ActionButton
            variant={syncRuntimeEnabled ? 'primary' : 'secondary'}
            size="md"
            onClick={onViewDetails}
          >
            <RefreshCw className="h-4 w-4" />
            <span>查看详情</span>
          </ActionButton>
        )}
      </div>
    </Card>
  );
}
