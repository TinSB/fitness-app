import { handleReadMirrorRequest } from '../../apps/api/src';
import type { AppData } from '../models/training-model';
import type { DevApiReadOnlyEnabledConfig } from './devApiReadOnlyConfig';
import {
  createDevApiReadOnlyClient,
  type DevApiReadOnlyError,
  type DevApiReadOnlyFetch,
  type DevApiReadOnlyPath,
} from './devApiReadOnlyClient';

export type DevApiReadOnlyEndpointStatus = 'matching' | 'mismatch' | 'unavailable' | 'error';
export type DevApiReadOnlyDiagnosticStatus = 'checking' | 'matching' | 'mismatch' | 'unavailable' | 'error';

export type DevApiReadOnlyEndpointDiagnostic = {
  path: DevApiReadOnlyPath;
  status: DevApiReadOnlyEndpointStatus;
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

const comparablePaths = (data: AppData): DevApiReadOnlyPath[] => {
  const paths: DevApiReadOnlyPath[] = ['/app-data/summary', '/sessions/summary', '/history', '/data-health/summary'];
  const firstHistoryId = data.history[0]?.id;
  if (firstHistoryId) paths.push(`/history/${encodeURIComponent(firstHistoryId)}`);
  return paths;
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

  for (const path of comparablePaths(data)) {
    if (signal?.aborted) {
      endpoints.push({
        path,
        status: 'unavailable',
        error: { code: 'dev_api_unavailable', message: 'Dev API read-only comparison was cancelled.' },
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
      });
      continue;
    }

    const local = localReadMirrorResult(data, path);
    endpoints.push({
      path,
      status: stableStringify(local) === stableStringify(remote.result) ? 'matching' : 'mismatch',
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
          ? 'Dev API read-only comparison found diagnostic mismatches.'
          : status === 'unavailable'
            ? 'Dev API read-only comparison is unavailable; App remains on localStorage.'
            : 'Dev API read-only comparison returned diagnostic errors.',
  };
};
