import type { DevApiHistoryDataFlagEnabledConfig } from './devApiHistoryDataFlagConfig';

export type HistoryDataFlagValue = 'normal' | 'test' | 'excluded';

export type DevApiHistoryDataFlagFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export type DevApiHistoryDataFlagErrorCode =
  | 'dev_mutation_aborted'
  | 'dev_mutation_fetch_unavailable'
  | 'dev_mutation_timeout'
  | 'dev_mutation_unavailable'
  | 'dev_mutation_invalid_response'
  | 'dev_mutation_error_response'
  | 'dev_mutation_missing_snapshot'
  | 'dev_mutation_not_successful'
  | 'dev_mutation_invalid_data_flag'
  | 'dev_mutation_source_fingerprint_missing';

export type DevApiHistoryDataFlagError = {
  code: DevApiHistoryDataFlagErrorCode;
  message: string;
  serverCode?: string;
};

export type DevApiHistoryDataFlagSnapshot = {
  snapshotId: string;
  schemaVersion: number;
  createdAt: string;
};

export type DevApiHistoryDataFlagMutationResult = {
  ok: boolean;
  changed: boolean;
  status: string;
  reasonCode: string;
  message: string;
  warnings?: string[];
  requiresConfirmation?: boolean;
};

export type DevApiHistoryDataFlagMetadata = {
  sessionId: string;
  targetDataFlag: HistoryDataFlagValue;
  mutationId: string;
  idempotencyKey: string;
  requestFingerprint: string;
  sourceFingerprint: string;
  confirmed: true;
  reason?: string;
  nowIso?: string;
};

export type DevApiHistoryDataFlagResult =
  | {
      ok: true;
      sessionId: string;
      targetDataFlag: HistoryDataFlagValue;
      status: number;
      result: DevApiHistoryDataFlagMutationResult;
      snapshot: DevApiHistoryDataFlagSnapshot;
      metadata: DevApiHistoryDataFlagMetadata;
    }
  | {
      ok: false;
      sessionId: string;
      targetDataFlag?: HistoryDataFlagValue;
      status?: number;
      error: DevApiHistoryDataFlagError;
      metadata?: DevApiHistoryDataFlagMetadata;
    };

export const DEV_API_HISTORY_DATA_FLAG_ROUTE = '/history/:id/data-flag';

const allowedDataFlags = new Set<HistoryDataFlagValue>(['normal', 'test', 'excluded']);

export const isHistoryDataFlagValue = (value: unknown): value is HistoryDataFlagValue =>
  value === 'normal' || value === 'test' || value === 'excluded';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isServerError = (value: unknown): value is { code: string; message: string } =>
  isRecord(value) && typeof value.code === 'string' && typeof value.message === 'string';

const isMutationResult = (value: unknown): value is DevApiHistoryDataFlagMutationResult =>
  isRecord(value)
  && typeof value.ok === 'boolean'
  && typeof value.changed === 'boolean'
  && typeof value.status === 'string'
  && typeof value.reasonCode === 'string'
  && typeof value.message === 'string';

const isSnapshot = (value: unknown): value is DevApiHistoryDataFlagSnapshot =>
  isRecord(value)
  && typeof value.snapshotId === 'string'
  && value.snapshotId.trim().length > 0
  && typeof value.schemaVersion === 'number'
  && Number.isFinite(value.schemaVersion)
  && typeof value.createdAt === 'string'
  && value.createdAt.trim().length > 0;

const toRequestUrl = (baseUrl: string, sessionId: string) =>
  `${baseUrl.replace(/\/$/, '')}/history/${encodeURIComponent(sessionId)}/data-flag`;

