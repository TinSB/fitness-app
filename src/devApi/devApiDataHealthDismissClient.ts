import type { DevApiDataHealthDismissEnabledConfig } from './devApiDataHealthDismissConfig';

export type DevApiDataHealthDismissFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export type DevApiDataHealthDismissErrorCode =
  | 'dev_mutation_fetch_unavailable'
  | 'dev_mutation_timeout'
  | 'dev_mutation_unavailable'
  | 'dev_mutation_invalid_response'
  | 'dev_mutation_error_response'
  | 'dev_mutation_missing_snapshot'
  | 'dev_mutation_not_successful'
  | 'dev_mutation_source_fingerprint_missing';

export type DevApiDataHealthDismissError = {
  code: DevApiDataHealthDismissErrorCode;
  message: string;
  serverCode?: string;
};

export type DevApiDataHealthDismissSnapshot = {
  snapshotId: string;
  schemaVersion: number;
  createdAt: string;
};

export type DevApiDataHealthDismissMutationResult = {
  ok: boolean;
  changed: boolean;
  status: string;
  reasonCode: string;
  message: string;
  warnings?: string[];
  requiresConfirmation?: boolean;
};

export type DevApiDataHealthDismissMetadata = {
  issueId: string;
  mutationId: string;
  idempotencyKey: string;
  requestFingerprint: string;
  sourceFingerprint: string;
  confirmed: true;
};

export type DevApiDataHealthDismissResult =
  | {
      ok: true;
      issueId: string;
      status: number;
      result: DevApiDataHealthDismissMutationResult;
      snapshot: DevApiDataHealthDismissSnapshot;
      metadata: DevApiDataHealthDismissMetadata;
    }
  | {
      ok: false;
      issueId: string;
      status?: number;
      error: DevApiDataHealthDismissError;
      metadata?: DevApiDataHealthDismissMetadata;
    };

export const DEV_API_DATA_HEALTH_DISMISS_ROUTE = '/data-health/issues/:issueId/dismiss';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isServerError = (value: unknown): value is { code: string; message: string } =>
  isRecord(value) && typeof value.code === 'string' && typeof value.message === 'string';

const isMutationResult = (value: unknown): value is DevApiDataHealthDismissMutationResult =>
  isRecord(value)
  && typeof value.ok === 'boolean'
  && typeof value.changed === 'boolean'
  && typeof value.status === 'string'
  && typeof value.reasonCode === 'string'
  && typeof value.message === 'string';

const isSnapshot = (value: unknown): value is DevApiDataHealthDismissSnapshot =>
  isRecord(value)
  && typeof value.snapshotId === 'string'
  && value.snapshotId.trim().length > 0
  && typeof value.schemaVersion === 'number'
  && Number.isFinite(value.schemaVersion)
  && typeof value.createdAt === 'string'
  && value.createdAt.trim().length > 0;

const toRequestUrl = (baseUrl: string, issueId: string) =>
  `${baseUrl.replace(/\/$/, '')}/data-health/issues/${encodeURIComponent(issueId)}/dismiss`;

const failure = (
  issueId: string,
  error: DevApiDataHealthDismissError,
  status?: number,
  metadata?: DevApiDataHealthDismissMetadata,
): DevApiDataHealthDismissResult => ({
  ok: false,
  issueId,
  status,
  error,
  metadata,
});

export const dismissDataHealthIssueViaDevApi = async ({
  issueId,
  config,
  metadata,
  fetchImpl,
  signal,
}: {
  issueId: string;
  config: DevApiDataHealthDismissEnabledConfig;
  metadata: DevApiDataHealthDismissMetadata;
  fetchImpl?: DevApiDataHealthDismissFetch;
  signal?: AbortSignal;
}): Promise<DevApiDataHealthDismissResult> => {
  if (!metadata.sourceFingerprint.trim() || metadata.confirmed !== true) {
    return failure(issueId, {
      code: 'dev_mutation_source_fingerprint_missing',
      message: 'DataHealth dismiss source fingerprint is missing.',
    }, undefined, metadata);
  }

  const requestFetch = fetchImpl || globalThis.fetch;
  if (!requestFetch) {
    return failure(issueId, {
      code: 'dev_mutation_fetch_unavailable',
      message: 'Fetch is unavailable for the DataHealth dismiss experiment.',
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
    const response = await requestFetch(toRequestUrl(config.baseUrl, issueId), {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ confirmed: true }),
      signal: controller.signal,
    });

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      return failure(issueId, {
        code: 'dev_mutation_invalid_response',
        message: 'DataHealth dismiss response was not valid JSON.',
      }, response.status, metadata);
    }

    if (!isRecord(body)) {
      return failure(issueId, {
        code: 'dev_mutation_invalid_response',
        message: 'DataHealth dismiss response was not an object.',
      }, response.status, metadata);
    }

    if ('error' in body) {
      const error = body.error;
      if (!isServerError(error)) {
        return failure(issueId, {
          code: 'dev_mutation_invalid_response',
          message: 'DataHealth dismiss error response shape is invalid.',
        }, response.status, metadata);
      }
      return failure(issueId, {
        code: 'dev_mutation_error_response',
        message: error.message,
        serverCode: error.code,
      }, response.status, metadata);
    }

    if (!isMutationResult(body.result)) {
      return failure(issueId, {
        code: 'dev_mutation_invalid_response',
        message: 'DataHealth dismiss response is missing a mutation result.',
      }, response.status, metadata);
    }

    if (!response.ok || body.result.ok !== true || body.result.changed !== true || body.result.status !== 'success') {
      return failure(issueId, {
        code: 'dev_mutation_not_successful',
        message: body.result.message || 'DataHealth dismiss did not complete.',
        serverCode: body.result.reasonCode,
      }, response.status, metadata);
    }

    if (!isSnapshot(body.snapshot)) {
      return failure(issueId, {
        code: 'dev_mutation_missing_snapshot',
        message: 'DataHealth dismiss did not return snapshot metadata.',
      }, response.status, metadata);
    }

    return {
      ok: true,
      issueId,
      status: response.status,
      result: body.result,
      snapshot: body.snapshot,
      metadata,
    };
  } catch {
    return failure(issueId, {
      code: didTimeout ? 'dev_mutation_timeout' : 'dev_mutation_unavailable',
      message: didTimeout
        ? 'DataHealth dismiss request timed out.'
        : 'DataHealth dismiss request is unavailable.',
    }, undefined, metadata);
  } finally {
    globalThis.clearTimeout(timeout);
    signal?.removeEventListener('abort', abortFromParent);
  }
};
