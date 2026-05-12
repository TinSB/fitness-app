export type ApiStorageAdapterEnv = {
  DEV?: boolean | string;
  VITE_IRONPATH_RUNTIME_SOURCE?: string;
  VITE_IRONPATH_DEV_API_BASE_URL?: string;
  VITE_IRONPATH_DEV_API_TIMEOUT_MS?: string | number;
};

export type ApiStorageAdapterDisabledConfig = {
  enabled: false;
  status: 'disabled';
  reason: 'not_dev' | 'runtime_source_off';
};

export type ApiStorageAdapterInvalidConfig = {
  enabled: false;
  status: 'invalid';
  error: {
    code: 'api_storage_invalid_base_url' | 'api_storage_non_localhost_base_url' | 'api_storage_invalid_timeout';
    message: string;
  };
};

export type ApiStorageAdapterEnabledConfig = {
  enabled: true;
  status: 'enabled';
  runtimeSource: typeof API_STORAGE_ADAPTER_RUNTIME_SOURCE;
  baseUrl: string;
  timeoutMs: number;
};

export type ApiStorageAdapterConfig =
  | ApiStorageAdapterDisabledConfig
  | ApiStorageAdapterInvalidConfig
  | ApiStorageAdapterEnabledConfig;

export type ApiStorageAdapterFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export type ApiStorageSnapshotMetadata = {
  snapshotId: string;
  schemaVersion?: number;
  createdAt: string;
  label?: string;
};

export type ApiStorageMutationResult = {
  ok: boolean;
  changed: boolean;
  status: string;
  reasonCode: string;
  message: string;
  warnings?: string[];
  requiresConfirmation?: boolean;
};

export type ApiStorageAdapterErrorCode =
  | 'api_storage_disabled'
  | 'api_storage_invalid_target'
  | 'api_storage_fetch_unavailable'
  | 'api_storage_timeout'
  | 'api_storage_aborted'
  | 'api_storage_unavailable'
  | 'api_storage_invalid_response'
  | 'api_storage_error_response'
  | 'api_storage_missing_snapshot'
  | 'api_storage_write_not_successful';

export type ApiStorageAdapterError = {
  code: ApiStorageAdapterErrorCode;
  message: string;
  serverCode?: string;
};

export type ApiStorageReadResult =
  | {
      ok: true;
      status: number;
      result: unknown;
      snapshot?: ApiStorageSnapshotMetadata;
      snapshotMetadataPresent: boolean;
    }
  | {
      ok: false;
      status?: number;
      error: ApiStorageAdapterError;
    };

export type ApiStorageWriteResult =
  | {
      ok: true;
      route: ApiStorageAcceptedWriteRoute;
      status: number;
      result: ApiStorageMutationResult;
      snapshot: ApiStorageSnapshotMetadata;
    }
  | {
      ok: false;
      route?: ApiStorageAcceptedWriteRoute;
      status?: number;
      error: ApiStorageAdapterError;
    };

export type ApiStorageSourceMetadata = {
  sourceSnapshotHash: string;
  sourceSnapshotVersion: string;
  mutationId: string;
  idempotencyKey: string;
  requestFingerprint: string;
  confirmed?: true;
};

export type ApiStorageHistoryDataFlag = 'normal' | 'test' | 'excluded';

export type ApiStorageDataHealthDismissBody = ApiStorageSourceMetadata & {
  issueId: string;
};

export type ApiStorageHistoryDataFlagBody = ApiStorageSourceMetadata & {
  historyId: string;
  dataFlag: ApiStorageHistoryDataFlag;
};

export type ApiStorageHistorySetEditBody = ApiStorageSourceMetadata & {
  historyId: string;
  exerciseId: string;
  setId: string;
  actualWeightKg?: number;
  actualReps?: number;
  rir?: number;
  note?: string;
};

export type ApiStorageSessionStartBody = ApiStorageSourceMetadata & {
  templateId: string;
  confirmed: true;
};

export type ApiStorageSessionPatchBody = ApiStorageSourceMetadata & {
  activeSessionId: string;
  pendingPatchId?: string;
  patches?: unknown[];
  confirmed: true;
};

