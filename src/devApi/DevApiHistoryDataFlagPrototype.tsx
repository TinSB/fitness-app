import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { buildReadMirrorHistoryList, buildReadMirrorSessionsSummary } from '../../apps/api/src/readMirror';
import type { AppData } from '../models/training-model';
import {
  isHistoryDataFlagValue,
  sanitizeHistoryDataFlagMessage,
  updateHistoryDataFlagViaDevApi,
  type DevApiHistoryDataFlagError,
  type DevApiHistoryDataFlagFetch,
  type DevApiHistoryDataFlagMetadata,
  type DevApiHistoryDataFlagResult,
  type DevApiHistoryDataFlagSnapshot,
  type HistoryDataFlagValue,
} from './devApiHistoryDataFlagClient';
import {
  resolveDevApiHistoryDataFlagConfig,
  type DevApiHistoryDataFlagConfig,
} from './devApiHistoryDataFlagConfig';

type ExperimentStatus = 'idle' | 'blocked' | 'pending' | 'success' | 'failure' | 'misconfigured';
export type HistoryDataFlagDiagnosticState = 'idle' | 'confirming' | 'pending' | 'success' | 'failure';

export type HistoryDataFlagSessionOption = {
  id: string;
  calendarDate: string;
  dataFlag: HistoryDataFlagValue;
};

export type HistoryDataFlagSourceContext = {
  sessionId: string;
  currentDataFlag: HistoryDataFlagValue;
  targetDataFlag: HistoryDataFlagValue;
  sourceFingerprint: string;
  historyCount: number;
  analyticsSessionCount: number;
  byDataFlag: Record<HistoryDataFlagValue, number>;
  historyIds: string[];
  sessions: HistoryDataFlagSessionOption[];
};

export type HistoryDataFlagPrototypeState = {
  status: ExperimentStatus;
  sessionId?: string;
  targetDataFlag?: HistoryDataFlagValue;
  message?: string;
  error?: DevApiHistoryDataFlagError;
  snapshot?: DevApiHistoryDataFlagSnapshot;
  metadata?: DevApiHistoryDataFlagMetadata;
  startedAt?: string;
  finishedAt?: string;
  lastAttemptStatus?: number;
  duplicateSubmitBlocked?: boolean;
};

export type HistoryDataFlagDiagnosticSummary = {
  sessionReference?: string;
  state: HistoryDataFlagDiagnosticState;
  lastAttemptStatus?: number;
  failureCode?: string;
  failureMessage?: string;
  snapshotMetadataPresent: boolean;
  startedAt?: string;
  finishedAt?: string;
  duplicateSubmitBlocked: boolean;
  recoveryNote?: string;
};

type DevApiHistoryDataFlagPrototypeProps = {
  data: AppData;
  config?: DevApiHistoryDataFlagConfig;
  fetchImpl?: DevApiHistoryDataFlagFetch;
  now?: () => string;
};

const runtimeConfig = resolveDevApiHistoryDataFlagConfig(import.meta.env);

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

const normalizeDataFlag = (value: unknown): HistoryDataFlagValue =>
  isHistoryDataFlagValue(value) ? value : 'normal';

const fallbackTargetDataFlag = (current: HistoryDataFlagValue): HistoryDataFlagValue =>
  current === 'normal' ? 'test' : 'normal';

export const formatHistoryDataFlagSessionReference = (sessionId?: string) =>
  sessionId ? `session-${hashString(sessionId)}` : 'unavailable';

