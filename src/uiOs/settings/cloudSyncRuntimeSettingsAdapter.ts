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
import {
  buildExplicitOptInSyncPreflight,
  type Phase21aExplicitOptInSyncPreflightResult,
} from '../../cloudProduction/explicitOptInSyncPreflight';
import type { Phase21bLocalBackupDryRunUiResult } from '../../cloudProduction/localBackupDryRunUi';

export type CloudSyncSettingsRuntimeCallbacks = {
  onSignIn?: () => void;
  onSignUp?: () => void;
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
  authActionPending?: boolean;
  authErrorMessage?: string | null;
  syncRuntime?: Phase20dExplicitOptInSyncRuntimeResult | null;
  backupDryRun?: Phase20eLocalBackupDryRunResult | null;
  localBackupDryRunUi?: Phase21bLocalBackupDryRunUiResult | null;
  verificationFlow?: Phase20fCloudReadWriteVerificationResult | null;
  conflictOfflineRollback?: Phase20gConflictOfflineRollbackResult | null;
  syncPreflight?: Phase21aExplicitOptInSyncPreflightResult | null;
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

const backupReady = (
  backupDryRun?: Phase20eLocalBackupDryRunResult | null,
  syncRuntime?: Phase20dExplicitOptInSyncRuntimeResult | null,
  localBackupDryRunUi?: Phase21bLocalBackupDryRunUiResult | null,
) =>
  localBackupDryRunUi?.backupReady === true ||
  backupDryRun?.backup.status === 'valid' ||
  backupDryRun?.backup.matchesCurrentLocal === true ||
  syncRuntime?.backupBeforeSyncConfirmed === true;

const dryRunReady = (
  backupDryRun?: Phase20eLocalBackupDryRunResult | null,
  localBackupDryRunUi?: Phase21bLocalBackupDryRunUiResult | null,
) =>
  localBackupDryRunUi?.dryRunReady === true ||
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
  if (!backupReady(input.backupDryRun, input.syncRuntime, input.localBackupDryRunUi)) warnings.push('开启前先备份');
  if (hasConflict(input.verificationFlow, input.conflictOfflineRollback)) warnings.push('冲突需查看后再决定');
  return unique(warnings).slice(0, 3);
};

