import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import type { AppData, TrainingTemplate } from '../models/training-model';
import {
  DEV_API_SESSION_START_SOURCE_SNAPSHOT_VERSION,
  sanitizeSessionStartMessage,
  startSessionViaDevApi,
  type DevApiSessionStartError,
  type DevApiSessionStartFetch,
  type DevApiSessionStartMetadata,
  type DevApiSessionStartSnapshot,
} from './devApiSessionStartClient';
import {
  resolveDevApiSessionStartConfig,
  type DevApiSessionStartConfig,
} from './devApiSessionStartConfig';

type ExperimentStatus = 'idle' | 'blocked' | 'pending' | 'success' | 'failure' | 'misconfigured';
export type SessionStartDiagnosticState = 'idle' | 'confirming' | 'pending' | 'success' | 'failure';

export type SessionStartSourceContext = {
  templateId: string;
  templateName: string;
  sourceSnapshotHash: string;
  sourceSnapshotVersion: string;
  selectedTemplateId?: string;
  activeProgramTemplateId?: string;
  hasActiveSession: boolean;
  activeSessionId?: string;
  pendingPatchIds: string[];
};

export type SessionStartPrototypeState = {
  status: ExperimentStatus;
  templateId?: string;
  message?: string;
  error?: DevApiSessionStartError;
  snapshot?: DevApiSessionStartSnapshot;
  metadata?: DevApiSessionStartMetadata;
  startedAt?: string;
  finishedAt?: string;
  lastAttemptStatus?: number;
  duplicateSubmitBlocked?: boolean;
};

export type SessionStartDiagnosticSummary = {
  targetReference?: string;
  state: SessionStartDiagnosticState;
  lastAttemptStatus?: number;
  failureCode?: string;
  failureMessage?: string;
  snapshotMetadataPresent: boolean;
  startedAt?: string;
  finishedAt?: string;
  duplicateSubmitBlocked: boolean;
  recoveryNote?: string;
};

type DevApiSessionStartPrototypeProps = {
  data: AppData;
  config?: DevApiSessionStartConfig;
  fetchImpl?: DevApiSessionStartFetch;
  now?: () => string;
};

const runtimeConfig = resolveDevApiSessionStartConfig(import.meta.env);

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

const findTemplate = (data: AppData, templateId?: string) => {
  const id = clean(templateId);
  return id ? (data.templates || []).find((template) => template.id === id) : undefined;
};

const firstTemplate = (data: AppData) => (data.templates || []).find((template) => clean(template.id));

const targetTemplate = (data: AppData): TrainingTemplate | undefined =>
  findTemplate(data, data.activeProgramTemplateId)
  || findTemplate(data, data.selectedTemplateId)
  || firstTemplate(data);

const latestHistoryReference = (data: AppData) => {
  const latest = [...(data.history || [])]
    .filter((session) => clean(session.id))
    .sort((left, right) => clean(right.date).localeCompare(clean(left.date)) || clean(right.id).localeCompare(clean(left.id)))[0];
  return latest ? { id: latest.id, date: latest.date } : null;
};

export const createSessionStartSourceContext = (data: AppData): SessionStartSourceContext | null => {
  const template = targetTemplate(data);
  if (!template || !clean(template.id)) return null;

  const activeSessionId = clean(data.activeSession?.id);
  if (data.activeSession) {
    return {
      templateId: template.id,
      templateName: template.name || template.id,
      sourceSnapshotHash: '',
      sourceSnapshotVersion: DEV_API_SESSION_START_SOURCE_SNAPSHOT_VERSION,
      selectedTemplateId: data.selectedTemplateId,
      activeProgramTemplateId: data.activeProgramTemplateId,
      hasActiveSession: true,
      activeSessionId,
      pendingPatchIds: pendingPatchesOf(data).map((patch) => patch.id).filter(Boolean),
    };
  }

  const pendingPatchIds = pendingPatchesOf(data).map((patch) => patch.id).filter(Boolean).sort();
  const source = {
    route: ['sessions', 'start'],
    sourceSnapshotVersion: DEV_API_SESSION_START_SOURCE_SNAPSHOT_VERSION,
    schemaVersion: data.schemaVersion,
    templateId: template.id,
    selectedTemplateId: data.selectedTemplateId,
    activeProgramTemplateId: data.activeProgramTemplateId,
    hasActiveSession: false,
    pendingPatchIds,
    historyLength: data.history?.length || 0,
    latestHistory: latestHistoryReference(data),
    trainingMode: data.trainingMode,
  };

  return {
    templateId: template.id,
    templateName: template.name || template.id,
    sourceSnapshotHash: `session-start-${hashString(stableStringify(source))}`,
    sourceSnapshotVersion: DEV_API_SESSION_START_SOURCE_SNAPSHOT_VERSION,
    selectedTemplateId: data.selectedTemplateId,
    activeProgramTemplateId: data.activeProgramTemplateId,
    hasActiveSession: false,
    pendingPatchIds,
  };
};

