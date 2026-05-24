import { Download, Shield, FileCheck, AlertTriangle, Check, Loader2 } from 'lucide-react';
import { classNames } from '../engines/engineUtils';
import { ActionButton } from '../ui/ActionButton';
import { Card } from '../ui/Card';
import { useUiTheme } from '../uiOs/theme/UiThemeProvider';

export type FirstSyncFlowStatus = 'needs_backup' | 'needs_dry_run' | 'ready_to_verify' | 'blocked';

export interface FirstSyncFlowProps {
  backupReady: boolean;
  dryRunReady: boolean;
  explicitOptIn: boolean;
  canVerify: boolean;
  onStartDryRun?: () => void;
  onCreateBackup?: () => void;
  onDismiss?: () => void;
}

function getFlowStatus(props: FirstSyncFlowProps): FirstSyncFlowStatus {
  if (!props.backupReady) return 'needs_backup';
  if (!props.dryRunReady) return 'needs_dry_run';
  if (props.canVerify) return 'ready_to_verify';
  return 'blocked';
}

const statusConfig: Record<FirstSyncFlowStatus, { label: string; tone: 'slate' | 'emerald' | 'amber' | 'rose' }> = {
  needs_backup: { label: '请先备份', tone: 'amber' },
  needs_dry_run: { label: '准备检查', tone: 'slate' },
  ready_to_verify: { label: '可以开始', tone: 'emerald' },
  blocked: { label: '暂不可用', tone: 'rose' },
};

interface StepIndicatorProps {
  completed: boolean;
  active: boolean;
  label: string;
  description: string;
  Icon: typeof Shield;
  isDark: boolean;
}

function StepIndicator({ completed, active, label, description, Icon, isDark }: StepIndicatorProps) {
  return (
    <div className="flex items-start gap-3">
      <div
        className={classNames(
          'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
          completed && (isDark ? 'bg-emerald-500/20' : 'bg-emerald-100'),
          active && !completed && (isDark ? 'bg-white/10' : 'bg-slate-100'),
          !completed && !active && (isDark ? 'bg-white/[0.04]' : 'bg-slate-50')
        )}
      >
        {completed ? (
          <Check className={classNames('h-4 w-4', isDark ? 'text-emerald-400' : 'text-emerald-600')} />
        ) : (
          <Icon
            className={classNames(
              'h-4 w-4',
              active && (isDark ? 'text-white/80' : 'text-slate-600'),
              !active && (isDark ? 'text-white/30' : 'text-slate-400')
            )}
          />
        )}
      </div>
      <div className="flex-1">
        <p
          className={classNames(
            'text-sm font-medium',
            completed && (isDark ? 'text-emerald-300' : 'text-emerald-700'),
            active && !completed && (isDark ? 'text-white' : 'text-slate-900'),
            !completed && !active && (isDark ? 'text-white/50' : 'text-slate-500')
          )}
        >
          {label}
        </p>
        <p
          className={classNames(
            'text-xs',
            isDark ? 'text-white/50' : 'text-slate-500'
          )}
        >
          {description}
        </p>
      </div>
    </div>
  );
}

export function FirstSyncFlow({
  backupReady,
  dryRunReady,
  explicitOptIn,
  canVerify,
  onStartDryRun,
  onCreateBackup,
  onDismiss,
}: FirstSyncFlowProps) {
  const { resolvedTheme } = useUiTheme();
  const isDark = resolvedTheme === 'dark';
  const status = getFlowStatus({ backupReady, dryRunReady, explicitOptIn, canVerify });
  const config = statusConfig[status];

  return (
    <Card
      tone={config.tone}
      padded
      className="space-y-4"
      data-testid="ironpath-first-sync-flow"
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className={classNames(
            'flex h-10 w-10 items-center justify-center rounded-full',
            isDark ? 'bg-white/10' : 'bg-slate-100'
          )}
        >
          <Download
            className={classNames(
              'h-5 w-5',
              isDark ? 'text-white/70' : 'text-slate-500'
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
            首次同步
          </h3>
          <p
            className={classNames(
              'text-sm',
              isDark ? 'text-white/60' : 'text-slate-500'
            )}
          >
            {config.label}
          </p>
        </div>
      </div>

      {/* Info message */}
      <div
        className={classNames(
          'rounded-lg px-3 py-2',
          isDark ? 'bg-white/[0.06]' : 'bg-slate-50'
        )}
      >
        <p
          className={classNames(
            'text-sm leading-relaxed',
            isDark ? 'text-white/70' : 'text-slate-600'
          )}
        >
          开启前先备份
        </p>
        <p
          className={classNames(
            'text-sm leading-relaxed',
            isDark ? 'text-white/50' : 'text-slate-500'
          )}
        >
          本地数据仍会保留
        </p>
      </div>

      {/* Steps */}
      <div className="space-y-3" data-testid="ironpath-backup-before-sync">
        <StepIndicator
          completed={backupReady}
          active={!backupReady}
          label="备份本地数据"
          description="确保训练记录安全"
          Icon={Shield}
          isDark={isDark}
        />
        <StepIndicator
          completed={dryRunReady}
          active={backupReady && !dryRunReady}
          label="检查同步内容"
          description="查看后再决定"
          Icon={FileCheck}
          isDark={isDark}
          data-testid="ironpath-dry-run-before-sync"
        />
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        {!backupReady && onCreateBackup && (
          <ActionButton
            variant="primary"
            size="md"
            onClick={onCreateBackup}
          >
            <Shield className="h-4 w-4" />
            <span>开始备份</span>
          </ActionButton>
        )}

        {backupReady && !dryRunReady && onStartDryRun && (
          <ActionButton
            variant="primary"
            size="md"
            onClick={onStartDryRun}
          >
            <FileCheck className="h-4 w-4" />
            <span>检查内容</span>
          </ActionButton>
        )}

        {onDismiss && (
          <ActionButton variant="ghost" size="md" onClick={onDismiss}>
            <span>稍后再说</span>
          </ActionButton>
        )}
      </div>
    </Card>
  );
}
