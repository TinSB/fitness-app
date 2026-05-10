import type { DevApiReadOnlyEnabledConfig } from './devApiReadOnlyConfig';

export type DevApiReadOnlyPath =
  | '/health'
  | '/app-data/summary'
  | '/sessions/summary'
  | '/history'
  | '/data-health/summary'
  | `/history/${string}`;

export type DevApiReadOnlyErrorCode =
  | 'dev_api_route_not_allowed'
  | 'dev_api_fetch_unavailable'
  | 'dev_api_timeout'
  | 'dev_api_unavailable'
  | 'dev_api_invalid_response'
  | 'dev_api_error_response';

export type DevApiReadOnlyError = {
  code: DevApiReadOnlyErrorCode;
  message: string;
  serverCode?: string;
};

export type DevApiReadOnlyResult =
  | {
      ok: true;
      path: DevApiReadOnlyPath;
      status: number;
      result: unknown;
      snapshot?: unknown;
    }
  | {
      ok: false;
      path: DevApiReadOnlyPath;
      status?: number;
      error: DevApiReadOnlyError;
    };

export type DevApiReadOnlyFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export const DEV_API_READ_ONLY_ROUTES = [
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

export const isDevApiReadOnlyPath = (path: string): path is DevApiReadOnlyPath =>
  allowedStaticPaths.has(path) || /^\/history\/[^/]+$/.test(path);

const toResultError = (
  path: DevApiReadOnlyPath,
  error: DevApiReadOnlyError,
  status?: number,
): DevApiReadOnlyResult => ({
  ok: false,
  path,
  status,
  error,
});

const toRequestUrl = (baseUrl: string, path: DevApiReadOnlyPath) => `${baseUrl.replace(/\/$/, '')}${path}`;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isServerError = (value: unknown): value is { code: string; message: string } =>
  isRecord(value) && typeof value.code === 'string' && typeof value.message === 'string';

export const fetchDevApiReadOnlyPath = async (
  path: DevApiReadOnlyPath,
  config: DevApiReadOnlyEnabledConfig,
  options: {
    fetchImpl?: DevApiReadOnlyFetch;
    signal?: AbortSignal;
  } = {},
): Promise<DevApiReadOnlyResult> => {
  if (!isDevApiReadOnlyPath(path)) {
    return toResultError(path, {
      code: 'dev_api_route_not_allowed',
      message: 'Dev API read-only route is not allowed.',
    });
  }

  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (!fetchImpl) {
    return toResultError(path, {
      code: 'dev_api_fetch_unavailable',
      message: 'Fetch is unavailable for Dev API read-only comparison.',
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
          code: 'dev_api_invalid_response',
          message: 'Dev API read-only response was not an object.',
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
            code: 'dev_api_invalid_response',
            message: 'Dev API read-only error response shape is invalid.',
          },
          response.status,
        );
      }
      return toResultError(
        path,
        {
          code: 'dev_api_error_response',
          message: error.message,
          serverCode: error.code,
        },
        response.status,
      );
    }

    if (!('result' in body)) {
      return toResultError(
        path,
        {
          code: 'dev_api_invalid_response',
          message: 'Dev API read-only response is missing result.',
        },
        response.status,
      );
    }

    return {
      ok: true,
      path,
      status: response.status,
      result: body.result,
      snapshot: body.snapshot,
    };
  } catch {
    return toResultError(path, {
      code: didTimeout ? 'dev_api_timeout' : 'dev_api_unavailable',
      message: didTimeout
        ? 'Dev API read-only request timed out.'
        : 'Dev API read-only request is unavailable.',
    });
  } finally {
    globalThis.clearTimeout(timeout);
    options.signal?.removeEventListener('abort', abortFromParent);
  }
};

export const createDevApiReadOnlyClient = (
  config: DevApiReadOnlyEnabledConfig,
  fetchImpl?: DevApiReadOnlyFetch,
) => ({
  readHealth: (signal?: AbortSignal) => fetchDevApiReadOnlyPath('/health', config, { fetchImpl, signal }),
  readAppDataSummary: (signal?: AbortSignal) =>
    fetchDevApiReadOnlyPath('/app-data/summary', config, { fetchImpl, signal }),
  readSessionsSummary: (signal?: AbortSignal) =>
    fetchDevApiReadOnlyPath('/sessions/summary', config, { fetchImpl, signal }),
  readHistory: (signal?: AbortSignal) => fetchDevApiReadOnlyPath('/history', config, { fetchImpl, signal }),
  readHistoryDetail: (sessionId: string, signal?: AbortSignal) =>
    fetchDevApiReadOnlyPath(`/history/${encodeURIComponent(sessionId)}`, config, { fetchImpl, signal }),
  readDataHealthSummary: (signal?: AbortSignal) =>
    fetchDevApiReadOnlyPath('/data-health/summary', config, { fetchImpl, signal }),
});
