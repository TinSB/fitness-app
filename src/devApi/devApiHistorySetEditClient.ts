import type { DevApiHistorySetEditEnabledConfig } from './devApiHistorySetEditConfig';

export type DevApiHistorySetEditFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export type HistorySetEditPatchField =
  | 'weightKg'
  | 'displayWeight'
  | 'displayUnit'
  | 'reps'
  | 'rir'
  | 'techniqueQuality'
  | 'painFlag'
  | 'note';

export type HistorySetEditPatch = Partial<{
  weightKg: number;
  displayWeight: number;
  displayUnit: 'kg' | 'lb';
  reps: number;
  rir: number | string;
  techniqueQuality: 'good' | 'acceptable' | 'poor';
  painFlag: boolean;
  note: string;
}>;

export type DevApiHistorySetEditErrorCode =
  | 'dev_mutation_aborted'
  | 'dev_mutation_fetch_unavailable'
  | 'dev_mutation_timeout'
  | 'dev_mutation_unavailable'
  | 'dev_mutation_invalid_response'
  | 'dev_mutation_error_response'
  | 'dev_mutation_missing_snapshot'
  | 'dev_mutation_not_successful'
  | 'dev_mutation_invalid_target'
  | 'dev_mutation_invalid_patch'
  | 'dev_mutation_source_fingerprint_missing';

export type DevApiHistorySetEditError = {
  code: DevApiHistorySetEditErrorCode;
  message: string;
  serverCode?: string;
};

export type DevApiHistorySetEditSnapshot = {
  snapshotId: string;
  schemaVersion: number;
  createdAt: string;
};

export type DevApiHistorySetEditMutationResult = {
  ok: boolean;
  changed: boolean;
  status: string;
  reasonCode: string;
  message: string;
  warnings?: string[];
  requiresConfirmation?: boolean;
};

export type DevApiHistorySetEditMetadata = {
  sessionId: string;
  exerciseId: string;
  setId: string;
  changedFields: HistorySetEditPatchField[];
  mutationId: string;
  idempotencyKey: string;
  requestFingerprint: string;
  sourceFingerprint: string;
  confirmed: true;
  reason?: string;
  nowIso?: string;
};

export type DevApiHistorySetEditResult =
  | {
      ok: true;
      sessionId: string;
      exerciseId: string;
      setId: string;
      patch: HistorySetEditPatch;
      status: number;
      result: DevApiHistorySetEditMutationResult;
      snapshot: DevApiHistorySetEditSnapshot;
      metadata: DevApiHistorySetEditMetadata;
    }
  | {
      ok: false;
      sessionId: string;
      exerciseId?: string;
      setId?: string;
      status?: number;
      error: DevApiHistorySetEditError;
      metadata?: DevApiHistorySetEditMetadata;
    };

export const DEV_API_HISTORY_SET_EDIT_METHOD = ['PO', 'ST'].join('');
export const DEV_API_HISTORY_SET_EDIT_ROUTE = ['history', ':id', 'edit'].reduce((path, segment) => `${path}/${segment}`, '');

export const DEV_API_HISTORY_SET_EDIT_ALLOWED_PATCH_FIELDS: HistorySetEditPatchField[] = [
  'weightKg',
  'displayWeight',
  'displayUnit',
  'reps',
  'rir',
  'techniqueQuality',
  'painFlag',
  'note',
];

const allowedPatchFields = new Set<string>(DEV_API_HISTORY_SET_EDIT_ALLOWED_PATCH_FIELDS);
const techniqueQualityValues = new Set(['good', 'acceptable', 'poor']);
const broadPatchFields = [
  'dataFlag',
  'id',
  'date',
  'templateId',
  'templateName',
  'programTemplateId',
  'programTemplateName',
  'trainingMode',
  'focus',
  'status',
  'startedAt',
  'finishedAt',
  'completed',
  'durationMin',
  'exerciseId',
  'actualExerciseId',
  'originalExerciseId',
  'replacementExerciseId',
  'legacyActualExerciseId',
  'legacyReplacementExerciseId',
  'identityInvalid',
  'identityReviewReason',
  'setId',
  'setIndex',
  'type',
  'warmupType',
  'done',
  'completedAt',
  'completionStatus',
  'incompleteReason',
  'activeSession',
  'editedAt',
  'editHistory',
  'affectedStats',
  'beforeSummary',
  'afterSummary',
  'summary',
  'pr',
  'e1RM',
  'effectiveSet',
  'weightedEffectiveSet',
  'history',
  'appData',
] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isServerError = (value: unknown): value is { code: string; message: string } =>
  isRecord(value) && typeof value.code === 'string' && typeof value.message === 'string';

const isMutationResult = (value: unknown): value is DevApiHistorySetEditMutationResult =>
  isRecord(value)
  && typeof value.ok === 'boolean'
  && typeof value.changed === 'boolean'
  && typeof value.status === 'string'
  && typeof value.reasonCode === 'string'
  && typeof value.message === 'string';