export const sanitizeHistoryDataFlagMessage = (message: string, fallback = 'History data-flag experiment failed.') => {
  const normalized = message
    .replace(/\b(?:Error|TypeError|SqliteRepositoryError):\s*/gi, '')
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

const failure = (
  sessionId: string,
  error: DevApiHistoryDataFlagError,
  status?: number,
  metadata?: DevApiHistoryDataFlagMetadata,
): DevApiHistoryDataFlagResult => ({
  ok: false,
  sessionId,
  targetDataFlag: metadata?.targetDataFlag,
  status,
  error: {
    ...error,
    message: sanitizeHistoryDataFlagMessage(error.message),
  },
  metadata,
});

export const updateHistoryDataFlagViaDevApi = async ({
  sessionId,
  targetDataFlag,
  config,
  metadata,
  fetchImpl,
  signal,
}: {
  sessionId: string;
  targetDataFlag: unknown;
  config: DevApiHistoryDataFlagEnabledConfig;
  metadata?: DevApiHistoryDataFlagMetadata;
  fetchImpl?: DevApiHistoryDataFlagFetch;
  signal?: AbortSignal;
}): Promise<DevApiHistoryDataFlagResult> => {
  if (!isHistoryDataFlagValue(targetDataFlag) || !allowedDataFlags.has(targetDataFlag)) {
    return failure(sessionId, {
      code: 'dev_mutation_invalid_data_flag',
      message: 'History dataFlag must be normal, test, or excluded.',
    }, undefined, metadata);
  }

  if (!metadata || !metadata.sourceFingerprint.trim() || metadata.confirmed !== true) {
    return failure(sessionId, {
      code: 'dev_mutation_source_fingerprint_missing',
      message: 'History data-flag source fingerprint is missing.',
    }, undefined, metadata);
  }

  const requestFetch = fetchImpl || globalThis.fetch;
  if (!requestFetch) {
    return failure(sessionId, {
      code: 'dev_mutation_fetch_unavailable',
      message: 'Fetch is unavailable for the History data-flag experiment.',
    }, undefined, metadata);
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
    const response = await requestFetch(toRequestUrl(config.baseUrl, sessionId), {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ dataFlag: targetDataFlag }),
      signal: controller.signal,
    });

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      return failure(sessionId, {
        code: 'dev_mutation_invalid_response',
        message: 'History data-flag response was not valid JSON.',
      }, response.status, metadata);
    }

    if (!isRecord(body)) {
      return failure(sessionId, {
        code: 'dev_mutation_invalid_response',
        message: 'History data-flag response was not an object.',
      }, response.status, metadata);
    }

    if ('error' in body) {
      const error = body.error;
      if (!isServerError(error)) {
        return failure(sessionId, {
          code: 'dev_mutation_invalid_response',
          message: 'History data-flag error response shape is invalid.',
        }, response.status, metadata);
      }
      return failure(sessionId, {
        code: 'dev_mutation_error_response',
        message: error.message,
        serverCode: error.code,
      }, response.status, metadata);
    }

    if (!isMutationResult(body.result)) {
      return failure(sessionId, {
        code: 'dev_mutation_invalid_response',
        message: 'History data-flag response is missing a mutation result.',
      }, response.status, metadata);
    }

    if (!response.ok || body.result.ok !== true || body.result.changed !== true || body.result.status !== 'success') {
      return failure(sessionId, {
        code: 'dev_mutation_not_successful',
        message: body.result.message || 'History dataFlag did not change.',
        serverCode: body.result.reasonCode,
      }, response.status, metadata);
    }

    if (!isSnapshot(body.snapshot)) {
      return failure(sessionId, {
        code: 'dev_mutation_missing_snapshot',
        message: 'History dataFlag did not return snapshot metadata.',
      }, response.status, metadata);
    }

    return {
      ok: true,
      sessionId,
      targetDataFlag,
      status: response.status,
      result: body.result,
      snapshot: body.snapshot,
      metadata,
    };
  } catch {
    const abortedByParent = !didTimeout && (signal?.aborted || controller.signal.aborted);
    return failure(sessionId, {
      code: didTimeout
        ? 'dev_mutation_timeout'
        : abortedByParent
          ? 'dev_mutation_aborted'
          : 'dev_mutation_unavailable',
      message: didTimeout
        ? 'History data-flag request timed out.'
        : abortedByParent
          ? 'History data-flag request was canceled before completion.'
          : 'History data-flag request is unavailable.',
    }, undefined, metadata);
  } finally {
    globalThis.clearTimeout(timeout);
    signal?.removeEventListener('abort', abortFromParent);
  }
};
