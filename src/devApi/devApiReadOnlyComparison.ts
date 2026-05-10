import { handleReadMirrorRequest } from '../../apps/api/src';
import type { AppData } from '../models/training-model';
import type { DevApiReadOnlyEnabledConfig } from './devApiReadOnlyConfig';
import {
  createDevApiReadOnlyClient,
  type DevApiReadOnlyError,
  type DevApiReadOnlyFetch,
  type DevApiReadOnlyPath,
} from './devApiReadOnlyClient';

export type DevApiReadOnlyEndpointPath = DevApiReadOnlyPath | '/history/:id';
export type DevApiReadOnlyEndpointStatus = 'skipped' | 'matching' | 'mismatch' | 'unavailable' | 'error';
export type DevApiReadOnlyDiagnosticStatus =
  | 'disabled'
  | 'checking'
  | 'matching'
  | 'mismatch'
  | 'unavailable'
  | 'error'
  | 'misconfigured';

export type DevApiReadOnlyEndpointDiagnostic = {
  path: DevApiReadOnlyEndpointPath;
  status: DevApiReadOnlyEndpointStatus;
  reason?: string;
  error?: DevApiReadOnlyError;
};

export type DevApiReadOnlyDiagnostic = {
  status: DevApiReadOnlyDiagnosticStatus;
  checkedAt: string;
  checkedEndpoints: DevApiReadOnlyEndpointDiagnostic[];
  mismatchCount: number;
  message?: string;
};

const unavailableCodes = new Set(['dev_api_timeout', 'dev_api_unavailable', 'dev_api_fetch_unavailable']);

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

const localReadMirrorResult = (data: AppData, path: DevApiReadOnlyPath) =>
  handleReadMirrorRequest(data, { method: 'GET', path }).body;

type ComparisonTarget =
  | {
      path: DevApiReadOnlyPath;
      status?: never;
      reason?: never;
    }
  | {
      path: '/history/:id';
      status: 'skipped';
      reason: string;
    };

const comparisonTargets = (data: AppData): ComparisonTarget[] => {
  const firstHistoryId = data.history[0]?.id;
  return [
    { path: '/app-data/summary' },
    { path: '/sessions/summary' },
    { path: '/history' },
    firstHistoryId
      ? { path: `/history/${encodeURIComponent(firstHistoryId)}` as DevApiReadOnlyPath }
      : {
          path: '/history/:id',
          status: 'skipped',
          reason: 'No stable local history id is available.',
        },
    { path: '/data-health/summary' },
  ];
};

export const runDevApiReadOnlyComparison = async ({
  data,
  config,
  fetchImpl,
  signal,
  now = () => new Date().toISOString(),
}: {
  data: AppData;
  config: DevApiReadOnlyEnabledConfig;
  fetchImpl?: DevApiReadOnlyFetch;
  signal?: AbortSignal;
  now?: () => string;
}): Promise<DevApiReadOnlyDiagnostic> => {
  const client = createDevApiReadOnlyClient(config, fetchImpl);
  const endpoints: DevApiReadOnlyEndpointDiagnostic[] = [];

  for (const target of comparisonTargets(data)) {
    if (target.status === 'skipped') {
      endpoints.push(target);
      continue;
    }

    const path = target.path;
    if (signal?.aborted) {
      endpoints.push({
        path,
        status: 'unavailable',
        error: { code: 'dev_api_unavailable', message: 'Dev API read-only comparison was cancelled.' },
        reason: 'Comparison was cancelled.',
      });
      continue;
    }

    const remote =
      path === '/app-data/summary'
        ? await client.readAppDataSummary(signal)
        : path === '/sessions/summary'
          ? await client.readSessionsSummary(signal)
          : path === '/history'
            ? await client.readHistory(signal)
            : path === '/data-health/summary'
              ? await client.readDataHealthSummary(signal)
              : await client.readHistoryDetail(decodeURIComponent(path.slice('/history/'.length)), signal);

    if (!remote.ok) {
      endpoints.push({
        path,
        status: unavailableCodes.has(remote.error.code) ? 'unavailable' : 'error',
        error: remote.error,
        reason: remote.error.message,
      });
      continue;
    }

    const local = localReadMirrorResult(data, path);
    endpoints.push({
      path,
      status: stableStringify(local) === stableStringify(remote.result) ? 'matching' : 'mismatch',
      reason:
        stableStringify(local) === stableStringify(remote.result)
          ? 'Local and Dev API summaries match.'
          : 'Read-only summary differs from local data.',
    });
  }

  const mismatchCount = endpoints.filter((endpoint) => endpoint.status === 'mismatch').length;
  const errorCount = endpoints.filter((endpoint) => endpoint.status === 'error').length;
  const unavailableCount = endpoints.filter((endpoint) => endpoint.status === 'unavailable').length;
  const status: DevApiReadOnlyDiagnosticStatus =
    errorCount > 0
      ? 'error'
      : mismatchCount > 0
        ? 'mismatch'
        : unavailableCount > 0
          ? 'unavailable'
          : 'matching';

  return {
    status,
    checkedAt: now(),
    checkedEndpoints: endpoints,
    mismatchCount,
    message:
      status === 'matching'
        ? 'Dev API read-only comparison matches local data.'
        : status === 'mismatch'
          ? 'Read-only comparison found differences. localStorage remains source of truth. No data was changed.'
          : status === 'unavailable'
            ? 'Dev API unavailable; app continues normally using localStorage. Comparison was unavailable for one or more endpoints.'
            : 'Read-only comparison returned diagnostic errors. App continues using localStorage.',
  };
};
