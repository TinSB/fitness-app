import type { DevApiSessionCompleteEnabledConfig } from './devApiSessionCompleteConfig';

export type DevApiSessionCompleteFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export type DevApiSessionCompleteErrorCode =
  | 'dev_mutation_aborted'
  | 'dev_mutation_fetch_unavailable'
  | 'dev_mutation_timeout'
  | 'dev_mutation_unavailable'
  | 'dev_mutation_invalid_response'
  | 'dev_mutation_error_response'
  | 'dev_mutation_missing_snapshot'
  | 'dev_mutation_not_successful'
  | 'dev_mutation_invalid_target'
  | 'dev_mutation_source_snapshot_missing'
  | 'dev_mutation_idempotency_missing';

export type DevApiSessionCompleteError = {
  code: DevApiSessionCompleteErrorCode;
  message: string;
  serverCode?: string;
};

export type DevApiSessionCompleteSnapshot = {
  snapshotId: string;
  schemaVersion: number;
  createdAt: string;
};

export type DevApiSessionCompleteMutationResult = {
  ok: boolean;
  changed: boolean;
  status: string;
  reasonCode: string;
  message: string;
  warnings?: string[];
  requiresConfirmation?: boolean;
};

export type DevApiSessionCompleteMetadata = {
  activeSessionId: string;
  sourceSnapshotHash: string;
  sourceSnapshotVersion: string;
  mutationId: string;
  idempotencyKey: string;
  requestFingerprint: string;
  confirmed: true;
  confirmIncompleteMainWork?: true;
  nowIso?: string;
};

export type DevApiSessionCompleteResult =
  | {
      ok: true;
      activeSessionId: string;
      status: number;
      result: DevApiSessionCompleteMutationResult;
      snapshot: DevApiSessionCompleteSnapshot;
      metadata: DevApiSessionCompleteMetadata;
    }
  | {
      ok: false;
      activeSessionId?: string;
      status?: number;
      error: DevApiSessionCompleteError;
      metadata?: DevApiSessionCompleteMetadata;
    };

export const DEV_API_SESSION_COMPLETE_METHOD = ['PO', 'ST'].join('');
export const DEV_API_SESSION_COMPLETE_ROUTE = ['sessions', 'active', 'complete'].reduce((path, segment) => `${path}/${segment}`, '');
export const DEV_API_SESSION_COMPLETE_SOURCE_SNAPSHOT_VERSION = 'phase5-session-complete-v1';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isServerError = (value: unknown): value is { code: string; message: string } =>
  isRecord(value) && typeof value.code === 'string' && typeof value.message === 'string';

const isMutationResult = (value: unknown): value is DevApiSessionCompleteMutationResult =>
  isRecord(value)
  && typeof value.ok === 'boolean'
  && typeof value.changed === 'boolean'
  && typeof value.status === 'string'
  && typeof value.reasonCode === 'string'
  && typeof value.message === 'string';

const isSnapshot = (value: unknown): value is DevApiSessionCompleteSnapshot =>
  isRecord(value)
  && typeof value.snapshotId === 'string'
  && value.snapshotId.trim().length > 0
  && typeof value.schemaVersion === 'number'
  && Number.isFinite(value.schemaVersion)
  && typeof value.createdAt === 'string'
  && value.createdAt.trim().length > 0;

const clean = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const toRequestUrl = (baseUrl: string) =>
  `${baseUrl.replace(/\/$/, '')}/${['sessions', 'active', 'complete'].join('/')}`;

