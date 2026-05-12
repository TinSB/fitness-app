import {
  createApiStorageAdapter,
  resolveApiStorageAdapterConfig,
  type ApiStorageAcceptedWriteRoute,
  type ApiStorageAdapterError,
  type ApiStorageAdapterFetch,
  type ApiStorageAdapterEnv,
  type ApiStorageDataHealthDismissBody,
  type ApiStorageHistoryDataFlagBody,
  type ApiStorageHistorySetEditBody,
  type ApiStorageMutationResult,
  type ApiStorageSessionCompleteBody,
  type ApiStorageSessionDiscardBody,
  type ApiStorageSessionPatchBody,
  type ApiStorageSessionStartBody,
  type ApiStorageSnapshotMetadata,
  type ApiStorageWriteResult,
} from './apiStorageAdapter';
import { createRuntimeSourceSelector, type RuntimeSourceSelection } from './runtimeSourceSelector';

export type ApiWriteThroughRuntimeErrorCode =
  | 'api_write_through_disabled'
  | 'api_write_through_adapter_disabled'
  | 'api_write_through_failed';

export type ApiWriteThroughRuntimeError = {
  code: ApiWriteThroughRuntimeErrorCode;
  message: string;
  adapterError?: ApiStorageAdapterError;
};

export type ApiWriteThroughRuntimeResult =
  | {
      ok: true;
      route: ApiStorageAcceptedWriteRoute;
      status: number;
      result: ApiStorageMutationResult;
      snapshot: ApiStorageSnapshotMetadata;
      source: 'api-primary-dev';
      shouldWriteLocalStorage: false;
      localStorageFallbackAvailable: true;
      productionReady: false;
    }
  | {
      ok: false;
      route?: ApiStorageAcceptedWriteRoute;
      status?: number;
      error: ApiWriteThroughRuntimeError;
      source: 'localStorage';
      shouldWriteLocalStorage: false;
      localStorageFallbackAvailable: true;
      productionReady: false;
    };

export type ApiWriteThroughRuntime = {
  runtimeSource: RuntimeSourceSelection;
  enabled: boolean;
  writeDataHealthDismiss: (body: ApiStorageDataHealthDismissBody) => Promise<ApiWriteThroughRuntimeResult>;
  writeHistoryDataFlag: (body: ApiStorageHistoryDataFlagBody) => Promise<ApiWriteThroughRuntimeResult>;
  writeHistorySetEdit: (body: ApiStorageHistorySetEditBody) => Promise<ApiWriteThroughRuntimeResult>;
  writeSessionStart: (body: ApiStorageSessionStartBody) => Promise<ApiWriteThroughRuntimeResult>;
  writeSessionPatch: (body: ApiStorageSessionPatchBody) => Promise<ApiWriteThroughRuntimeResult>;
  writeSessionComplete: (body: ApiStorageSessionCompleteBody) => Promise<ApiWriteThroughRuntimeResult>;
  writeSessionDiscard: (body: ApiStorageSessionDiscardBody) => Promise<ApiWriteThroughRuntimeResult>;
};

const runtimeFailure = (
  error: ApiWriteThroughRuntimeError,
  route?: ApiStorageAcceptedWriteRoute,
  status?: number,
): ApiWriteThroughRuntimeResult => ({
  ok: false,
  route,
  status,
  error,
  source: 'localStorage',
  shouldWriteLocalStorage: false,
  localStorageFallbackAvailable: true,
  productionReady: false,
});

const runtimeSuccess = (result: Extract<ApiStorageWriteResult, { ok: true }>): ApiWriteThroughRuntimeResult => ({
  ok: true,
  route: result.route,
  status: result.status,
  result: result.result,
  snapshot: result.snapshot,
  source: 'api-primary-dev',
  shouldWriteLocalStorage: false,
  localStorageFallbackAvailable: true,
  productionReady: false,
});

export const createApiWriteThroughRuntime = (
  env: ApiStorageAdapterEnv,
  fetchImpl?: ApiStorageAdapterFetch,
): ApiWriteThroughRuntime => {
  const runtimeSource = createRuntimeSourceSelector(env);
  const adapterConfig = resolveApiStorageAdapterConfig(env);
  const adapter = createApiStorageAdapter(adapterConfig, fetchImpl);
  const enabled = runtimeSource.mode === 'api-primary-dev' && adapterConfig.enabled === true;

  const run = async (
    route: ApiStorageAcceptedWriteRoute,
    write: () => Promise<ApiStorageWriteResult>,
  ): Promise<ApiWriteThroughRuntimeResult> => {
    if (runtimeSource.mode !== 'api-primary-dev') {
      return runtimeFailure(
        {
          code: 'api_write_through_disabled',
          message: 'API write-through runtime requires explicit api-primary-dev mode.',
        },
        route,
      );
    }

    if (!adapterConfig.enabled) {
      return runtimeFailure(
        {
          code: 'api_write_through_adapter_disabled',
          message: adapterConfig.status === 'invalid'
            ? adapterConfig.error.message
            : 'API storage adapter is not enabled.',
        },
        route,
      );
    }

    const result = await write();
    if (result.ok) return runtimeSuccess(result);
    return runtimeFailure(
      {
        code: 'api_write_through_failed',
        message: result.error.message,
        adapterError: result.error,
      },
      result.route || route,
      result.status,
    );
  };

  return {
    runtimeSource,
    enabled,
    writeDataHealthDismiss: (body) => run('/data-health/issues/:issueId/dismiss', () => adapter.writeDataHealthDismiss(body)),
    writeHistoryDataFlag: (body) => run('/history/:id/data-flag', () => adapter.writeHistoryDataFlag(body)),
    writeHistorySetEdit: (body) => run('/history/:id/edit', () => adapter.writeHistorySetEdit(body)),
    writeSessionStart: (body) => run('/sessions/start', () => adapter.writeSessionStart(body)),
    writeSessionPatch: (body) => run('/sessions/active/patches', () => adapter.writeSessionPatch(body)),
    writeSessionComplete: (body) => run('/sessions/active/complete', () => adapter.writeSessionComplete(body)),
    writeSessionDiscard: (body) => run('/sessions/active/discard', () => adapter.writeSessionDiscard(body)),
  };
};