export const createHistoryDataFlagSourceContext = (
  data: AppData,
  sessionId?: string,
  targetDataFlag?: HistoryDataFlagValue,
): HistoryDataFlagSourceContext | null => {
  const historyList = buildReadMirrorHistoryList(data).sessions.filter((session) => session.id.trim());
  if (!historyList.length) return null;

  const selected = sessionId
    ? historyList.find((session) => session.id === sessionId) || historyList[0]
    : historyList[0];
  if (!selected?.id) return null;

  const sessionSummary = buildReadMirrorSessionsSummary(data);
  const currentDataFlag = normalizeDataFlag(selected.dataFlag);
  const resolvedTarget = targetDataFlag || fallbackTargetDataFlag(currentDataFlag);
  const historyIds = historyList.map((session) => session.id).sort();
  const byDataFlag = {
    normal: sessionSummary.byDataFlag.normal,
    test: sessionSummary.byDataFlag.test,
    excluded: sessionSummary.byDataFlag.excluded,
  };
  const source = {
    path: '/history/:id/data-flag',
    selectedSessionId: selected.id,
    currentDataFlag,
    targetDataFlag: resolvedTarget,
    historyCount: historyList.length,
    analyticsSessionCount: sessionSummary.analyticsSessionCount,
    byDataFlag,
    historyIds,
  };

  return {
    sessionId: selected.id,
    currentDataFlag,
    targetDataFlag: resolvedTarget,
    sourceFingerprint: `history-data-flag-${hashString(stableStringify(source))}`,
    historyCount: historyList.length,
    analyticsSessionCount: sessionSummary.analyticsSessionCount,
    byDataFlag,
    historyIds,
    sessions: historyList.map((session) => ({
      id: session.id,
      calendarDate: session.calendarDate,
      dataFlag: normalizeDataFlag(session.dataFlag),
    })),
  };
};

export const createHistoryDataFlagMetadata = ({
  sessionId,
  targetDataFlag,
  sourceFingerprint,
  nowIso,
  reason,
}: {
  sessionId: string;
  targetDataFlag: HistoryDataFlagValue;
  sourceFingerprint: string;
  nowIso: string;
  reason?: string;
}): DevApiHistoryDataFlagMetadata => {
  const requestFingerprint = `request-${hashString(stableStringify({ sessionId, targetDataFlag, sourceFingerprint }))}`;
  const mutationId = `history-data-flag-${hashString(`${sessionId}:${targetDataFlag}:${sourceFingerprint}:${nowIso}`)}`;
  return {
    sessionId,
    targetDataFlag,
    mutationId,
    idempotencyKey: `${mutationId}:${requestFingerprint}`,
    requestFingerprint,
    sourceFingerprint,
    confirmed: true,
    reason,
    nowIso,
  };
};

export const canSubmitHistoryDataFlagPrototype = ({
  config,
  sourceContext,
  confirmed,
  pending,
}: {
  config: DevApiHistoryDataFlagConfig;
  sourceContext: HistoryDataFlagSourceContext | null;
  confirmed: boolean;
  pending: boolean;
}) =>
  config.enabled
  && Boolean(sourceContext?.sessionId)
  && Boolean(sourceContext?.sourceFingerprint)
  && isHistoryDataFlagValue(sourceContext?.targetDataFlag)
  && confirmed
  && !pending;

