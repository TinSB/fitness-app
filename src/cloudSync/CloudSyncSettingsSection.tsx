import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Cloud,
  CloudOff,
  Loader2,
  LogOut,
  RefreshCw,
  Shield,
  User,
  UserPlus,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { CloudAuthCard } from './CloudAuthCard';
import { ConflictReview, type ConflictItem } from './ConflictReview';
import { FirstSyncFlow } from './FirstSyncFlow';
import { OfflineRecovery } from './OfflineRecovery';
import type { AccountSettingsProps } from './AccountSettings';
import type { CloudAuthCardProps, CloudAuthMode, CloudAuthStatus } from './CloudAuthCard';
import type { ConflictReviewProps } from './ConflictReview';
import type { FirstSyncFlowProps } from './FirstSyncFlow';
import type { OfflineRecoveryProps } from './OfflineRecovery';
import type { SyncReadinessStatus, SyncStatusCenterProps } from './SyncStatusCenter';
import { classNames } from '../engines/engineUtils';
import { ActionButton } from '../ui/ActionButton';
import { Card, type UiTone } from '../ui/Card';
import { useUiTheme } from '../uiOs/theme/UiThemeProvider';

const previewConflictItems: ConflictItem[] = [
  {
    id: 'preview-conflict-training-log',
    field: '训练记录',
    localValue: '本地',
    cloudValue: '云端',
  },
];

export interface CloudSyncSettingsSectionProps {
  authCard?: CloudAuthCardProps;
  syncStatus?: SyncStatusCenterProps;
  accountSettings?: AccountSettingsProps;
  firstSyncFlow?: FirstSyncFlowProps;
  conflictReview?: ConflictReviewProps;
  offlineRecovery?: OfflineRecoveryProps;
  syncPreflight?: {
    visible: boolean;
    title: string;
    summary: string;
    primaryLabel: string;
    secondaryLabels: string[];
    statusLabel: string;
  };
  eyebrow?: string;
  title?: string;
  description?: string;
  detailSummaryLabel?: string;
}

type CompactStatusConfig = {
  label: string;
  tone: UiTone;
  Icon: LucideIcon;
};

const defaultPreviewProps = (): Required<CloudSyncSettingsSectionProps> => ({
  eyebrow: '',
  title: '',
  description: '',
  detailSummaryLabel: '更多',
  authCard: {
    authStatus: 'signed_out',
    authMode: 'sign_in',
    onAuthModeChange: () => undefined,
    onEmailInputChange: () => undefined,
    onPasswordInputChange: () => undefined,
    onSignIn: () => undefined,
    onSignUp: () => undefined,
  },
  syncStatus: {
    syncRuntimeEnabled: false,
    readinessStatus: 'not_enabled',
    warnings: ['开启前先备份'],
  },
  accountSettings: {
    accountEmail: null,
    syncOptIn: false,
    localBackupAvailable: false,
  },
  firstSyncFlow: {
    backupReady: false,
    dryRunReady: false,
    explicitOptIn: false,
    canVerify: false,
  },
  conflictReview: {
    conflictCount: 1,
    conflictItems: previewConflictItems,
    selectedResolution: 'review_required',
  },
  offlineRecovery: {
    offlineAvailable: true,
    cloudUnavailable: true,
    rollbackAvailable: false,
    emergencyLocalAvailable: true,
  },
  syncPreflight: {
    visible: false,
    title: '同步预检',
    summary: '',
    primaryLabel: '检查本地数据',
    secondaryLabels: ['开启前先备份', '查看将同步的内容'],
    statusLabel: '准备中',
  },
});

const authStatusLabel = (status: CloudAuthStatus, mode: CloudAuthMode) => {
  if (status === 'signed_out') return '未登录';
  if (status === 'signing_in') return '登录中';
  if (status === 'signed_in') return '已登录';
  return mode === 'sign_up' ? '创建失败' : '登录失败';
};

