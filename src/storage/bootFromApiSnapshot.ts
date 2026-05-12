import type { AppData } from '../models/training-model';
import { sanitizeData } from './appDataSanitize';
import { validateAppDataSchema } from './appDataValidation';
import { createRuntimeSourceSelector, type RuntimeSourceSelection } from './runtimeSourceSelector';
import type { RuntimeSourceEnv } from './runtimeSourceConfig';

export type BootFromApiSnapshotMetadata = {
  snapshotId: string;
  createdAt: string;
  schemaVersion?: number;
  label?: string;
};

export type BootFromApiSnapshotReader = (signal?: AbortSignal) => Promise<unknown>;

export type BootFromApiSnapshotErrorCode =
  | 'boot_api_snapshot_disabled'
  | 'boot_api_snapshot_reader_missing'
  | 'boot_api_snapshot_unavailable'
  | 'boot_api_snapshot_invalid_response'
  | 'boot_api_snapshot_missing_metadata'
  | 'boot_api_snapshot_schema_invalid';

export type BootFromApiSnapshotError = {
  code: BootFromApiSnapshotErrorCode;
  message: string;
};

export type BootFromApiSnapshotResult =
  | {
      ok: true;
      source: 'api-primary-dev';
      data: AppData;
      snapshot: BootFromApiSnapshotMetadata;
      runtimeSource: RuntimeSourceSelection;
      localStorageFallbackAvailable: true;
      shouldWriteLocalStorage: false;
      productionReady: false;
    }
  | {
      ok: false;
      source: 'localStorage';
      runtimeSource: RuntimeSourceSelection;
      error: BootFromApiSnapshotError;
      localStorageFallbackAvailable: true;
      shouldWriteLocalStorage: false;
      productionReady: false;
    };

export type BootFromApiSnapshotOptions = {
  readSnapshot?: BootFromApiSnapshotReader;
  signal?: AbortSignal;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isSnapshotMetadata = (value: unknown): value is BootFromApiSnapshotMetadata =>
  isRecord(value)
  && typeof value.snapshotId === 'string'
  && value.snapshotId.trim().length > 0
  && typeof value.createdAt === 'string'
  && value.createdAt.trim().length > 0;

const looksLikeAppDataSnapshot = (value: unknown) =>
  isRecord(value)
  && typeof value.schemaVersion === 'number'
  && Array.isArray(value.templates)
  && Array.isArray(value.history)
  && isRecord(value.settings);

const failure = (
  runtimeSource: RuntimeSourceSelection,
  code: BootFromApiSnapshotErrorCode,
  message: string,
): BootFromApiSnapshotResult => ({
  ok: false,
  source: 'localStorage',
  runtimeSource,
  error: { code, message },
  localStorageFallbackAvailable: true,
  shouldWriteLocalStorage: false,
  productionReady: false,
});

const readPayloadFields = (payload: unknown) => {
  if (!isRecord(payload)) return null;
  const result = isRecord(payload.result) ? payload.result : payload;
  const appData = 'appData' in result ? result.appData : 'data' in result ? result.data : undefined;
  const snapshot = 'snapshot' in payload ? payload.snapshot : 'snapshot' in result ? result.snapshot : undefined;
  return { appData, snapshot };
};

export const bootFromApiSnapshot = async (
  env: RuntimeSourceEnv,
  options: BootFromApiSnapshotOptions = {},
): Promise<BootFromApiSnapshotResult> => {
  const runtimeSource = createRuntimeSourceSelector(env);

  if (runtimeSource.mode !== 'api-primary-dev') {
    return failure(
      runtimeSource,
      'boot_api_snapshot_disabled',
      'API snapshot boot requires explicit dev/local api-primary-dev runtime source.',
    );
  }

  if (!options.readSnapshot) {
    return failure(
      runtimeSource,
      'boot_api_snapshot_reader_missing',
      'API snapshot reader is not wired for this prototype.',
    );
  }

  let payload: unknown;
  try {
    payload = await options.readSnapshot(options.signal);
  } catch {
    return failure(runtimeSource, 'boot_api_snapshot_unavailable', 'API snapshot boot request failed.');
  }

  const fields = readPayloadFields(payload);
  if (!fields || !looksLikeAppDataSnapshot(fields.appData)) {
    return failure(runtimeSource, 'boot_api_snapshot_invalid_response', 'API snapshot boot response is not AppData.');
  }

  if (!isSnapshotMetadata(fields.snapshot)) {
    return failure(runtimeSource, 'boot_api_snapshot_missing_metadata', 'API snapshot boot response is missing snapshot metadata.');
  }

  if (!validateAppDataSchema(fields.appData)) {
    return failure(runtimeSource, 'boot_api_snapshot_schema_invalid', 'API snapshot AppData failed schema validation.');
  }

  const data = sanitizeData(fields.appData);
  if (!validateAppDataSchema(data)) {
    return failure(runtimeSource, 'boot_api_snapshot_schema_invalid', 'API snapshot AppData failed schema validation.');
  }

  return {
    ok: true,
    source: 'api-primary-dev',
    data,
    snapshot: fields.snapshot,
    runtimeSource,
    localStorageFallbackAvailable: true,
    shouldWriteLocalStorage: false,
    productionReady: false,
  };
};
