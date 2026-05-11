import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import type { AppData, PendingSessionPatch } from '../models/training-model';
import {
  applySessionPatchViaDevApi,
  DEV_API_SESSION_PATCH_SOURCE_SNAPSHOT_VERSION,
  sanitizeSessionPatchMessage,
  type DevApiSessionPatchError,
  type DevApiSessionPatchFetch,
  type DevApiSessionPatchMetadata,
  type DevApiSessionPatchSnapshot,
} from './devApiSessionPatchClient';
import {
  resolveDevApiSessionPatchConfig,
  type DevApiSessionPatchConfig,
} from './devApiSessionPatchConfig';

type ExperimentStatus = 'idle' | 'blocked' | 'pending' | 'success' | 'failure' | 'misconfigured';
export type SessionPatchDiagnosticState = 'idle' | 'confirming' | 'pending' | 'success' | 'failure';

export type SessionPatchSourceContext = {
  activeSessionId: string;
  activeSessionDate?: string;
  activeSessionTemplateId?: string;
  pendingPatchId: string;
  pendingPatchTitle: string;
  patchCount: number;
  sourceSnapshotHash: string;
  sourceSnapshotVersion: string;
};

export type SessionPatchPrototypeState = {
  status: ExperimentStatus;
  activeSessionId?: string;
  pendingPatchId?: string;
  message?: string;
  error?: DevApiSessionPatchError;
  snapshot?: DevApiSessionPatchSnapshot;
  metadata?: DevApiSessionPatchMetadata;
  startedAt?: string;
  finishedAt?: string;
  lastAttemptStatus?: number;
  duplicateSubmitBlocked?: boolean;
};

export type SessionPatchDiagnosticSummary = {
  targetReference?: string;
  state: SessionPatchDiagnosticState;
  lastAttemptStatus?: number;
  failureCode?: string;
  failureMessage?: string;
  snapshotMetadataPresent: boolean;
  startedAt?: string;
  finishedAt?: string;
  duplicateSubmitBlocked: boolean;
  recoveryNote?: string;
};

type DevApiSessionPatchPrototypeProps = {
  data: AppData;
  config?: DevApiSessionPatchConfig;
  fetchImpl?: DevApiSessionPatchFetch;
  now?: () => string;
};

const runtimeConfig = resolveDevApiSessionPatchConfig(import.meta.env);

const sortForStableComparison = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sortForStableComparison);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value)
    .sort()
    .reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = sortForStableComparison((value as Record<string, unknown>)[key]);
      return acc;
    }, {});
};

const stableStringify = (value: unknown) => JSON.stringify(sortForStableComparison(value));

const hashString = (value: string) => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
};

const clean = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const pendingPatchesOf = (data: AppData) => data.pendingSessionPatches || data.settings?.pendingSessionPatches || [];

const setCountOf = (sets: unknown) => (Array.isArray(sets) ? sets.length : typeof sets === 'number' ? sets : 0);

const findPendingPatchTarget = (data: AppData): PendingSessionPatch | undefined => {
  const activeSession = data.activeSession;
  if (!activeSession) return undefined;
  const activeTemplateIds = new Set([
    clean(activeSession.templateId),
    clean(activeSession.programTemplateId),
  ].filter(Boolean));

  return pendingPatchesOf(data).find((patch) => {
    if (patch.status !== 'pending') return false;
    if (!patch.patches?.length) return false;
    const targetTemplateId = clean(patch.targetTemplateId);
    return !targetTemplateId || activeTemplateIds.has(targetTemplateId);
  });
};

