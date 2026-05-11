import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import type { AppData } from '../models/training-model';
import {
  completeSessionViaDevApi,
  DEV_API_SESSION_COMPLETE_SOURCE_SNAPSHOT_VERSION,
  sanitizeSessionCompleteMessage,
  type DevApiSessionCompleteError,
  type DevApiSessionCompleteFetch,
  type DevApiSessionCompleteMetadata,
  type DevApiSessionCompleteSnapshot,
} from './devApiSessionCompleteClient';
import {
  resolveDevApiSessionCompleteConfig,
  type DevApiSessionCompleteConfig,
} from './devApiSessionCompleteConfig';

type ExperimentStatus = 'idle' | 'blocked' | 'pending' | 'success' | 'failure' | 'misconfigured';
export type SessionCompleteDiagnosticState = 'idle' | 'confirming' | 'pending' | 'success' | 'failure';

export type SessionCompleteSourceContext = {
  activeSessionId: string;
  activeSessionDate?: string;
  activeSessionTemplateId?: string;
  exerciseCount: number;
  completedSetCount: number;
  sourceSnapshotHash: string;
  sourceSnapshotVersion: string;
};

export type SessionCompletePrototypeState = {
  status: ExperimentStatus;
  activeSessionId?: string;
  message?: string;
  error?: DevApiSessionCompleteError;
  snapshot?: DevApiSessionCompleteSnapshot;
  metadata?: DevApiSessionCompleteMetadata;
  startedAt?: string;
  finishedAt?: string;
  lastAttemptStatus?: number;
  duplicateSubmitBlocked?: boolean;
};

export type SessionCompleteDiagnosticSummary = {
  targetReference?: string;
  state: SessionCompleteDiagnosticState;
  lastAttemptStatus?: number;
  failureCode?: string;
  failureMessage?: string;
  snapshotMetadataPresent: boolean;
  startedAt?: string;
  finishedAt?: string;
  duplicateSubmitBlocked: boolean;
  recoveryNote?: string;
};

type DevApiSessionCompletePrototypeProps = {
  data: AppData;
  config?: DevApiSessionCompleteConfig;
  fetchImpl?: DevApiSessionCompleteFetch;
  now?: () => string;
};

const runtimeConfig = resolveDevApiSessionCompleteConfig(import.meta.env);

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

const setCountOf = (sets: unknown) => (Array.isArray(sets) ? sets.length : typeof sets === 'number' ? sets : 0);

const doneSetCountOf = (sets: unknown) =>
  Array.isArray(sets) ? sets.filter((set) => Boolean((set as { done?: unknown }).done)).length : 0;

export const createSessionCompleteSourceContext = (data: AppData): SessionCompleteSourceContext | null => {
  const activeSession = data.activeSession;
  const activeSessionId = clean(activeSession?.id);
  if (!activeSession || !activeSessionId) return null;

  const exerciseCount = activeSession.exercises?.length || 0;
  const setCount = activeSession.exercises?.reduce((total, exercise) => total + setCountOf(exercise.sets), 0) || 0;
  const completedSetCount = activeSession.exercises?.reduce((total, exercise) => total + doneSetCountOf(exercise.sets), 0) || 0;
  const source = {
    route: ['sessions', 'active', 'complete'],
    sourceSnapshotVersion: DEV_API_SESSION_COMPLETE_SOURCE_SNAPSHOT_VERSION,
    schemaVersion: data.schemaVersion,
    activeSession: {
      id: activeSessionId,
      date: activeSession.date,
      templateId: activeSession.templateId,
      programTemplateId: activeSession.programTemplateId,
      exerciseCount,
      setCount,
      completedSetCount,
      currentExerciseId: activeSession.currentExerciseId,
      currentSetIndex: activeSession.currentSetIndex,
      completed: activeSession.completed,
    },
    historyLength: data.history?.length || 0,
    latestHistoryId: data.history?.[0]?.id,
  };

  return {
    activeSessionId,
    activeSessionDate: activeSession.date,
    activeSessionTemplateId: activeSession.templateId,
    exerciseCount,
    completedSetCount,
    sourceSnapshotHash: `session-complete-${hashString(stableStringify(source))}`,
    sourceSnapshotVersion: DEV_API_SESSION_COMPLETE_SOURCE_SNAPSHOT_VERSION,
  };
};

