export type AuthFailureEmergencyReason =
  | 'provider_unavailable'
  | 'session_expired'
  | 'session_invalid'
  | 'user_mismatch'
  | 'owner_mismatch'
  | 'logout'
  | 'callback_error'
  | 'token_missing'
  | 'account_unlink_rejected';

export type AuthFailureRecommendedAction =
  | 'continue_local'
  | 'retry_candidate_later'
  | 'return_to_local_mode'
  | 'manual_owner_review'
  | 'keep_emergency_backup'
  | 'reject_candidate_success';

export type AuthFailureEmergencyInput = {
  reason: AuthFailureEmergencyReason;
  backendPrimaryEnabled?: boolean;
  emergencyBackupAvailable?: boolean;
  fallbackLocalStorageAvailable?: boolean;
  candidateClaimedSuccess?: boolean;
};

export type AuthFailureEmergencyResult = {
  ok: boolean;
  localAppAvailable: true;
  fallbackLocalStorageAvailable: boolean;
  emergencyLocalAvailable: boolean;
  backendPrimaryDisabled: boolean;
  localDataDeleted: false;
  cloudDataOverwritten: false;
  sourceOfTruthChanged: false;
  fakeSuccessAccepted: false;
  reason: AuthFailureEmergencyReason;
  recommendedAction: AuthFailureRecommendedAction;
  message: string;
};

const actionForReason = (reason: AuthFailureEmergencyReason): AuthFailureRecommendedAction => {
  switch (reason) {
    case 'provider_unavailable':
    case 'callback_error':
      return 'retry_candidate_later';
    case 'user_mismatch':
    case 'owner_mismatch':
    case 'account_unlink_rejected':
      return 'manual_owner_review';
    case 'logout':
      return 'return_to_local_mode';
    case 'token_missing':
    case 'session_expired':
    case 'session_invalid':
      return 'continue_local';
    default:
      return 'keep_emergency_backup';
  }
};

const messageForReason = (reason: AuthFailureEmergencyReason): string => {
  switch (reason) {
    case 'provider_unavailable':
      return 'Provider candidate is unavailable; continue in local mode.';
    case 'session_expired':
      return 'Candidate session expired; local mode remains available.';
    case 'session_invalid':
      return 'Candidate session is invalid; do not accept candidate success.';
    case 'user_mismatch':
      return 'Candidate user mismatch requires manual review.';
    case 'owner_mismatch':
      return 'Candidate owner mismatch requires manual review.';
    case 'logout':
      return 'Logout returns to local mode without deleting emergency backup.';
    case 'callback_error':
      return 'Callback candidate error keeps local mode available.';
    case 'token_missing':
      return 'Candidate credential is missing; continue in local mode.';
    case 'account_unlink_rejected':
      return 'Account unlink candidate is rejected; preserve local data.';
    default:
      return 'Local mode remains available.';
  }
};

export const resolveAuthFailureEmergencyLocalMode = (
  input: AuthFailureEmergencyInput,
): AuthFailureEmergencyResult => {
  const fallbackAvailable = input.fallbackLocalStorageAvailable !== false;
  const emergencyAvailable = input.emergencyBackupAvailable !== false;
  const noFakeSuccess = input.candidateClaimedSuccess === true
    ? 'reject_candidate_success'
    : actionForReason(input.reason);

  return {
    ok: input.reason === 'logout' && fallbackAvailable && emergencyAvailable && input.candidateClaimedSuccess !== true,
    localAppAvailable: true,
    fallbackLocalStorageAvailable: fallbackAvailable,
    emergencyLocalAvailable: emergencyAvailable,
    backendPrimaryDisabled: input.backendPrimaryEnabled === true,
    localDataDeleted: false,
    cloudDataOverwritten: false,
    sourceOfTruthChanged: false,
    fakeSuccessAccepted: false,
    reason: input.reason,
    recommendedAction: noFakeSuccess,
    message: messageForReason(input.reason),
  };
};
