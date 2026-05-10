import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { buildReadMirrorDataHealthSummary } from '../../apps/api/src/readMirror';
import type { DataHealthIssue } from '../engines/dataHealthEngine';
import type { AppData } from '../models/training-model';
import {
  dismissDataHealthIssueViaDevApi,
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
  return `${error.serverCode || error.code}: ${error.message}`.replace(/\s+/g, ' ').slice(0, 160);
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
        <dt className="font-medium">Local issues</dt>
        <dd>{sourceContext?.issueCount ?? 0}</dd>
        <dt className="font-medium">Source</dt>
        <dd>{sourceContext?.sourceFingerprint || 'unavailable'}</dd>
      </dl>

      {state.status === 'success' ? (
        <p className="mt-2 font-medium text-emerald-700">
          Snapshot recorded: {state.snapshot?.snapshotId}. No data was changed locally.
        </p>
      ) : null}

      {state.status === 'failure' || state.status === 'blocked' || state.status === 'misconfigured' ? (
        <p className="mt-2 font-medium text-rose-700">{state.message || safeErrorMessage(state.error)}</p>
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
    if (!submitLockRef.current.acquire()) return;

    const metadata = createDataHealthDismissMetadata({
      issueId: sourceContext.issueId,
      sourceFingerprint: sourceContext.sourceFingerprint,
      nowIso: now(),
    });

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setState({ status: 'pending', issueId: sourceContext.issueId, metadata });

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