export const createSessionCompleteMetadata = ({
  sourceContext,
  nowIso,
}: {
  sourceContext: SessionCompleteSourceContext;
  nowIso: string;
}): DevApiSessionCompleteMetadata => {
  const requestFingerprint = `request-${hashString(stableStringify({
    activeSessionId: sourceContext.activeSessionId,
    sourceSnapshotHash: sourceContext.sourceSnapshotHash,
    sourceSnapshotVersion: sourceContext.sourceSnapshotVersion,
  }))}`;
  const mutationId = `session-complete-${hashString(`${sourceContext.activeSessionId}:${sourceContext.sourceSnapshotHash}:${requestFingerprint}:${nowIso}`)}`;
  return {
    activeSessionId: sourceContext.activeSessionId,
    sourceSnapshotHash: sourceContext.sourceSnapshotHash,
    sourceSnapshotVersion: sourceContext.sourceSnapshotVersion,
    mutationId,
    idempotencyKey: `${mutationId}:${requestFingerprint}`,
    requestFingerprint,
    confirmed: true,
    nowIso,
  };
};

export const canSubmitSessionCompletePrototype = ({
  config,
  sourceContext,
  confirmed,
  pending,
}: {
  config: DevApiSessionCompleteConfig;
  sourceContext: SessionCompleteSourceContext | null;
  confirmed: boolean;
  pending: boolean;
}) =>
  config.enabled
  && Boolean(sourceContext?.activeSessionId)
  && Boolean(sourceContext?.sourceSnapshotHash)
  && confirmed
  && !pending;

export const createSessionCompleteSubmitLock = () => {
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

export const formatSessionCompleteTargetReference = (activeSessionId?: string) =>
  activeSessionId ? `active-${hashString(activeSessionId)}` : 'unavailable';

const safeErrorMessage = (error?: DevApiSessionCompleteError) => {
  if (!error) return 'Session complete experiment failed.';
  return `${error.serverCode || error.code}: ${sanitizeSessionCompleteMessage(error.message)}`.replace(/\s+/g, ' ').slice(0, 180);
};

export const getSessionCompleteRecoveryNote = (error?: DevApiSessionCompleteError) => {
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
      return 'Verify the active session still exists in local App state before retrying.';
    case 'incomplete_main_work_requires_confirmation':
      return 'The Dev API requires incomplete-work confirmation. No success was recorded.';
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
      return 'Verify only the approved session complete experiment is enabled.';
    default:
      return 'Check Dev API logs and rerun read-only diagnostics before retrying.';
  }
};

export const createSessionCompleteDiagnosticSummary = ({
  state,
  sourceContext,
  confirmed,
}: {
  state: SessionCompletePrototypeState;
  sourceContext: SessionCompleteSourceContext | null;
  confirmed: boolean;
}): SessionCompleteDiagnosticSummary => {
  const activeSessionId = state.activeSessionId || sourceContext?.activeSessionId;
  const failureCode = state.error ? state.error.serverCode || state.error.code : undefined;
  const diagnosticState: SessionCompleteDiagnosticState =
    state.status === 'pending'
      ? 'pending'
      : state.status === 'success'
        ? 'success'
        : state.status === 'failure' || state.status === 'blocked' || state.status === 'misconfigured'
          ? 'failure'
          : confirmed && Boolean(sourceContext?.activeSessionId)
            ? 'confirming'
            : 'idle';

  return {
    targetReference: formatSessionCompleteTargetReference(activeSessionId),
    state: diagnosticState,
    lastAttemptStatus: state.lastAttemptStatus,
    failureCode,
    failureMessage: state.error ? safeErrorMessage(state.error) : undefined,
    snapshotMetadataPresent: Boolean(state.snapshot?.snapshotId && state.snapshot.createdAt),
    startedAt: state.startedAt,
    finishedAt: state.finishedAt,
    duplicateSubmitBlocked: Boolean(state.duplicateSubmitBlocked),
    recoveryNote: state.error ? getSessionCompleteRecoveryNote(state.error) : undefined,
  };
};

