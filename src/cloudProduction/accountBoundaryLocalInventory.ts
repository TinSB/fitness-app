import type { AppData } from '../models/training-model';
import { validateAppDataSchema } from '../storage/appDataValidation';

export type Phase19AccountOwnerScope = 'anonymous-local' | 'device-local' | 'cloud-account-candidate';

export type Phase19AccountBoundaryStatus =
  | 'ready_for_migration_dry_run'
  | 'missing_local_data'
  | 'local_schema_invalid'
  | 'account_candidate_incomplete'
  | 'owner_mismatch'
  | 'backup_required'
  | 'backup_invalid'
  | 'backup_mismatch';

export type Phase19AccountBoundaryBlockingError =
  | 'missing_local_data'
  | 'local_schema_invalid'
  | 'account_candidate_incomplete'
  | 'owner_mismatch'
  | 'backup_missing'
  | 'backup_invalid'
  | 'backup_mismatch';

export type Phase19AccountBoundaryWarning =
  | 'anonymous_local_requires_account_linking'
  | 'localStorage_remains_source_of_truth'
  | 'cloud_runtime_disabled';

export type Phase19BackupPreflightStatus = 'valid' | 'missing' | 'invalid' | 'mismatch';

export type Phase19LocalOwnerInventory = {
  scope: Exclude<Phase19AccountOwnerScope, 'cloud-account-candidate'>;
  ownerId: string;
  deviceId?: string;
};

export type Phase19CloudAccountCandidate = {
  scope: 'cloud-account-candidate';
  accountId: string;
  ownerId: string;
  ownerUserId: string;
  deviceId?: string;
  rlsOwnerMatch: boolean;
};

export type Phase19LocalDeviceInventory = {
  deviceId: string | null;
  participatesInAccountCandidate: boolean;
};

export type Phase19LocalAppDataInventory = {
  schemaVersion: number;
  templateCount: number;
  historyCount: number;
  bodyWeightCount: number;
  activeSessionPresent: boolean;
  pendingSessionPatchCount: number;
  programAdjustmentDraftCount: number;
  selectedTemplateId: string;
  trainingMode: string;
  sourceSnapshotHash: string;
};

export type Phase19BackupPreflightInventory = {
  status: Phase19BackupPreflightStatus;
  checked: boolean;
  backupSnapshotHash: string | null;
  matchesCurrentLocal: boolean | null;
  exportRequiredBeforeFirstSync: true;
  localDataChanged: false;
};

export type Phase19AccountBoundaryGates = {
  canStartMigrationDryRun: boolean;
  canReadMirrorCandidate: false;
  canWriteShadowCandidate: false;
  canOptInSync: false;
  blockedReasons: Phase19AccountBoundaryBlockingError[];
  warnings: Phase19AccountBoundaryWarning[];
};

export type Phase19AccountBoundaryLocalInventoryInput = {
  appData?: unknown;
  localOwnerId?: string;
  deviceId?: string;
  cloudAccountId?: string;
  ownerUserId?: string;
  backupJson?: string | null;
  nowIso?: string;
};

export type Phase19AccountBoundaryLocalInventory = {
  id: string;
  ok: boolean;
  status: Phase19AccountBoundaryStatus;
  productScope: 'single-user-multi-device';
  sourceOfTruth: 'localStorage';
  localOwner: Phase19LocalOwnerInventory | null;
  accountCandidate: Phase19CloudAccountCandidate | null;
  device: Phase19LocalDeviceInventory;
  appDataSummary: Phase19LocalAppDataInventory | null;
  backup: Phase19BackupPreflightInventory;
  gates: Phase19AccountBoundaryGates;
  blockingErrors: Phase19AccountBoundaryBlockingError[];
  warnings: Phase19AccountBoundaryWarning[];
  offlineTrainingAvailable: true;
  localStorageEmergencyFallbackPreserved: true;
  syncRuntimeEnabled: false;
  localDataChanged: false;
  cloudDataChanged: false;
  sourceOfTruthChanged: false;
  createdAt: string;
};