export const createSessionPatchSourceContext = (data: AppData): SessionPatchSourceContext | null => {
  const activeSession = data.activeSession;
  const activeSessionId = clean(activeSession?.id);
  if (!activeSession || !activeSessionId) return null;

  const pendingPatch = findPendingPatchTarget(data);
  if (!pendingPatch || !clean(pendingPatch.id)) return null;

  const source = {
    route: ['sessions', 'active', 'patches'],
    sourceSnapshotVersion: DEV_API_SESSION_PATCH_SOURCE_SNAPSHOT_VERSION,
    schemaVersion: data.schemaVersion,
    activeSession: {
      id: activeSessionId,
      date: activeSession.date,
      templateId: activeSession.templateId,
      programTemplateId: activeSession.programTemplateId,
      exerciseCount: activeSession.exercises?.length || 0,
      setCount: activeSession.exercises?.reduce((total, exercise) => total + setCountOf(exercise.sets), 0) || 0,
      appliedCoachActionCount: activeSession.appliedCoachActions?.length || 0,
    },
    pendingPatch: {
      id: pendingPatch.id,
      status: pendingPatch.status,
      sourceFingerprint: pendingPatch.sourceFingerprint,
      targetTemplateId: pendingPatch.targetTemplateId,
      patchCount: pendingPatch.patches.length,
      patchIds: pendingPatch.patches.map((patch) => patch.id).sort(),
    },
  };

  return {
    activeSessionId,
    activeSessionDate: activeSession.date,
    activeSessionTemplateId: activeSession.templateId,
    pendingPatchId: pendingPatch.id,
    pendingPatchTitle: pendingPatch.patches[0]?.title || pendingPatch.id,
    patchCount: pendingPatch.patches.length,
    sourceSnapshotHash: `session-patch-${hashString(stableStringify(source))}`,
    sourceSnapshotVersion: DEV_API_SESSION_PATCH_SOURCE_SNAPSHOT_VERSION,
  };
};

export const createSessionPatchMetadata = ({
  sourceContext,
  nowIso,
}: {
  sourceContext: SessionPatchSourceContext;
  nowIso: string;
}): DevApiSessionPatchMetadata => {
  const requestFingerprint = `request-${hashString(stableStringify({
    activeSessionId: sourceContext.activeSessionId,
    pendingPatchId: sourceContext.pendingPatchId,
    sourceSnapshotHash: sourceContext.sourceSnapshotHash,
    sourceSnapshotVersion: sourceContext.sourceSnapshotVersion,
  }))}`;
  const mutationId = `session-patch-${hashString(`${sourceContext.activeSessionId}:${sourceContext.pendingPatchId}:${sourceContext.sourceSnapshotHash}:${requestFingerprint}:${nowIso}`)}`;
  return {
    activeSessionId: sourceContext.activeSessionId,
    pendingPatchId: sourceContext.pendingPatchId,
    sourceSnapshotHash: sourceContext.sourceSnapshotHash,
    sourceSnapshotVersion: sourceContext.sourceSnapshotVersion,
    mutationId,
    idempotencyKey: `${mutationId}:${requestFingerprint}`,
    requestFingerprint,
    confirmed: true,
    nowIso,
  };
};

export const canSubmitSessionPatchPrototype = ({
  config,
  sourceContext,
  confirmed,
  pending,
}: {
  config: DevApiSessionPatchConfig;
  sourceContext: SessionPatchSourceContext | null;
  confirmed: boolean;
  pending: boolean;
}) =>
  config.enabled
  && Boolean(sourceContext?.activeSessionId)
  && Boolean(sourceContext?.pendingPatchId)
  && Boolean(sourceContext?.sourceSnapshotHash)
  && confirmed
  && !pending;

export const createSessionPatchSubmitLock = () => {
  let locked = false;
  return {
    acquire: () => {
      if (locked) return false;
      locked = true;
      return true;
    },
    release: () => {
      locked = false;
    },
    isLocked: () => locked,
  };
};

export const formatSessionPatchTargetReference = (activeSessionId?: string, pendingPatchId?: string) =>
  activeSessionId && pendingPatchId
    ? `active-${hashString(activeSessionId)}:patch-${hashString(pendingPatchId)}`
    : 'unavailable';