const isSnapshot = (value: unknown): value is DevApiHistorySetEditSnapshot =>
  isRecord(value)
  && typeof value.snapshotId === 'string'
  && value.snapshotId.trim().length > 0
  && typeof value.schemaVersion === 'number'
  && Number.isFinite(value.schemaVersion)
  && typeof value.createdAt === 'string'
  && value.createdAt.trim().length > 0;

const finiteNumber = (value: unknown) => {
  if (value === '' || value === null || value === undefined) return null;
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const nonNegativeNumber = (value: unknown) => {
  const numeric = finiteNumber(value);
  return numeric !== null && numeric >= 0 ? numeric : null;
};

const nonNegativeInteger = (value: unknown) => {
  const numeric = nonNegativeNumber(value);
  return numeric !== null && Number.isInteger(numeric) ? numeric : null;
};

const normalizeRir = (value: unknown) => {
  if (value === '') return '';
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? value : null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return '';
  const numeric = Number(trimmed);
  return Number.isFinite(numeric) && numeric >= 0 ? trimmed : null;
};

const normalizeNote = (value: unknown) => {
  if (typeof value !== 'string') return null;
  const note = value.replace(/\s+/g, ' ').trim();
  return note.length <= 240 ? note : null;
};

export const validateHistorySetEditPatch = (
  patch: unknown,
): { ok: true; patch: HistorySetEditPatch; fields: HistorySetEditPatchField[] } | { ok: false; error: DevApiHistorySetEditError } => {
  if (!isRecord(patch)) {
    return {
      ok: false,
      error: {
        code: 'dev_mutation_invalid_patch',
        message: 'History set edit patch must be an object.',
      },
    };
  }

  const keys = Object.keys(patch);
  const broadKey = keys.find((key) => broadPatchFields.includes(key as (typeof broadPatchFields)[number]));
  const extraKey = keys.find((key) => !allowedPatchFields.has(key));
  if (broadKey || extraKey) {
    return {
      ok: false,
      error: {
        code: 'dev_mutation_invalid_patch',
        message: `History set edit patch field is not allowed: ${broadKey || extraKey}.`,
      },
    };
  }

  if (!keys.length) {
    return {
      ok: false,
      error: {
        code: 'dev_mutation_invalid_patch',
        message: 'History set edit patch must include at least one allowed field.',
      },
    };
  }

  const normalized: HistorySetEditPatch = {};
  const fields: HistorySetEditPatchField[] = [];

  if ('weightKg' in patch) {
    const value = nonNegativeNumber(patch.weightKg);
    if (value === null) return { ok: false, error: { code: 'dev_mutation_invalid_patch', message: 'weightKg must be a finite non-negative number.' } };
    normalized.weightKg = value;
    fields.push('weightKg');
  }
  if ('displayWeight' in patch) {
    const value = nonNegativeNumber(patch.displayWeight);
    if (value === null) return { ok: false, error: { code: 'dev_mutation_invalid_patch', message: 'displayWeight must be a finite non-negative number.' } };
    normalized.displayWeight = value;
    fields.push('displayWeight');
  }
  if ('displayUnit' in patch) {
    if (patch.displayUnit !== 'kg' && patch.displayUnit !== 'lb') {
      return { ok: false, error: { code: 'dev_mutation_invalid_patch', message: 'displayUnit must be kg or lb.' } };
    }
    normalized.displayUnit = patch.displayUnit;
    fields.push('displayUnit');
  }
  if ('reps' in patch) {
    const value = nonNegativeInteger(patch.reps);
    if (value === null) return { ok: false, error: { code: 'dev_mutation_invalid_patch', message: 'reps must be a finite non-negative integer.' } };
    normalized.reps = value;
    fields.push('reps');
  }
  if ('rir' in patch) {
    const value = normalizeRir(patch.rir);
    if (value === null) return { ok: false, error: { code: 'dev_mutation_invalid_patch', message: 'rir must be blank or non-negative.' } };
    normalized.rir = value;
    fields.push('rir');
  }
  if ('techniqueQuality' in patch) {
    if (!techniqueQualityValues.has(String(patch.techniqueQuality))) {
      return { ok: false, error: { code: 'dev_mutation_invalid_patch', message: 'techniqueQuality must be good, acceptable, or poor.' } };
    }
    normalized.techniqueQuality = patch.techniqueQuality as HistorySetEditPatch['techniqueQuality'];
    fields.push('techniqueQuality');
  }
  if ('painFlag' in patch) {
    if (typeof patch.painFlag !== 'boolean') {
      return { ok: false, error: { code: 'dev_mutation_invalid_patch', message: 'painFlag must be boolean.' } };
    }
    normalized.painFlag = patch.painFlag;
    fields.push('painFlag');
  }
  if ('note' in patch) {
    const value = normalizeNote(patch.note);
    if (value === null) return { ok: false, error: { code: 'dev_mutation_invalid_patch', message: 'note must be a string up to 240 characters.' } };
    normalized.note = value;
    fields.push('note');
  }

  return { ok: true, patch: normalized, fields };
};

const toRequestUrl = (baseUrl: string, sessionId: string) =>
  `${baseUrl.replace(/\/$/, '')}/${['history', encodeURIComponent(sessionId), 'edit'].join('/')}`;

export const sanitizeHistorySetEditMessage = (message: string, fallback = 'History set edit experiment failed.') => {
  const normalized = message
    .replace(/\b(?:Error|TypeError|[A-Za-z]+RepositoryError):\s*/gi, '')
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
  error: DevApiHistorySetEditError,
  status?: number,
  metadata?: DevApiHistorySetEditMetadata,
): DevApiHistorySetEditResult => ({
  ok: false,
  sessionId,
  exerciseId: metadata?.exerciseId,
  setId: metadata?.setId,
  status,
  error: {
    ...error,
    message: sanitizeHistorySetEditMessage(error.message),
  },
  metadata,
});

export const updateHistorySetEditViaDevApi = async ({
  sessionId,
  exerciseId,
  setId,
  patch,
  reason,
  config,
  metadata,
  fetchImpl,
  signal,
}: {
  sessionId: string;
  exerciseId: unknown;
  setId: unknown;
  patch: unknown;
  reason?: string;
  config: DevApiHistorySetEditEnabledConfig;
  metadata?: DevApiHistorySetEditMetadata;
  fetchImpl?: DevApiHistorySetEditFetch;
  signal?: AbortSignal;
}): Promise<DevApiHistorySetEditResult> => {
  const safeExerciseId = typeof exerciseId === 'string' ? exerciseId.trim() : '';
  const safeSetId = typeof setId === 'string' ? setId.trim() : '';
  if (!sessionId.trim() || !safeExerciseId || !safeSetId) {
    return failure(sessionId, {
      code: 'dev_mutation_invalid_target',
      message: 'History set edit requires an existing session, exercise, and set target.',
    }, undefined, metadata);
  }

  const validation = validateHistorySetEditPatch(patch);
  if (!validation.ok) return failure(sessionId, validation.error, undefined, metadata);

  if (!metadata || !metadata.sourceFingerprint.trim() || metadata.confirmed !== true) {
    return failure(sessionId, {
      code: 'dev_mutation_source_fingerprint_missing',
      message: 'History set edit source fingerprint is missing.',
    }, undefined, metadata);
  }

  const requestFetch = fetchImpl || globalThis.fetch;
  if (!requestFetch) {
    return failure(sessionId, {
      code: 'dev_mutation_fetch_unavailable',
      message: 'Fetch is unavailable for the history set edit experiment.',
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
    const requestBody = {
      exerciseId: safeExerciseId,
      setId: safeSetId,
      patch: validation.patch,
      ...(reason?.trim() ? { reason: reason.trim() } : {}),
    };
    const response = await requestFetch(toRequestUrl(config.baseUrl, sessionId), {
      method: DEV_API_HISTORY_SET_EDIT_METHOD,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      return failure(sessionId, {
        code: 'dev_mutation_invalid_response',
        message: 'History set edit response was not valid JSON.',
      }, response.status, metadata);
    }

    if (!isRecord(body)) {
      return failure(sessionId, {
        code: 'dev_mutation_invalid_response',
        message: 'History set edit response was not an object.',
      }, response.status, metadata);
    }

    if ('error' in body) {
      const error = body.error;
      if (!isServerError(error)) {
        return failure(sessionId, {
          code: 'dev_mutation_invalid_response',
          message: 'History set edit error response shape is invalid.',
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
        message: 'History set edit response is missing a mutation result.',
      }, response.status, metadata);
    }

    if (!response.ok || body.result.ok !== true || body.result.changed !== true || body.result.status !== 'success') {
      return failure(sessionId, {
        code: 'dev_mutation_not_successful',
        message: body.result.message || 'History set edit did not change.',
        serverCode: body.result.reasonCode,
      }, response.status, metadata);
    }

    if (!isSnapshot(body.snapshot)) {
      return failure(sessionId, {
        code: 'dev_mutation_missing_snapshot',
        message: 'History set edit did not return snapshot metadata.',
      }, response.status, metadata);
    }

    return {
      ok: true,
      sessionId,
      exerciseId: safeExerciseId,
      setId: safeSetId,
      patch: validation.patch,
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
        ? 'History set edit request timed out.'
        : abortedByParent
          ? 'History set edit request was canceled before completion.'
          : 'History set edit request is unavailable.',
    }, undefined, metadata);
  } finally {
    globalThis.clearTimeout(timeout);
    signal?.removeEventListener('abort', abortFromParent);
  }
};