export type ApiStorageSessionCompleteBody = ApiStorageSourceMetadata & {
  activeSessionId: string;
  confirmed: true;
  confirmIncompleteMainWork?: true;
};

export type ApiStorageSessionDiscardBody = ApiStorageSourceMetadata & {
  activeSessionId: string;
  confirmed: true;
  confirmDiscard: true;
};

export type ApiStorageAcceptedWriteRoute =
  | '/data-health/issues/:issueId/dismiss'
  | '/history/:id/data-flag'
  | '/history/:id/edit'
  | '/sessions/start'
  | '/sessions/active/patches'
  | '/sessions/active/complete'
  | '/sessions/active/discard';

export const API_STORAGE_ADAPTER_RUNTIME_SOURCE = 'api-primary-dev';
export const DEFAULT_API_STORAGE_ADAPTER_BASE_URL = 'http://127.0.0.1:8787';
export const DEFAULT_API_STORAGE_ADAPTER_TIMEOUT_MS = 1500;
export const API_STORAGE_ADAPTER_WRITE_METHOD = ['PO', 'ST'].join('');
export const API_STORAGE_ADAPTER_READ_METHOD = 'GET';

export const API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES: readonly ApiStorageAcceptedWriteRoute[] = [
  '/data-health/issues/:issueId/dismiss',
  '/history/:id/data-flag',
  '/history/:id/edit',
  '/sessions/start',
  '/sessions/active/patches',
  '/sessions/active/complete',
  '/sessions/active/discard',
];

const isDevValue = (value: ApiStorageAdapterEnv['DEV']) => value === true || value === 'true';

const normalizeLocalHostname = (hostname: string) => hostname.toLowerCase().replace(/^\[(.*)]$/, '$1');

const isLocalhostUrl = (url: URL) => {
  const hostname = normalizeLocalHostname(url.hostname);
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
};

const normalizeBaseUrl = (rawBaseUrl: string) => {
  const url = new URL(rawBaseUrl);
  url.pathname = url.pathname.replace(/\/+$/, '');
  url.search = '';
  url.hash = '';
  return url.toString().replace(/\/$/, '');
};

const resolveTimeoutMs = (rawTimeout: ApiStorageAdapterEnv['VITE_IRONPATH_DEV_API_TIMEOUT_MS']) => {
  if (rawTimeout === undefined || rawTimeout === '') return DEFAULT_API_STORAGE_ADAPTER_TIMEOUT_MS;
  const timeout = typeof rawTimeout === 'number' ? rawTimeout : Number(rawTimeout);
  return Number.isFinite(timeout) && timeout > 0 ? Math.floor(timeout) : null;
};