const safeErrorMessage = (error?: DevApiSessionPatchError) => {
  if (!error) return 'Session patch experiment failed.';
  return `${error.serverCode || error.code}: ${sanitizeSessionPatchMessage(error.message)}`.replace(/\s+/g, ' ').slice(0, 180);
};

export const getSessionPatchRecoveryNote = (error?: DevApiSessionPatchError) => {
  const code = error?.serverCode || error?.code;
  switch (code) {
    case 'dev_mutation_fetch_unavailable':
      return 'Fetch is unavailable in this browser. The App remains local-only.';
    case 'dev_mutation_unavailable':
      return 'Confirm the Dev API runner is running and the base URL is localhost.';
    case 'dev_mutation_timeout':
      return 'Confirm the Dev API is responsive, then retry only after explicit confirmation.';
    case 'dev_mutation_invalid_response':
      return 'Inspect Dev API logs and response shape before trusting persistence.';
    case 'dev_mutation_missing_snapshot':
      return 'Treat this as failed persistence because snapshot metadata was missing.';
    case 'dev_mutation_aborted':
      return 'The request was canceled or the component unmounted. No local data was changed.';
    case 'dev_mutation_invalid_target':
    case 'no_active_session':
    case 'pending_patch_not_found':
      return 'Verify the active session and pending patch still exist in local App state before retrying.';
    case 'dev_mutation_source_snapshot_missing':
    case 'dev_mutation_idempotency_missing':
      return 'Rebuild the source snapshot and confirm again before retrying.';
    case 'no_change':
      return 'Treat no-change as non-success for this prototype. Refresh diagnostics before retrying.';
    case 'write_failed':
    case 'transaction_failed':
      return 'Stop the Dev API runner, make a dev DB copy, and inspect the dev DB before retrying.';
    case 'database_closed':
      return 'Restart the Dev API runner, then rerun read-only diagnostics before retrying.';
    case 'unsupported_route':
      return 'Verify only the approved session patch experiment is enabled.';
    default:
      return 'Check Dev API logs and rerun read-only diagnostics before retrying.';
  }
};

export const createSessionPatchDiagnosticSummary = ({
  state,
  sourceContext,
  confirmed,
}: {
  state: SessionPatchPrototypeState;
  sourceContext: SessionPatchSourceContext | null;
  confirmed: boolean;
}): SessionPatchDiagnosticSummary => {
  const activeSessionId = state.activeSessionId || sourceContext?.activeSessionId;
  const pendingPatchId = state.pendingPatchId || sourceContext?.pendingPatchId;
  const failureCode = state.error ? state.error.serverCode || state.error.code : undefined;
  const diagnosticState: SessionPatchDiagnosticState =
    state.status === 'pending'
      ? 'pending'
      : state.status === 'success'
        ? 'success'
        : state.status === 'failure' || state.status === 'blocked' || state.status === 'misconfigured'
          ? 'failure'
          : confirmed && Boolean(sourceContext?.pendingPatchId)
            ? 'confirming'
            : 'idle';

  return {
    targetReference: formatSessionPatchTargetReference(activeSessionId, pendingPatchId),
    state: diagnosticState,
    lastAttemptStatus: state.lastAttemptStatus,
    failureCode,
    failureMessage: state.error ? safeErrorMessage(state.error) : undefined,
    snapshotMetadataPresent: Boolean(state.snapshot?.snapshotId && state.snapshot.createdAt),
    startedAt: state.startedAt,
    finishedAt: state.finishedAt,
    duplicateSubmitBlocked: Boolean(state.duplicateSubmitBlocked),
    recoveryNote: state.error ? getSessionPatchRecoveryNote(state.error) : undefined,
  };
};

