import type {
  AccountSettingsProps,
  CloudAuthCardProps,
  CloudSyncSettingsSectionProps,
  ConflictItem,
  ConflictReviewProps,
  FirstSyncFlowProps,
  OfflineRecoveryProps,
  SyncReadinessStatus,
  SyncStatusCenterProps,
} from '../../cloudSync';
import type { Phase20bSupabaseProjectRuntimeReadinessResult } from '../../cloudProduction/supabaseProjectRuntimeReadinessCheck';
import type { Phase20cAuthRuntimeWiringResult } from '../../cloudProduction/authRuntimeWiring';
import type { Phase20dExplicitOptInSyncRuntimeResult } from '../../cloudProduction/explicitOptInSyncRuntimeWiring';
import type { Phase20eLocalBackupDryRunResult } from '../../cloudProduction/localBackupDryRunMigrationRuntimeFlow';
import type { Phase20fCloudReadWriteVerificationResult } from '../../cloudProduction/cloudReadWriteVerificationFlow';
import type { Phase20gConflictOfflineRollbackResult } from '../../cloudProduction/conflictOfflineRollbackRuntimeFlow';

export type CloudSyncSettingsRuntimeCallbacks = {
  onSignIn?: () => void;
  onSignOut?: () => void;
  onEnableSync?: () => void;
  onCreateBackup?: () => void;
  onStartDryRun?: () => void;
  onViewDetails?: () => void;
  onKeepLocal?: () => void;
  onUseCloud?: () => void;
  onReviewConflictDetail?: (itemId: string) => void;
  onUseLocal?: () => void;
  onRetryCloud?: () => void;
};

export type CloudSyncSettingsRuntimeInput = CloudSyncSettingsRuntimeCallbacks & {
  readiness?: Phase20bSupabaseProjectRuntimeReadinessResult | null;
  authRuntime?: Phase20cAuthRuntimeWiringResult | null;
  syncRuntime?: Phase20dExplicitOptInSyncRuntimeResult | null;
  backupDryRun?: Phase20eLocalBackupDryRunResult | null;
  verificationFlow?: Phase20fCloudReadWriteVerificationResult | null;
  conflictOfflineRollback?: Phase20gConflictOfflineRollbackResult | null;
};

const unique = (values: string[]) => [...new Set(values.filter(Boolean))];

const hasReadyPublicConfig = (readiness?: Phase20bSupabaseProjectRuntimeReadinessResult | null) =>
  readiness?.readyFor20C === true &&
  readiness.browserSafeConfigReady === true &&
  readiness.serviceRoleExposed === false &&
  readiness.secretsExposed === false;

const hasSignedInUser = (authRuntime?: Phase20cAuthRuntimeWiringResult | null) =>
  authRuntime?.authenticated === true && Boolean(authRuntime.user);

const accountLabel = (authRuntime?: Phase20cAuthRuntimeWiringResult | null) => {
  if (!hasSignedInUser(authRuntime)) return null;
  return authRuntime?.user?.displayName || authRuntime?.user?.accountId || authRuntime?.user?.userId || null;
};

const backupReady = (backupDryRun?: Phase20eLocalBackupDryRunResult | null, syncRuntime?: Phase20dExplicitOptInSyncRuntimeResult | null) =>
  backupDryRun?.backup.status === 'valid' ||
  backupDryRun?.backup.matchesCurrentLocal === true ||
  syncRuntime?.backupBeforeSyncConfirmed === true;

const dryRunReady = (backupDryRun?: Phase20eLocalBackupDryRunResult | null) =>
  backupDryRun?.readyFor20F === true || backupDryRun?.status === 'ready_for_cloud_verification';

const hasConflict = (
  verificationFlow?: Phase20fCloudReadWriteVerificationResult | null,
  conflictOfflineRollback?: Phase20gConflictOfflineRollbackResult | null,
) =>
  verificationFlow?.status === 'manual_review_required' ||
  verificationFlow?.blockers.includes('cloud_read_manual_review') === true ||
  conflictOfflineRollback?.status === 'conflict_review_missing' ||
  conflictOfflineRollback?.blockers.includes('conflict_review_missing') === true;

const runtimeUnavailable = (readiness?: Phase20bSupabaseProjectRuntimeReadinessResult | null) =>
  Boolean(readiness) && readiness?.readyFor20C !== true;

const syncReadinessStatus = (input: CloudSyncSettingsRuntimeInput): SyncReadinessStatus => {
  if (runtimeUnavailable(input.readiness)) return 'unavailable';
  if (hasConflict(input.verificationFlow, input.conflictOfflineRollback)) return 'needs_review';
  if (input.syncRuntime?.syncRuntimeEnabled === true) return 'ready';
  if (hasSignedInUser(input.authRuntime) && hasReadyPublicConfig(input.readiness)) return 'ready';
  return 'not_enabled';
};

const syncWarnings = (input: CloudSyncSettingsRuntimeInput): string[] => {
  const warnings: string[] = [];
  if (!hasReadyPublicConfig(input.readiness)) warnings.push('登录配置暂不可用');
  if (!hasSignedInUser(input.authRuntime)) warnings.push('登录后再开启同步');
  if (!backupReady(input.backupDryRun, input.syncRuntime)) warnings.push('开启前先备份');
  if (hasConflict(input.verificationFlow, input.conflictOfflineRollback)) warnings.push('冲突需查看后再决定');
  warnings.push('本地数据仍会保留');
  return unique(warnings).slice(0, 3);
};

