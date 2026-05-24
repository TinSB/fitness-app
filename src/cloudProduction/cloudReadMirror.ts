import {
  runCloudPullCandidate,
  type CloudPullOwner,
  type CloudPullSnapshot,
} from './cloudPullCandidate';
import type {
  CloudAppDataOwner,
  CloudAppDataRepositoryCandidateResult,
  CloudAppDataSnapshotCandidate,
} from './cloudAppDataRepositoryCandidate';

export const PHASE19G_CLOUD_READ_MIRROR_ID = 'phase19g-cloud-read-mirror';

export type Phase19gCloudReadMirrorStatus =
  | 'disabled'
  | 'account_not_ready'
  | 'repository_unavailable'
  | 'cloud_missing'
  | 'rejected'
  | 'review_required'
  | 'mirrored';

export type Phase19gCloudReadMirrorBlockerCode =
  | 'read_mirror_disabled'
  | 'account_not_ready'
  | 'repository_unavailable'
  | 'cloud_appdata_not_found'
  | 'cloud_data_invalid'
  | 'owner_mismatch'
  | 'schema_mismatch'
  | 'manual_review_required';

export type Phase19gCloudReadMirrorFreshness =
  | 'cloud_newer'
  | 'local_newer'
  | 'same_updated_at'
  | 'unknown';

export type Phase19gLocalSnapshotMetadata = {
  schemaVersion?: string | null;
  sourceSnapshotHash?: string | null;
  updatedAt?: string | null;
};

export type Phase19gCloudReadMirrorRepository<TAppData = unknown> = {
  readLatestCloudAppDataCandidate: () => CloudAppDataRepositoryCandidateResult<TAppData>;
};

export type Phase19gCloudReadMirrorInput<TAppData = unknown> = {
  enabled?: boolean;
  accountReady?: boolean;
  expectedOwner?: CloudAppDataOwner | null;
  localSnapshot?: Phase19gLocalSnapshotMetadata | null;
  repository?: Phase19gCloudReadMirrorRepository<TAppData> | null;
  schemaValidator?: (appData: TAppData) => boolean;
};

export type Phase19gCloudReadMirrorSnapshot<TAppData = unknown> = {
  snapshotId: string;
  owner: CloudAppDataOwner;
  appData: TAppData;
  schemaVersion: string;
  sourceSnapshotHash: string;
  localSnapshotHash: string | null;
  cloudUpdatedAt: string;
  localUpdatedAt: string | null;
  freshness: Phase19gCloudReadMirrorFreshness;
  hashMatch: boolean;
  ownerMatch: boolean;
  schemaMatch: boolean;
};

export type Phase19gCloudReadMirrorResult<TAppData = unknown> = {
  id: typeof PHASE19G_CLOUD_READ_MIRROR_ID;
  phase: '19G';
  ok: boolean;
  status: Phase19gCloudReadMirrorStatus;
  mirror: Phase19gCloudReadMirrorSnapshot<TAppData> | null;
  requiresManualReview: boolean;
  blockers: Phase19gCloudReadMirrorBlockerCode[];
  applied: false;
  cloudWriteAttempted: false;
  localDataChanged: false;
  localStorageUnchanged: true;
  sourceOfTruthChanged: false;
  message: string;
};

const baseResult = <TAppData>(
  status: Phase19gCloudReadMirrorStatus,
  message: string,
  options: {
    ok?: boolean;
    mirror?: Phase19gCloudReadMirrorSnapshot<TAppData> | null;
    requiresManualReview?: boolean;
    blockers?: Phase19gCloudReadMirrorBlockerCode[];
  } = {},
): Phase19gCloudReadMirrorResult<TAppData> => ({
  id: PHASE19G_CLOUD_READ_MIRROR_ID,
  phase: '19G',
  ok: options.ok ?? false,
  status,
  mirror: options.mirror ?? null,
  requiresManualReview: options.requiresManualReview ?? false,
  blockers: options.blockers ?? [],
  applied: false,
  cloudWriteAttempted: false,
  localDataChanged: false,
  localStorageUnchanged: true,
  sourceOfTruthChanged: false,
  message,
});

const toPullOwner = (owner: CloudAppDataOwner | null | undefined): CloudPullOwner | null => {
  if (!owner) return null;
  return {
    scope: owner.scope,
    ownerId: owner.ownerId,
    ...(owner.accountId ? { accountId: owner.accountId } : {}),
    ...(owner.deviceId ? { deviceId: owner.deviceId } : {}),
  };
};

const toPullSnapshot = <TAppData>(
  snapshot: CloudAppDataSnapshotCandidate<TAppData>,
): CloudPullSnapshot<TAppData> => ({
  snapshotId: snapshot.snapshotId,
  owner: toPullOwner(snapshot.owner) as CloudPullOwner,
  appData: snapshot.appData,
  schemaVersion: snapshot.schemaVersion,
  sourceSnapshotHash: snapshot.sourceSnapshotHash,
  updatedAt: snapshot.createdAt,
});

