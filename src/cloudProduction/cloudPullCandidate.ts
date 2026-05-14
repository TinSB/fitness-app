export type CloudPullOwner = {
  scope: 'anonymous-local' | 'device-local' | 'backend-primary-candidate' | 'cloud-account-candidate';
  ownerId: string;
  accountId?: string;
  deviceId?: string;
};

export type CloudPullSnapshot<TAppData = unknown> = {
  snapshotId: string;
  owner: CloudPullOwner;
  appData: TAppData;
  schemaVersion: string;
  sourceSnapshotHash: string;
  updatedAt: string;
};

export type CloudPullCandidateStatus =
  | 'disabled'
  | 'cloud_unavailable'
  | 'cloud_data_missing'
  | 'cloud_data_invalid'
  | 'owner_mismatch'
  | 'schema_mismatch'
  | 'cloud_newer'
  | 'local_newer'
  | 'ready_candidate'
  | 'manual_confirmation_required';

export type CloudPullCandidateInput<TAppData = unknown> = {
  enabled?: boolean;
  explicitOptIn?: boolean;
  cloudAvailable?: boolean;
  expectedOwner?: CloudPullOwner | null;
  localSchemaVersion?: string | null;
  localSnapshotHash?: string | null;
  localUpdatedAt?: string | null;
  cloudSnapshot?: CloudPullSnapshot<TAppData> | null;
  schemaValidator?: (appData: TAppData) => boolean;
  manualConfirmation?: boolean;
};

export type CloudPullCandidateResult<TAppData = unknown> = {
  ok: boolean;
  status: CloudPullCandidateStatus;
  pullCandidate: CloudPullSnapshot<TAppData> | null;
  applied: false;
  requiresManualConfirmation: boolean;
  localStorageUnchanged: true;
  sourceOfTruthChanged: false;
  message: string;
};

const sameOwner = (left: CloudPullOwner | null | undefined, right: CloudPullOwner | null | undefined): boolean =>
  !!left &&
  !!right &&
  left.scope === right.scope &&
  left.ownerId === right.ownerId &&
  left.accountId === right.accountId;

const result = <TAppData>(
  status: CloudPullCandidateStatus,
  message: string,
  options: {
    ok?: boolean;
    pullCandidate?: CloudPullSnapshot<TAppData> | null;
    requiresManualConfirmation?: boolean;
  } = {},
): CloudPullCandidateResult<TAppData> => ({
  ok: options.ok ?? false,
  status,
  pullCandidate: options.pullCandidate ?? null,
  applied: false,
  requiresManualConfirmation: options.requiresManualConfirmation ?? false,
  localStorageUnchanged: true,
  sourceOfTruthChanged: false,
  message,
});

export const runCloudPullCandidate = <TAppData = unknown>(
  input: CloudPullCandidateInput<TAppData> = {},
): CloudPullCandidateResult<TAppData> => {
  if (input.enabled !== true) {
    return result('disabled', 'Cloud pull candidate is disabled by default.');
  }

  if (input.explicitOptIn !== true) {
    return result('disabled', 'Cloud pull candidate requires explicit opt-in.');
  }

  if (input.cloudAvailable !== true) {
    return result('cloud_unavailable', 'Cloud candidate data is unavailable.');
  }

  if (!input.cloudSnapshot) {
    return result('cloud_data_missing', 'Cloud AppData candidate is missing.');
  }

  if (!sameOwner(input.cloudSnapshot.owner, input.expectedOwner)) {
    return result('owner_mismatch', 'Cloud AppData owner does not match expected owner.', {
      pullCandidate: input.cloudSnapshot,
      requiresManualConfirmation: true,
    });
  }

  if (
    !input.cloudSnapshot.snapshotId ||
    !input.cloudSnapshot.sourceSnapshotHash ||
    !input.cloudSnapshot.schemaVersion ||
    !input.cloudSnapshot.updatedAt
  ) {
    return result('cloud_data_invalid', 'Cloud AppData candidate metadata is invalid.', {
      pullCandidate: input.cloudSnapshot,
      requiresManualConfirmation: true,
    });
  }

  if (input.schemaValidator?.(input.cloudSnapshot.appData) === false) {
    return result('cloud_data_invalid', 'Cloud AppData candidate failed schema validation.', {
      pullCandidate: input.cloudSnapshot,
      requiresManualConfirmation: true,
    });
  }

  if (input.localSchemaVersion && input.localSchemaVersion !== input.cloudSnapshot.schemaVersion) {
    return result('schema_mismatch', 'Cloud AppData schema differs from local AppData schema.', {
      pullCandidate: input.cloudSnapshot,
      requiresManualConfirmation: true,
    });
  }

  const cloudIsNewer = !!input.localUpdatedAt && input.cloudSnapshot.updatedAt > input.localUpdatedAt;
  const localIsNewer = !!input.localUpdatedAt && input.cloudSnapshot.updatedAt < input.localUpdatedAt;

  if (cloudIsNewer) {
    return result('cloud_newer', 'Cloud AppData candidate is newer than local data and needs review.', {
      ok: true,
      pullCandidate: input.cloudSnapshot,
      requiresManualConfirmation: true,
    });
  }

  if (localIsNewer) {
    return result('local_newer', 'Local AppData is newer than the cloud candidate and needs review.', {
      ok: true,
      pullCandidate: input.cloudSnapshot,
      requiresManualConfirmation: true,
    });
  }

  if (input.manualConfirmation !== true) {
    return result('manual_confirmation_required', 'Manual confirmation is required before any future apply step.', {
      ok: true,
      pullCandidate: input.cloudSnapshot,
      requiresManualConfirmation: true,
    });
  }

  return result('ready_candidate', 'Cloud pull candidate is ready for manual review and is not applied.', {
    ok: true,
    pullCandidate: input.cloudSnapshot,
    requiresManualConfirmation: true,
  });
};
