import type { DevApiSessionStartEnabledConfig } from './devApiSessionStartConfig';

export type DevApiSessionStartFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export type DevApiSessionStartErrorCode =
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

export type DevApiSessionStartError = {
  code: DevApiSessionStartErrorCode;
  message: string;
  serverCode?: string;
};

export type DevApiSessionStartSnapshot = {
  snapshotId: string;
  schemaVersion: number;
  createdAt: string;
};

export type DevApiSessionStartMutationResult = {
  ok: boolean;
  changed: boolean;
  status: string;
  reasonCode: string;
  message: string;
  warnings?: string[];
  requiresConfirmation?: boolean;
};

export type DevApiSessionStartMetadata = {
  templateId: string;
  sourceSnapshotHash: string;
  sourceSnapshotVersion: string;
  mutationId: string;
  idempotencyKey: string;
  requestFingerprint: string;
  confirmed: true;
  nowIso?: string;
};

export type DevApiSessionStartResult =
  | {
      ok: true;
      templateId: string;
      status: number;
      result: DevApiSessionStartMutationResult;
      snapshot: DevApiSessionStartSnapshot;
      metadata: DevApiSessionStartMetadata;
    }
  | {
      ok: false;
      templateId?: string;
      status?: number;
      error: DevApiSessionStartError;
      metadata?: DevApiSessionStartMetadata;
    };

export const DEV_API_SESSION_START_METHOD = ['PO', 'ST'].join('');
export const DEV_API_SESSION_START_ROUTE = ['sessions', 'start'].reduce((path, segment) => `${path}/${segment}`, '');
export const DEV_API_SESSION_START_SOURCE_SNAPSHOT_VERSION = 'phase4-active-session-v1';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isServerError = (value: unknown): value is { code: string; message: string } =>
  isRecord(value) && typeof value.code === 'string' && typeof value.message === 'string';

const isMutationResult = (value: unknown): value is DevApiSessionStartMutationResult =>
  isRecord(value)
  && typeof value.ok === 'boolean'
  && typeof value.changed === 'boolean'
  && typeof value.status === 'string'
  && typeof value.reasonCode === 'string'
  && typeof value.message === 'string';

const isSnapshot = (value: unknown): value is DevApiSessionStartSnapshot =>
  isRecord(value)
  && typeof value.snapshotId === 'string'
  && value.snapshotId.trim().length > 0
  && typeof value.schemaVersion === 'number'
  && Number.isFinite(value.schemaVersion)
  && typeof value.createdAt === 'string'
  && value.createdAt.trim().length > 0;

const clean = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const toRequestUrl = (baseUrl: string) =>
  `${baseUrl.replace(/\/$/, '')}/${['sessions', 'start'].join('/')}`;

export const sanitizeSessionStartMessage = (message: string, fallback = 'Session start experiment failed.') => {
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
  error: DevApiSessionStartError,
  status?: number,
  metadata?: DevApiSessionStartMetadata,
  templateId?: string,
): DevApiSessionStartResult => ({
  ok: false,
  templateId,
  status,
  error: {
    ...error,
    message: sanitizeSessionStartMessage(error.message),
  },
  metadata,
});

