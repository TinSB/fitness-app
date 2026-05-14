export type AccountScopedBackendOwnerScope =
  | 'anonymous-local'
  | 'device-local'
  | 'backend-primary-candidate'
  | 'cloud-account-candidate';

export type AccountScopedBackendOwnerCandidate = {
  scope: AccountScopedBackendOwnerScope;
  ownerId: string;
  deviceId?: string;
  accountId?: string;
};

export type AccountScopedBackendUserCandidate = {
  userId: string;
  accountId?: string;
};

export type AccountScopedBackendPrimaryErrorCode =
  | 'owner_scope_missing'
  | 'owner_scope_mismatch'
  | 'auth_candidate_missing'
  | 'account_candidate_missing'
  | 'backend_primary_not_enabled'
  | 'cloud_sync_not_available';

export type AccountScopedBackendPrimaryInput = {
  backendPrimaryEnabled?: boolean;
  cloudSyncRequested?: boolean;
  authUserCandidate?: AccountScopedBackendUserCandidate | null;
  accountOwnerCandidate?: AccountScopedBackendOwnerCandidate | null;
  deviceOwner?: AccountScopedBackendOwnerCandidate | null;
  localOwner?: AccountScopedBackendOwnerCandidate | null;
};

export type AccountScopedBackendPrimaryResult = {
  ok: boolean;
  errorCode?: AccountScopedBackendPrimaryErrorCode;
  authUserCandidate: AccountScopedBackendUserCandidate | null;
  accountOwnerCandidate: AccountScopedBackendOwnerCandidate | null;
  deviceOwner: AccountScopedBackendOwnerCandidate | null;
  localOwner: AccountScopedBackendOwnerCandidate | null;
  ownerScopeMatched: boolean;
  backendPrimaryCandidateAllowed: boolean;
  cloudSyncAvailable: false;
  normalizedTablesCreated: false;
  sourceOfTruthChanged: false;
  message: string;
};

const cloneOwner = (
  owner: AccountScopedBackendOwnerCandidate | null | undefined,
): AccountScopedBackendOwnerCandidate | null =>
  owner
    ? {
        scope: owner.scope,
        ownerId: owner.ownerId,
        ...(owner.deviceId ? { deviceId: owner.deviceId } : {}),
        ...(owner.accountId ? { accountId: owner.accountId } : {}),
      }
    : null;

const validOwner = (owner: AccountScopedBackendOwnerCandidate | null | undefined) =>
  !!owner &&
  !!owner.scope &&
  !!owner.ownerId &&
  (owner.scope !== 'cloud-account-candidate' || !!owner.accountId);

const baseResult = (
  input: AccountScopedBackendPrimaryInput,
  message: string,
  options: {
    ok?: boolean;
    errorCode?: AccountScopedBackendPrimaryErrorCode;
    ownerScopeMatched?: boolean;
    backendPrimaryCandidateAllowed?: boolean;
  } = {},
): AccountScopedBackendPrimaryResult => ({
  ok: options.ok ?? false,
  errorCode: options.errorCode,
  authUserCandidate: input.authUserCandidate ?? null,
  accountOwnerCandidate: cloneOwner(input.accountOwnerCandidate),
  deviceOwner: cloneOwner(input.deviceOwner),
  localOwner: cloneOwner(input.localOwner),
  ownerScopeMatched: options.ownerScopeMatched ?? false,
  backendPrimaryCandidateAllowed: options.backendPrimaryCandidateAllowed ?? false,
  cloudSyncAvailable: false,
  normalizedTablesCreated: false,
  sourceOfTruthChanged: false,
  message,
});

const ownersMatch = (
  expected: AccountScopedBackendOwnerCandidate,
  actual: AccountScopedBackendOwnerCandidate,
) =>
  expected.scope === actual.scope &&
  expected.ownerId === actual.ownerId &&
  expected.accountId === actual.accountId;

export const resolveAccountScopedBackendPrimaryAuthCandidate = (
  input: AccountScopedBackendPrimaryInput = {},
): AccountScopedBackendPrimaryResult => {
  if (input.cloudSyncRequested === true) {
    return baseResult(input, 'Cloud sync is not available in Phase 11.', {
      errorCode: 'cloud_sync_not_available',
    });
  }

  if (input.backendPrimaryEnabled !== true) {
    return baseResult(input, 'Backend-primary candidate is not enabled.', {
      errorCode: 'backend_primary_not_enabled',
    });
  }

  if (!input.authUserCandidate?.userId) {
    return baseResult(input, 'Auth user candidate is required.', {
      errorCode: 'auth_candidate_missing',
    });
  }

  if (!validOwner(input.accountOwnerCandidate)) {
    return baseResult(input, 'Account owner candidate is required.', {
      errorCode: 'account_candidate_missing',
    });
  }

  if (!validOwner(input.localOwner)) {
    return baseResult(input, 'Local owner scope is required.', {
      errorCode: 'owner_scope_missing',
    });
  }

  const accountOwner = input.accountOwnerCandidate;
  const localOwner = input.localOwner;
  if (!accountOwner || !localOwner) {
    return baseResult(input, 'Owner scope is required.', {
      errorCode: 'owner_scope_missing',
    });
  }

  if (
    accountOwner.scope === 'cloud-account-candidate' &&
    input.authUserCandidate.accountId &&
    accountOwner.accountId !== input.authUserCandidate.accountId
  ) {
    return baseResult(input, 'Auth user account does not match account owner candidate.', {
      errorCode: 'owner_scope_mismatch',
    });
  }

  if (localOwner.scope === 'cloud-account-candidate' && !ownersMatch(accountOwner, localOwner)) {
    return baseResult(input, 'Local owner does not match account owner candidate.', {
      errorCode: 'owner_scope_mismatch',
    });
  }

  return baseResult(input, 'Account-scoped backend-primary auth candidate is allowed for explicit candidate use.', {
    ok: true,
    ownerScopeMatched: true,
    backendPrimaryCandidateAllowed: true,
  });
};
