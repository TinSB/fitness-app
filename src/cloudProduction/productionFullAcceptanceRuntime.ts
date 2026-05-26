import type { SupabaseClient } from '@supabase/supabase-js';
import { buildAppDataSnapshotHash } from './accountBoundaryLocalInventory';
import {
  type CloudAppDataOwner,
  type CloudAppDataRepositoryCandidateResult,
  type CloudAppDataSnapshotCandidate,
  type WriteCloudAppDataCandidateInput,
} from './cloudAppDataRepositoryCandidate';
import {
  buildCloudParityCheck,
  type Phase21fCloudParityCheckResult,
} from './cloudParityCheck';
import {
  buildCloudReadMirrorVerification,
  type Phase21dCloudReadMirrorVerificationResult,
} from './cloudReadMirrorVerification';
import {
  buildCloudWriteShadowCandidate,
  type Phase21cCloudWriteShadowCandidateResult,
} from './cloudWriteShadowCandidate';
import {
  buildExplicitOptInSyncRuntimeWiring,
  type Phase20dExplicitOptInSyncRuntimeResult,
} from './explicitOptInSyncRuntimeWiring';
import {
  buildFirstUploadExplicitApply,
  type Phase21eFirstUploadExplicitApplyResult,
} from './firstUploadExplicitApply';
import type { Phase20cAuthRuntimeWiringResult } from './authRuntimeWiring';
import type { Phase20bSupabaseProjectRuntimeReadinessResult } from './supabaseProjectRuntimeReadinessCheck';
import {
  getSupabaseAuthRuntimeSharedClient,
  type SupabaseAuthRuntimePublicConfig,
} from './supabaseAuthRuntimeAdapter';
import type { Phase21bLocalBackupDryRunUiResult } from './localBackupDryRunUi';
import type { AppData } from '../models/training-model';

type SupabaseAppDataSnapshotRow<TAppData = unknown> = {
  id: string;
  account_id: string;
  owner_user_id: string;
  device_id: string;
  local_owner_id: string;
  source_snapshot_hash: string;
  schema_version: number;
  operation_id: string;
  app_data: TAppData;
  validation_status: 'valid' | 'invalid' | 'pending_review';
  created_at: string;
};

export type Phase21iProductionFullAcceptanceStatus =
  | 'disabled'
  | 'preflight_not_ready'
  | 'backup_dry_run_not_ready'
  | 'shadow_candidate_blocked'
  | 'cloud_read_blocked'
  | 'conflict_review_required'
  | 'upload_blocked'
  | 'upload_failed'
  | 'parity_failed'
  | 'accepted';

export type Phase21iProductionFullAcceptanceGateway<TAppData = AppData> = {
  readLatestSnapshot: (
    owner: CloudAppDataOwner,
  ) => Promise<CloudAppDataRepositoryCandidateResult<TAppData>>;
  writeSnapshot: (
    input: WriteCloudAppDataCandidateInput<TAppData>,
  ) => Promise<CloudAppDataRepositoryCandidateResult<TAppData>>;
};

export type Phase21iProductionFullAcceptanceInput<TAppData = AppData> = {
  enabled?: boolean;
  readiness?: Phase20bSupabaseProjectRuntimeReadinessResult | null;
  authRuntime?: Phase20cAuthRuntimeWiringResult | null;
  publicConfig?: SupabaseAuthRuntimePublicConfig | null;
  appData?: TAppData | null;
  localBackupDryRunUi?: Phase21bLocalBackupDryRunUiResult | null;
  gateway?: Phase21iProductionFullAcceptanceGateway<TAppData> | null;
  schemaValidator?: (appData: TAppData) => boolean;
  nowIso?: string;
  currentUrl?: string | null;
  uuidFactory?: () => string;
  /**
   * Explicit opt-in escape hatch for when the user has been shown the
   * "发现冲突" review and has actively chosen to overwrite the existing
   * cloud snapshot with their current local AppData. The default safe
   * path (false) keeps the manual review semantics intact. The runtime
   * only honors this flag in the read-mirror review path, never in the
   * post-upload parity check or in any of the safety blockers tied to
   * owner / schema / runtime boundary.
   */
  overrideExistingCloudSnapshot?: boolean;
};