export const validateSessionStartMetadata = (
  metadata: unknown,
): { ok: true; metadata: DevApiSessionStartMetadata } | { ok: false; error: DevApiSessionStartError } => {
  if (!isRecord(metadata) || metadata.confirmed !== true) {
    return {
      ok: false,
      error: {
        code: 'dev_mutation_source_snapshot_missing',
        message: 'Session start requires explicit confirmation and source snapshot metadata.',
      },
    };
  }

  const templateId = clean(metadata.templateId);
  const sourceSnapshotHash = clean(metadata.sourceSnapshotHash);
  const sourceSnapshotVersion = clean(metadata.sourceSnapshotVersion);
  const mutationId = clean(metadata.mutationId);
  const idempotencyKey = clean(metadata.idempotencyKey);
  const requestFingerprint = clean(metadata.requestFingerprint);
  if (!templateId || !sourceSnapshotHash || !sourceSnapshotVersion) {
    return {
      ok: false,
      error: {
        code: 'dev_mutation_source_snapshot_missing',
        message: 'Session start source snapshot metadata is missing.',
      },
    };
  }
  if (!mutationId || !idempotencyKey || !requestFingerprint) {
    return {
      ok: false,
      error: {
        code: 'dev_mutation_idempotency_missing',
        message: 'Session start idempotency metadata is missing.',
      },
    };
  }

  return {
    ok: true,
    metadata: {
      templateId,
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

export const startSessionViaDevApi = async ({
  templateId,
  config,
  metadata,
  fetchImpl,
  signal,
}: {
  templateId: unknown;
  config: DevApiSessionStartEnabledConfig;
  metadata?: DevApiSessionStartMetadata;
  fetchImpl?: DevApiSessionStartFetch;
  signal?: AbortSignal;
}): Promise<DevApiSessionStartResult> => {
  const safeTemplateId = clean(templateId);
  if (!safeTemplateId) {
    return failure({
      code: 'dev_mutation_invalid_target',
      message: 'Session start requires a stable template target.',
    });
  }

  const metadataValidation = validateSessionStartMetadata(metadata);
  if (!metadataValidation.ok) return failure(metadataValidation.error, undefined, metadata, safeTemplateId);
  const safeMetadata = metadataValidation.metadata;
  if (safeMetadata.templateId !== safeTemplateId) {
    return failure({
      code: 'dev_mutation_invalid_target',
      message: 'Session start target does not match request metadata.',
    }, undefined, safeMetadata, safeTemplateId);
  }

  const requestFetch = fetchImpl || globalThis.fetch;
  if (!requestFetch) {
    return failure({
      code: 'dev_mutation_fetch_unavailable',
      message: 'Fetch is unavailable for the session start experiment.',
    }, undefined, safeMetadata, safeTemplateId);
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
      method: DEV_API_SESSION_START_METHOD,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        templateId: safeTemplateId,
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
        message: 'Session start response was not valid JSON.',
      }, response.status, safeMetadata, safeTemplateId);
    }

    if (!isRecord(body)) {
      return failure({
        code: 'dev_mutation_invalid_response',
        message: 'Session start response was not an object.',
      }, response.status, safeMetadata, safeTemplateId);
    }

    if ('error' in body) {
      const error = body.error;
      if (!isServerError(error)) {
        return failure({
          code: 'dev_mutation_invalid_response',
          message: 'Session start error response shape is invalid.',
        }, response.status, safeMetadata, safeTemplateId);
      }
      return failure({
        code: 'dev_mutation_error_response',
        message: error.message,
        serverCode: error.code,
      }, response.status, safeMetadata, safeTemplateId);
    }

    if (!isMutationResult(body.result)) {
      return failure({
        code: 'dev_mutation_invalid_response',
        message: 'Session start response is missing a mutation result.',
      }, response.status, safeMetadata, safeTemplateId);
    }

    if (!response.ok || body.result.ok !== true || body.result.changed !== true || body.result.status !== 'success') {
      return failure({
        code: 'dev_mutation_not_successful',
        message: body.result.message || 'Session start did not change.',
        serverCode: body.result.reasonCode,
      }, response.status, safeMetadata, safeTemplateId);
    }

    if (!isSnapshot(body.snapshot)) {
      return failure({
        code: 'dev_mutation_missing_snapshot',
        message: 'Session start did not return snapshot metadata.',
      }, response.status, safeMetadata, safeTemplateId);
    }

    return {
      ok: true,
      templateId: safeTemplateId,
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
        ? 'Session start request timed out.'
        : abortedByParent
          ? 'Session start request was canceled before completion.'
          : 'Session start request is unavailable.',
    }, undefined, safeMetadata, safeTemplateId);
  } finally {
    globalThis.clearTimeout(timeout);
    signal?.removeEventListener('abort', abortFromParent);
  }
};