const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;

  return `{${Object.entries(value as Record<string, unknown>)
    .filter(([, entryValue]) => entryValue !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`)
    .join(',')}}`;
};

const hashText = (text: string): string => {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `phase19b-${(hash >>> 0).toString(16).padStart(8, '0')}`;
};

// IMPORTANT: this used to canonicalise through `exportAppData →
// sanitizeData → JSON.parse`. That broke hash stability: `sanitizeData`
// fills missing `createdAt` / `id` fields with `new Date().toISOString()`
// and `Date.now()` fallbacks (see programAdjustmentDrafts / Sessions /
// migrateLegacyExercise), so two consecutive hash calls on the same
// AppData object produced different hashes whenever any row was missing
// a timestamp. Dry-run vs parity-check therefore diverged by seconds,
// surfacing as the iOS "上传完成但云端校验失败" false positive — the
// write to Supabase landed cleanly, but the recomputed local hash
// disagreed with the upload receipt and the parity gate refused to
// flip the toggle to "已开启".
//
// We now hash directly on a stable JSON serialisation. Properties:
//   1. idempotent (pure function, no side effects, no Date.now()).
//   2. jsonb-roundtrip equal: stableStringify drops `undefined` the
//      same way `JSON.stringify` does and sorts keys, so the hash is
//      invariant across the JSON.parse(JSON.stringify(x)) transform
//      that Supabase's jsonb column applies on write+read.
// The persistence layer owns schema correctness; the hash only needs
// determinism + jsonb-roundtrip equality.
export const buildAppDataSnapshotHash = (appData: unknown): string =>
  hashText(stableStringify(appData ?? null));

