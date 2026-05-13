export type BackendPrimaryReadCandidateSurface =
  | 'app-data-summary'
  | 'sessions-summary'
  | 'history'
  | 'history-detail'
  | 'data-health-summary';

export type BackendPrimaryReadCandidateStatus =
  | 'disabled'
  | 'success'
  | 'unavailable'
  | 'not_found'
  | 'mismatch'
  | 'fallback';

export type BackendPrimaryReadCandidateAdapterResult =
  | { ok: true; value: unknown }
  | { ok: false; code: 'unavailable' | 'not_found' | 'unsupported'; message: string };

export type BackendPrimaryReadCandidateAdapter = {
  read: (
    surface: BackendPrimaryReadCandidateSurface,
    params?: Record<string, string>,
  ) => Promise<BackendPrimaryReadCandidateAdapterResult>;
};

export type BackendPrimaryReadCandidateInput = {
  enabled?: boolean;
  surface: BackendPrimaryReadCandidateSurface;
  params?: Record<string, string>;
  localValue?: unknown;
  adapter?: BackendPrimaryReadCandidateAdapter;
};

export type BackendPrimaryReadCandidateResult = {
  status: BackendPrimaryReadCandidateStatus;
  surface: BackendPrimaryReadCandidateSurface;
  sourceOfTruth: 'localStorage';
  backendPrimaryCandidate: boolean;
  localStorageMutated: false;
  mutationCalled: false;
  value?: unknown;
  fallbackValue?: unknown;
  diagnostic?: {
    code: string;
    message: string;
  };
};

const stableStringify = (value: unknown): string => JSON.stringify(value, Object.keys(value as object).sort());

const valuesMatch = (left: unknown, right: unknown): boolean => stableStringify(left) === stableStringify(right);

export const runBackendPrimaryReadCandidate = async ({
  enabled = false,
  surface,
  params,
  localValue,
  adapter,
}: BackendPrimaryReadCandidateInput): Promise<BackendPrimaryReadCandidateResult> => {
  if (!enabled) {
    return {
      status: 'disabled',
      surface,
      sourceOfTruth: 'localStorage',
      backendPrimaryCandidate: false,
      localStorageMutated: false,
      mutationCalled: false,
      fallbackValue: localValue,
    };
  }

  if (adapter === undefined) {
    return {
      status: 'fallback',
      surface,
      sourceOfTruth: 'localStorage',
      backendPrimaryCandidate: true,
      localStorageMutated: false,
      mutationCalled: false,
      fallbackValue: localValue,
      diagnostic: {
        code: 'backend_read_adapter_required',
        message: 'Backend-primary read candidate requires an explicit adapter.',
      },
    };
  }

  const result = await adapter.read(surface, params);
  if (!result.ok) {
    return {
      status: result.code === 'not_found' ? 'not_found' : 'unavailable',
      surface,
      sourceOfTruth: 'localStorage',
      backendPrimaryCandidate: true,
      localStorageMutated: false,
      mutationCalled: false,
      fallbackValue: localValue,
      diagnostic: {
        code: `backend_read_${result.code}`,
        message: result.message,
      },
    };
  }

  if (localValue !== undefined && !valuesMatch(localValue, result.value)) {
    return {
      status: 'mismatch',
      surface,
      sourceOfTruth: 'localStorage',
      backendPrimaryCandidate: true,
      localStorageMutated: false,
      mutationCalled: false,
      value: result.value,
      fallbackValue: localValue,
      diagnostic: {
        code: 'backend_read_mismatch',
        message: 'Backend-primary read candidate differs from localStorage value; no repair or overwrite was performed.',
      },
    };
  }

  return {
    status: 'success',
    surface,
    sourceOfTruth: 'localStorage',
    backendPrimaryCandidate: true,
    localStorageMutated: false,
    mutationCalled: false,
    value: result.value,
    fallbackValue: localValue,
  };
};
