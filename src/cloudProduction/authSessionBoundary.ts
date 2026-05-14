export type AuthSessionState =
  | 'disabled'
  | 'unauthenticated'
  | 'authenticated-candidate'
  | 'expired'
  | 'invalid'
  | 'provider-unavailable';

export type AuthSessionErrorCode =
  | 'session_disabled'
  | 'session_missing'
  | 'session_expired'
  | 'session_invalid'
  | 'provider_unavailable'
  | 'manual_link_required';

export type AuthUserCandidate = {
  userId: string;
  displayName?: string;
};

export type AuthAccountCandidate = {
  accountId: string;
  ownerScope: 'cloud-account-candidate' | 'backend-primary-candidate' | 'anonymous-local' | 'device-local';
};

export type AuthSessionBoundaryInput = {
  enabled?: boolean;
  state?: AuthSessionState;
  userCandidate?: AuthUserCandidate | null;
  accountCandidate?: AuthAccountCandidate | null;
  providerAvailable?: boolean;
  manualLinkAccepted?: boolean;
};

export type AuthSessionBoundaryResult = {
  ok: boolean;
  state: AuthSessionState;
  errorCode?: AuthSessionErrorCode;
  userCandidate: AuthUserCandidate | null;
  accountCandidate: AuthAccountCandidate | null;
  canUseBackendPrimaryCandidate: boolean;
  requiresManualLinking: boolean;
  localAppAvailable: true;
  emergencyLocalAvailable: true;
  localStorageDeleted: false;
  emergencyBackupDeleted: false;
  localDataUploaded: false;
  sourceOfTruthChanged: false;
  message: string;
};

const baseResult = (
  input: AuthSessionBoundaryInput,
  state: AuthSessionState,
  message: string,
  options: {
    ok?: boolean;
    errorCode?: AuthSessionErrorCode;
    canUseBackendPrimaryCandidate?: boolean;
    requiresManualLinking?: boolean;
  } = {},
): AuthSessionBoundaryResult => ({
  ok: options.ok ?? false,
  state,
  errorCode: options.errorCode,
  userCandidate: input.userCandidate ?? null,
  accountCandidate: input.accountCandidate ?? null,
  canUseBackendPrimaryCandidate: options.canUseBackendPrimaryCandidate ?? false,
  requiresManualLinking: options.requiresManualLinking ?? false,
  localAppAvailable: true,
  emergencyLocalAvailable: true,
  localStorageDeleted: false,
  emergencyBackupDeleted: false,
  localDataUploaded: false,
  sourceOfTruthChanged: false,
  message,
});

export const resolveAuthSessionBoundary = (
  input: AuthSessionBoundaryInput = {},
): AuthSessionBoundaryResult => {
  if (input.enabled !== true) {
    return baseResult(input, 'disabled', 'Auth session boundary is disabled by default.', {
      errorCode: 'session_disabled',
    });
  }

  if (input.providerAvailable === false) {
    return baseResult(input, 'provider-unavailable', 'Provider candidate is unavailable; local app remains usable.', {
      errorCode: 'provider_unavailable',
    });
  }

  const state = input.state ?? 'unauthenticated';

  if (state === 'expired') {
    return baseResult(input, 'expired', 'Candidate session expired; local data remains available.', {
      errorCode: 'session_expired',
    });
  }

  if (state === 'invalid') {
    return baseResult(input, 'invalid', 'Candidate session is invalid; source of truth is unchanged.', {
      errorCode: 'session_invalid',
    });
  }

  if (state === 'unauthenticated') {
    return baseResult(input, 'unauthenticated', 'No candidate session is active; local app remains available.', {
      ok: true,
      errorCode: input.userCandidate || input.accountCandidate ? 'session_missing' : undefined,
    });
  }

  if (!input.userCandidate || !input.accountCandidate) {
    return baseResult(input, 'unauthenticated', 'Candidate user and account are required before backend-primary use.', {
      errorCode: 'session_missing',
    });
  }

  const requiresManualLinking = input.manualLinkAccepted !== true;

  return baseResult(
    input,
    'authenticated-candidate',
    requiresManualLinking
      ? 'Candidate session exists, but manual account linking is still required.'
      : 'Candidate session exists and may be used by explicit backend-primary candidate flow.',
    {
      ok: !requiresManualLinking,
      errorCode: requiresManualLinking ? 'manual_link_required' : undefined,
      requiresManualLinking,
      canUseBackendPrimaryCandidate: !requiresManualLinking,
    },
  );
};

export const resolveLogoutSessionBoundary = (
  input: AuthSessionBoundaryInput = {},
): AuthSessionBoundaryResult =>
  baseResult(input, 'unauthenticated', 'Logout candidate returns to unauthenticated local mode without deleting backup.', {
    ok: true,
  });