const compactStatusConfig: Record<SyncReadinessStatus, CompactStatusConfig> = {
  not_enabled: { label: '未开启', tone: 'slate', Icon: CloudOff },
  ready: { label: '可开启', tone: 'emerald', Icon: CheckCircle2 },
  needs_review: { label: '需确认', tone: 'amber', Icon: AlertTriangle },
  unavailable: { label: '不可用', tone: 'rose', Icon: CloudOff },
};

const statusClassName = (tone: UiTone, isDark: boolean) =>
  classNames(
    tone === 'emerald' && (isDark ? 'bg-emerald-400/15 text-emerald-200' : 'bg-emerald-100 text-emerald-700'),
    tone === 'amber' && (isDark ? 'bg-amber-400/15 text-amber-100' : 'bg-amber-100 text-amber-700'),
    tone === 'rose' && (isDark ? 'bg-rose-400/15 text-rose-100' : 'bg-rose-100 text-rose-700'),
    tone === 'slate' && (isDark ? 'bg-white/10 text-white/60' : 'bg-slate-100 text-slate-500'),
  );

const panelTone = (
  authCard: CloudAuthCardProps,
  syncStatus: SyncStatusCenterProps,
): UiTone => {
  if (authCard.authStatus === 'error' || syncStatus.readinessStatus === 'unavailable') return 'rose';
  if (syncStatus.readinessStatus === 'needs_review') return 'amber';
  if (syncStatus.syncRuntimeEnabled) return 'emerald';
  return 'slate';
};

function statusLabel(syncStatus: SyncStatusCenterProps) {
  return syncStatus.syncRuntimeEnabled ? '已开启' : compactStatusConfig[syncStatus.readinessStatus].label;
}

function ToggleSwitch({
  checked,
  disabled,
  onClick,
}: {
  checked: boolean;
  disabled: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      aria-label={checked ? '关闭同步' : '开启同步'}
      disabled={disabled}
      onClick={onClick}
      className={classNames(
        'relative h-7 w-12 shrink-0 rounded-full border transition',
        // Visual contract:
        //   - checked (sync on): emerald solid
        //   - !checked && !disabled (ready to enable): emerald-tinted so the
        //     user knows the toggle is now actionable; this fixes the
        //     "everything is green-checked but the toggle still looks dead"
        //     state reported on iOS.
        //   - disabled: muted white + opacity-55 + not-allowed cursor.
        disabled
          ? 'cursor-not-allowed border-white/10 bg-white/10 opacity-55'
          : checked
            ? 'border-emerald-300/60 bg-emerald-400/55'
            : 'border-emerald-300/50 bg-emerald-500/20 hover:bg-emerald-500/30',
      )}
      data-testid="ironpath-cloud-sync-toggle"
    >
      <span
        className={classNames(
          'absolute top-1 h-5 w-5 rounded-full bg-white shadow transition',
          checked ? 'left-6' : 'left-1',
        )}
      />
    </button>
  );
}