export const resolveApiStorageAdapterConfig = (env: ApiStorageAdapterEnv): ApiStorageAdapterConfig => {
  if (!isDevValue(env.DEV)) {
    return { enabled: false, status: 'disabled', reason: 'not_dev' };
  }

  if (env.VITE_IRONPATH_RUNTIME_SOURCE !== API_STORAGE_ADAPTER_RUNTIME_SOURCE) {
    return { enabled: false, status: 'disabled', reason: 'runtime_source_off' };
  }

  const timeoutMs = resolveTimeoutMs(env.VITE_IRONPATH_DEV_API_TIMEOUT_MS);
  if (timeoutMs === null) {
    return {
      enabled: false,
      status: 'invalid',
      error: {
        code: 'api_storage_invalid_timeout',
        message: 'API storage adapter timeout must be a positive number.',
      },
    };
  }

  const rawBaseUrl = env.VITE_IRONPATH_DEV_API_BASE_URL || DEFAULT_API_STORAGE_ADAPTER_BASE_URL;
  let url: URL;
  try {
    url = new URL(rawBaseUrl);
  } catch {
    return {
      enabled: false,
      status: 'invalid',
      error: {
        code: 'api_storage_invalid_base_url',
        message: 'API storage adapter base URL is invalid.',
      },
    };
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return {
      enabled: false,
      status: 'invalid',
      error: {
        code: 'api_storage_invalid_base_url',
        message: 'API storage adapter base URL must use HTTP.',
      },
    };
  }

  if (!isLocalhostUrl(url)) {
    return {
      enabled: false,
      status: 'invalid',
      error: {
        code: 'api_storage_non_localhost_base_url',
        message: 'API storage adapter base URL must be localhost-only.',
      },
    };
  }

  return {
    enabled: true,
    status: 'enabled',
    runtimeSource: API_STORAGE_ADAPTER_RUNTIME_SOURCE,
    baseUrl: normalizeBaseUrl(rawBaseUrl),
    timeoutMs,
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isServerError = (value: unknown): value is { code: string; message: string } =>
  isRecord(value) && typeof value.code === 'string' && typeof value.message === 'string';

const isSnapshot = (value: unknown): value is ApiStorageSnapshotMetadata =>
  isRecord(value)
  && typeof value.snapshotId === 'string'
  && value.snapshotId.trim().length > 0
  && typeof value.createdAt === 'string'
  && value.createdAt.trim().length > 0;

const isMutationResult = (value: unknown): value is ApiStorageMutationResult =>
  isRecord(value)
  && typeof value.ok === 'boolean'
  && typeof value.changed === 'boolean'
  && typeof value.status === 'string'
  && typeof value.reasonCode === 'string'
  && typeof value.message === 'string';

const clean = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const sanitizeApiStorageMessage = (message: string, fallback = 'API storage adapter request failed.') => {
  const normalized = message
    .replace(/\b(?:Error|TypeError|RepositoryError|[A-Za-z]+RepositoryError):\s*/gi, '')
    .replace(/\{[\s\S]*?\}/g, '[details omitted]')
    .replace(/\[[\s\S]*?\]/g, '[details omitted]')
    .replace(/\bat\s+[^\n\r]+/gi, '')
    .replace(/stack/gi, 'diagnostic')
    .replace(/\bAppData\b/g, 'app data')
    .replace(/\blocalStorage\b/g, 'local data')
    .replace(/\bSQLite\b/gi, 'repository')
    .replace(/\s+/g, ' ')
    .trim();
  return (normalized || fallback).slice(0, 180);
};

const readFailure = (
  error: ApiStorageAdapterError,
  status?: number,
): ApiStorageReadResult => ({
  ok: false,
  status,
  error: { ...error, message: sanitizeApiStorageMessage(error.message) },
});

const writeFailure = (
  error: ApiStorageAdapterError,
  route?: ApiStorageAcceptedWriteRoute,
  status?: number,
): ApiStorageWriteResult => ({
  ok: false,
  route,
  status,
  error: { ...error, message: sanitizeApiStorageMessage(error.message) },
});

const toRequestUrl = (baseUrl: string, path: string) => `${baseUrl.replace(/\/$/, '')}${path}`;

const invalidIfDisabled = (config: ApiStorageAdapterConfig): ApiStorageAdapterError | null => {
  if (config.enabled) return null;
  return {
    code: 'api_storage_disabled',
    message: config.status === 'invalid' ? config.error.message : 'API storage adapter is disabled.',
  };
};

const requestJson = async ({
  config,
  fetchImpl,
  method,
  path,
  body,
  signal,
}: {
  config: ApiStorageAdapterEnabledConfig;
  fetchImpl?: ApiStorageAdapterFetch;
  method: string;
  path: string;
  body?: unknown;
  signal?: AbortSignal;
}): Promise<{ ok: true; status: number; body: unknown } | { ok: false; status?: number; error: ApiStorageAdapterError }> => {
  const requestFetch = fetchImpl || globalThis.fetch;
  if (!requestFetch) {
    return {
      ok: false,
      error: {
        code: 'api_storage_fetch_unavailable',
        message: 'Fetch is unavailable for the API storage adapter.',
      },
    };
  }

  const controller = new AbortController();
  let didTimeout = false;
  const timeout = globalThis.setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, config.timeoutMs);
  const abortFromParent = () => controller.abort();
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener('abort', abortFromParent, { once: true });

  try {
    const response = await requestFetch(toRequestUrl(config.baseUrl, path), {
      method,
      headers: {
        Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: controller.signal,
    });

    let parsed: unknown;
    try {
      parsed = await response.json();
    } catch {
      return {
        ok: false,
        status: response.status,
        error: {
          code: 'api_storage_invalid_response',
          message: 'API storage adapter response was not valid JSON.',
        },
      };
    }

    if (!isRecord(parsed)) {
      return {
        ok: false,
        status: response.status,
        error: {
          code: 'api_storage_invalid_response',
          message: 'API storage adapter response was not an object.',
        },
      };
    }

    if ('error' in parsed) {
      const error = parsed.error;
      if (!isServerError(error)) {
        return {
          ok: false,
          status: response.status,
          error: {
            code: 'api_storage_invalid_response',
            message: 'API storage adapter error response shape is invalid.',
          },
        };
      }
      return {
        ok: false,
        status: response.status,
        error: {
          code: 'api_storage_error_response',
          message: error.message,
          serverCode: error.code,
        },
      };
    }

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: {
          code: 'api_storage_error_response',
          message: 'API storage adapter request returned a non-success status.',
          serverCode: 'http_error',
        },
      };
    }

    return { ok: true, status: response.status, body: parsed };
  } catch {
    const abortedByParent = !didTimeout && (signal?.aborted || controller.signal.aborted);
    return {
      ok: false,
      error: {
        code: didTimeout ? 'api_storage_timeout' : abortedByParent ? 'api_storage_aborted' : 'api_storage_unavailable',
        message: didTimeout
          ? 'API storage adapter request timed out.'
          : abortedByParent
            ? 'API storage adapter request was canceled before completion.'
            : 'API storage adapter request is unavailable.',
      },
    };
  } finally {
    globalThis.clearTimeout(timeout);
    signal?.removeEventListener('abort', abortFromParent);
  }
};