export type Phase21iProductionFullAcceptanceResult<TAppData = AppData> = {
  phase: '21I';
  ok: boolean;
  status: Phase21iProductionFullAcceptanceStatus;
  userMessage: '同步完成' | '发现冲突' | '恢复本地模式' | '开启前先备份';
  blockers: string[];
  shadowCandidate: Phase21cCloudWriteShadowCandidateResult | null;
  readMirrorVerification: Phase21dCloudReadMirrorVerificationResult<TAppData> | null;
  firstUploadApply: Phase21eFirstUploadExplicitApplyResult | null;
  cloudParityCheck: Phase21fCloudParityCheckResult<TAppData> | null;
  syncRuntime: Phase20dExplicitOptInSyncRuntimeResult | null;
  cloudReadAttempted: boolean;
  cloudWriteAttempted: boolean;
  firstUploadSucceeded: boolean;
  cloudReadMirrorMatchesLocal: boolean;
  /**
   * Real, human-readable explanation captured from whichever cloud
   * sub-step failed (read mirror, write, or parity). The fixed
   * userMessage union above is intentionally short for analytics, but
   * the panel needs the actual reason so the user is not stuck behind
   * "恢复本地模式" with no way to know what really went wrong on the
   * Supabase side.
   */
  cloudFailureDetail: string | null;
  localStorageFallbackPreserved: true;
  cloudPrimaryEnabled: false;
  defaultSyncEnabled: false;
  backgroundWorkEnabled: false;
  localStorageDeleted: false;
  sourceOfTruthChanged: false;
  createdAt: string;
};

const selectColumns =
  'id,account_id,owner_user_id,device_id,local_owner_id,source_snapshot_hash,schema_version,operation_id,app_data,validation_status,created_at';

const runtimeBoundaryOff = {
  syncRuntimeEnabled: false,
  liveCloudSyncActivated: false,
  cloudPrimaryEnabled: false,
  defaultSyncEnabled: false,
  backgroundWorkEnabled: false,
  sourceOfTruthChanged: false,
  localStorageDeleted: false,
};

const result = <TAppData>(
  status: CloudAppDataRepositoryCandidateResult<TAppData>['status'],
  message: string,
  options: {
    ok?: boolean;
    errorCode?: CloudAppDataRepositoryCandidateResult<TAppData>['errorCode'];
    snapshot?: CloudAppDataSnapshotCandidate<TAppData> | null;
    manualConfirmationRequired?: boolean;
  } = {},
): CloudAppDataRepositoryCandidateResult<TAppData> => ({
  ok: options.ok ?? false,
  status,
  errorCode: options.errorCode,
  snapshot: options.snapshot ?? null,
  localStorageUnchanged: true,
  sourceOfTruthChanged: false,
  manualConfirmationRequired: options.manualConfirmationRequired ?? false,
  message,
});

const normalizeConfig = (
  publicConfig: SupabaseAuthRuntimePublicConfig | null | undefined,
): Required<SupabaseAuthRuntimePublicConfig> | null => {
  const supabaseUrl = publicConfig?.supabaseUrl?.trim();
  const anonKey = publicConfig?.anonKey?.trim();
  const authCallbackUrl = publicConfig?.authCallbackUrl?.trim();
  const cloudEnvironment = publicConfig?.cloudEnvironment?.trim();
  if (!supabaseUrl || !anonKey || !authCallbackUrl || cloudEnvironment !== 'production') return null;
  try {
    const url = new URL(supabaseUrl);
    if (url.protocol !== 'https:' || !url.hostname.endsWith('.supabase.co')) return null;
  } catch {
    return null;
  }
  return { supabaseUrl, anonKey, authCallbackUrl, cloudEnvironment };
};

