import { Cloud, CloudOff, HardDrive, LogOut, Shield, User } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { classNames } from '../engines/engineUtils';
import { ActionButton } from '../ui/ActionButton';
import { Card } from '../ui/Card';
import { useUiTheme } from '../uiOs/theme/UiThemeProvider';

export type AccountSettingsState = 'signed_in' | 'sync_off' | 'sync_opted_in' | 'needs_backup';

export interface AccountSettingsProps {
  accountEmail: string | null;
  syncOptIn: boolean;
  localBackupAvailable: boolean;
  serviceRoleExposed?: boolean;
  onSignOut?: () => void;
  onToggleSync?: () => void;
  onCreateBackup?: () => void;
  onViewSyncDetails?: () => void;
}

function getAccountState(props: AccountSettingsProps): AccountSettingsState {
  if (!props.localBackupAvailable) return 'needs_backup';
  if (props.syncOptIn) return 'sync_opted_in';
  if (props.accountEmail) return 'signed_in';
  return 'sync_off';
}

const stateConfig: Record<AccountSettingsState, { tone: 'slate' | 'emerald' | 'amber' }> = {
  signed_in: { tone: 'slate' },
  sync_off: { tone: 'slate' },
  sync_opted_in: { tone: 'emerald' },
  needs_backup: { tone: 'amber' },
};

interface SettingRowProps {
  icon: LucideIcon;
  label: string;
  value: string;
  status?: 'on' | 'off' | 'warning';
  isDark: boolean;
}

function SettingRow({ icon: Icon, label, value, status, isDark }: SettingRowProps) {
  return (
    <div className={classNames('flex items-center justify-between gap-3 rounded-lg px-3 py-2.5', isDark ? 'bg-white/[0.04]' : 'bg-slate-50')}>
      <div className="flex items-center gap-3">
        <Icon
          className={classNames(
            'h-4 w-4 shrink-0',
            status === 'on' && (isDark ? 'text-emerald-400' : 'text-emerald-600'),
            status === 'off' && (isDark ? 'text-white/40' : 'text-slate-400'),
            status === 'warning' && (isDark ? 'text-amber-400' : 'text-amber-600'),
            !status && (isDark ? 'text-white/50' : 'text-slate-500'),
          )}
        />
        <span className={classNames('text-sm', isDark ? 'text-white/80' : 'text-slate-700')}>
          {label}
        </span>
      </div>
      <span
        className={classNames(
          'text-sm font-medium',
          status === 'on' && (isDark ? 'text-emerald-400' : 'text-emerald-600'),
          status === 'off' && (isDark ? 'text-white/50' : 'text-slate-500'),
          status === 'warning' && (isDark ? 'text-amber-400' : 'text-amber-600'),
          !status && (isDark ? 'text-white' : 'text-slate-900'),
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function AccountSettings({
  accountEmail,
  syncOptIn,
  localBackupAvailable,
  serviceRoleExposed = false,
  onSignOut,
  onToggleSync,
  onCreateBackup,
  onViewSyncDetails,
}: AccountSettingsProps) {
  const { resolvedTheme } = useUiTheme();
  const isDark = resolvedTheme === 'dark';
  const state = getAccountState({ accountEmail, syncOptIn, localBackupAvailable });
  const config = stateConfig[state];

  if (serviceRoleExposed) return null;

  return (
    <Card tone={config.tone} padded className="space-y-4" data-testid="ironpath-account-settings">
      <div className="flex items-center gap-3">
        <div
          className={classNames(
            'flex h-10 w-10 items-center justify-center rounded-full',
            isDark ? 'bg-white/10' : 'bg-slate-100',
          )}
        >
          <User className={classNames('h-5 w-5', isDark ? 'text-white/70' : 'text-slate-500')} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className={classNames('text-base font-semibold', isDark ? 'text-white' : 'text-slate-900')}>
            账号设置
          </h3>
          {accountEmail ? (
            <p
              className={classNames('truncate text-sm', isDark ? 'text-white/60' : 'text-slate-500')}
              data-testid="ironpath-account-email"
            >
              {accountEmail}
            </p>
          ) : null}
        </div>
      </div>

      <div className="space-y-2">
        <SettingRow
          icon={syncOptIn ? Cloud : CloudOff}
          label="云端同步"
          value={syncOptIn ? '已选择开启' : '未开启'}
          status={syncOptIn ? 'on' : 'off'}
          isDark={isDark}
        />
        <SettingRow
          icon={HardDrive}
          label="本地备份"
          value={localBackupAvailable ? '可用' : '未创建'}
          status={localBackupAvailable ? 'on' : 'warning'}
          isDark={isDark}
        />
      </div>

      {!localBackupAvailable ? (
        <div className={classNames('rounded-lg px-3 py-2', isDark ? 'bg-white/[0.06]' : 'bg-slate-50')}>
          <p className={classNames('text-sm leading-relaxed', isDark ? 'text-amber-300/80' : 'text-amber-700')}>
            开启前先备份
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {!localBackupAvailable && onCreateBackup ? (
          <ActionButton variant="primary" size="md" onClick={onCreateBackup}>
            <Shield className="h-4 w-4" />
            <span>创建备份</span>
          </ActionButton>
        ) : null}

        {localBackupAvailable && onToggleSync ? (
          <ActionButton variant={syncOptIn ? 'secondary' : 'primary'} size="md" onClick={onToggleSync}>
            {syncOptIn ? <CloudOff className="h-4 w-4" /> : <Cloud className="h-4 w-4" />}
            <span>{syncOptIn ? '关闭同步' : '开启同步'}</span>
          </ActionButton>
        ) : null}

        {syncOptIn && onViewSyncDetails ? (
          <ActionButton variant="secondary" size="md" onClick={onViewSyncDetails}>
            <span>同步详情</span>
          </ActionButton>
        ) : null}

        {accountEmail && onSignOut ? (
          <ActionButton variant="ghost" size="md" onClick={onSignOut} data-testid="ironpath-account-sign-out">
            <LogOut className="h-4 w-4" />
            <span>退出登录</span>
          </ActionButton>
        ) : null}
      </div>
    </Card>
  );
}