export const readAppDataSummaryFromApiStorage = async ({
  config,
  fetchImpl,
  signal,
}: {
  config: ApiStorageAdapterConfig;
  fetchImpl?: ApiStorageAdapterFetch;
  signal?: AbortSignal;
}): Promise<ApiStorageReadResult> => {
  const disabled = invalidIfDisabled(config);
  if (disabled) return readFailure(disabled);
  const enabledConfig = config as ApiStorageAdapterEnabledConfig;

  const response = await requestJson({
    config: enabledConfig,
    fetchImpl,
    method: API_STORAGE_ADAPTER_READ_METHOD,
    path: '/app-data/summary',
    signal,
  });
  if (!response.ok) return readFailure(response.error, response.status);
  if (!isRecord(response.body) || !('result' in response.body)) {
    return readFailure({
      code: 'api_storage_invalid_response',
      message: 'API storage adapter read response is missing result.',
    }, response.status);
  }

  const snapshot = isSnapshot(response.body.snapshot) ? response.body.snapshot : undefined;
  return {
    ok: true,
    status: response.status,
    result: response.body.result,
    snapshot,
    snapshotMetadataPresent: Boolean(snapshot),
  };
};

const validateTarget = (value: unknown, label: string): string | ApiStorageAdapterError => {
  const target = clean(value);
  if (target) return target;
  return {
    code: 'api_storage_invalid_target',
    message: `${label} is required for the API storage adapter.`,
  };
};