const browserHref = () => {
  if (typeof window === 'undefined') return null;
  return window.location.href;
};

const storageSignature = () => {
  if (typeof globalThis.localStorage === 'undefined') return null;
  try {
    return Array.from({ length: globalThis.localStorage.length }, (_, index) => globalThis.localStorage.key(index))
      .filter((key): key is string => Boolean(key))
      .sort()
      .join('|');
  } catch {
    return null;
  }
};

const createUuid = (uuidFactory?: () => string) => {
  if (uuidFactory) return uuidFactory();
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  return '00000000-0000-4000-8000-000000000000';
};

const rowToSnapshot = <TAppData>(
  row: SupabaseAppDataSnapshotRow<TAppData>,
): CloudAppDataSnapshotCandidate<TAppData> => ({
  snapshotId: row.id,
  accountId: row.account_id,
  ownerUserId: row.owner_user_id,
  owner: {
    scope: 'cloud-account-candidate',
    ownerId: row.owner_user_id,
    accountId: row.account_id,
    deviceId: row.device_id,
  },
  appData: row.app_data,
  schemaVersion: String(row.schema_version),
  sourceSnapshotHash: row.source_snapshot_hash,
  operationId: row.operation_id,
  validationStatus: row.validation_status === 'valid' ? 'valid' : 'valid',
  createdAt: row.created_at,
});

const sessionUserId = async (client: SupabaseClient) => {
  const response = await client.auth.getSession();
  if (response.error) return null;
  return response.data.session?.user?.id ?? null;
};

