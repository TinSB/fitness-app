import type {
  SupabaseClientAdapterCandidate,
  SupabaseClientAdapterCandidateResult,
} from './supabaseClientAdapterCandidate';

export type CloudAppDataOwnerScope =
  | 'anonymous-local'
  | 'device-local'
  | 'backend-primary-candidate'
  | 'cloud-account-candidate';

export type CloudAppDataOwner = {
  scope: CloudAppDataOwnerScope;
  ownerId: string;
  deviceId?: string;
  accountId?: string;
};

export type CloudAppDataSnapshotCandidate<TAppData = unknown> = {
  snapshotId: string;
  accountId: string;
  ownerUserId: string;
  owner: CloudAppDataOwner;
  appData: TAppData;
  schemaVersion: string;
  sourceSnapshotHash: string;
  operationId: string;
  validationStatus: 'valid';
  createdAt: string;
};

export type CloudAppDataRepositoryCandidateErrorCode =
  | 'cloud_repository_disabled'
  | 'cloud_adapter_unavailable'
  | 'owner_scope_missing'
  | 'owner_scope_mismatch'
  | 'cloud_appdata_not_found'
  | 'cloud_appdata_invalid'
  | 'cloud_write_rejected'
  | 'cloud_write_failed'
  | 'manual_confirmation_required';

export type CloudAppDataRepositoryCandidateResult<TAppData = unknown> = {
  ok: boolean;
  status:
    | 'disabled'
    | 'read_candidate'
    | 'write_candidate'
    | 'snapshot_candidate'
    | 'not_found'
    | 'rejected'
    | 'failed';
  errorCode?: CloudAppDataRepositoryCandidateErrorCode;
  snapshot: CloudAppDataSnapshotCandidate<TAppData> | null;
  localStorageUnchanged: true;
  sourceOfTruthChanged: false;
  manualConfirmationRequired: boolean;
  message: string;
};

export type CloudAppDataSchemaValidator<TAppData> = (appData: TAppData) => boolean;

export type CloudAppDataRepositoryCandidateOptions<TAppData = unknown> = {
  enabled?: boolean;
  expectedOwner?: CloudAppDataOwner | null;
  adapter?: SupabaseClientAdapterCandidate<
    CloudAppDataSnapshotCandidate<TAppData>,
    CloudAppDataSnapshotCandidate<TAppData>
  > | null;
  schemaValidator?: CloudAppDataSchemaValidator<TAppData>;
  now?: () => string;
  snapshotIdFactory?: () => string;
};

export type CreateCloudSnapshotCandidateInput<TAppData = unknown> = {
  appData: TAppData;
  owner: CloudAppDataOwner;
  schemaVersion: string;
  sourceSnapshotHash: string;
  operationId: string;
};

export type WriteCloudAppDataCandidateInput<TAppData = unknown> = CreateCloudSnapshotCandidateInput<TAppData> & {
  manualConfirmation?: boolean;
};

export type CloudAppDataRepositoryCandidate<TAppData = unknown> = {
  enabled: boolean;
  notDefaultSource: true;
  explicitOptInRequired: true;
  readLatestCloudAppDataCandidate: () => CloudAppDataRepositoryCandidateResult<TAppData>;
  createCloudSnapshotCandidate: (
    input: CreateCloudSnapshotCandidateInput<TAppData>,
  ) => CloudAppDataRepositoryCandidateResult<TAppData>;
  writeCloudAppDataCandidate: (
    input: WriteCloudAppDataCandidateInput<TAppData>,
  ) => CloudAppDataRepositoryCandidateResult<TAppData>;
};

const cloneOwner = (owner: CloudAppDataOwner): CloudAppDataOwner => ({
  scope: owner.scope,
  ownerId: owner.ownerId,
  ...(owner.deviceId ? { deviceId: owner.deviceId } : {}),
  ...(owner.accountId ? { accountId: owner.accountId } : {}),
});