function SignedInSyncFlow({
  authCard,
  accountSettings,
  firstSyncFlow,
  syncStatus,
  isDark,
}: {
  authCard: CloudAuthCardProps;
  accountSettings: AccountSettingsProps;
  firstSyncFlow: FirstSyncFlowProps;
  syncStatus: SyncStatusCenterProps;
  isDark: boolean;
}) {
  const canToggle = Boolean(accountSettings.onToggleSync) && accountSettings.localBackupAvailable;
  const needsBackup = !accountSettings.localBackupAvailable && Boolean(accountSettings.onCreateBackup);
  const needsDryRun =
    accountSettings.localBackupAvailable &&
    firstSyncFlow.backupReady &&
    !firstSyncFlow.dryRunReady &&
    Boolean(firstSyncFlow.onStartDryRun);
  const visibleWarnings = [...(syncStatus.warnings ?? []), ...(syncStatus.blockers ?? [])]
    .filter((item) => item !== '登录后再开启同步')
    .slice(0, 2);

  return (
    <div className="space-y-3" data-testid="ironpath-account-settings">
      {accountSettings.accountEmail || authCard.currentUserEmail ? (
        <div className={classNames('rounded-lg px-3 py-2', isDark ? 'bg-white/[0.05]' : 'bg-slate-50')}>
          <p className={classNames('truncate text-sm font-medium', isDark ? 'text-white/90' : 'text-slate-700')} data-testid="ironpath-account-email">
            {accountSettings.accountEmail ?? authCard.currentUserEmail}
          </p>
        </div>
      ) : null}

      <div className={classNames('flex items-center justify-between gap-3 rounded-lg px-3 py-3', isDark ? 'bg-white/[0.055]' : 'bg-slate-50')}>
        <div className="flex min-w-0 items-center gap-3">
          <Cloud className={classNames('h-5 w-5 shrink-0', accountSettings.syncOptIn ? 'text-emerald-300' : isDark ? 'text-white/45' : 'text-slate-400')} />
          <div className="min-w-0">
            <p className={classNames('text-sm font-semibold', isDark ? 'text-white' : 'text-slate-900')}>云同步</p>
            <p className={classNames('text-xs', accountSettings.syncOptIn ? 'text-emerald-300' : isDark ? 'text-white/45' : 'text-slate-500')}>
              {accountSettings.syncOptIn ? '已开启' : '未开启'}
            </p>
          </div>
        </div>
        <ToggleSwitch
          checked={accountSettings.syncOptIn}
          disabled={!canToggle}
          onClick={canToggle ? accountSettings.onToggleSync : undefined}
        />
      </div>

      {visibleWarnings.length ? (
        <div className="flex flex-wrap gap-1.5" data-testid="ironpath-sync-inline-warnings">
          {visibleWarnings.map((warning) => (
            <span
              key={warning}
              className={classNames('rounded-full px-2.5 py-1 text-xs font-semibold', isDark ? 'bg-amber-400/12 text-amber-100' : 'bg-amber-100 text-amber-700')}
            >
              {warning}
            </span>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {needsBackup ? (
          <ActionButton variant="primary" size="md" onClick={accountSettings.onCreateBackup}>
            <Shield className="h-4 w-4" />
            <span>创建备份</span>
          </ActionButton>
        ) : null}

        {needsDryRun ? (
          <ActionButton variant="primary" size="md" onClick={firstSyncFlow.onStartDryRun}>
            <RefreshCw className="h-4 w-4" />
            <span>查看将同步的内容</span>
          </ActionButton>
        ) : null}

        {accountSettings.syncOptIn && accountSettings.onViewSyncDetails ? (
          <ActionButton variant="secondary" size="md" onClick={accountSettings.onViewSyncDetails}>
            <span>同步详情</span>
          </ActionButton>
        ) : null}

        {(accountSettings.accountEmail || authCard.currentUserEmail) && authCard.onSignOut ? (
          <ActionButton variant="ghost" size="md" onClick={authCard.onSignOut} data-testid="ironpath-account-sign-out">
            <LogOut className="h-4 w-4" />
            <span className="sr-only" data-testid="ironpath-auth-sign-out">
              退出登录
            </span>
            <span>退出登录</span>
          </ActionButton>
        ) : null}
      </div>
    </div>
  );
}

export function CloudSyncSettingsSection(props: CloudSyncSettingsSectionProps = {}) {
  const preview = defaultPreviewProps();
  const authCard = props.authCard ?? preview.authCard;
  const syncStatus = props.syncStatus ?? preview.syncStatus;
  const accountSettings = props.accountSettings ?? preview.accountSettings;
  const firstSyncFlow = props.firstSyncFlow ?? preview.firstSyncFlow;
  const conflictReview = props.conflictReview ?? preview.conflictReview;
  const offlineRecovery = props.offlineRecovery ?? preview.offlineRecovery;
  const syncPreflight = props.syncPreflight ?? preview.syncPreflight;
  const { resolvedTheme } = useUiTheme();
  const isDark = resolvedTheme === 'dark';
  const authMode = authCard.authMode ?? 'sign_in';
  const signedIn = authCard.authStatus === 'signed_in';
  const statusMeta = syncStatus.syncRuntimeEnabled
    ? { label: '已开启', tone: 'emerald' as UiTone, Icon: Cloud }
    : compactStatusConfig[syncStatus.readinessStatus];
  const StatusIcon = statusMeta.Icon;
  const AuthIcon =
    authCard.authStatus === 'signing_in'
      ? Loader2
      : authCard.authStatus === 'error'
        ? AlertCircle
        : authMode === 'sign_up' && authCard.authStatus !== 'signed_in'
          ? UserPlus
          : User;
  const flowTitle = signedIn ? '已登录' : authMode === 'sign_up' ? '创建账号' : '登录账号';
  const showDetailDrawer =
    firstSyncFlow.dryRunSummary?.visible === true ||
    conflictReview.conflictCount > 0 ||
    offlineRecovery.cloudUnavailable === true ||
    offlineRecovery.rollbackAvailable === true;

  if (accountSettings.serviceRoleExposed) return null;

  return (
    <section className="space-y-3" data-testid="ironpath-cloud-sync-settings-section">
      <Card tone={panelTone(authCard, syncStatus)} padded className="space-y-4" data-testid="ironpath-account-sync-flow">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className={classNames('grid h-10 w-10 shrink-0 place-items-center rounded-full', isDark ? 'bg-white/10' : 'bg-slate-100')}>
              <AuthIcon className={classNames('h-5 w-5', authCard.authStatus === 'signing_in' && 'animate-spin', isDark ? 'text-white/70' : 'text-slate-500')} />
            </div>
            <div className="min-w-0">
              <h3 className={classNames('text-base font-semibold', isDark ? 'text-white' : 'text-slate-900')}>
                {flowTitle}
              </h3>
              <p
                className={classNames('truncate text-sm', isDark ? 'text-white/55' : 'text-slate-500')}
                data-testid="ironpath-auth-status"
              >
                {authStatusLabel(authCard.authStatus, authMode)}
              </p>
            </div>
          </div>

          <div
            className={classNames('inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold', statusClassName(statusMeta.tone, isDark))}
            data-testid="ironpath-sync-status-center"
            aria-label={`同步状态：${statusLabel(syncStatus)}`}
          >
            <StatusIcon className="h-3.5 w-3.5" aria-hidden="true" />
            <span data-testid="ironpath-sync-status-message">{statusMeta.label}</span>
          </div>
        </div>

        {signedIn ? (
          <SignedInSyncFlow
            authCard={authCard}
            accountSettings={accountSettings}
            firstSyncFlow={firstSyncFlow}
            syncStatus={syncStatus}
            isDark={isDark}
          />
        ) : (
          <CloudAuthCard {...authCard} variant="embedded" hideHeader />
        )}

        {signedIn && syncPreflight.visible ? (
          <div
            className={classNames('rounded-lg px-3 py-2', isDark ? 'bg-white/[0.05]' : 'bg-slate-50')}
            data-testid="ironpath-explicit-sync-preflight"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className={classNames('text-sm font-semibold', isDark ? 'text-white/80' : 'text-slate-800')}>
                {syncPreflight.primaryLabel}
              </span>
              <span className={classNames('rounded-full px-2 py-1 text-xs font-semibold', isDark ? 'bg-white/10 text-white/55' : 'bg-slate-100 text-slate-500')}>
                {syncPreflight.statusLabel}
              </span>
            </div>
          </div>
        ) : null}
      </Card>

      {showDetailDrawer ? (
        <details className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
          <summary className="cursor-pointer text-sm font-semibold text-white/72">
            {props.detailSummaryLabel ?? preview.detailSummaryLabel}
          </summary>
          <div className="mt-4 grid gap-4">
            {firstSyncFlow.dryRunSummary?.visible ? <FirstSyncFlow {...firstSyncFlow} /> : null}
            {conflictReview.conflictCount > 0 ? <ConflictReview {...conflictReview} /> : null}
            {offlineRecovery.cloudUnavailable || offlineRecovery.rollbackAvailable ? <OfflineRecovery {...offlineRecovery} /> : null}
          </div>
        </details>
      ) : null}
    </section>
  );
}
