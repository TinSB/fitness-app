import type { DevApiSessionDiscardEnabledConfig } from './devApiSessionDiscardConfig';

export type DevApiSessionDiscardFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export type DevApiSessionDiscardErrorCode =
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

export type DevApiSessionDiscardError = {
  code: DevApiSessionDiscardErrorCode;
  message: string;
  serverCode?: string;
};

export type DevApiSessionDiscardSnapshot = {
  snapshotId: string;
  schemaVersion: number;
  createdAt: string;
};

export type DevApiSessionDiscardMutationResult = {
  ok: boolean;
  changed: boolean;
  status: string;
  reasonCode: string;
  message: string;
  warnings?: string[];
  requiresConfirmation?: boolean;
};

export type DevApiSessionDiscardMetadata = {
  activeSessionId: string;
  sourceSnapshotHash: string;
  sourceSnapshotVersion: string;
  mutationId: string;
  idempotencyKey: string;
  requestFingerprint: string;
  confirmed: true;
  confirmDiscard: true;
  nowIso?: string;
};

export type DevApiSessionDiscardResult =
  | {
      ok: true;
      activeSessionId: string;
      status: number;
      result: DevApiSessionDiscardMutationResult;
      snapshot: DevApiSessionDiscardSnapshot;
      metadata: DevApiSessionDiscardMetadata;
    }
  | {
      ok: false;
      activeSessionId?: string;
      status?: number;
      error: DevApiSessionDiscardError;
      metadata?: DevApiSessionDiscardMetadata;
    };

export const DEV_API_SESSION_DISCARD_METHOD = ['PO', 'ST'].join('');
export const DEV_API_SESSION_DISCARD_ROUTE = ['sessions', 'active', 'discard'].reduce((path, segment) => `${path}/${segment}`, '');
export const DEV_API_SESSION_DISCARD_SOURCE_SNAPSHOT_VERSION = 'phase5-session-discard-v1';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isServerError = (value: unknown): value is { code: string; message: string } =>
  isRecord(value) && typeof value.code === 'string' && typeof value.message === 'string';

const isMutationResult = (value: unknown): value is DevApiSessionDiscardMutationResult =>
  isRecord(value)
  && typeof value.ok === 'boolean'
  && typeof value.changed === 'boolean'
  && typeof value.status === 'string'
  && typeof value.reasonCode === 'string'
  && typeof value.message === 'string';

const isSnapshot = (value: unknown): value is DevApiSessionDiscardSnapshot =>
  isRecord(value)
  && typeof value.snapshotId === 'string'
  && value.snapshotId.trim().length > 0
  && typeof value.schemaVersion === 'number'
  && Number.isFinite(value.schemaVersion)
  && typeof value.createdAt === 'string'
  && value.createdAt.trim().length > 0;

const clean = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const toRequestUrl = (baseUrl: string) =>
  `${baseUrl.replace(/\/$/, '')}/${['sessions', 'active', 'discard'].join('/')}`;

export const sanitizeSessionDiscardMessage = (message: string, fallback = 'Session discard experiment failed.') => {
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
  error: DevApiSessionDiscardError,
  status?: number,
  metadata?: DevApiSessionDiscardMetadata,
  activeSessionId?: string,
): DevApiSessionDiscardResult => ({
  ok: false,
  activeSessionId,
  status,
  error: {
    ...error,
    message: sanitizeSessionDiscardMessage(error.message),
  },
  metadata,
});

export const validateSessionDiscardMetadata = (
  metadata: unknown,
): { ok: true; metadata: DevApiSessionDiscardMetadata } | { ok: false; error: DevApiSessionDiscardError } => {
  if (!isRecord(metadata) || metadata.confirmed !== true || metadata.confirmDiscard !== true) {
    return {
      ok: false,
      error: {
        code: 'dev_mutation_source_snapshot_missing',
        message: 'Session discard requires explicit confirmation and source snapshot metadata.',
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
        message: 'Session discard source snapshot metadata is missing.',
      },
    };
  }
  if (!mutationId || !idempotencyKey || !requestFingerprint) {
    return {
      ok: false,
      error: {
        code: 'dev_mutation_idempotency_missing',
        message: 'Session discard idempotency metadata is missing.',
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
      confirmDiscard: true,
      ...(typeof metadata.nowIso === 'string' && metadata.nowIso.trim() ? { nowIso: metadata.nowIso.trim() } : {}),
    },
  };
};

export const discardSessionViaDevApi = async ({
  activeSessionId,
  config,
  metadata,
  fetchImpl,
  signal,
}: {
  activeSessionId: unknown;
  config: DevApiSessionDiscardEnabledConfig;
  metadata?: DevApiSessionDiscardMetadata;
  fetchImpl?: DevApiSessionDiscardFetch;
  signal?: AbortSignal;
}): Promise<DevApiSessionDiscardResult> => {
  const safeActiveSessionId = clean(activeSessionId);
  if (!safeActiveSessionId) {
    return failure({
      code: 'dev_mutation_invalid_target',
      message: 'Session discard requires a stable active session target.',
    });
  }

  const metadataValidation = validateSessionDiscardMetadata(metadata);
  if (!metadataValidation.ok) return failure(metadataValidation.error, undefined, metadata, safeActiveSessionId);
  const safeMetadata = metadataValidation.metadata;
  if (safeMetadata.activeSessionId !== safeActiveSessionId) {
    return failure({
      code: 'dev_mutation_invalid_target',
      message: 'Session discard target does not match request metadata.',
    }, undefined, safeMetadata, safeActiveSessionId);
  }

  const requestFetch = fetchImpl || globalThis.fetch;
  if (!requestFetch) {
    return failure({
      code: 'dev_mutation_fetch_unavailable',
      message: 'Fetch is unavailable for the session discard experiment.',
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
      method: DEV_API_SESSION_DISCARD_METHOD,
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
        confirmDiscard: true,
      }),
      signal: controller.signal,
    });

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      return failure({
        code: 'dev_mutation_invalid_response',
        message: 'Session discard response was not valid JSON.',
      }, response.status, safeMetadata, safeActiveSessionId);
    }

    if (!isRecord(body)) {
      return failure({
        code: 'dev_mutation_invalid_response',
        message: 'Session discard response was not an object.',
      }, response.status, safeMetadata, safeActiveSessionId);
    }

    if ('error' in body) {
      const error = body.error;
      if (!isServerError(error)) {
        return failure({
          code: 'dev_mutation_invalid_response',
          message: 'Session discard error response shape is invalid.',
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
        message: 'Session discard response is missing a mutation result.',
      }, response.status, safeMetadata, safeActiveSessionId);
    }

    if (!response.ok || body.result.ok !== true || body.result.changed !== true || body.result.status !== 'success') {
      return failure({
        code: 'dev_mutation_not_successful',
        message: body.result.message || 'Session discard did not change.',
        serverCode: body.result.reasonCode,
      }, response.status, safeMetadata, safeActiveSessionId);
    }

    if (!isSnapshot(body.snapshot)) {
      return failure({
        code: 'dev_mutation_missing_snapshot',
        message: 'Session discard did not return snapshot metadata.',
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
        ? 'Session discard request timed out.'
        : abortedByParent
          ? 'Session discard request was canceled before completion.'
          : 'Session discard request is unavailable.',
    }, undefined, safeMetadata, safeActiveSessionId);
  } finally {
    globalThis.clearTimeout(timeout);
    signal?.removeEventListener('abort', abortFromParent);
  }
};