export const createSessionStartMetadata = ({
  sourceContext,
  nowIso,
}: {
  sourceContext: SessionStartSourceContext;
  nowIso: string;
}): DevApiSessionStartMetadata => {
  const requestFingerprint = `request-${hashString(stableStringify({
    templateId: sourceContext.templateId,
    sourceSnapshotHash: sourceContext.sourceSnapshotHash,
    sourceSnapshotVersion: sourceContext.sourceSnapshotVersion,
  }))}`;
  const mutationId = `session-start-${hashString(`${sourceContext.templateId}:${sourceContext.sourceSnapshotHash}:${requestFingerprint}:${nowIso}`)}`;
  return {
    templateId: sourceContext.templateId,
    sourceSnapshotHash: sourceContext.sourceSnapshotHash,
    sourceSnapshotVersion: sourceContext.sourceSnapshotVersion,
    mutationId,
    idempotencyKey: `${mutationId}:${requestFingerprint}`,
    requestFingerprint,
    confirmed: true,
    nowIso,
  };
};

export const canSubmitSessionStartPrototype = ({
  config,
  sourceContext,
  confirmed,
  pending,
}: {
  config: DevApiSessionStartConfig;
  sourceContext: SessionStartSourceContext | null;
  confirmed: boolean;
  pending: boolean;
}) =>
  config.enabled
  && Boolean(sourceContext?.templateId)
  && Boolean(sourceContext?.sourceSnapshotHash)
  && sourceContext?.hasActiveSession === false
  && confirmed
  && !pending;

export const createSessionStartSubmitLock = () => {
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

export const formatSessionStartTargetReference = (templateId?: string) =>
  templateId ? `template-${hashString(templateId)}` : 'unavailable';

const safeErrorMessage = (error?: DevApiSessionStartError) => {
  if (!error) return 'Session start experiment failed.';
  return `${error.serverCode || error.code}: ${sanitizeSessionStartMessage(error.message)}`.replace(/\s+/g, ' ').slice(0, 180);
};

export const getSessionStartRecoveryNote = (error?: DevApiSessionStartError) => {
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
    case 'template_not_found':
      return 'Verify the target template still exists in local App state before retrying.';
    case 'active_session_exists':
      return 'A session already exists in the dev snapshot. Disable the experiment or refresh diagnostics before retrying.';
    case 'dev_mutation_source_snapshot_missing':
    case 'dev_mutation_idempotency_missing':
      return 'Rebuild the source snapshot and confirm again before retrying.';
    case 'write_failed':
    case 'transaction_failed':
      return 'Stop the Dev API runner, make a dev DB copy, and inspect the dev DB before retrying.';
    case 'database_closed':
      return 'Restart the Dev API runner, then rerun read-only diagnostics before retrying.';
    case 'unsupported_route':
      return 'Verify only the approved session start experiment is enabled.';
    default:
      return 'Check Dev API logs and rerun read-only diagnostics before retrying.';
  }
};

export const createSessionStartDiagnosticSummary = ({
  state,
  sourceContext,
  confirmed,
}: {
  state: SessionStartPrototypeState;
  sourceContext: SessionStartSourceContext | null;
  confirmed: boolean;
}): SessionStartDiagnosticSummary => {
  const templateId = state.templateId || sourceContext?.templateId;
  const failureCode = state.error ? state.error.serverCode || state.error.code : undefined;
  const diagnosticState: SessionStartDiagnosticState =
    state.status === 'pending'
      ? 'pending'
      : state.status === 'success'
        ? 'success'
        : state.status === 'failure' || state.status === 'blocked' || state.status === 'misconfigured'
          ? 'failure'
          : confirmed && Boolean(sourceContext?.templateId)
            ? 'confirming'
            : 'idle';

  return {
    targetReference: formatSessionStartTargetReference(templateId),
    state: diagnosticState,
    lastAttemptStatus: state.lastAttemptStatus,
    failureCode,
    failureMessage: state.error ? safeErrorMessage(state.error) : undefined,
    snapshotMetadataPresent: Boolean(state.snapshot?.snapshotId && state.snapshot.createdAt),
    startedAt: state.startedAt,
    finishedAt: state.finishedAt,
    duplicateSubmitBlocked: Boolean(state.duplicateSubmitBlocked),
    recoveryNote: state.error ? getSessionStartRecoveryNote(state.error) : undefined,
  };
};

