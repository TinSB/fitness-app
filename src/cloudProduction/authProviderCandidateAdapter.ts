export type CandidateProviderName = 'supabase-auth-candidate' | 'clerk-candidate';

export type ProviderCandidateState =
  | 'disabled'
  | 'provider_candidate'
  | 'provider_not_configured'
  | 'session_unavailable'
  | 'user_unavailable'
  | 'unsupported';

export type ProviderCandidateErrorCode =
  | 'candidate_disabled'
  | 'provider_config_missing'
  | 'callback_rejected'
  | 'session_unavailable'
  | 'user_unavailable'
  | 'operation_unsupported'
  | 'secret_exposed'
  | 'local_data_mutation_blocked';

export type ProviderCandidateUser = {
  userId: string;
  accountId: string;
  displayName?: string;
};

export type ProviderCandidateSession = {
  state: ProviderCandidateState;
  providerCandidate: CandidateProviderName | null;
  userCandidate: ProviderCandidateUser | null;
  sessionCandidateId: string | null;
  secretsExposed: false;
  localDataChanged: false;
  sourceOfTruthChanged: false;
};

export type ProviderCandidateResult = ProviderCandidateSession & {
  ok: boolean;
  errorCode?: ProviderCandidateErrorCode;
  message: string;
};

export type ProviderCandidateAdapter = {
  readonly adapterName: string;
  readonly providerCandidate: CandidateProviderName | null;
  readonly networkEnabled: false;
  readonly sdkLoaded: false;
  readonly secretsExposed: false;
  getCandidateSession: () => ProviderCandidateResult;
  getCandidateUser: () => ProviderCandidateResult;
  startCandidateFlow: () => ProviderCandidateResult;
  endCandidateFlow: () => ProviderCandidateResult;
};

export type ProviderCandidateAdapterOptions = {
  enabled?: boolean;
  providerCandidate?: CandidateProviderName;
  callbackGuard?: { ok: boolean };
  fakeSession?: ProviderCandidateUser | null;
};

const result = (
  state: ProviderCandidateState,
  message: string,
  ok = false,
  options: {
    errorCode?: ProviderCandidateErrorCode;
    providerCandidate?: CandidateProviderName | null;
    userCandidate?: ProviderCandidateUser | null;
    sessionCandidateId?: string | null;
  } = {},
): ProviderCandidateResult => ({
  ok,
  state,
  providerCandidate: options.providerCandidate ?? null,
  userCandidate: options.userCandidate ?? null,
  sessionCandidateId: options.sessionCandidateId ?? null,
  secretsExposed: false,
  localDataChanged: false,
  sourceOfTruthChanged: false,
  errorCode: options.errorCode,
  message,
});

const disabledAdapter = (): ProviderCandidateAdapter => ({
  adapterName: 'disabled-provider-candidate-adapter',
  providerCandidate: null,
  networkEnabled: false,
  sdkLoaded: false,
  secretsExposed: false,
  getCandidateSession: () =>
    result('disabled', 'Provider candidate adapter is disabled by default.', false, {
      errorCode: 'candidate_disabled',
    }),
  getCandidateUser: () =>
    result('disabled', 'Provider candidate user lookup is disabled.', false, {
      errorCode: 'candidate_disabled',
    }),
  startCandidateFlow: () =>
    result('unsupported', 'Starting a real provider flow is not implemented in Phase 11.', false, {
      errorCode: 'operation_unsupported',
    }),
  endCandidateFlow: () =>
    result('unsupported', 'Ending a real provider flow is not implemented in Phase 11.', false, {
      errorCode: 'operation_unsupported',
    }),
});

const missingProviderAdapter = (): ProviderCandidateAdapter => ({
  ...disabledAdapter(),
  adapterName: 'missing-provider-candidate-adapter',
  getCandidateSession: () =>
    result('provider_not_configured', 'Provider candidate config is missing.', false, {
      errorCode: 'provider_config_missing',
    }),
  getCandidateUser: () =>
    result('provider_not_configured', 'Provider candidate config is missing.', false, {
      errorCode: 'provider_config_missing',
    }),
});

const rejectedCallbackAdapter = (providerCandidate: CandidateProviderName | null): ProviderCandidateAdapter => ({
  ...disabledAdapter(),
  adapterName: 'callback-rejected-provider-candidate-adapter',
  providerCandidate,
  getCandidateSession: () =>
    result('unsupported', 'Provider candidate callback guard rejected this configuration.', false, {
      errorCode: 'callback_rejected',
      providerCandidate,
    }),
  getCandidateUser: () =>
    result('unsupported', 'Provider candidate callback guard rejected this configuration.', false, {
      errorCode: 'callback_rejected',
      providerCandidate,
    }),
});

export const createSupabaseAuthCandidateAdapter = (
  options: ProviderCandidateAdapterOptions = {},
): ProviderCandidateAdapter => {
  if (options.enabled !== true) return disabledAdapter();

  if (!options.providerCandidate) return missingProviderAdapter();

  if (options.callbackGuard && !options.callbackGuard.ok) {
    return rejectedCallbackAdapter(options.providerCandidate);
  }

  const userCandidate = options.fakeSession ?? null;
  const sessionCandidateId = userCandidate ? `candidate-session:${userCandidate.accountId}` : null;

  return {
    adapterName: 'supabase-auth-candidate-adapter',
    providerCandidate: options.providerCandidate,
    networkEnabled: false,
    sdkLoaded: false,
    secretsExposed: false,
    getCandidateSession: () =>
      userCandidate
        ? result('provider_candidate', 'Fake provider candidate session is available for tests only.', true, {
            providerCandidate: options.providerCandidate,
            userCandidate,
            sessionCandidateId,
          })
        : result('session_unavailable', 'Provider candidate session is unavailable.', false, {
            errorCode: 'session_unavailable',
            providerCandidate: options.providerCandidate,
          }),
    getCandidateUser: () =>
      userCandidate
        ? result('provider_candidate', 'Fake provider candidate user is available for tests only.', true, {
            providerCandidate: options.providerCandidate,
            userCandidate,
            sessionCandidateId,
          })
        : result('user_unavailable', 'Provider candidate user is unavailable.', false, {
            errorCode: 'user_unavailable',
            providerCandidate: options.providerCandidate,
          }),
    startCandidateFlow: () =>
      result('unsupported', 'Real provider start flow is not implemented in Phase 11.', false, {
        errorCode: 'operation_unsupported',
        providerCandidate: options.providerCandidate,
      }),
    endCandidateFlow: () =>
      result('unsupported', 'Real provider end flow is not implemented in Phase 11.', false, {
        errorCode: 'operation_unsupported',
        providerCandidate: options.providerCandidate,
      }),
  };
};

export const createDisabledProviderCandidateAdapter = (): ProviderCandidateAdapter => disabledAdapter();