const authCardProps = (input: CloudSyncSettingsRuntimeInput): CloudAuthCardProps => {
  if (input.authRuntime?.status === 'adapter_failed' || input.authRuntime?.status === 'runtime_boundary_unsafe') {
    return {
      authStatus: 'error',
      errorMessage: '登录暂不可用',
      onSignIn: input.onSignIn,
    };
  }

  if (hasSignedInUser(input.authRuntime)) {
    return {
      authStatus: 'signed_in',
      currentUserEmail: accountLabel(input.authRuntime),
      onSignOut: input.onSignOut,
    };
  }

  return {
    authStatus: 'signed_out',
    onSignIn: input.onSignIn,
  };
};

const syncStatusProps = (input: CloudSyncSettingsRuntimeInput): SyncStatusCenterProps => {
  const signedIn = hasSignedInUser(input.authRuntime);
  const syncRuntimeEnabled = input.syncRuntime?.syncRuntimeEnabled === true;
  const enableSyncAvailable =
    signedIn &&
    !syncRuntimeEnabled &&
    hasReadyPublicConfig(input.readiness) &&
    Boolean(input.onEnableSync);

  return {
    syncRuntimeEnabled,
    readinessStatus: syncReadinessStatus(input),
    lastVerificationAt: input.verificationFlow?.createdAt ?? input.backupDryRun?.createdAt ?? null,
    warnings: syncWarnings(input),
    onEnableSync: enableSyncAvailable ? input.onEnableSync : undefined,
    onViewDetails: input.onViewDetails,
  };
};

const accountSettingsProps = (input: CloudSyncSettingsRuntimeInput): AccountSettingsProps => ({
  accountEmail: accountLabel(input.authRuntime),
  syncOptIn: input.syncRuntime?.syncRuntimeEnabled === true,
  localBackupAvailable: backupReady(input.backupDryRun, input.syncRuntime),
  serviceRoleExposed: false,
  onSignOut: hasSignedInUser(input.authRuntime) ? input.onSignOut : undefined,
  onToggleSync:
    hasSignedInUser(input.authRuntime) &&
    hasReadyPublicConfig(input.readiness) &&
    backupReady(input.backupDryRun, input.syncRuntime)
      ? input.onEnableSync
      : undefined,
  onCreateBackup: !backupReady(input.backupDryRun, input.syncRuntime) ? input.onCreateBackup : undefined,
  onViewSyncDetails: input.syncRuntime?.syncRuntimeEnabled === true ? input.onViewDetails : undefined,
});

const firstSyncFlowProps = (input: CloudSyncSettingsRuntimeInput): FirstSyncFlowProps => {
  const hasBackup = backupReady(input.backupDryRun, input.syncRuntime);
  const hasDryRun = dryRunReady(input.backupDryRun);

  return {
    backupReady: hasBackup,
    dryRunReady: hasDryRun,
    explicitOptIn:
      input.syncRuntime?.explicitOptInAccepted === true ||
      input.syncRuntime?.syncRuntimeEnabled === true ||
      Boolean(input.onEnableSync && hasSignedInUser(input.authRuntime)),
    canVerify: hasBackup && hasDryRun && input.verificationFlow?.readyFor20G === true,
    onCreateBackup: hasBackup ? undefined : input.onCreateBackup,
    onStartDryRun: hasBackup && !hasDryRun ? input.onStartDryRun : undefined,
  };
};

const conflictItems = (input: CloudSyncSettingsRuntimeInput): ConflictItem[] => {
  if (!hasConflict(input.verificationFlow, input.conflictOfflineRollback)) return [];
  return [
    {
      id: 'runtime-conflict-review',
      field: '训练记录',
      localValue: '本地',
      cloudValue: '云端',
    },
  ];
};

const conflictReviewProps = (input: CloudSyncSettingsRuntimeInput): ConflictReviewProps => {
  const showReview = hasConflict(input.verificationFlow, input.conflictOfflineRollback) &&
    Boolean(input.onKeepLocal || input.onUseCloud || input.onReviewConflictDetail);

  return {
    conflictCount: showReview ? conflictItems(input).length : 0,
    conflictItems: showReview ? conflictItems(input) : [],
    selectedResolution: showReview ? 'review_required' : 'none',
    onKeepLocal: showReview ? input.onKeepLocal : undefined,
    onUseCloud: showReview ? input.onUseCloud : undefined,
    onReviewDetail: showReview ? input.onReviewConflictDetail : undefined,
  };
};

const offlineRecoveryProps = (input: CloudSyncSettingsRuntimeInput): OfflineRecoveryProps => {
  const cloudUnavailable =
    runtimeUnavailable(input.readiness) ||
    input.conflictOfflineRollback?.status === 'offline_unavailable' ||
    input.conflictOfflineRollback?.blockers.includes('offline_training_unavailable') === true;

  return {
    offlineAvailable: true,
    cloudUnavailable,
    rollbackAvailable:
      input.conflictOfflineRollback?.rollbackAccepted === true ||
      input.verificationFlow?.localStorageFallbackPreserved === true,
    emergencyLocalAvailable: input.conflictOfflineRollback?.emergencyLocalAccepted !== false,
    onUseLocal: input.onUseLocal,
    onRetryCloud: cloudUnavailable ? input.onRetryCloud : undefined,
  };
};

export const buildCloudSyncSettingsSectionPropsFromRuntime = (
  input: CloudSyncSettingsRuntimeInput = {},
): CloudSyncSettingsSectionProps => ({
  eyebrow: '账号同步',
  title: '云端同步',
  description: '根据当前账号、备份和同步准备状态显示；本地数据仍会保留，本地训练记录不会被覆盖。',
  detailSummaryLabel: '查看同步状态',
  authCard: authCardProps(input),
  syncStatus: syncStatusProps(input),
  accountSettings: accountSettingsProps(input),
  firstSyncFlow: firstSyncFlowProps(input),
  conflictReview: conflictReviewProps(input),
  offlineRecovery: offlineRecoveryProps(input),
});
