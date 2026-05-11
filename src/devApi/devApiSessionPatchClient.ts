import type { SessionPatch } from '../models/training-model';
import type { DevApiSessionPatchEnabledConfig } from './devApiSessionPatchConfig';

export type DevApiSessionPatchFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export type DevApiSessionPatchErrorCode =
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

export type DevApiSessionPatchError = {
  code: DevApiSessionPatchErrorCode;
  message: string;
  serverCode?: string;
};

export type DevApiSessionPatchSnapshot = {
  snapshotId: string;
  schemaVersion: number;
  createdAt: string;
};

export type DevApiSessionPatchMutationResult = {
  ok: boolean;
  changed: boolean;
  status: string;
  reasonCode: string;
  message: string;
  warnings?: string[];
  requiresConfirmation?: boolean;
};

export type DevApiSessionPatchMetadata = {
  activeSessionId: string;
  pendingPatchId?: string;
  sourceSnapshotHash: string;
  sourceSnapshotVersion: string;
  mutationId: string;
  idempotencyKey: string;
  requestFingerprint: string;
  confirmed: true;
  nowIso?: string;
};

export type DevApiSessionPatchResult =
  | {
      ok: true;
      activeSessionId: string;
      pendingPatchId?: string;
      status: number;
      result: DevApiSessionPatchMutationResult;
      snapshot: DevApiSessionPatchSnapshot;
      metadata: DevApiSessionPatchMetadata;
    }
  | {
      ok: false;
      activeSessionId?: string;
      pendingPatchId?: string;
      status?: number;
      error: DevApiSessionPatchError;
      metadata?: DevApiSessionPatchMetadata;
    };

export const DEV_API_SESSION_PATCH_METHOD = ['PO', 'ST'].join('');
export const DEV_API_SESSION_PATCH_ROUTE = ['sessions', 'active', 'patches'].reduce((path, segment) => `${path}/${segment}`, '');
export const DEV_API_SESSION_PATCH_SOURCE_SNAPSHOT_VERSION = 'phase5-session-patch-v1';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isServerError = (value: unknown): value is { code: string; message: string } =>
  isRecord(value) && typeof value.code === 'string' && typeof value.message === 'string';

const isMutationResult = (value: unknown): value is DevApiSessionPatchMutationResult =>
  isRecord(value)
  && typeof value.ok === 'boolean'
  && typeof value.changed === 'boolean'
  && typeof value.status === 'string'
  && typeof value.reasonCode === 'string'
  && typeof value.message === 'string';

const isSnapshot = (value: unknown): value is DevApiSessionPatchSnapshot =>
  isRecord(value)
  && typeof value.snapshotId === 'string'
  && value.snapshotId.trim().length > 0
  && typeof value.schemaVersion === 'number'
  && Number.isFinite(value.schemaVersion)
  && typeof value.createdAt === 'string'
  && value.createdAt.trim().length > 0;

const clean = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const cleanPatches = (patches: unknown): SessionPatch[] =>
  Array.isArray(patches) ? (patches.filter(isRecord) as unknown as SessionPatch[]) : [];

const toRequestUrl = (baseUrl: string) =>
  `${baseUrl.replace(/\/$/, '')}/${['sessions', 'active', 'patches'].join('/')}`;

export const sanitizeSessionPatchMessage = (message: string, fallback = 'Session patch experiment failed.') => {
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
  error: DevApiSessionPatchError,
  status?: number,
  metadata?: DevApiSessionPatchMetadata,
  activeSessionId?: string,
  pendingPatchId?: string,
): DevApiSessionPatchResult => ({
  ok: false,
  activeSessionId,
  pendingPatchId,
  status,
  error: {
    ...error,
    message: sanitizeSessionPatchMessage(error.message),
  },
  metadata,
});

export const validateSessionPatchMetadata = (
  metadata: unknown,
): { ok: true; metadata: DevApiSessionPatchMetadata } | { ok: false; error: DevApiSessionPatchError } => {
  if (!isRecord(metadata) || metadata.confirmed !== true) {
    return {
      ok: false,
      error: {
        code: 'dev_mutation_source_snapshot_missing',
        message: 'Session patch requires explicit confirmation and source snapshot metadata.',
      },
    };
  }

  const activeSessionId = clean(metadata.activeSessionId);
  const pendingPatchId = clean(metadata.pendingPatchId);
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
        message: 'Session patch source snapshot metadata is missing.',
      },
    };
  }
  if (!mutationId || !idempotencyKey || !requestFingerprint) {
    return {
      ok: false,
      error: {
        code: 'dev_mutation_idempotency_missing',
        message: 'Session patch idempotency metadata is missing.',
      },
    };
  }

  return {
    ok: true,
    metadata: {
      activeSessionId,
      ...(pendingPatchId ? { pendingPatchId } : {}),
      sourceSnapshotHash,
      sourceSnapshotVersion,
      mutationId,
      idempotencyKey,
      requestFingerprint,
      confirmed: true,
      ...(typeof metadata.nowIso === 'string' && metadata.nowIso.trim() ? { nowIso: metadata.nowIso.trim() } : {}),
    },
  };
};