export const createHistoryDataFlagSubmitLock = () => {
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

const safeErrorMessage = (error?: DevApiHistoryDataFlagError) => {
  if (!error) return 'History data-flag experiment failed.';
  return `${error.serverCode || error.code}: ${sanitizeHistoryDataFlagMessage(error.message)}`.replace(/\s+/g, ' ').slice(0, 180);
};

export const getHistoryDataFlagRecoveryNote = (error?: DevApiHistoryDataFlagError) => {
  const code = error?.serverCode || error?.code;
  switch (code) {
    case 'dev_mutation_fetch_unavailable':
      return 'Fetch is unavailable in this browser. The App remains localStorage-only.';
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
    case 'dev_mutation_invalid_data_flag':
    case 'record_edit_invalid':
      return 'Choose normal, test, or excluded before trying again.';
    case 'record_not_found':
      return 'Refresh read-only diagnostics or verify the history record still exists before retrying.';
    case 'record_no_change':
      return 'The record may already have that dataFlag. Rerun read-only diagnostics before retrying.';
    case 'write_failed':
    case 'transaction_failed':
      return 'Stop the Dev API runner, make a dev DB copy, and inspect the dev DB before retrying.';
    case 'database_closed':
      return 'Restart the Dev API runner, then rerun read-only diagnostics before retrying.';
    case 'snapshot_validation_failed':
    case 'repository_schema_mismatch':
      return 'Stop the Dev API runner, make a dev DB copy, and inspect schema notes before retrying.';
    case 'unsupported_route':
      return 'Verify only POST /history/:id/data-flag is enabled for this experiment.';
    case 'dev_mutation_source_fingerprint_missing':
      return 'Rebuild read-only diagnostics first so the request has source context.';
    default:
      return 'Check Dev API logs and rerun read-only diagnostics before retrying.';
  }
};

export const createHistoryDataFlagDiagnosticSummary = ({
  state,
  sourceContext,
  selectedSessionId,
  confirmed,
}: {
  state: HistoryDataFlagPrototypeState;
  sourceContext: HistoryDataFlagSourceContext | null;
  selectedSessionId: string;
  confirmed: boolean;
}): HistoryDataFlagDiagnosticSummary => {
  const sessionId = state.sessionId || sourceContext?.sessionId || selectedSessionId || undefined;
  const failureCode = state.error ? state.error.serverCode || state.error.code : undefined;
  const diagnosticState: HistoryDataFlagDiagnosticState =
    state.status === 'pending'
      ? 'pending'
      : state.status === 'success'
        ? 'success'
        : state.status === 'failure' || state.status === 'blocked' || state.status === 'misconfigured'
          ? 'failure'
          : confirmed && Boolean(sourceContext?.sessionId)
            ? 'confirming'
            : 'idle';

  return {
    sessionReference: formatHistoryDataFlagSessionReference(sessionId),
    state: diagnosticState,
    lastAttemptStatus: state.lastAttemptStatus,
    failureCode,
    failureMessage: state.error ? safeErrorMessage(state.error) : undefined,
    snapshotMetadataPresent: Boolean(state.snapshot?.snapshotId && state.snapshot.createdAt),
    startedAt: state.startedAt,
    finishedAt: state.finishedAt,
    duplicateSubmitBlocked: Boolean(state.duplicateSubmitBlocked),
    recoveryNote: state.error ? getHistoryDataFlagRecoveryNote(state.error) : undefined,
  };
};

export const DevApiHistoryDataFlagPrototypePanel = ({
  config,
  sourceContext,
  selectedSessionId,
  targetDataFlag,
  confirmed,
  state,
  pending,
  onSessionChange,
  onTargetDataFlagChange,
  onConfirmedChange,
  onCancel,
  onSubmit,
}: {
  config: DevApiHistoryDataFlagConfig;
  sourceContext: HistoryDataFlagSourceContext | null;
  selectedSessionId: string;
  targetDataFlag: HistoryDataFlagValue;
  confirmed: boolean;
  state: HistoryDataFlagPrototypeState;
  pending: boolean;
  onSessionChange?: (sessionId: string) => void;
  onTargetDataFlagChange?: (dataFlag: HistoryDataFlagValue) => void;
  onConfirmedChange?: (confirmed: boolean) => void;
  onCancel?: () => void;
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
}) => {
  if (config.status === 'disabled') return null;

  const canSubmit = canSubmitHistoryDataFlagPrototype({
    config,
    sourceContext,
    confirmed,
    pending,
  });
  const selectedSessionIndex = sourceContext
    ? Math.max(0, sourceContext.sessions.findIndex((session) => session.id === selectedSessionId))
    : 0;
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
  const diagnostic = createHistoryDataFlagDiagnosticSummary({
    state,
    sourceContext,
    selectedSessionId,
    confirmed,
  });

  return (
    <section
      aria-label="Dev API History data-flag experiment"
      aria-live="polite"
      className="fixed bottom-48 left-3 z-[89] max-h-[45vh] w-[min(22rem,calc(100vw-1.5rem))] overflow-auto rounded-lg border border-sky-300 bg-sky-50/95 p-3 text-xs text-slate-800 shadow-lg lg:bottom-40"
      role="status"
    >
      <div className="text-sm font-semibold text-slate-950">Dev API History data-flag experiment</div>
      <p className="mt-2 text-slate-700">
        Dev-only mutation experiment. localStorage remains source of truth. No data is changed locally.
      </p>

      {config.status === 'invalid' ? (
        <p className="mt-2 font-medium text-rose-700">
          Config is invalid. Use a localhost Dev API base URL. No request was sent.
        </p>
      ) : null}

      {config.enabled && !sourceContext ? (
        <p className="mt-2 font-medium text-slate-700">
          No stable history record is available for this experiment. No request was sent.
        </p>
      ) : null}

      {sourceContext ? (
        <form className="mt-3 space-y-2" onSubmit={onSubmit}>
          <label className="block">
            <span className="font-medium">History record</span>
            <select
              aria-label="History record"
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1"
              disabled={pending}
              onChange={(event) => {
                const session = sourceContext.sessions[Number(event.target.value)];
                if (session) onSessionChange?.(session.id);
              }}
              value={String(selectedSessionIndex)}
            >
              {sourceContext.sessions.map((session, index) => (
                <option key={session.id} value={String(index)}>
                  {`Record ${index + 1} - ${session.calendarDate} - ${session.dataFlag}`}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="font-medium">Target dataFlag</span>
            <select
              aria-label="Target dataFlag"
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1"
              disabled={pending}
              onChange={(event) => {
                if (isHistoryDataFlagValue(event.target.value)) onTargetDataFlagChange?.(event.target.value);
              }}
              value={targetDataFlag}
            >
              <option value="normal">normal</option>
              <option value="test">test</option>
              <option value="excluded">excluded</option>
            </select>
          </label>

          <p className="text-slate-700">
            Current dataFlag: {sourceContext.currentDataFlag}. Target dataFlag: {targetDataFlag}. Statistics may change
            if this record changes participation.
          </p>

          <label className="flex items-start gap-2">
            <input
              checked={confirmed}
              className="mt-0.5"
              disabled={pending}
              onChange={(event) => onConfirmedChange?.(event.target.checked)}
              type="checkbox"
            />
            <span>I confirm this one-route dev request for the selected history record.</span>
          </label>

          <div className="flex gap-2">
            <button
              className="rounded-md border border-sky-500 bg-white px-2 py-1 font-medium text-slate-900 disabled:opacity-60"
              disabled={!canSubmit}
              type="submit"
            >
              {pending ? 'Pending' : 'Send dataFlag request'}
            </button>
            <button
              className="rounded-md border border-slate-300 bg-white px-2 py-1 font-medium text-slate-700 disabled:opacity-60"
              disabled={pending}
              onClick={onCancel}
              type="button"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1">
        <dt className="font-medium">Status</dt>
        <dd>{statusLabel}</dd>
        <dt className="font-medium">Mutation state</dt>
        <dd>{diagnostic.state}</dd>
        <dt className="font-medium">Target record</dt>
        <dd>{diagnostic.sessionReference}</dd>
        <dt className="font-medium">Current dataFlag</dt>
        <dd>{sourceContext?.currentDataFlag || 'unavailable'}</dd>
        <dt className="font-medium">Target dataFlag</dt>
        <dd>{targetDataFlag}</dd>
        <dt className="font-medium">History count</dt>
        <dd>{sourceContext?.historyCount ?? 0}</dd>
        <dt className="font-medium">Analytics count</dt>
        <dd>{sourceContext?.analyticsSessionCount ?? 0}</dd>
        <dt className="font-medium">Source</dt>
        <dd>{sourceContext?.sourceFingerprint || 'unavailable'}</dd>
        <dt className="font-medium">Snapshot metadata</dt>
        <dd>{diagnostic.snapshotMetadataPresent ? 'present' : 'absent'}</dd>
        {typeof diagnostic.lastAttemptStatus === 'number' ? (
          <>
            <dt className="font-medium">HTTP status</dt>
            <dd>{diagnostic.lastAttemptStatus}</dd>
          </>
        ) : null}
        {diagnostic.failureCode ? (
          <>
            <dt className="font-medium">Failure code</dt>
            <dd>{diagnostic.failureCode}</dd>
          </>
        ) : null}
        {diagnostic.startedAt ? (
          <>
            <dt className="font-medium">Started</dt>
            <dd>{diagnostic.startedAt}</dd>
          </>
        ) : null}
        {diagnostic.finishedAt ? (
          <>
            <dt className="font-medium">Finished</dt>
            <dd>{diagnostic.finishedAt}</dd>
          </>
        ) : null}
        <dt className="font-medium">Duplicate attempt</dt>
        <dd>{diagnostic.duplicateSubmitBlocked ? 'blocked' : 'none'}</dd>
      </dl>

      {state.status === 'success' ? (
        <p className="mt-2 font-medium text-emerald-700">
          Snapshot recorded: {state.snapshot?.snapshotId}. No data was changed locally. Rerun read-only comparison manually.
        </p>
      ) : null}

      {state.status === 'failure' || state.status === 'blocked' || state.status === 'misconfigured' ? (
        <>
          <p className="mt-2 font-medium text-rose-700">{state.message || safeErrorMessage(state.error)}</p>
          {diagnostic.recoveryNote ? (
            <p className="mt-1 text-slate-700">Safe recovery note: {diagnostic.recoveryNote}</p>
          ) : null}
        </>
      ) : null}
    </section>
  );
};

export const DevApiHistoryDataFlagPrototype = ({
  data,
  config = runtimeConfig,
  fetchImpl,
  now = () => new Date().toISOString(),
}: DevApiHistoryDataFlagPrototypeProps) => {
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [targetDataFlag, setTargetDataFlag] = useState<HistoryDataFlagValue>('test');
  const [confirmed, setConfirmed] = useState(false);
  const [state, setState] = useState<HistoryDataFlagPrototypeState>(() => {
    if (config.status === 'invalid') {
      return {
        status: 'misconfigured',
        message: 'Config is invalid. Use a localhost Dev API base URL. No request was sent.',
      };
    }
    return { status: 'idle' };
  });
  const controllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const submitLockRef = useRef(createHistoryDataFlagSubmitLock());

  const sourceContext = useMemo(
    () => (config.enabled ? createHistoryDataFlagSourceContext(data, selectedSessionId || undefined, targetDataFlag) : null),
    [config, data, selectedSessionId, targetDataFlag],
  );

  useEffect(() => {
    if (!sourceContext) return;
    if (!selectedSessionId || !sourceContext.sessions.some((session) => session.id === selectedSessionId)) {
      setSelectedSessionId(sourceContext.sessionId);
      setTargetDataFlag(fallbackTargetDataFlag(sourceContext.currentDataFlag));
      setConfirmed(false);
    }
  }, [selectedSessionId, sourceContext]);

  useEffect(() => () => {
    mountedRef.current = false;
    submitLockRef.current.release();
    controllerRef.current?.abort();
  }, []);

  useEffect(() => {
    if (config.status === 'invalid') {
      submitLockRef.current.release();
      controllerRef.current?.abort();
      setConfirmed(false);
      setState({
        status: 'misconfigured',
        message: 'Config is invalid. Use a localhost Dev API base URL. No request was sent.',
      });
      return;
    }
    if (!config.enabled) {
      submitLockRef.current.release();
      controllerRef.current?.abort();
      setConfirmed(false);
      setState({ status: 'idle' });
    }
  }, [config]);

  if (config.status === 'disabled') return null;

  const changeSession = (sessionId: string) => {
    const nextContext = createHistoryDataFlagSourceContext(data, sessionId);
    setSelectedSessionId(sessionId);
    setTargetDataFlag(nextContext ? fallbackTargetDataFlag(nextContext.currentDataFlag) : 'test');
    setConfirmed(false);
    if (state.status !== 'pending') setState({ status: 'idle', sessionId });
  };

  const changeTargetDataFlag = (dataFlag: HistoryDataFlagValue) => {
    setTargetDataFlag(dataFlag);
    setConfirmed(false);
    if (state.status !== 'pending') setState({ status: 'idle', sessionId: selectedSessionId, targetDataFlag: dataFlag });
  };

  const cancel = () => {
    setConfirmed(false);
    if (state.status !== 'pending') setState({ status: 'idle', sessionId: selectedSessionId, targetDataFlag });
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!config.enabled) return;
    if (!sourceContext?.sourceFingerprint) {
      setState({
        status: 'blocked',
        sessionId: selectedSessionId,
        targetDataFlag,
        error: {
          code: 'dev_mutation_source_fingerprint_missing',
          message: 'History data-flag source fingerprint is missing.',
        },
      });
      return;
    }
    if (!confirmed || state.status === 'pending') return;
    if (!submitLockRef.current.acquire()) {
      setState((current) => current.status === 'pending'
        ? { ...current, duplicateSubmitBlocked: true }
        : current);
      return;
    }

    const startedAt = now();
    const metadata = createHistoryDataFlagMetadata({
      sessionId: sourceContext.sessionId,
      targetDataFlag: sourceContext.targetDataFlag,
      sourceFingerprint: sourceContext.sourceFingerprint,
      nowIso: startedAt,
      reason: 'dev-only dataFlag mutation experiment',
    });

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setState({
      status: 'pending',
      sessionId: sourceContext.sessionId,
      targetDataFlag: sourceContext.targetDataFlag,
      metadata,
      startedAt,
      duplicateSubmitBlocked: false,
    });

    const result: DevApiHistoryDataFlagResult = await updateHistoryDataFlagViaDevApi({
      sessionId: sourceContext.sessionId,
      targetDataFlag: sourceContext.targetDataFlag,
      config,
      metadata,
      fetchImpl,
      signal: controller.signal,
    });

    if (controller.signal.aborted || !mountedRef.current) {
      submitLockRef.current.release();
      return;
    }

    if (result.ok) {
      submitLockRef.current.release();
      setState({
        status: 'success',
        sessionId: result.sessionId,
        targetDataFlag: result.targetDataFlag,
        snapshot: result.snapshot,
        metadata: result.metadata,
        startedAt,
        finishedAt: now(),
        lastAttemptStatus: result.status,
        message: 'Snapshot metadata was returned. No data was changed locally.',
      });
      setConfirmed(false);
      return;
    }

    submitLockRef.current.release();
    setState({
      status: 'failure',
      sessionId: result.sessionId,
      targetDataFlag: result.targetDataFlag || targetDataFlag,
      error: result.error,
      metadata: result.metadata,
      startedAt,
      finishedAt: now(),
      lastAttemptStatus: result.status,
      message: safeErrorMessage(result.error),
    });
    setConfirmed(false);
  };

  return (
    <DevApiHistoryDataFlagPrototypePanel
      config={config}
      confirmed={confirmed}
      onCancel={cancel}
      onConfirmedChange={setConfirmed}
      onSessionChange={changeSession}
      onSubmit={submit}
      onTargetDataFlagChange={changeTargetDataFlag}
      pending={state.status === 'pending'}
      selectedSessionId={sourceContext?.sessionId || selectedSessionId}
      sourceContext={sourceContext}
      state={state}
      targetDataFlag={sourceContext?.targetDataFlag || targetDataFlag}
    />
  );
};