export const DevApiSessionCompletePrototypePanel = ({
  config,
  sourceContext,
  confirmed,
  state,
  pending,
  onConfirmedChange,
  onCancel,
  onSubmit,
}: {
  config: DevApiSessionCompleteConfig;
  sourceContext: SessionCompleteSourceContext | null;
  confirmed: boolean;
  state: SessionCompletePrototypeState;
  pending: boolean;
  onConfirmedChange?: (confirmed: boolean) => void;
  onCancel?: () => void;
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
}) => {
  if (config.status === 'disabled') return null;

  const canSubmit = canSubmitSessionCompletePrototype({ config, sourceContext, confirmed, pending });
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
  const diagnostic = createSessionCompleteDiagnosticSummary({ state, sourceContext, confirmed });

  return (
    <section
      aria-label="Dev API session complete experiment"
      aria-live="polite"
      className="fixed bottom-3 right-3 z-[87] max-h-[45vh] w-[min(23rem,calc(100vw-1.5rem))] overflow-auto rounded-lg border border-amber-300 bg-amber-50/95 p-3 text-xs text-slate-800 shadow-lg"
      role="status"
    >
      <div className="text-sm font-semibold text-slate-950">Dev API session complete experiment</div>
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
          No stable session-complete target is available. No request was sent.
        </p>
      ) : null}

      {sourceContext ? (
        <form className="mt-3 space-y-2" onSubmit={onSubmit}>
          <div>
            <span className="font-medium">Active session target</span>
            <div className="mt-1 rounded-md border border-slate-300 bg-white px-2 py-1">
              {sourceContext.activeSessionTemplateId || sourceContext.activeSessionId}
            </div>
          </div>
          <div className="rounded-md bg-white/80 p-2 text-[11px] text-slate-700">
            <div>Source snapshot: {sourceContext.sourceSnapshotHash}</div>
            <div>Target reference: {diagnostic.targetReference}</div>
            <div>Exercises: {sourceContext.exerciseCount}</div>
            <div>Completed sets: {sourceContext.completedSetCount}</div>
          </div>

          <label className="flex items-start gap-2 rounded-md bg-white/80 p-2">
            <input
              aria-label="Confirm session complete experiment"
              checked={confirmed}
              className="mt-0.5"
              disabled={pending || !config.enabled}
              onChange={(event) => onConfirmedChange?.(event.target.checked)}
              type="checkbox"
            />
            <span>
              I confirm this dev-only request completes the active session in the Dev API snapshot only. The App remains local-first.
            </span>
          </label>

          <div className="flex items-center gap-2">
            <button
              className="rounded-md bg-amber-700 px-3 py-1.5 font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-400"
              disabled={!canSubmit}
              type="submit"
            >
              {pending ? 'Completing...' : 'Complete in Dev API'}
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

export const DevApiSessionCompletePrototype = ({
  data,
  config = runtimeConfig,
  fetchImpl,
  now = () => new Date().toISOString(),
}: DevApiSessionCompletePrototypeProps) => {
  const [confirmed, setConfirmed] = useState(false);
  const [state, setState] = useState<SessionCompletePrototypeState>({ status: 'idle' });
  const lockRef = useRef(createSessionCompleteSubmitLock());
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(false);

  const sourceContext = useMemo(() => createSessionCompleteSourceContext(data), [data]);
  const resetKey = `${config.status}:${config.enabled ? config.baseUrl : ''}:${sourceContext?.activeSessionId || ''}:${sourceContext?.sourceSnapshotHash || ''}`;
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
    });
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!config.enabled || !sourceContext) return;
    if (!canSubmitSessionCompletePrototype({ config, sourceContext, confirmed, pending: state.status === 'pending' })) return;
    if (!lockRef.current.acquire()) {
      setState((current) => ({ ...current, duplicateSubmitBlocked: true }));
      return;
    }

    const startedAt = now();
    const metadata = createSessionCompleteMetadata({ sourceContext, nowIso: startedAt });
    const controller = new AbortController();
    abortRef.current = controller;
    setState({
      status: 'pending',
      activeSessionId: sourceContext.activeSessionId,
      metadata,
      startedAt,
    });

    const result = await completeSessionViaDevApi({
      activeSessionId: sourceContext.activeSessionId,
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
        error: result.error,
        metadata: result.metadata,
        lastAttemptStatus: result.status,
        startedAt,
        finishedAt,
      });
    }
  };

  return (
    <DevApiSessionCompletePrototypePanel
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