const authCardProps = (input: CloudSyncSettingsRuntimeInput): CloudAuthCardProps => {
  if (input.authActionPending === true) {
    return {
      authStatus: 'signing_in',
      isSigningIn: true,
    };
  }

  if (input.authErrorMessage) {
    return {
      authStatus: 'error',
      errorMessage: input.authErrorMessage,
      onSignIn: input.onSignIn,
      onSignUp: input.onSignUp,
    };
  }

  if (input.authRuntime?.status === 'adapter_failed' || input.authRuntime?.status === 'runtime_boundary_unsafe') {
    return {
      authStatus: 'error',
      errorMessage: '登录暂不可用',
      onSignIn: input.onSignIn,
      onSignUp: input.onSignUp,
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
    onSignUp: input.onSignUp,
  };
};

const syncStatusProps = (input: CloudSyncSettingsRuntimeInput): SyncStatusCenterProps => {
  const signedIn = hasSignedInUser(input.authRuntime);
  const syncRuntimeEnabled = input.syncRuntime?.syncRuntimeEnabled === true;
  const localBackupReady = backupReady(input.backupDryRun, input.syncRuntime, input.localBackupDryRunUi);
  const localDryRunReady = dryRunReady(input.backupDryRun, input.localBackupDryRunUi);
  const enableSyncAvailable =
    signedIn &&
    !syncRuntimeEnabled &&
    hasReadyPublicConfig(input.readiness) &&
    localBackupReady &&
    localDryRunReady &&
    Boolean(input.onEnableSync);

  return {
    syncRuntimeEnabled,
    readinessStatus: syncReadinessStatus(input),
    lastVerificationAt: input.verificationFlow?.createdAt ?? input.localBackupDryRunUi?.createdAt ?? input.backupDryRun?.createdAt ?? null,
    warnings: syncWarnings(input),
    onEnableSync: enableSyncAvailable ? input.onEnableSync : undefined,
    onViewDetails: input.onViewDetails,
  };
};

const accountSettingsProps = (input: CloudSyncSettingsRuntimeInput): AccountSettingsProps => ({
  accountEmail: accountLabel(input.authRuntime),
  syncOptIn: input.syncRuntime?.syncRuntimeEnabled === true,
  localBackupAvailable: backupReady(input.backupDryRun, input.syncRuntime, input.localBackupDryRunUi),
  serviceRoleExposed: false,
  onSignOut: hasSignedInUser(input.authRuntime) ? input.onSignOut : undefined,
  onToggleSync:
    hasSignedInUser(input.authRuntime) &&
    hasReadyPublicConfig(input.readiness) &&
    backupReady(input.backupDryRun, input.syncRuntime, input.localBackupDryRunUi) &&
    dryRunReady(input.backupDryRun, input.localBackupDryRunUi)
      ? input.onEnableSync
      : undefined,
  onCreateBackup: !backupReady(input.backupDryRun, input.syncRuntime, input.localBackupDryRunUi) ? input.onCreateBackup : undefined,
  onViewSyncDetails: input.syncRuntime?.syncRuntimeEnabled === true ? input.onViewDetails : undefined,
});

const firstSyncFlowProps = (input: CloudSyncSettingsRuntimeInput): FirstSyncFlowProps => {
  const hasBackup = backupReady(input.backupDryRun, input.syncRuntime, input.localBackupDryRunUi);
  const hasDryRun = dryRunReady(input.backupDryRun, input.localBackupDryRunUi);
  const preflight = preflightResult(input);

  return {
    backupReady: hasBackup,
    dryRunReady: hasDryRun,
    preflightReady: preflight.readyFor21B === true,
    explicitOptIn:
      input.syncRuntime?.explicitOptInAccepted === true ||
      input.syncRuntime?.syncRuntimeEnabled === true ||
      Boolean(input.onEnableSync && hasSignedInUser(input.authRuntime)),
    canVerify: hasBackup && hasDryRun && input.verificationFlow?.readyFor20G === true,
    dryRunSummary: input.localBackupDryRunUi
      ? {
          visible: input.localBackupDryRunUi.dryRunPreviewVisible,
          title: input.localBackupDryRunUi.dryRunPreview.title,
          statusLabel: input.localBackupDryRunUi.readyFor21C ? '检查完成' : '继续检查',
          items: input.localBackupDryRunUi.dryRunPreview.items,
          message: input.localBackupDryRunUi.userMessage,
        }
      : undefined,
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

const safePreflightBoundary = {
  syncRuntimeEnabled: false,
  liveCloudSyncActivated: false,
  cloudPrimaryEnabled: false,
  defaultSyncEnabled: false,
  backgroundWorkEnabled: false,
  sourceOfTruthChanged: false,
  localStorageDeleted: false,
};

const preflightResult = (input: CloudSyncSettingsRuntimeInput) =>
  input.syncPreflight ??
  buildExplicitOptInSyncPreflight({
    enabled: true,
    readiness: input.readiness,
    authRuntime: input.authRuntime,
    runtimeBoundary: safePreflightBoundary,
  });

const preflightStatusLabel = (preflight: Phase21aExplicitOptInSyncPreflightResult) => {
  if (preflight.status === 'ready_for_backup_dry_run') return '可以检查';
  if (preflight.status === 'sign_in_required') return '登录后继续';
  if (preflight.status === 'readiness_missing') return '暂不可用';
  if (preflight.status === 'runtime_boundary_unsafe') return '先暂停';
  return '准备中';
};

const syncPreflightProps = (input: CloudSyncSettingsRuntimeInput): CloudSyncSettingsSectionProps['syncPreflight'] => {
  const preflight = preflightResult(input);
  const visible = hasSignedInUser(input.authRuntime) && preflight.syncPreflightVisible;

  return {
    visible,
    title: '同步预检',
    summary: preflight.userMessage,
    primaryLabel: preflight.primaryActionLabel,
    secondaryLabels: preflight.secondaryActionLabels,
    statusLabel: preflightStatusLabel(preflight),
  };
};

export const buildCloudSyncSettingsSectionPropsFromRuntime = (
  input: CloudSyncSettingsRuntimeInput = {},
): CloudSyncSettingsSectionProps => ({
  eyebrow: '账号同步',
  title: '云端同步',
  description: '本地数据仍会保留，本地训练记录不会被覆盖；冲突可保留本地。',
  detailSummaryLabel: '查看同步状态',
  authCard: authCardProps(input),
  syncStatus: syncStatusProps(input),
  accountSettings: accountSettingsProps(input),
  syncPreflight: syncPreflightProps(input),
  firstSyncFlow: firstSyncFlowProps(input),
  conflictReview: conflictReviewProps(input),
  offlineRecovery: offlineRecoveryProps(input),
});
