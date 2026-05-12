export type SyncSnapshotMetadata = {
  snapshotId: string;
  deviceId: string;
  accountId?: string;
  clientRevision: number;
  serverRevision: number;
  operationId?: string;
  idempotencyKey?: string;
  deleted?: boolean;
};

export type SyncConflictStatus =
  | 'no_conflict'
  | 'stale_client'
  | 'stale_server'
  | 'divergent_edits'
  | 'deletion_conflict'
  | 'duplicate_operation'
  | 'account_mismatch'
  | 'invalid_metadata';

export type SyncConflictDetectorInput = {
  local: SyncSnapshotMetadata;
  remote: SyncSnapshotMetadata;
  previouslyAppliedOperationIds?: readonly string[];
};

export type SyncConflictDetectorResult = {
  ok: boolean;
  status: SyncConflictStatus;
  canAutoApply: false;
  requiresUserResolution: boolean;
  reasons: string[];
  idempotency: {
    operationId?: string;
    idempotencyKey?: string;
    duplicateOperation: boolean;
  };
};

const isValidRevision = (revision: number) => Number.isInteger(revision) && revision >= 0;

const hasRequiredIdentity = (metadata: SyncSnapshotMetadata) =>
  metadata.snapshotId.trim().length > 0
  && metadata.deviceId.trim().length > 0
  && isValidRevision(metadata.clientRevision)
  && isValidRevision(metadata.serverRevision);

export const detectSyncConflict = ({
  local,
  remote,
  previouslyAppliedOperationIds = [],
}: SyncConflictDetectorInput): SyncConflictDetectorResult => {
  const reasons: string[] = [];
  const duplicateOperation = local.operationId !== undefined
    && previouslyAppliedOperationIds.includes(local.operationId);

  if (!hasRequiredIdentity(local) || !hasRequiredIdentity(remote)) {
    reasons.push('metadata identity and revisions are required');
    return {
      ok: false,
      status: 'invalid_metadata',
      canAutoApply: false,
      requiresUserResolution: true,
      reasons,
      idempotency: {
        operationId: local.operationId,
        idempotencyKey: local.idempotencyKey,
        duplicateOperation,
      },
    };
  }

  if (local.accountId !== undefined && remote.accountId !== undefined && local.accountId !== remote.accountId) {
    reasons.push('account identity does not match');
    return {
      ok: false,
      status: 'account_mismatch',
      canAutoApply: false,
      requiresUserResolution: true,
      reasons,
      idempotency: {
        operationId: local.operationId,
        idempotencyKey: local.idempotencyKey,
        duplicateOperation,
      },
    };
  }

  if (duplicateOperation) {
    reasons.push('operation was already applied');
    return {
      ok: true,
      status: 'duplicate_operation',
      canAutoApply: false,
      requiresUserResolution: false,
      reasons,
      idempotency: {
        operationId: local.operationId,
        idempotencyKey: local.idempotencyKey,
        duplicateOperation,
      },
    };
  }

  if (local.deleted !== remote.deleted) {
    reasons.push('one side marks the snapshot deleted');
    return {
      ok: false,
      status: 'deletion_conflict',
      canAutoApply: false,
      requiresUserResolution: true,
      reasons,
      idempotency: {
        operationId: local.operationId,
        idempotencyKey: local.idempotencyKey,
        duplicateOperation,
      },
    };
  }

  if (local.clientRevision < remote.serverRevision) {
    reasons.push('local client revision is behind remote server revision');
    return {
      ok: false,
      status: 'stale_client',
      canAutoApply: false,
      requiresUserResolution: true,
      reasons,
      idempotency: {
        operationId: local.operationId,
        idempotencyKey: local.idempotencyKey,
        duplicateOperation,
      },
    };
  }

  if (local.serverRevision > remote.serverRevision) {
    reasons.push('local metadata references a newer server revision than remote metadata');
    return {
      ok: false,
      status: 'stale_server',
      canAutoApply: false,
      requiresUserResolution: true,
      reasons,
      idempotency: {
        operationId: local.operationId,
        idempotencyKey: local.idempotencyKey,
        duplicateOperation,
      },
    };
  }

  if (
    local.snapshotId !== remote.snapshotId
    && local.clientRevision === remote.clientRevision
    && local.serverRevision === remote.serverRevision
  ) {
    reasons.push('matching revisions point to different snapshots');
    return {
      ok: false,
      status: 'divergent_edits',
      canAutoApply: false,
      requiresUserResolution: true,
      reasons,
      idempotency: {
        operationId: local.operationId,
        idempotencyKey: local.idempotencyKey,
        duplicateOperation,
      },
    };
  }

  reasons.push('metadata is aligned');
  return {
    ok: true,
    status: 'no_conflict',
    canAutoApply: false,
    requiresUserResolution: false,
    reasons,
    idempotency: {
      operationId: local.operationId,
      idempotencyKey: local.idempotencyKey,
      duplicateOperation,
    },
  };
};
