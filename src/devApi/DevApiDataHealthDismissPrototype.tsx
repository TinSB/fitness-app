import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { buildReadMirrorDataHealthSummary } from '../../apps/api/src/readMirror';
import type { DataHealthIssue } from '../engines/dataHealthEngine';
import type { AppData } from '../models/training-model';
import {
  dismissDataHealthIssueViaDevApi,
  sanitizeDataHealthDismissMessage,
  type DevApiDataHealthDismissError,
  type DevApiDataHealthDismissFetch,
  type DevApiDataHealthDismissMetadata,
  type DevApiDataHealthDismissResult,
  type DevApiDataHealthDismissSnapshot,
} from './devApiDataHealthDismissClient';
import {
  resolveDevApiDataHealthDismissConfig,
  type DevApiDataHealthDismissConfig,
} from './devApiDataHealthDismissConfig';

type ExperimentStatus = 'idle' | 'blocked' | 'pending' | 'success' | 'failure' | 'misconfigured';
export type DataHealthDismissDiagnosticState = 'idle' | 'confirming' | 'pending' | 'success' | 'failure';

export type DataHealthDismissSourceContext = {
  issueId: string;
  issues: Array<Pick<DataHealthIssue, 'id' | 'title' | 'severity' | 'category'>>;
  sourceFingerprint: string;
  issueCount: number;
  summaryStatus: string;
};

export type DataHealthDismissPrototypeState = {
  status: ExperimentStatus;
  issueId?: string;
  message?: string;
  error?: DevApiDataHealthDismissError;
  snapshot?: DevApiDataHealthDismissSnapshot;
  metadata?: DevApiDataHealthDismissMetadata;
  startedAt?: string;
  finishedAt?: string;
  lastAttemptStatus?: number;
  duplicateSubmitBlocked?: boolean;
};

export type DataHealthDismissDiagnosticSummary = {
  issueId?: string;
  state: DataHealthDismissDiagnosticState;
  lastAttemptStatus?: number;
  failureCode?: string;
  failureMessage?: string;
  snapshotMetadataPresent: boolean;
  startedAt?: string;
  finishedAt?: string;
  duplicateSubmitBlocked: boolean;
  recoveryNote?: string;
};

type DevApiDataHealthDismissPrototypeProps = {
  data: AppData;
  config?: DevApiDataHealthDismissConfig;
  fetchImpl?: DevApiDataHealthDismissFetch;
  now?: () => string;
};

const runtimeConfig = resolveDevApiDataHealthDismissConfig(import.meta.env);

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

const compactIssue = (issue: DataHealthIssue) => ({
  id: issue.id,
  title: issue.title,
  severity: issue.severity,
  category: issue.category,
});

export const formatDataHealthDismissIssueReference = (issueId?: string) =>
  issueId ? `issue-${hashString(issueId)}` : 'unavailable';

export const createDataHealthDismissSourceContext = (
  data: AppData,
  issueId?: string,
): DataHealthDismissSourceContext | null => {
  const summary = buildReadMirrorDataHealthSummary(data);
  const issues = summary.issues.filter((issue) => typeof issue.id === 'string' && issue.id.trim());
  if (!issues.length) return null;

  const selectedIssueId = issueId && issues.some((issue) => issue.id === issueId)
    ? issueId
    : issues[0].id;
  if (!selectedIssueId) return null;

  const source = {
    path: '/data-health/summary',
    status: summary.status,
    issueCount: summary.issueCount,
    issueIds: issues.map((issue) => issue.id).sort(),
    selectedIssueId,
  };

  return {
    issueId: selectedIssueId,
    issues: issues.map(compactIssue),
    sourceFingerprint: `datahealth-${hashString(stableStringify(source))}`,
    issueCount: summary.issueCount,
    summaryStatus: summary.status,
  };
};

export const createDataHealthDismissMetadata = ({
  issueId,
  sourceFingerprint,
  nowIso,
}: {
  issueId: string;
  sourceFingerprint: string;
  nowIso: string;
}): DevApiDataHealthDismissMetadata => {
  const requestFingerprint = `request-${hashString(stableStringify({ issueId, sourceFingerprint }))}`;
  const mutationId = `datahealth-dismiss-${hashString(`${issueId}:${sourceFingerprint}:${nowIso}`)}`;
  return {
    issueId,
    mutationId,
    idempotencyKey: `${mutationId}:${requestFingerprint}`,
    requestFingerprint,
    sourceFingerprint,
    confirmed: true,
  };
};