const freshnessFromDates = (
  cloudUpdatedAt: string,
  localUpdatedAt: string | null | undefined,
): Phase19gCloudReadMirrorFreshness => {
  if (!localUpdatedAt) return 'unknown';
  if (cloudUpdatedAt > localUpdatedAt) return 'cloud_newer';
  if (cloudUpdatedAt < localUpdatedAt) return 'local_newer';
  return 'same_updated_at';
};

const ownerMatches = (
  left: CloudAppDataOwner | null | undefined,
  right: CloudAppDataOwner | null | undefined,
) =>
  !!left &&
  !!right &&
  left.scope === right.scope &&
  left.ownerId === right.ownerId &&
  left.accountId === right.accountId;

const invalidSnapshot = <TAppData>(snapshot: CloudAppDataSnapshotCandidate<TAppData>) =>
  !snapshot.snapshotId ||
  !snapshot.schemaVersion ||
  !snapshot.sourceSnapshotHash ||
  !snapshot.createdAt ||
  !snapshot.owner?.ownerId;

const buildMirror = <TAppData>(
  snapshot: CloudAppDataSnapshotCandidate<TAppData>,
  expectedOwner: CloudAppDataOwner | null | undefined,
  localSnapshot: Phase19gLocalSnapshotMetadata | null | undefined,
): Phase19gCloudReadMirrorSnapshot<TAppData> => {
  const localSnapshotHash = localSnapshot?.sourceSnapshotHash ?? null;
  const localUpdatedAt = localSnapshot?.updatedAt ?? null;
  return {
    snapshotId: snapshot.snapshotId,
    owner: snapshot.owner,
    appData: snapshot.appData,
    schemaVersion: snapshot.schemaVersion,
    sourceSnapshotHash: snapshot.sourceSnapshotHash,
    localSnapshotHash,
    cloudUpdatedAt: snapshot.createdAt,
    localUpdatedAt,
    freshness: freshnessFromDates(snapshot.createdAt, localUpdatedAt),
    hashMatch: Boolean(localSnapshotHash && localSnapshotHash === snapshot.sourceSnapshotHash),
    ownerMatch: ownerMatches(snapshot.owner, expectedOwner),
    schemaMatch: !localSnapshot?.schemaVersion || localSnapshot.schemaVersion === snapshot.schemaVersion,
  };
};

export const buildPhase19gCloudReadMirror = <TAppData = unknown>(
  input: Phase19gCloudReadMirrorInput<TAppData> = {},
): Phase19gCloudReadMirrorResult<TAppData> => {
  if (input.enabled !== true) {
    return baseResult('disabled', 'Cloud read mirror is disabled by default.', {
      blockers: ['read_mirror_disabled'],
    });
  }

  if (input.accountReady !== true) {
    return baseResult('account_not_ready', 'Account boundary is not ready for cloud read mirror.', {
      blockers: ['account_not_ready'],
    });
  }

  if (!input.repository) {
    return baseResult('repository_unavailable', 'Cloud repository candidate is unavailable.', {
      blockers: ['repository_unavailable'],
    });
  }

  const repositoryResult = input.repository.readLatestCloudAppDataCandidate();
  if (!repositoryResult.ok || !repositoryResult.snapshot) {
    return baseResult('cloud_missing', repositoryResult.message, {
      blockers: [repositoryResult.errorCode === 'cloud_appdata_not_found'
        ? 'cloud_appdata_not_found'
        : 'repository_unavailable'],
    });
  }

  const snapshot = repositoryResult.snapshot;
  if (invalidSnapshot(snapshot) || input.schemaValidator?.(snapshot.appData) === false) {
    return baseResult('rejected', 'Cloud read mirror rejected invalid cloud data.', {
      requiresManualReview: true,
      blockers: ['cloud_data_invalid'],
    });
  }

  const pullResult = runCloudPullCandidate({
    enabled: true,
    explicitOptIn: true,
    cloudAvailable: true,
    expectedOwner: toPullOwner(input.expectedOwner),
    localSchemaVersion: input.localSnapshot?.schemaVersion ?? null,
    localSnapshotHash: input.localSnapshot?.sourceSnapshotHash ?? null,
    localUpdatedAt: input.localSnapshot?.updatedAt ?? null,
    cloudSnapshot: toPullSnapshot(snapshot),
    schemaValidator: input.schemaValidator,
    manualConfirmation: false,
  });

  const mirror = buildMirror(snapshot, input.expectedOwner, input.localSnapshot);

  if (!pullResult.ok) {
    const blocker: Phase19gCloudReadMirrorBlockerCode =
      pullResult.status === 'owner_mismatch'
        ? 'owner_mismatch'
        : pullResult.status === 'schema_mismatch'
          ? 'schema_mismatch'
          : 'cloud_data_invalid';
    return baseResult('rejected', pullResult.message, {
      mirror,
      requiresManualReview: true,
      blockers: [blocker],
    });
  }

  if (mirror.hashMatch && mirror.freshness === 'same_updated_at') {
    return baseResult('mirrored', 'Cloud read mirror matches local snapshot metadata.', {
      ok: true,
      mirror,
    });
  }

  return baseResult('review_required', 'Cloud read mirror differs from local snapshot metadata and needs review.', {
    ok: true,
    mirror,
    requiresManualReview: true,
    blockers: ['manual_review_required'],
  });
};