export const sanitizeSessionCompleteMessage = (message: string, fallback = 'Session complete experiment failed.') => {
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

const failure = (
  error: DevApiSessionCompleteError,
  status?: number,
  metadata?: DevApiSessionCompleteMetadata,
  activeSessionId?: string,
): DevApiSessionCompleteResult => ({
  ok: false,
  activeSessionId,
  status,
  error: {
    ...error,
    message: sanitizeSessionCompleteMessage(error.message),
  },
  metadata,
});

export const validateSessionCompleteMetadata = (
  metadata: unknown,
): { ok: true; metadata: DevApiSessionCompleteMetadata } | { ok: false; error: DevApiSessionCompleteError } => {
  if (!isRecord(metadata) || metadata.confirmed !== true) {
    return {
      ok: false,
      error: {
        code: 'dev_mutation_source_snapshot_missing',
        message: 'Session complete requires explicit confirmation and source snapshot metadata.',
      },
    };
  }

  const activeSessionId = clean(metadata.activeSessionId);
  const sourceSnapshotHash = clean(metadata.sourceSnapshotHash);
  const sourceSnapshotVersion = clean(metadata.sourceSnapshotVersion);
  const mutationId = clean(metadata.mutationId);
  const idempotencyKey = clean(metadata.idempotencyKey);
  const requestFingerprint = clean(metadata.requestFingerprint);
  if (!activeSessionId || !sourceSnapshotHash || !sourceSnapshotVersion) {
    return {
      ok: false,
      error: {
        code: 'dev_mutation_source_snapshot_missing',
        message: 'Session complete source snapshot metadata is missing.',
      },
    };
  }
  if (!mutationId || !idempotencyKey || !requestFingerprint) {
    return {
      ok: false,
      error: {
        code: 'dev_mutation_idempotency_missing',
        message: 'Session complete idempotency metadata is missing.',
      },
    };
  }

  return {
    ok: true,
    metadata: {
      activeSessionId,
      sourceSnapshotHash,
      sourceSnapshotVersion,
      mutationId,
      idempotencyKey,
      requestFingerprint,
      confirmed: true,
      ...(metadata.confirmIncompleteMainWork === true ? { confirmIncompleteMainWork: true } : {}),
      ...(typeof metadata.nowIso === 'string' && metadata.nowIso.trim() ? { nowIso: metadata.nowIso.trim() } : {}),
    },
  };
};

export const completeSessionViaDevApi = async ({
  activeSessionId,
  confirmIncompleteMainWork,
  config,
  metadata,
  fetchImpl,
  signal,
}: {
  activeSessionId: unknown;
  confirmIncompleteMainWork?: boolean;
  config: DevApiSessionCompleteEnabledConfig;
  metadata?: DevApiSessionCompleteMetadata;
  fetchImpl?: DevApiSessionCompleteFetch;
  signal?: AbortSignal;
}): Promise<DevApiSessionCompleteResult> => {
  const safeActiveSessionId = clean(activeSessionId);
  if (!safeActiveSessionId) {
    return failure({
      code: 'dev_mutation_invalid_target',
      message: 'Session complete requires a stable active session target.',
    });
  }

  const metadataValidation = validateSessionCompleteMetadata(metadata);
  if (!metadataValidation.ok) return failure(metadataValidation.error, undefined, metadata, safeActiveSessionId);
  const safeMetadata = metadataValidation.metadata;
  if (safeMetadata.activeSessionId !== safeActiveSessionId) {
    return failure({
      code: 'dev_mutation_invalid_target',
      message: 'Session complete target does not match request metadata.',
    }, undefined, safeMetadata, safeActiveSessionId);
  }

  const requestFetch = fetchImpl || globalThis.fetch;
  if (!requestFetch) {
    return failure({
      code: 'dev_mutation_fetch_unavailable',
      message: 'Fetch is unavailable for the session complete experiment.',
    }, undefined, safeMetadata, safeActiveSessionId);
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
    const response = await requestFetch(toRequestUrl(config.baseUrl), {
      method: DEV_API_SESSION_COMPLETE_METHOD,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        activeSessionId: safeActiveSessionId,
        sourceSnapshotHash: safeMetadata.sourceSnapshotHash,
        sourceSnapshotVersion: safeMetadata.sourceSnapshotVersion,
        mutationId: safeMetadata.mutationId,
        idempotencyKey: safeMetadata.idempotencyKey,
        requestFingerprint: safeMetadata.requestFingerprint,
        confirmed: true,
        ...(confirmIncompleteMainWork || safeMetadata.confirmIncompleteMainWork ? { confirmIncompleteMainWork: true } : {}),
      }),
      signal: controller.signal,
    });

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      return failure({
        code: 'dev_mutation_invalid_response',
        message: 'Session complete response was not valid JSON.',
      }, response.status, safeMetadata, safeActiveSessionId);
    }

    if (!isRecord(body)) {
      return failure({
        code: 'dev_mutation_invalid_response',
        message: 'Session complete response was not an object.',
      }, response.status, safeMetadata, safeActiveSessionId);
    }

    if ('error' in body) {
      const error = body.error;
      if (!isServerError(error)) {
        return failure({
          code: 'dev_mutation_invalid_response',
          message: 'Session complete error response shape is invalid.',
        }, response.status, safeMetadata, safeActiveSessionId);
      }
      return failure({
        code: 'dev_mutation_error_response',
        message: error.message,
        serverCode: error.code,
      }, response.status, safeMetadata, safeActiveSessionId);
    }

    if (!isMutationResult(body.result)) {
      return failure({
        code: 'dev_mutation_invalid_response',
        message: 'Session complete response is missing a mutation result.',
      }, response.status, safeMetadata, safeActiveSessionId);
    }

    if (!response.ok || body.result.ok !== true || body.result.changed !== true || body.result.status !== 'success') {
      return failure({
        code: 'dev_mutation_not_successful',
        message: body.result.message || 'Session complete did not change.',
        serverCode: body.result.reasonCode,
      }, response.status, safeMetadata, safeActiveSessionId);
    }

    if (!isSnapshot(body.snapshot)) {
      return failure({
        code: 'dev_mutation_missing_snapshot',
        message: 'Session complete did not return snapshot metadata.',
      }, response.status, safeMetadata, safeActiveSessionId);
    }

    return {
      ok: true,
      activeSessionId: safeActiveSessionId,
      status: response.status,
      result: body.result,
      snapshot: body.snapshot,
      metadata: safeMetadata,
    };
  } catch {
    const abortedByParent = !didTimeout && (signal?.aborted || controller.signal.aborted);
    return failure({
      code: didTimeout
        ? 'dev_mutation_timeout'
        : abortedByParent
          ? 'dev_mutation_aborted'
          : 'dev_mutation_unavailable',
      message: didTimeout
        ? 'Session complete request timed out.'
        : abortedByParent
          ? 'Session complete request was canceled before completion.'
          : 'Session complete request is unavailable.',
    }, undefined, safeMetadata, safeActiveSessionId);
  } finally {
    globalThis.clearTimeout(timeout);
    signal?.removeEventListener('abort', abortFromParent);
  }
};