export const canSubmitDataHealthDismissPrototype = ({
  config,
  sourceContext,
  confirmed,
  pending,
}: {
  config: DevApiDataHealthDismissConfig;
  sourceContext: DataHealthDismissSourceContext | null;
  confirmed: boolean;
  pending: boolean;
}) =>
  config.enabled
  && Boolean(sourceContext?.issueId)
  && Boolean(sourceContext?.sourceFingerprint)
  && confirmed
  && !pending;

export const createDataHealthDismissSubmitLock = () => {
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

const safeErrorMessage = (error?: DevApiDataHealthDismissError) => {
  if (!error) return 'DataHealth dismiss experiment failed.';
  return `${error.serverCode || error.code}: ${sanitizeDataHealthDismissMessage(error.message)}`.replace(/\s+/g, ' ').slice(0, 180);
};

export const getDataHealthDismissRecoveryNote = (error?: DevApiDataHealthDismissError) => {
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
    case 'issue_not_found':
      return 'Refresh read-only diagnostics or verify the issue still exists before retrying.';
    case 'no_change':
      return 'The issue may already be dismissed. Refresh read-only diagnostics before retrying.';
    case 'requiresConfirmation':
    case 'requires_confirmation':
      return 'Confirm the one-route dev request again before retrying.';
    case 'write_failed':
    case 'transaction_failed':
      return 'Stop the Dev API runner, back up the dev DB, inspect it, and use the existing recovery runbook only if needed.';
    case 'database_closed':
      return 'Restart the Dev API runner, then rerun read-only diagnostics before retrying.';
    case 'snapshot_validation_failed':
    case 'repository_schema_mismatch':
      return 'Stop the Dev API runner, back up the dev DB, and inspect schema notes before retrying.';
    case 'unsupported_route':
      return 'Verify only POST /data-health/issues/:issueId/dismiss is enabled from browser code.';
    case 'dev_mutation_source_fingerprint_missing':
      return 'Rebuild read-only diagnostics first so the request has source context.';
    default:
      return 'Check Dev API logs and rerun read-only diagnostics before retrying.';
  }
};

export const createDataHealthDismissDiagnosticSummary = ({
  state,
  sourceContext,
  selectedIssueId,
  confirmed,
}: {
  state: DataHealthDismissPrototypeState;
  sourceContext: DataHealthDismissSourceContext | null;
  selectedIssueId: string;
  confirmed: boolean;
}): DataHealthDismissDiagnosticSummary => {
  const issueId = state.issueId || sourceContext?.issueId || selectedIssueId || undefined;
  const failureCode = state.error ? state.error.serverCode || state.error.code : undefined;
  const diagnosticState: DataHealthDismissDiagnosticState =
    state.status === 'pending'
      ? 'pending'
      : state.status === 'success'
        ? 'success'
        : state.status === 'failure' || state.status === 'blocked' || state.status === 'misconfigured'
          ? 'failure'
          : confirmed && Boolean(sourceContext?.issueId)
            ? 'confirming'
            : 'idle';

  return {
    issueId,
    state: diagnosticState,
    lastAttemptStatus: state.lastAttemptStatus,
    failureCode,
    failureMessage: state.error ? safeErrorMessage(state.error) : undefined,
    snapshotMetadataPresent: Boolean(state.snapshot?.snapshotId && state.snapshot.createdAt),
    startedAt: state.startedAt,
    finishedAt: state.finishedAt,
    duplicateSubmitBlocked: Boolean(state.duplicateSubmitBlocked),
    recoveryNote: state.error ? getDataHealthDismissRecoveryNote(state.error) : undefined,
  };
};

