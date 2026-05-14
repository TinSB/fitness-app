export type CloudOperationType =
  | 'manual_pull_review'
  | 'manual_push_candidate'
  | 'manual_conflict_resolution'
  | 'snapshot_candidate';

export type CloudOperationStatus =
  | 'pending_manual_review'
  | 'accepted_candidate'
  | 'rejected'
  | 'completed_candidate'
  | 'failed';

export type CloudOperationOwnerScope = {
  scope: 'anonymous-local' | 'device-local' | 'backend-primary-candidate' | 'cloud-account-candidate';
  ownerId: string;
  accountId?: string;
};

export type CloudOperationJournalEntry = {
  operationId: string;
  operationType: CloudOperationType;
  ownerScope: CloudOperationOwnerScope;
  requestFingerprint: string;
  sourceSnapshotHash: string;
  targetSnapshotHash: string;
  status: CloudOperationStatus;
  createdAt: string;
  completedAt: string | null;
  errorCode: string | null;
  cloudIdempotencyKey: string;
};

export type CloudOperationJournalInput = Omit<CloudOperationJournalEntry, 'cloudIdempotencyKey'>;

export type CloudOperationDuplicateCheck = {
  duplicate: boolean;
  existingOperationId: string | null;
  preventDuplicateManualApplyCandidate: boolean;
};

const normalize = (value: string): string => value.trim().toLowerCase();

export const buildCloudIdempotencyKey = (
  operationType: CloudOperationType,
  ownerScope: CloudOperationOwnerScope,
  requestFingerprint: string,
  sourceSnapshotHash: string,
  targetSnapshotHash: string,
): string => [
  operationType,
  normalize(ownerScope.scope),
  normalize(ownerScope.ownerId),
  normalize(ownerScope.accountId ?? 'no-account'),
  normalize(requestFingerprint),
  normalize(sourceSnapshotHash),
  normalize(targetSnapshotHash),
].join(':');

export const validateCloudIdempotencyKey = (
  key: string | null | undefined,
): { ok: boolean; reason: string } => {
  if (!key) return { ok: false, reason: 'Idempotency key is required.' };
  if (key.split(':').length !== 7) return { ok: false, reason: 'Idempotency key has invalid shape.' };
  if (key.includes(' ')) return { ok: false, reason: 'Idempotency key must be normalized.' };
  return { ok: true, reason: 'Idempotency key is valid.' };
};

export const createCloudOperationJournalEntry = (
  input: CloudOperationJournalInput,
): CloudOperationJournalEntry => ({
  ...input,
  ownerScope: {
    scope: input.ownerScope.scope,
    ownerId: input.ownerScope.ownerId,
    ...(input.ownerScope.accountId ? { accountId: input.ownerScope.accountId } : {}),
  },
  cloudIdempotencyKey: buildCloudIdempotencyKey(
    input.operationType,
    input.ownerScope,
    input.requestFingerprint,
    input.sourceSnapshotHash,
    input.targetSnapshotHash,
  ),
});

export const checkDuplicateManualCloudOperationCandidate = (
  existing: CloudOperationJournalEntry[],
  candidate: CloudOperationJournalEntry,
): CloudOperationDuplicateCheck => {
  const duplicate = existing.find((entry) => entry.cloudIdempotencyKey === candidate.cloudIdempotencyKey);

  return {
    duplicate: !!duplicate,
    existingOperationId: duplicate?.operationId ?? null,
    preventDuplicateManualApplyCandidate: !!duplicate,
  };
};