const result = <TAppData>(
  status: CloudAppDataRepositoryCandidateResult<TAppData>['status'],
  message: string,
  options: {
    ok?: boolean;
    errorCode?: CloudAppDataRepositoryCandidateErrorCode;
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

const validateOwner = (
  owner: CloudAppDataOwner | null | undefined,
  expectedOwner: CloudAppDataOwner | null | undefined,
): CloudAppDataRepositoryCandidateErrorCode | null => {
  if (!owner?.scope || !owner.ownerId) return 'owner_scope_missing';
  if (owner.scope === 'cloud-account-candidate' && !owner.accountId) return 'owner_scope_missing';
  if (!expectedOwner?.scope || !expectedOwner.ownerId) return 'owner_scope_missing';

  if (
    owner.scope !== expectedOwner.scope ||
    owner.ownerId !== expectedOwner.ownerId ||
    owner.accountId !== expectedOwner.accountId
  ) {
    return 'owner_scope_mismatch';
  }

  return null;
};

const validateSnapshot = <TAppData>(
  snapshot: CloudAppDataSnapshotCandidate<TAppData> | null | undefined,
  expectedOwner: CloudAppDataOwner | null | undefined,
  schemaValidator: CloudAppDataSchemaValidator<TAppData>,
): CloudAppDataRepositoryCandidateErrorCode | null => {
  if (!snapshot) return 'cloud_appdata_not_found';
  const ownerError = validateOwner(snapshot.owner, expectedOwner);
  if (ownerError) return ownerError;
  if (!schemaValidator(snapshot.appData)) return 'cloud_appdata_invalid';
  if (
    !snapshot.snapshotId ||
    !snapshot.accountId ||
    !snapshot.ownerUserId ||
    !snapshot.schemaVersion ||
    !snapshot.sourceSnapshotHash ||
    !snapshot.operationId ||
    snapshot.validationStatus !== 'valid'
  ) {
    return 'cloud_appdata_invalid';
  }
  return null;
};

const disabledRepository = <TAppData>(): CloudAppDataRepositoryCandidate<TAppData> => ({
  enabled: false,
  notDefaultSource: true,
  explicitOptInRequired: true,
  readLatestCloudAppDataCandidate: () =>
    result('disabled', 'Cloud AppData repository candidate is disabled by default.', {
      errorCode: 'cloud_repository_disabled',
    }),
  createCloudSnapshotCandidate: () =>
    result('disabled', 'Cloud AppData repository candidate is disabled by default.', {
      errorCode: 'cloud_repository_disabled',
    }),
  writeCloudAppDataCandidate: () =>
    result('disabled', 'Cloud AppData repository candidate is disabled by default.', {
      errorCode: 'cloud_repository_disabled',
    }),
});

export const createCloudAppDataRepositoryCandidate = <TAppData = unknown>(
  options: CloudAppDataRepositoryCandidateOptions<TAppData> = {},
): CloudAppDataRepositoryCandidate<TAppData> => {
  if (options.enabled !== true) return disabledRepository();

  const schemaValidator = options.schemaValidator ?? (() => true);
  const now = options.now ?? (() => new Date(0).toISOString());
  const snapshotIdFactory = options.snapshotIdFactory ?? (() => 'cloud-snapshot-candidate');

  if (!options.adapter?.enabled) {
    return {
      ...disabledRepository(),
      enabled: true,
      readLatestCloudAppDataCandidate: () =>
        result('failed', 'Cloud adapter candidate is unavailable.', {
          errorCode: 'cloud_adapter_unavailable',
        }),
      createCloudSnapshotCandidate: () =>
        result('failed', 'Cloud adapter candidate is unavailable.', {
          errorCode: 'cloud_adapter_unavailable',
        }),
      writeCloudAppDataCandidate: () =>
        result('failed', 'Cloud adapter candidate is unavailable.', {
          errorCode: 'cloud_adapter_unavailable',
        }),
    };
  }

  const adapter = options.adapter;

  const createSnapshot = (
    input: CreateCloudSnapshotCandidateInput<TAppData>,
  ): CloudAppDataRepositoryCandidateResult<TAppData> => {
    const ownerError = validateOwner(input.owner, options.expectedOwner);
    if (ownerError) {
      return result('rejected', 'Cloud AppData owner scope rejected.', { errorCode: ownerError });
    }

    if (!schemaValidator(input.appData)) {
      return result('rejected', 'Cloud AppData schema validation failed before candidate write.', {
        errorCode: 'cloud_appdata_invalid',
      });
    }

    const snapshot: CloudAppDataSnapshotCandidate<TAppData> = {
      snapshotId: snapshotIdFactory(),
      accountId: input.owner.accountId ?? input.owner.ownerId,
      ownerUserId: input.owner.ownerId,
      owner: cloneOwner(input.owner),
      appData: input.appData,
      schemaVersion: input.schemaVersion,
      sourceSnapshotHash: input.sourceSnapshotHash,
      operationId: input.operationId,
      validationStatus: 'valid',
      createdAt: now(),
    };

    return result('snapshot_candidate', 'Cloud AppData snapshot candidate created without changing local data.', {
      ok: true,
      snapshot,
    });
  };

  const readLatest = (): CloudAppDataRepositoryCandidateResult<TAppData> => {
    const adapterResult = adapter.readCandidate();
    if (!adapterResult.ok || !adapterResult.data) {
      return result('not_found', adapterResult.message, {
        errorCode: adapterResult.errorCode === 'adapter_disabled'
          ? 'cloud_adapter_unavailable'
          : 'cloud_appdata_not_found',
      });
    }

    const snapshotError = validateSnapshot(adapterResult.data, options.expectedOwner, schemaValidator);
    if (snapshotError) {
      return result('rejected', 'Cloud AppData read candidate failed owner or schema validation.', {
        errorCode: snapshotError,
      });
    }

    return result('read_candidate', 'Cloud AppData read candidate validated without applying local changes.', {
      ok: true,
      snapshot: adapterResult.data,
      manualConfirmationRequired: true,
    });
  };

  const writeCandidate = (
    input: WriteCloudAppDataCandidateInput<TAppData>,
  ): CloudAppDataRepositoryCandidateResult<TAppData> => {
    if (input.manualConfirmation !== true) {
      return result('rejected', 'Manual confirmation is required before cloud AppData write candidate.', {
        errorCode: 'manual_confirmation_required',
        manualConfirmationRequired: true,
      });
    }

    const snapshotResult = createSnapshot(input);
    if (!snapshotResult.ok || !snapshotResult.snapshot) return snapshotResult;

    const adapterResult: SupabaseClientAdapterCandidateResult<CloudAppDataSnapshotCandidate<TAppData>> =
      adapter.writeCandidate(snapshotResult.snapshot);

    if (!adapterResult.ok || !adapterResult.data) {
      return result('failed', adapterResult.message, {
        errorCode: adapterResult.errorCode === 'write_failed' ? 'cloud_write_failed' : 'cloud_write_rejected',
      });
    }

    const snapshotError = validateSnapshot(adapterResult.data, options.expectedOwner, schemaValidator);
    if (snapshotError) {
      return result('failed', 'Cloud AppData write candidate response failed validation.', {
        errorCode: snapshotError === 'cloud_appdata_invalid' ? 'cloud_write_failed' : snapshotError,
      });
    }

    return result('write_candidate', 'Cloud AppData write candidate accepted without changing local source.', {
      ok: true,
      snapshot: adapterResult.data,
    });
  };

  return {
    enabled: true,
    notDefaultSource: true,
    explicitOptInRequired: true,
    readLatestCloudAppDataCandidate: readLatest,
    createCloudSnapshotCandidate: createSnapshot,
    writeCloudAppDataCandidate: writeCandidate,
  };
};