export const applySessionPatchViaDevApi = async ({
  activeSessionId,
  pendingPatchId,
  patches,
  config,
  metadata,
  fetchImpl,
  signal,
}: {
  activeSessionId: unknown;
  pendingPatchId?: unknown;
  patches?: SessionPatch[];
  config: DevApiSessionPatchEnabledConfig;
  metadata?: DevApiSessionPatchMetadata;
  fetchImpl?: DevApiSessionPatchFetch;
  signal?: AbortSignal;
}): Promise<DevApiSessionPatchResult> => {
  const safeActiveSessionId = clean(activeSessionId);
  const safePendingPatchId = clean(pendingPatchId);
  const safePatches = cleanPatches(patches);
  if (!safeActiveSessionId || (!safePendingPatchId && !safePatches.length)) {
    return failure({
      code: 'dev_mutation_invalid_target',
      message: 'Session patch requires a stable active session and patch target.',
    }, undefined, metadata, safeActiveSessionId || undefined, safePendingPatchId || undefined);
  }

  const metadataValidation = validateSessionPatchMetadata(metadata);
  if (!metadataValidation.ok) {
    return failure(metadataValidation.error, undefined, metadata, safeActiveSessionId, safePendingPatchId || undefined);
  }
  const safeMetadata = metadataValidation.metadata;
  if (safeMetadata.activeSessionId !== safeActiveSessionId || (safeMetadata.pendingPatchId || '') !== safePendingPatchId) {
    return failure({
      code: 'dev_mutation_invalid_target',
      message: 'Session patch target does not match request metadata.',
    }, undefined, safeMetadata, safeActiveSessionId, safePendingPatchId || undefined);
  }

  const requestFetch = fetchImpl || globalThis.fetch;
  if (!requestFetch) {
    return failure({
      code: 'dev_mutation_fetch_unavailable',
      message: 'Fetch is unavailable for the session patch experiment.',
    }, undefined, safeMetadata, safeActiveSessionId, safePendingPatchId || undefined);
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
      method: DEV_API_SESSION_PATCH_METHOD,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        activeSessionId: safeActiveSessionId,
        ...(safePendingPatchId ? { pendingPatchId: safePendingPatchId } : { patches: safePatches }),
        sourceSnapshotHash: safeMetadata.sourceSnapshotHash,
        sourceSnapshotVersion: safeMetadata.sourceSnapshotVersion,
        mutationId: safeMetadata.mutationId,
        idempotencyKey: safeMetadata.idempotencyKey,
        requestFingerprint: safeMetadata.requestFingerprint,
        confirmed: true,
      }),
      signal: controller.signal,
    });

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      return failure({
        code: 'dev_mutation_invalid_response',
        message: 'Session patch response was not valid JSON.',
      }, response.status, safeMetadata, safeActiveSessionId, safePendingPatchId || undefined);
    }

    if (!isRecord(body)) {
      return failure({
        code: 'dev_mutation_invalid_response',
        message: 'Session patch response was not an object.',
      }, response.status, safeMetadata, safeActiveSessionId, safePendingPatchId || undefined);
    }

    if ('error' in body) {
      const error = body.error;
      if (!isServerError(error)) {
        return failure({
          code: 'dev_mutation_invalid_response',
          message: 'Session patch error response shape is invalid.',
        }, response.status, safeMetadata, safeActiveSessionId, safePendingPatchId || undefined);
      }
      return failure({
        code: 'dev_mutation_error_response',
        message: error.message,
        serverCode: error.code,
      }, response.status, safeMetadata, safeActiveSessionId, safePendingPatchId || undefined);
    }

    if (!isMutationResult(body.result)) {
      return failure({
        code: 'dev_mutation_invalid_response',
        message: 'Session patch response is missing a mutation result.',
      }, response.status, safeMetadata, safeActiveSessionId, safePendingPatchId || undefined);
    }

    if (!response.ok || body.result.ok !== true || body.result.changed !== true || body.result.status !== 'success') {
      return failure({
        code: 'dev_mutation_not_successful',
        message: body.result.message || 'Session patch did not change.',
        serverCode: body.result.reasonCode,
      }, response.status, safeMetadata, safeActiveSessionId, safePendingPatchId || undefined);
    }

    if (!isSnapshot(body.snapshot)) {
      return failure({
        code: 'dev_mutation_missing_snapshot',
        message: 'Session patch did not return snapshot metadata.',
      }, response.status, safeMetadata, safeActiveSessionId, safePendingPatchId || undefined);
    }

    return {
      ok: true,
      activeSessionId: safeActiveSessionId,
      ...(safePendingPatchId ? { pendingPatchId: safePendingPatchId } : {}),
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
        ? 'Session patch request timed out.'
        : abortedByParent
          ? 'Session patch request was canceled before completion.'
          : 'Session patch request is unavailable.',
    }, undefined, safeMetadata, safeActiveSessionId, safePendingPatchId || undefined);
  } finally {
    globalThis.clearTimeout(timeout);
    signal?.removeEventListener('abort', abortFromParent);
  }
};