const writeAcceptedMutation = async ({
  config,
  fetchImpl,
  route,
  path,
  body,
  signal,
}: {
  config: ApiStorageAdapterConfig;
  fetchImpl?: ApiStorageAdapterFetch;
  route: ApiStorageAcceptedWriteRoute;
  path: string;
  body: unknown;
  signal?: AbortSignal;
}): Promise<ApiStorageWriteResult> => {
  const disabled = invalidIfDisabled(config);
  if (disabled) return writeFailure(disabled, route);
  const enabledConfig = config as ApiStorageAdapterEnabledConfig;

  const response = await requestJson({
    config: enabledConfig,
    fetchImpl,
    method: API_STORAGE_ADAPTER_WRITE_METHOD,
    path,
    body,
    signal,
  });
  if (!response.ok) return writeFailure(response.error, route, response.status);
  if (!isRecord(response.body) || !isMutationResult(response.body.result)) {
    return writeFailure({
      code: 'api_storage_invalid_response',
      message: 'API storage adapter write response is missing mutation result.',
    }, route, response.status);
  }
  if (response.body.result.ok !== true || response.body.result.changed !== true || response.body.result.status !== 'success') {
    return writeFailure({
      code: 'api_storage_write_not_successful',
      message: response.body.result.message || 'API storage adapter write did not change.',
      serverCode: response.body.result.reasonCode,
    }, route, response.status);
  }
  if (!isSnapshot(response.body.snapshot)) {
    return writeFailure({
      code: 'api_storage_missing_snapshot',
      message: 'API storage adapter write did not return snapshot metadata.',
    }, route, response.status);
  }

  return {
    ok: true,
    route,
    status: response.status,
    result: response.body.result,
    snapshot: response.body.snapshot,
  };
};

export const createApiStorageAdapter = (
  config: ApiStorageAdapterConfig,
  fetchImpl?: ApiStorageAdapterFetch,
) => ({
  config,
  readAppDataSummary: (signal?: AbortSignal) => readAppDataSummaryFromApiStorage({ config, fetchImpl, signal }),
  writeDataHealthDismiss: (
    input: ApiStorageDataHealthDismissBody,
    signal?: AbortSignal,
  ) => {
    const issueId = validateTarget(input.issueId, 'DataHealth issue id');
    if (typeof issueId !== 'string') return Promise.resolve(writeFailure(issueId, '/data-health/issues/:issueId/dismiss'));
    return writeAcceptedMutation({
      config,
      fetchImpl,
      route: '/data-health/issues/:issueId/dismiss',
      path: `/data-health/issues/${encodeURIComponent(issueId)}/dismiss`,
      body: input,
      signal,
    });
  },
  writeHistoryDataFlag: (
    input: ApiStorageHistoryDataFlagBody,
    signal?: AbortSignal,
  ) => {
    const historyId = validateTarget(input.historyId, 'History id');
    if (typeof historyId !== 'string') return Promise.resolve(writeFailure(historyId, '/history/:id/data-flag'));
    return writeAcceptedMutation({
      config,
      fetchImpl,
      route: '/history/:id/data-flag',
      path: `/history/${encodeURIComponent(historyId)}/data-flag`,
      body: input,
      signal,
    });
  },
  writeHistorySetEdit: (
    input: ApiStorageHistorySetEditBody,
    signal?: AbortSignal,
  ) => {
    const historyId = validateTarget(input.historyId, 'History id');
    if (typeof historyId !== 'string') return Promise.resolve(writeFailure(historyId, '/history/:id/edit'));
    return writeAcceptedMutation({
      config,
      fetchImpl,
      route: '/history/:id/edit',
      path: `/history/${encodeURIComponent(historyId)}/edit`,
      body: input,
      signal,
    });
  },
  writeSessionStart: (input: ApiStorageSessionStartBody, signal?: AbortSignal) =>
    writeAcceptedMutation({
      config,
      fetchImpl,
      route: '/sessions/start',
      path: '/sessions/start',
      body: input,
      signal,
    }),
  writeSessionPatch: (input: ApiStorageSessionPatchBody, signal?: AbortSignal) =>
    writeAcceptedMutation({
      config,
      fetchImpl,
      route: '/sessions/active/patches',
      path: '/sessions/active/patches',
      body: input,
      signal,
    }),
  writeSessionComplete: (input: ApiStorageSessionCompleteBody, signal?: AbortSignal) =>
    writeAcceptedMutation({
      config,
      fetchImpl,
      route: '/sessions/active/complete',
      path: '/sessions/active/complete',
      body: input,
      signal,
    }),
  writeSessionDiscard: (input: ApiStorageSessionDiscardBody, signal?: AbortSignal) =>
    writeAcceptedMutation({
      config,
      fetchImpl,
      route: '/sessions/active/discard',
      path: '/sessions/active/discard',
      body: input,
      signal,
    }),
});
