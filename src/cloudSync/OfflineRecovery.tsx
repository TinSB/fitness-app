import { CheckCircle2, HardDrive, RefreshCcw, WifiOff } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { classNames } from '../engines/engineUtils';
import { ActionButton } from '../ui/ActionButton';
import { Card } from '../ui/Card';
import { useUiTheme } from '../uiOs/theme/UiThemeProvider';

export type OfflineRecoveryState = 'online' | 'offline_available' | 'cloud_unavailable' | 'rollback_available';

export interface OfflineRecoveryProps {
  offlineAvailable: boolean;
  cloudUnavailable: boolean;
  rollbackAvailable: boolean;
  emergencyLocalAvailable: boolean;
  onUseLocal?: () => void;
  onRetryCloud?: () => void;
  onRollback?: () => void;
  onDismiss?: () => void;
}

function getRecoveryState(props: OfflineRecoveryProps): OfflineRecoveryState {
  if (props.rollbackAvailable) return 'rollback_available';
  if (props.cloudUnavailable) return 'cloud_unavailable';
  if (props.offlineAvailable) return 'offline_available';
  return 'online';
}

const stateConfig: Record<
  OfflineRecoveryState,
  { label: string; tone: 'slate' | 'emerald' | 'amber'; Icon: LucideIcon }
> = {
  online: {
    label: '连接正常',
    tone: 'emerald',
    Icon: CheckCircle2,
  },
  offline_available: {
    label: '离线可用',
    tone: 'slate',
    Icon: HardDrive,
  },
  cloud_unavailable: {
    label: '云端暂不可用',
    tone: 'amber',
    Icon: WifiOff,
  },
  rollback_available: {
    label: '可恢复',
    tone: 'amber',
    Icon: RefreshCcw,
  },
};

export function OfflineRecovery({
  offlineAvailable,
  cloudUnavailable,
  rollbackAvailable,
  emergencyLocalAvailable,
  onUseLocal,
  onRetryCloud,
  onRollback,
  onDismiss,
}: OfflineRecoveryProps) {
  const { resolvedTheme } = useUiTheme();
  const isDark = resolvedTheme === 'dark';
  const state = getRecoveryState({ offlineAvailable, cloudUnavailable, rollbackAvailable, emergencyLocalAvailable });
  const config = stateConfig[state];
  const StateIcon = config.Icon;

  return (
    <Card tone={config.tone} padded className="space-y-4" data-testid="ironpath-offline-recovery">
      <div className="flex items-center gap-3">
        <div
          className={classNames(
            'flex h-10 w-10 items-center justify-center rounded-full',
            isDark ? 'bg-white/10' : 'bg-slate-100',
          )}
        >
          <StateIcon
            className={classNames(
              'h-5 w-5',
              state === 'online' && (isDark ? 'text-emerald-300' : 'text-emerald-600'),
              state === 'cloud_unavailable' && (isDark ? 'text-amber-300' : 'text-amber-600'),
              state === 'rollback_available' && (isDark ? 'text-amber-300' : 'text-amber-600'),
              state === 'offline_available' && (isDark ? 'text-white/70' : 'text-slate-500'),
            )}
          />
        </div>
        <div>
          <h3 className={classNames('text-base font-semibold', isDark ? 'text-white' : 'text-slate-900')}>
            {config.label}
          </h3>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {state === 'cloud_unavailable' && onRetryCloud ? (
          <ActionButton variant="secondary" size="md" onClick={onRetryCloud}>
            <RefreshCcw className="h-4 w-4" />
            <span>重试连接</span>
          </ActionButton>
        ) : null}

        {onUseLocal ? (
          <ActionButton
            variant={state === 'cloud_unavailable' ? 'primary' : 'secondary'}
            size="md"
            onClick={onUseLocal}
            data-testid="ironpath-use-local"
          >
            <HardDrive className="h-4 w-4" />
            <span>恢复本地模式</span>
          </ActionButton>
        ) : null}

        {state === 'rollback_available' && onRollback ? (
          <ActionButton variant="secondary" size="md" onClick={onRollback}>
            <RefreshCcw className="h-4 w-4" />
            <span>恢复记录</span>
          </ActionButton>
        ) : null}

        {onDismiss ? (
          <ActionButton variant="ghost" size="md" onClick={onDismiss}>
            <span>稍后再说</span>
          </ActionButton>
        ) : null}
      </div>
    </Card>
  );
}