const cleanText = (value: string | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const isValidAppData = (value: unknown): value is AppData => validateAppDataSchema(value) === true;

const buildLocalOwner = (
  appData: AppData,
  localOwnerId: string | undefined,
  deviceId: string | undefined,
): Phase19LocalOwnerInventory => {
  const ownerId = cleanText(localOwnerId) ?? appData.userProfile.id;
  const cleanedDeviceId = cleanText(deviceId);

  return {
    scope: cleanedDeviceId ? 'device-local' : 'anonymous-local',
    ownerId,
    ...(cleanedDeviceId ? { deviceId: cleanedDeviceId } : {}),
  };
};

const buildAccountCandidate = (
  cloudAccountId: string | undefined,
  ownerUserId: string | undefined,
  deviceId: string | undefined,
): Phase19CloudAccountCandidate | null => {
  const accountId = cleanText(cloudAccountId);
  const userId = cleanText(ownerUserId);
  if (!accountId || !userId) return null;

  const cleanedDeviceId = cleanText(deviceId);
  return {
    scope: 'cloud-account-candidate',
    accountId,
    ownerId: accountId,
    ownerUserId: userId,
    ...(cleanedDeviceId ? { deviceId: cleanedDeviceId } : {}),
    rlsOwnerMatch: accountId === userId,
  };
};

const summarizeAppData = (appData: AppData): Phase19LocalAppDataInventory => ({
  schemaVersion: appData.schemaVersion,
  templateCount: appData.templates.length,
  historyCount: appData.history.length,
  bodyWeightCount: appData.bodyWeights.length,
  activeSessionPresent: appData.activeSession !== null,
  pendingSessionPatchCount: appData.pendingSessionPatches?.length ?? 0,
  programAdjustmentDraftCount: appData.programAdjustmentDrafts?.length ?? 0,
  selectedTemplateId: appData.selectedTemplateId,
  trainingMode: appData.trainingMode,
  sourceSnapshotHash: buildAppDataSnapshotHash(appData),
});

const inspectBackup = (
  backupJson: string | null | undefined,
  localSnapshotHash: string | null,
): Phase19BackupPreflightInventory => {
  if (!backupJson?.trim()) {
    return {
      status: 'missing',
      checked: true,
      backupSnapshotHash: null,
      matchesCurrentLocal: false,
      exportRequiredBeforeFirstSync: true,
      localDataChanged: false,
    };
  }

  try {
    const parsed = JSON.parse(backupJson) as unknown;
    if (!isValidAppData(parsed)) {
      return {
        status: 'invalid',
        checked: true,
        backupSnapshotHash: null,
        matchesCurrentLocal: false,
        exportRequiredBeforeFirstSync: true,
        localDataChanged: false,
      };
    }

    const backupSnapshotHash = buildAppDataSnapshotHash(parsed);
    const matchesCurrentLocal = localSnapshotHash ? backupSnapshotHash === localSnapshotHash : null;

    return {
      status: matchesCurrentLocal === false ? 'mismatch' : 'valid',
      checked: true,
      backupSnapshotHash,
      matchesCurrentLocal,
      exportRequiredBeforeFirstSync: true,
      localDataChanged: false,
    };
  } catch {
    return {
      status: 'invalid',
      checked: true,
      backupSnapshotHash: null,
      matchesCurrentLocal: false,
      exportRequiredBeforeFirstSync: true,
      localDataChanged: false,
    };
  }
};

const statusFromBlockingErrors = (
  blockingErrors: Phase19AccountBoundaryBlockingError[],
): Phase19AccountBoundaryStatus => {
  if (blockingErrors.includes('missing_local_data')) return 'missing_local_data';
  if (blockingErrors.includes('local_schema_invalid')) return 'local_schema_invalid';
  if (blockingErrors.includes('account_candidate_incomplete')) return 'account_candidate_incomplete';
  if (blockingErrors.includes('owner_mismatch')) return 'owner_mismatch';
  if (blockingErrors.includes('backup_invalid')) return 'backup_invalid';
  if (blockingErrors.includes('backup_mismatch')) return 'backup_mismatch';
  if (blockingErrors.includes('backup_missing')) return 'backup_required';
  return 'ready_for_migration_dry_run';
};

export const buildAccountBoundaryLocalInventory = (
  input: Phase19AccountBoundaryLocalInventoryInput = {},
): Phase19AccountBoundaryLocalInventory => {
  const createdAt = input.nowIso ?? new Date().toISOString();
  const blockingErrors: Phase19AccountBoundaryBlockingError[] = [];
  const warnings: Phase19AccountBoundaryWarning[] = [
    'localStorage_remains_source_of_truth',
    'cloud_runtime_disabled',
  ];

  let appData: AppData | null = null;
  if (input.appData == null) {
    blockingErrors.push('missing_local_data');
  } else if (!isValidAppData(input.appData)) {
    blockingErrors.push('local_schema_invalid');
  } else {
    appData = input.appData;
  }

  const appDataSummary = appData ? summarizeAppData(appData) : null;
  const localOwner = appData ? buildLocalOwner(appData, input.localOwnerId, input.deviceId) : null;
  if (localOwner?.scope === 'anonymous-local') warnings.push('anonymous_local_requires_account_linking');

  const accountCandidate = buildAccountCandidate(input.cloudAccountId, input.ownerUserId, input.deviceId);
  if (!accountCandidate) {
    blockingErrors.push('account_candidate_incomplete');
  } else if (!accountCandidate.rlsOwnerMatch) {
    blockingErrors.push('owner_mismatch');
  }

  const backup = inspectBackup(input.backupJson, appDataSummary?.sourceSnapshotHash ?? null);
  if (backup.status === 'missing') blockingErrors.push('backup_missing');
  if (backup.status === 'invalid') blockingErrors.push('backup_invalid');
  if (backup.status === 'mismatch') blockingErrors.push('backup_mismatch');

  const status = statusFromBlockingErrors(blockingErrors);
  const ok = blockingErrors.length === 0;

  return {
    id: `phase19b-local-inventory-${appDataSummary?.sourceSnapshotHash ?? 'missing'}-${hashText(createdAt)}`,
    ok,
    status,
    productScope: 'single-user-multi-device',
    sourceOfTruth: 'localStorage',
    localOwner,
    accountCandidate,
    device: {
      deviceId: cleanText(input.deviceId),
      participatesInAccountCandidate: !!accountCandidate?.deviceId,
    },
    appDataSummary,
    backup,
    gates: {
      canStartMigrationDryRun: ok,
      canReadMirrorCandidate: false,
      canWriteShadowCandidate: false,
      canOptInSync: false,
      blockedReasons: [...blockingErrors],
      warnings: [...warnings],
    },
    blockingErrors,
    warnings,
    offlineTrainingAvailable: true,
    localStorageEmergencyFallbackPreserved: true,
    syncRuntimeEnabled: false,
    localDataChanged: false,
    cloudDataChanged: false,
    sourceOfTruthChanged: false,
    createdAt,
  };
};