export const DevApiSessionStartPrototypePanel = ({
  config,
  sourceContext,
  confirmed,
  state,
  pending,
  onConfirmedChange,
  onCancel,
  onSubmit,
}: {
  config: DevApiSessionStartConfig;
  sourceContext: SessionStartSourceContext | null;
  confirmed: boolean;
  state: SessionStartPrototypeState;
  pending: boolean;
  onConfirmedChange?: (confirmed: boolean) => void;
  onCancel?: () => void;
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
}) => {
  if (config.status === 'disabled') return null;

  const canSubmit = canSubmitSessionStartPrototype({ config, sourceContext, confirmed, pending });
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
  const diagnostic = createSessionStartDiagnosticSummary({ state, sourceContext, confirmed });

  return (
    <section
      aria-label="Dev API session start experiment"
      aria-live="polite"
      className="fixed bottom-3 right-3 z-[89] max-h-[45vh] w-[min(23rem,calc(100vw-1.5rem))] overflow-auto rounded-lg border border-cyan-300 bg-cyan-50/95 p-3 text-xs text-slate-800 shadow-lg"
      role="status"
    >
      <div className="text-sm font-semibold text-slate-950">Dev API session start experiment</div>
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
          No stable session-start target is available. No request was sent.
        </p>
      ) : null}

      {sourceContext?.hasActiveSession ? (
        <p className="mt-2 font-medium text-rose-700">
          Local App state already has an active session. No request was sent.
        </p>
      ) : null}

      {sourceContext ? (
        <form className="mt-3 space-y-2" onSubmit={onSubmit}>
          <div>
            <span className="font-medium">Target template</span>
            <div className="mt-1 rounded-md border border-slate-300 bg-white px-2 py-1">
              {sourceContext.templateName}
            </div>
          </div>
          <div className="rounded-md bg-white/80 p-2 text-[11px] text-slate-700">
            <div>Source snapshot: {sourceContext.sourceSnapshotHash || 'blocked'}</div>
            <div>Target reference: {diagnostic.targetReference}</div>
            <div>Pending patch count: {sourceContext.pendingPatchIds.length}</div>
          </div>

          <label className="flex items-start gap-2 rounded-md bg-white/80 p-2">
            <input
              aria-label="Confirm session start experiment"
              checked={confirmed}
              className="mt-0.5"
              disabled={pending || !config.enabled || sourceContext.hasActiveSession}
              onChange={(event) => onConfirmedChange?.(event.target.checked)}
              type="checkbox"
            />
            <span>
              I confirm this dev-only request starts the selected template in the Dev API snapshot only. The App remains local-first.
            </span>
          </label>

          <div className="flex items-center gap-2">
            <button
              className="rounded-md bg-cyan-700 px-3 py-1.5 font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-400"
              disabled={!canSubmit}
              type="submit"
            >
              {pending ? 'Starting...' : 'Start in Dev API'}
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

export const DevApiSessionStartPrototype = ({
  data,
  config = runtimeConfig,
  fetchImpl,
  now = () => new Date().toISOString(),
}: DevApiSessionStartPrototypeProps) => {
  const [confirmed, setConfirmed] = useState(false);
  const [state, setState] = useState<SessionStartPrototypeState>({ status: 'idle' });
  const lockRef = useRef(createSessionStartSubmitLock());
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(false);

  const sourceContext = useMemo(() => createSessionStartSourceContext(data), [data]);
  const resetKey = `${config.status}:${config.enabled ? config.baseUrl : ''}:${sourceContext?.templateId || ''}:${sourceContext?.sourceSnapshotHash || ''}:${sourceContext?.hasActiveSession ? 'active' : 'empty'}`;
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
    setState({ status: config.status === 'invalid' ? 'misconfigured' : sourceContext?.hasActiveSession ? 'blocked' : 'idle' });
    lockRef.current.release();
    abortRef.current?.abort();
    abortRef.current = null;
  }, [resetKey, config.status, sourceContext?.hasActiveSession]);

  const cancel = () => {
    setConfirmed(false);
    setState((current) => current.status === 'pending' ? current : { status: 'idle', templateId: sourceContext?.templateId });
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!config.enabled || !sourceContext) return;
    if (!canSubmitSessionStartPrototype({ config, sourceContext, confirmed, pending: state.status === 'pending' })) return;
    if (!lockRef.current.acquire()) {
      setState((current) => ({ ...current, duplicateSubmitBlocked: true }));
      return;
    }

    const startedAt = now();
    const metadata = createSessionStartMetadata({ sourceContext, nowIso: startedAt });
    const controller = new AbortController();
    abortRef.current = controller;
    setState({
      status: 'pending',
      templateId: sourceContext.templateId,
      metadata,
      startedAt,
    });

    const result = await startSessionViaDevApi({
      templateId: sourceContext.templateId,
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
        templateId: result.templateId,
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
        templateId: result.templateId || sourceContext.templateId,
        error: result.error,
        metadata: result.metadata,
        lastAttemptStatus: result.status,
        startedAt,
        finishedAt,
      });
    }
  };

  return (
    <DevApiSessionStartPrototypePanel
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
