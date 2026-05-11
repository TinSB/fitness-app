import type { ApiBackedReadEnabledConfig } from './apiBackedReadConfig';

export type ApiBackedReadPath =
  | '/health'
  | '/app-data/summary'
  | '/sessions/summary'
  | '/history'
  | '/data-health/summary'
  | `/history/${string}`;

export type ApiBackedReadErrorCode =
  | 'api_backed_read_route_not_allowed'
  | 'api_backed_read_fetch_unavailable'
  | 'api_backed_read_timeout'
  | 'api_backed_read_unavailable'
  | 'api_backed_read_invalid_response'
  | 'api_backed_read_error_response';

export type ApiBackedReadError = {
  code: ApiBackedReadErrorCode;
  message: string;
  serverCode?: string;
};

export type ApiBackedReadSnapshotMetadata = {
  snapshotId: string;
  createdAt: string;
  schemaVersion?: number;
  label?: string;
};

export type ApiBackedReadResult =
  | {
      ok: true;
      path: ApiBackedReadPath;
      status: number;
      result: unknown;
      snapshot?: ApiBackedReadSnapshotMetadata;
      snapshotMetadataPresent: boolean;
    }
  | {
      ok: false;
      path: ApiBackedReadPath;
      status?: number;
      error: ApiBackedReadError;
    };

export type ApiBackedReadFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export const API_BACKED_READ_ROUTES = [
  '/health',
  '/app-data/summary',
  '/sessions/summary',
  '/history',
  '/history/:id',
  '/data-health/summary',
] as const;

const allowedStaticPaths = new Set<string>([
  '/health',
  '/app-data/summary',
  '/sessions/summary',
  '/history',
  '/data-health/summary',
]);

export const isApiBackedReadPath = (path: string): path is ApiBackedReadPath =>
  allowedStaticPaths.has(path) || /^\/history\/[^/]+$/.test(path);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isServerError = (value: unknown): value is { code: string; message: string } =>
  isRecord(value) && typeof value.code === 'string' && typeof value.message === 'string';

const isSnapshotMetadata = (value: unknown): value is ApiBackedReadSnapshotMetadata =>
  isRecord(value)
  && typeof value.snapshotId === 'string'
  && value.snapshotId.trim().length > 0
  && typeof value.createdAt === 'string'
  && value.createdAt.trim().length > 0;

const toResultError = (
  path: ApiBackedReadPath,
  error: ApiBackedReadError,
  status?: number,
): ApiBackedReadResult => ({
  ok: false,
  path,
  status,
  error,
});

const toRequestUrl = (baseUrl: string, path: ApiBackedReadPath) => `${baseUrl.replace(/\/$/, '')}${path}`;

export const fetchApiBackedReadPath = async (
  path: ApiBackedReadPath,
  config: ApiBackedReadEnabledConfig,
  options: {
    fetchImpl?: ApiBackedReadFetch;
    signal?: AbortSignal;
  } = {},
): Promise<ApiBackedReadResult> => {
  if (!isApiBackedReadPath(path)) {
    return toResultError(path, {
      code: 'api_backed_read_route_not_allowed',
      message: 'API-backed read route is not allowed.',
    });
  }

  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (!fetchImpl) {
    return toResultError(path, {
      code: 'api_backed_read_fetch_unavailable',
      message: 'Fetch is unavailable for API-backed read diagnostics.',
    });
  }

  const controller = new AbortController();
  let didTimeout = false;
  const timeout = globalThis.setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, config.timeoutMs);

  const abortFromParent = () => controller.abort();
  if (options.signal?.aborted) controller.abort();
  else options.signal?.addEventListener('abort', abortFromParent, { once: true });

  try {
    const response = await fetchImpl(toRequestUrl(config.baseUrl, path), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    const body = (await response.json()) as unknown;

    if (!isRecord(body)) {
      return toResultError(
        path,
        {
          code: 'api_backed_read_invalid_response',
          message: 'API-backed read response was not an object.',
        },
        response.status,
      );
    }

    if ('error' in body) {
      const error = body.error;
      if (!isServerError(error)) {
        return toResultError(
          path,
          {
            code: 'api_backed_read_invalid_response',
            message: 'API-backed read error response shape is invalid.',
          },
          response.status,
        );
      }
      return toResultError(
        path,
        {
          code: 'api_backed_read_error_response',
          message: error.message,
          serverCode: error.code,
        },
        response.status,
      );
    }

    if (!response.ok) {
      return toResultError(
        path,
        {
          code: 'api_backed_read_error_response',
          message: 'API-backed read request returned a non-success status.',
          serverCode: 'http_error',
        },
        response.status,
      );
    }

    if (!('result' in body)) {
      return toResultError(
        path,
        {
          code: 'api_backed_read_invalid_response',
          message: 'API-backed read response is missing result.',
        },
        response.status,
      );
    }

    const snapshot = isSnapshotMetadata(body.snapshot) ? body.snapshot : undefined;
    return {
      ok: true,
      path,
      status: response.status,
      result: body.result,
      snapshot,
      snapshotMetadataPresent: Boolean(snapshot),
    };
  } catch {
    return toResultError(path, {
      code: didTimeout ? 'api_backed_read_timeout' : 'api_backed_read_unavailable',
      message: didTimeout
        ? 'API-backed read request timed out.'
        : 'API-backed read request is unavailable.',
    });
  } finally {
    globalThis.clearTimeout(timeout);
    options.signal?.removeEventListener('abort', abortFromParent);
  }
};

export const createApiBackedReadClient = (
  config: ApiBackedReadEnabledConfig,
  fetchImpl?: ApiBackedReadFetch,
) => ({
  readHealth: (signal?: AbortSignal) => fetchApiBackedReadPath('/health', config, { fetchImpl, signal }),
  readAppDataSummary: (signal?: AbortSignal) =>
    fetchApiBackedReadPath('/app-data/summary', config, { fetchImpl, signal }),
  readSessionsSummary: (signal?: AbortSignal) =>
    fetchApiBackedReadPath('/sessions/summary', config, { fetchImpl, signal }),
  readHistory: (signal?: AbortSignal) => fetchApiBackedReadPath('/history', config, { fetchImpl, signal }),
  readHistoryDetail: (sessionId: string, signal?: AbortSignal) =>
    fetchApiBackedReadPath(`/history/${encodeURIComponent(sessionId)}`, config, { fetchImpl, signal }),
  readDataHealthSummary: (signal?: AbortSignal) =>
    fetchApiBackedReadPath('/data-health/summary', config, { fetchImpl, signal }),
});