export const DevApiSessionPatchPrototypePanel = ({
  config,
  sourceContext,
  confirmed,
  state,
  pending,
  onConfirmedChange,
  onCancel,
  onSubmit,
}: {
  config: DevApiSessionPatchConfig;
  sourceContext: SessionPatchSourceContext | null;
  confirmed: boolean;
  state: SessionPatchPrototypeState;
  pending: boolean;
  onConfirmedChange?: (confirmed: boolean) => void;
  onCancel?: () => void;
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
}) => {
  if (config.status === 'disabled') return null;

  const canSubmit = canSubmitSessionPatchPrototype({ config, sourceContext, confirmed, pending });
  const statusLabel =
    state.status === 'pending'
      ? 'Pending'
      : state.status === 'success'
        ? 'Success'
        : state.status === 'failure'
          ? 'Failure'
          : state.status === 'misconfigured'
            ? 'Misconfigured'
            : state.status === 'blocked'
              ? 'Blocked'
              : 'Ready';
  const diagnostic = createSessionPatchDiagnosticSummary({ state, sourceContext, confirmed });

  return (
    <section
      aria-label="Dev API session patch experiment"
      aria-live="polite"
      className="fixed bottom-3 right-3 z-[88] max-h-[45vh] w-[min(23rem,calc(100vw-1.5rem))] overflow-auto rounded-lg border border-teal-300 bg-teal-50/95 p-3 text-xs text-slate-800 shadow-lg"
      role="status"
    >
      <div className="text-sm font-semibold text-slate-950">Dev API session patch experiment</div>
      <p className="mt-2 text-slate-700">
        Dev-only mutation experiment. localStorage remains source of truth. No App data is changed locally.
      </p>

      {config.status === 'invalid' ? (
        <p className="mt-2 font-medium text-rose-700">
          Config is invalid. Use a localhost Dev API base URL. No request was sent.
        </p>
      ) : null}

      {config.enabled && !sourceContext ? (
        <p className="mt-2 font-medium text-slate-700">
          No stable session-patch target is available. No request was sent.
        </p>
      ) : null}

      {sourceContext ? (
        <form className="mt-3 space-y-2" onSubmit={onSubmit}>
          <div>
            <span className="font-medium">Pending patch target</span>
            <div className="mt-1 rounded-md border border-slate-300 bg-white px-2 py-1">
              {sourceContext.pendingPatchTitle}
            </div>
          </div>
          <div className="rounded-md bg-white/80 p-2 text-[11px] text-slate-700">
            <div>Source snapshot: {sourceContext.sourceSnapshotHash}</div>
            <div>Target reference: {diagnostic.targetReference}</div>
            <div>Patch count: {sourceContext.patchCount}</div>
          </div>

          <label className="flex items-start gap-2 rounded-md bg-white/80 p-2">
            <input
              aria-label="Confirm session patch experiment"
              checked={confirmed}
              className="mt-0.5"
              disabled={pending || !config.enabled}
              onChange={(event) => onConfirmedChange?.(event.target.checked)}
              type="checkbox"
            />
            <span>
              I confirm this dev-only request applies the selected patch in the Dev API snapshot only. The App remains local-first.
            </span>
          </label>

          <div className="flex items-center gap-2">
            <button
              className="rounded-md bg-teal-700 px-3 py-1.5 font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-400"
              disabled={!canSubmit}
              type="submit"
            >
              {pending ? 'Applying...' : 'Apply in Dev API'}
            </button>
            <button
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 disabled:cursor-not-allowed disabled:text-slate-400"
              disabled={pending && !confirmed}
              onClick={onCancel}
              type="button"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      <div className="mt-3 rounded-md bg-white/80 p-2">
        <div className="font-medium">Status: {statusLabel}</div>
        {state.status === 'success' && state.snapshot ? (
          <p className="mt-1 text-emerald-700">
            Snapshot recorded: {state.snapshot.snapshotId}. No App data was changed locally.
          </p>
        ) : null}
        {state.status === 'failure' && state.error ? (
          <p className="mt-1 text-rose-700">{safeErrorMessage(state.error)}</p>
        ) : null}
        {diagnostic.recoveryNote ? (
          <p className="mt-1 text-slate-700">{diagnostic.recoveryNote}</p>
        ) : null}
        {diagnostic.duplicateSubmitBlocked ? (
          <p className="mt-1 text-slate-700">Duplicate submit was blocked while a request was pending.</p>
        ) : null}
      </div>
    </section>
  );
};

export const DevApiSessionPatchPrototype = ({
  data,
  config = runtimeConfig,
  fetchImpl,
  now = () => new Date().toISOString(),
}: DevApiSessionPatchPrototypeProps) => {
  const [confirmed, setConfirmed] = useState(false);
  const [state, setState] = useState<SessionPatchPrototypeState>({ status: 'idle' });
  const lockRef = useRef(createSessionPatchSubmitLock());
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(false);

  const sourceContext = useMemo(() => createSessionPatchSourceContext(data), [data]);
  const resetKey = `${config.status}:${config.enabled ? config.baseUrl : ''}:${sourceContext?.activeSessionId || ''}:${sourceContext?.pendingPatchId || ''}:${sourceContext?.sourceSnapshotHash || ''}`;
  const pending = state.status === 'pending';

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    setConfirmed(false);
    setState({ status: config.status === 'invalid' ? 'misconfigured' : sourceContext ? 'idle' : 'blocked' });
    lockRef.current.release();
    abortRef.current?.abort();
    abortRef.current = null;
  }, [resetKey, config.status, sourceContext]);

  const cancel = () => {
    setConfirmed(false);
    setState((current) => current.status === 'pending' ? current : {
      status: 'idle',
      activeSessionId: sourceContext?.activeSessionId,
      pendingPatchId: sourceContext?.pendingPatchId,
    });
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!config.enabled || !sourceContext) return;
    if (!canSubmitSessionPatchPrototype({ config, sourceContext, confirmed, pending: state.status === 'pending' })) return;
    if (!lockRef.current.acquire()) {
      setState((current) => ({ ...current, duplicateSubmitBlocked: true }));
      return;
    }

    const startedAt = now();
    const metadata = createSessionPatchMetadata({ sourceContext, nowIso: startedAt });
    const controller = new AbortController();
    abortRef.current = controller;
    setState({
      status: 'pending',
      activeSessionId: sourceContext.activeSessionId,
      pendingPatchId: sourceContext.pendingPatchId,
      metadata,
      startedAt,
    });

    const result = await applySessionPatchViaDevApi({
      activeSessionId: sourceContext.activeSessionId,
      pendingPatchId: sourceContext.pendingPatchId,
      config,
      metadata,
      fetchImpl,
      signal: controller.signal,
    });

    lockRef.current.release();
    if (!mountedRef.current) return;
    abortRef.current = null;
    const finishedAt = now();
    setConfirmed(false);
    if (result.ok) {
      setState({
        status: 'success',
        activeSessionId: result.activeSessionId,
        pendingPatchId: result.pendingPatchId,
        message: result.result.message,
        snapshot: result.snapshot,
        metadata: result.metadata,
        lastAttemptStatus: result.status,
        startedAt,
        finishedAt,
      });
    } else {
      setState({
        status: 'failure',
        activeSessionId: result.activeSessionId || sourceContext.activeSessionId,
        pendingPatchId: result.pendingPatchId || sourceContext.pendingPatchId,
        error: result.error,
        metadata: result.metadata,
        lastAttemptStatus: result.status,
        startedAt,
        finishedAt,
      });
    }
  };

  return (
    <DevApiSessionPatchPrototypePanel
      config={config}
      confirmed={confirmed}
      onCancel={cancel}
      onConfirmedChange={setConfirmed}
      onSubmit={submit}
      pending={pending}
      sourceContext={sourceContext}
      state={state}
    />
  );
};