export const createSupabaseAppDataProductionGateway = <TAppData = AppData>(
  input: {
    publicConfig?: SupabaseAuthRuntimePublicConfig | null;
    authRuntime?: Phase20cAuthRuntimeWiringResult | null;
    currentUrl?: string | null;
    uuidFactory?: () => string;
  },
): Phase21iProductionFullAcceptanceGateway<TAppData> => {
  const config = normalizeConfig(input.publicConfig);
  const getClient = () =>
    config ? getSupabaseAuthRuntimeSharedClient(config, input.currentUrl ?? browserHref()) : null;

  const requireSession = async (client: SupabaseClient, owner: CloudAppDataOwner) => {
    if (input.authRuntime?.authenticated !== true || input.authRuntime.user?.userId !== owner.ownerId) return false;
    const userId = await sessionUserId(client);
    return Boolean(userId && userId === owner.ownerId && owner.accountId === owner.ownerId);
  };

  return {
    readLatestSnapshot: async (owner) => {
      const client = getClient();
      if (!client) {
        return result('failed', 'Cloud read is unavailable.', {
          errorCode: 'cloud_adapter_unavailable',
        });
      }

      const beforeStorage = storageSignature();
      try {
        if (!(await requireSession(client, owner))) {
          return result('failed', 'Cloud account session is unavailable.', {
            errorCode: 'cloud_adapter_unavailable',
          });
        }

        const response = await client
          .from('cloud_appdata_snapshots')
          .select(selectColumns)
          .eq('owner_user_id', owner.ownerId)
          .eq('account_id', owner.accountId ?? owner.ownerId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (beforeStorage !== storageSignature()) {
          return result('failed', 'Cloud read changed browser storage and was rejected.', {
            errorCode: 'cloud_adapter_unavailable',
          });
        }

        if (response.error) {
          return result('not_found', 'Cloud AppData snapshot is not available.', {
            errorCode: 'cloud_appdata_not_found',
          });
        }
        if (!response.data) {
          return result('not_found', 'Cloud AppData snapshot is empty.', {
            errorCode: 'cloud_appdata_not_found',
          });
        }
        if ((response.data as SupabaseAppDataSnapshotRow<TAppData>).validation_status !== 'valid') {
          return result('rejected', 'Cloud AppData snapshot is not valid.', {
            errorCode: 'cloud_appdata_invalid',
          });
        }

        return result('read_candidate', 'Cloud AppData snapshot read for explicit verification.', {
          ok: true,
          snapshot: rowToSnapshot(response.data as SupabaseAppDataSnapshotRow<TAppData>),
          manualConfirmationRequired: true,
        });
      } catch {
        return result('failed', 'Cloud read failed safely.', {
          errorCode: 'cloud_adapter_unavailable',
        });
      }
    },
    writeSnapshot: async (writeInput) => {
      if (writeInput.manualConfirmation !== true) {
        return result('rejected', 'Manual confirmation is required before cloud AppData write.', {
          errorCode: 'manual_confirmation_required',
          manualConfirmationRequired: true,
        });
      }

      const client = getClient();
      if (!client) {
        return result('failed', 'Cloud write is unavailable.', {
          errorCode: 'cloud_adapter_unavailable',
        });
      }

      const owner = writeInput.owner;
      const schemaVersion = Number(writeInput.schemaVersion);
      if (!owner.accountId || !Number.isInteger(schemaVersion)) {
        return result('rejected', 'Cloud write owner or schema is invalid.', {
          errorCode: 'cloud_write_rejected',
        });
      }

      const beforeStorage = storageSignature();
      try {
        if (!(await requireSession(client, owner))) {
          return result('failed', 'Cloud account session is unavailable.', {
            errorCode: 'cloud_adapter_unavailable',
          });
        }

        const row: SupabaseAppDataSnapshotRow<TAppData> = {
          id: createUuid(input.uuidFactory),
          account_id: owner.accountId,
          owner_user_id: owner.ownerId,
          device_id: owner.deviceId || createUuid(input.uuidFactory),
          local_owner_id: owner.ownerId,
          source_snapshot_hash: writeInput.sourceSnapshotHash,
          schema_version: schemaVersion,
          operation_id: writeInput.operationId,
          app_data: writeInput.appData,
          validation_status: 'valid',
          created_at: new Date().toISOString(),
        };

        const response = await client
          .from('cloud_appdata_snapshots')
          .insert(row)
          .select(selectColumns)
          .single();

        if (beforeStorage !== storageSignature()) {
          return result('failed', 'Cloud write changed browser storage and was rejected.', {
            errorCode: 'cloud_write_failed',
          });
        }

        if (response.error || !response.data) {
          // Carry the real Supabase response detail through so the panel can
          // surface it instead of the catch-all "恢复本地模式" — this is the
          // signal users need to know the difference between "RLS rejected
          // the insert", "table is missing", "schema_version not an integer"
          // and a transient network failure. Without it the only debugging
          // option is the Safari Web Inspector, which is not available on a
          // standalone PWA on iOS.
          const detail = response.error
            ? `${response.error.code ?? 'error'}:${response.error.message ?? ''}${
                response.error.details ? ` (${response.error.details})` : ''
              }`.trim()
            : 'empty response';
          // eslint-disable-next-line no-console
          console.error('IronPath cloud write failed:', response.error ?? '(no error object)');
          return result('failed', `Cloud AppData write failed: ${detail}`, {
            errorCode: 'cloud_write_failed',
          });
        }
        if ((response.data as SupabaseAppDataSnapshotRow<TAppData>).validation_status !== 'valid') {
          return result('failed', `Cloud AppData write response was not valid (validation_status=${(response.data as SupabaseAppDataSnapshotRow<TAppData>).validation_status})`, {
            errorCode: 'cloud_write_failed',
          });
        }

        return result('write_candidate', 'Cloud AppData snapshot was written after explicit confirmation.', {
          ok: true,
          snapshot: rowToSnapshot(response.data as SupabaseAppDataSnapshotRow<TAppData>),
        });
      } catch {
        return result('failed', 'Cloud write failed safely.', {
          errorCode: 'cloud_write_failed',
        });
      }
    },
  };
};

const ownerFromShadowCandidate = (
  shadowCandidate: Phase21cCloudWriteShadowCandidateResult | null,
): CloudAppDataOwner | null => {
  const accountId = shadowCandidate?.shadowCandidate.accountId;
  const ownerUserId = shadowCandidate?.shadowCandidate.ownerUserId;
  if (!accountId || !ownerUserId) return null;
  return {
    scope: 'cloud-account-candidate',
    ownerId: ownerUserId,
    accountId,
  };
};

const onlyRepositoryMissing = (upload: Phase21eFirstUploadExplicitApplyResult) =>
  upload.blockers.length === 1 && upload.blockers[0] === 'write_repository_unavailable';

const failure = <TAppData>(
  input: {
    status: Phase21iProductionFullAcceptanceStatus;
    userMessage: Phase21iProductionFullAcceptanceResult<TAppData>['userMessage'];
    blockers: string[];
    createdAt: string;
    shadowCandidate?: Phase21cCloudWriteShadowCandidateResult | null;
    readMirrorVerification?: Phase21dCloudReadMirrorVerificationResult<TAppData> | null;
    firstUploadApply?: Phase21eFirstUploadExplicitApplyResult | null;
    cloudParityCheck?: Phase21fCloudParityCheckResult<TAppData> | null;
    cloudFailureDetail?: string | null;
  },
): Phase21iProductionFullAcceptanceResult<TAppData> => ({
  phase: '21I',
  ok: false,
  status: input.status,
  userMessage: input.userMessage,
  blockers: input.blockers,
  shadowCandidate: input.shadowCandidate ?? null,
  readMirrorVerification: input.readMirrorVerification ?? null,
  firstUploadApply: input.firstUploadApply ?? null,
  cloudParityCheck: input.cloudParityCheck ?? null,
  syncRuntime: null,
  cloudReadAttempted: Boolean(input.readMirrorVerification?.cloudReadAttempted || input.cloudParityCheck?.cloudReadAttempted),
  cloudWriteAttempted: Boolean(input.firstUploadApply?.cloudWriteAttempted),
  firstUploadSucceeded: false,
  cloudReadMirrorMatchesLocal: false,
  cloudFailureDetail: input.cloudFailureDetail ?? null,
  localStorageFallbackPreserved: true,
  cloudPrimaryEnabled: false,
  defaultSyncEnabled: false,
  backgroundWorkEnabled: false,
  localStorageDeleted: false,
  sourceOfTruthChanged: false,
  createdAt: input.createdAt,
});

export const runProductionFullAcceptanceSync = async <TAppData = AppData>(
  input: Phase21iProductionFullAcceptanceInput<TAppData> = {},
): Promise<Phase21iProductionFullAcceptanceResult<TAppData>> => {
  const createdAt = input.nowIso ?? new Date().toISOString();
  const schemaValidator = input.schemaValidator ?? (() => true);

  if (input.enabled !== true) {
    return failure({
      status: 'disabled',
      userMessage: '开启前先备份',
      blockers: ['production_acceptance_disabled'],
      createdAt,
    });
  }

  if (
    input.readiness?.readyFor20C !== true ||
    input.authRuntime?.authenticated !== true ||
    !input.authRuntime.user
  ) {
    return failure({
      status: 'preflight_not_ready',
      userMessage: '开启前先备份',
      blockers: ['signed_in_account_missing'],
      createdAt,
    });
  }

  if (input.localBackupDryRunUi?.readyFor21C !== true || input.appData == null) {
    return failure({
      status: 'backup_dry_run_not_ready',
      userMessage: '开启前先备份',
      blockers: ['backup_dry_run_missing'],
      createdAt,
    });
  }

  const shadowCandidate = buildCloudWriteShadowCandidate({
    enabled: true,
    localBackupDryRunUi: input.localBackupDryRunUi,
    appData: input.appData,
    schemaValidator,
    explicitShadowConfirmation: true,
    cloudConflictDetected: false,
    runtimeBoundary: runtimeBoundaryOff,
    nowIso: createdAt,
  });

  if (shadowCandidate.readyFor21D !== true || shadowCandidate.ok !== true) {
    return failure({
      status: 'shadow_candidate_blocked',
      userMessage: '开启前先备份',
      blockers: shadowCandidate.blockers,
      shadowCandidate,
      createdAt,
    });
  }

  const owner = ownerFromShadowCandidate(shadowCandidate);
  if (!owner) {
    return failure({
      status: 'shadow_candidate_blocked',
      userMessage: '开启前先备份',
      blockers: ['owner_missing'],
      shadowCandidate,
      createdAt,
    });
  }

  const gateway = input.gateway ?? createSupabaseAppDataProductionGateway<TAppData>({
    publicConfig: input.publicConfig,
    authRuntime: input.authRuntime,
    currentUrl: input.currentUrl,
    uuidFactory: input.uuidFactory,
  });

  const preUploadRead = await gateway.readLatestSnapshot(owner);
  const readMirrorVerification = buildCloudReadMirrorVerification<TAppData>({
    enabled: true,
    shadowCandidate,
    readRepository: {
      readLatestCloudAppDataCandidate: () => preUploadRead,
    },
    schemaValidator,
    explicitReadMirrorVerification: true,
    runtimeBoundary: runtimeBoundaryOff,
    nowIso: createdAt,
  });

  // Manual review escape hatch:
  //   - default path (overrideExistingCloudSnapshot=false): the existing
  //     conflict review semantic is preserved.
  //   - explicit opt-in: caller (the UI) is allowed to bypass the read
  //     mirror review *only* for the soft "manual_review_required" blocker
  //     (i.e. hash/freshness mismatch with no harder safety issue). Hard
  //     blockers (owner_mismatch, schema_mismatch, cloud_data_invalid)
  //     stay enforced.
  const isOnlySoftReviewBlocker = readMirrorVerification.blockers.length > 0 &&
    readMirrorVerification.blockers.every((blocker) => blocker === 'cloud_read_manual_review');
  const skipManualReview =
    input.overrideExistingCloudSnapshot === true &&
    readMirrorVerification.manualReviewRequired === true &&
    isOnlySoftReviewBlocker;

  if (readMirrorVerification.manualReviewRequired && !skipManualReview) {
    return failure({
      status: 'conflict_review_required',
      userMessage: '发现冲突',
      blockers: readMirrorVerification.blockers,
      shadowCandidate,
      readMirrorVerification,
      createdAt,
    });
  }

  if (!skipManualReview && (readMirrorVerification.readyFor21E !== true || readMirrorVerification.ok !== true)) {
    return failure({
      status: 'cloud_read_blocked',
      userMessage: '恢复本地模式',
      blockers: readMirrorVerification.blockers,
      shadowCandidate,
      readMirrorVerification,
      createdAt,
    });
  }

  const uploadGate = buildFirstUploadExplicitApply<TAppData>({
    enabled: true,
    shadowCandidate,
    readMirrorVerification,
    appData: input.appData,
    schemaValidator,
    writeRepository: null,
    explicitFirstUploadApply: true,
    localStorageFallbackConfirmed: true,
    noSilentOverwriteConfirmed: true,
    backupStillAvailableConfirmed: true,
    runtimeBoundary: runtimeBoundaryOff,
    nowIso: createdAt,
  });

  if (!onlyRepositoryMissing(uploadGate)) {
    return failure({
      status: 'upload_blocked',
      userMessage: '恢复本地模式',
      blockers: uploadGate.blockers,
      shadowCandidate,
      readMirrorVerification,
      firstUploadApply: uploadGate,
      createdAt,
    });
  }

  const writeResult = await gateway.writeSnapshot({
    appData: input.appData,
    owner,
    schemaVersion: String(shadowCandidate.shadowCandidate.schemaVersion),
    sourceSnapshotHash: String(shadowCandidate.shadowCandidate.sourceSnapshotHash),
    operationId: String(shadowCandidate.shadowCandidate.operationId),
    manualConfirmation: true,
  });
  const firstUploadApply = buildFirstUploadExplicitApply<TAppData>({
    enabled: true,
    shadowCandidate,
    readMirrorVerification,
    appData: input.appData,
    schemaValidator,
    writeRepository: {
      writeCloudAppDataCandidate: () => writeResult,
    },
    explicitFirstUploadApply: true,
    localStorageFallbackConfirmed: true,
    noSilentOverwriteConfirmed: true,
    backupStillAvailableConfirmed: true,
    runtimeBoundary: runtimeBoundaryOff,
    nowIso: createdAt,
  });

  if (firstUploadApply.readyFor21F !== true || firstUploadApply.ok !== true) {
    return failure({
      status: 'upload_failed',
      userMessage: '恢复本地模式',
      blockers: firstUploadApply.blockers,
      shadowCandidate,
      readMirrorVerification,
      firstUploadApply,
      // Surface the actual Supabase response message (set by the gateway
      // when it captured response.error) so the user can see WHY the
      // cloud write failed instead of a opaque "恢复本地模式" pill.
      cloudFailureDetail: writeResult.ok ? null : writeResult.message ?? null,
      createdAt,
    });
  }

  const postUploadRead = await gateway.readLatestSnapshot(owner);
  const cloudParityCheck = buildCloudParityCheck<TAppData>({
    enabled: true,
    firstUploadApply,
    appData: input.appData,
    schemaValidator,
    readRepository: {
      readLatestCloudAppDataCandidate: () => postUploadRead,
    },
    explicitCloudReadAfterUpload: true,
    explicitLocalParityCheck: true,
    runtimeBoundary: {
      ...runtimeBoundaryOff,
      syncRuntimeEnabled: firstUploadApply.syncRuntimeEnabled,
    },
    nowIso: createdAt,
  });

  if (cloudParityCheck.readyFor21G !== true || cloudParityCheck.ok !== true) {
    return failure({
      status: cloudParityCheck.conflictReviewRequired ? 'conflict_review_required' : 'parity_failed',
      userMessage: cloudParityCheck.conflictReviewRequired ? '发现冲突' : '恢复本地模式',
      blockers: cloudParityCheck.blockers,
      shadowCandidate,
      readMirrorVerification,
      firstUploadApply,
      cloudParityCheck,
      cloudFailureDetail: postUploadRead.ok ? null : postUploadRead.message ?? null,
      createdAt,
    });
  }

  const syncRuntime = buildExplicitOptInSyncRuntimeWiring({
    enabled: true,
    authRuntime: input.authRuntime,
    explicitOptIn: true,
    manualConfirmation: true,
    localStorageFallbackConfirmed: true,
    noSilentOverwriteConfirmed: true,
    backupBeforeSyncConfirmed: true,
    runtimeBoundary: runtimeBoundaryOff,
    nowIso: createdAt,
  });

  return {
    phase: '21I',
    ok: true,
    status: 'accepted',
    userMessage: '同步完成',
    blockers: [],
    shadowCandidate,
    readMirrorVerification,
    firstUploadApply,
    cloudParityCheck,
    syncRuntime,
    cloudReadAttempted: true,
    cloudWriteAttempted: true,
    firstUploadSucceeded: true,
    cloudReadMirrorMatchesLocal:
      cloudParityCheck.localParityVerified &&
      cloudParityCheck.parity.localSnapshotHash === buildAppDataSnapshotHash(input.appData),
    cloudFailureDetail: null,
    localStorageFallbackPreserved: true,
    cloudPrimaryEnabled: false,
    defaultSyncEnabled: false,
    backgroundWorkEnabled: false,
    localStorageDeleted: false,
    sourceOfTruthChanged: false,
    createdAt,
  };
};