export const DevApiDataHealthDismissPrototypePanel = ({
  config,
  sourceContext,
  selectedIssueId,
  confirmed,
  state,
  pending,
  onIssueChange,
  onConfirmedChange,
  onSubmit,
}: {
  config: DevApiDataHealthDismissConfig;
  sourceContext: DataHealthDismissSourceContext | null;
  selectedIssueId: string;
  confirmed: boolean;
  state: DataHealthDismissPrototypeState;
  pending: boolean;
  onIssueChange?: (issueId: string) => void;
  onConfirmedChange?: (confirmed: boolean) => void;
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
}) => {
  if (config.status === 'disabled') return null;

  const canSubmit = canSubmitDataHealthDismissPrototype({
    config,
    sourceContext,
    confirmed,
    pending,
  });
  const selectedIssueIndex = sourceContext
    ? Math.max(0, sourceContext.issues.findIndex((issue) => issue.id === selectedIssueId))
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
  const diagnostic = createDataHealthDismissDiagnosticSummary({
    state,
    sourceContext,
    selectedIssueId,
    confirmed,
  });

  return (
    <section
      aria-label="Dev API DataHealth dismiss experiment"
      aria-live="polite"
      className="fixed bottom-24 left-3 z-[90] max-h-[45vh] w-[min(22rem,calc(100vw-1.5rem))] overflow-auto rounded-lg border border-amber-300 bg-amber-50/95 p-3 text-xs text-slate-800 shadow-lg lg:bottom-4"
      role="status"
    >
      <div className="text-sm font-semibold text-slate-950">Dev API DataHealth dismiss experiment</div>
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
          No local DataHealth issue is available for this experiment. No request was sent.
        </p>
      ) : null}

      {sourceContext ? (
        <form className="mt-3 space-y-2" onSubmit={onSubmit}>
          <label className="block">
            <span className="font-medium">Issue</span>
            <select
              aria-label="DataHealth issue"
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1"
              disabled={pending}
              onChange={(event) => {
                const issue = sourceContext.issues[Number(event.target.value)];
                if (issue) onIssueChange?.(issue.id);
              }}
              value={String(selectedIssueIndex)}
            >
              {sourceContext.issues.map((issue, index) => (
                <option key={issue.id} value={String(index)}>
                  {`Issue ${index + 1} - ${issue.severity} - ${issue.category}`}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-start gap-2">
            <input
              checked={confirmed}
              className="mt-0.5"
              disabled={pending}
              onChange={(event) => onConfirmedChange?.(event.target.checked)}
              type="checkbox"
            />
            <span>I confirm this one-route dev request for the selected issue.</span>
          </label>

          <button
            className="rounded-md border border-amber-500 bg-white px-2 py-1 font-medium text-slate-900 disabled:opacity-60"
            disabled={!canSubmit}
            type="submit"
          >
            {pending ? 'Pending' : 'Send dismiss request'}
          </button>
        </form>
      ) : null}

      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1">
        <dt className="font-medium">Status</dt>
        <dd>{statusLabel}</dd>
        <dt className="font-medium">Mutation state</dt>
        <dd>{diagnostic.state}</dd>
        <dt className="font-medium">Target issue</dt>
        <dd>{formatDataHealthDismissIssueReference(diagnostic.issueId)}</dd>
        <dt className="font-medium">Local issues</dt>
        <dd>{sourceContext?.issueCount ?? 0}</dd>
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
          Snapshot recorded: {state.snapshot?.snapshotId}. No data was changed locally.
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

export const DevApiDataHealthDismissPrototype = ({
  data,
  config = runtimeConfig,
  fetchImpl,
  now = () => new Date().toISOString(),
}: DevApiDataHealthDismissPrototypeProps) => {
  const [selectedIssueId, setSelectedIssueId] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [state, setState] = useState<DataHealthDismissPrototypeState>(() => {
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
  const submitLockRef = useRef(createDataHealthDismissSubmitLock());

  const sourceContext = useMemo(
    () => (config.enabled ? createDataHealthDismissSourceContext(data, selectedIssueId || undefined) : null),
    [config, data, selectedIssueId],
  );

  useEffect(() => {
    if (!sourceContext) return;
    if (!selectedIssueId || !sourceContext.issues.some((issue) => issue.id === selectedIssueId)) {
      setSelectedIssueId(sourceContext.issueId);
    }
  }, [selectedIssueId, sourceContext]);

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

  const changeIssue = (issueId: string) => {
    setSelectedIssueId(issueId);
    setConfirmed(false);
    if (state.status !== 'pending') setState({ status: 'idle', issueId });
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!config.enabled) return;
    if (!sourceContext?.sourceFingerprint) {
      setState({
        status: 'blocked',
        issueId: selectedIssueId,
        error: {
          code: 'dev_mutation_source_fingerprint_missing',
          message: 'DataHealth dismiss source fingerprint is missing.',
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

    const metadata = createDataHealthDismissMetadata({
      issueId: sourceContext.issueId,
      sourceFingerprint: sourceContext.sourceFingerprint,
      nowIso: startedAt,
    });

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setState({
      status: 'pending',
      issueId: sourceContext.issueId,
      metadata,
      startedAt,
      duplicateSubmitBlocked: false,
    });

    const result: DevApiDataHealthDismissResult = await dismissDataHealthIssueViaDevApi({
      issueId: sourceContext.issueId,
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
        issueId: result.issueId,
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
      issueId: result.issueId,
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
    <DevApiDataHealthDismissPrototypePanel
      config={config}
      confirmed={confirmed}
      onConfirmedChange={setConfirmed}
      onIssueChange={changeIssue}
      onSubmit={submit}
      pending={state.status === 'pending'}
      selectedIssueId={sourceContext?.issueId || selectedIssueId}
      sourceContext={sourceContext}
      state={state}
    />
  );
};
