import { STORAGE_VERSION } from '../data/trainingData';
import type { AppData } from '../models/training-model';
import { sanitizeData } from './appDataSanitize';
import { validateAppDataSchema } from './appDataValidation';
import { readStoredAppDataFromLocalStorage, type AppDataStorageLike } from './localStorageAdapter';

export type MigrationDryRunWarningCode =
  | 'local_storage_empty'
  | 'local_storage_raw_schema_mismatch'
  | 'api_snapshot_unavailable'
  | 'api_snapshot_schema_mismatch'
  | 'api_snapshot_count_mismatch';

export type MigrationDryRunWarning = {
  code: MigrationDryRunWarningCode;
  message: string;
};

export type MigrationDryRunErrorCode =
  | 'local_storage_read_failed'
  | 'local_storage_sanitize_failed'
  | 'local_storage_schema_invalid';

export type MigrationDryRunError = {
  code: MigrationDryRunErrorCode;
  message: string;
};

export type MigrationDryRunSummary = {
  schemaVersion: number;
  storageVersion: number;
  historyCount: number;
  templateCount: number;
  activeSessionPresent: boolean;
  settingsPresent: boolean;
};

export type MigrationDryRunApiSummary = Partial<MigrationDryRunSummary>;

export type MigrationDryRunResult =
  | {
      ok: true;
      found: true;
      canApplyAfterBackup: true;
      summary: MigrationDryRunSummary;
      warnings: MigrationDryRunWarning[];
      sanitizedData: AppData;
      shouldWriteSqlite: false;
      shouldWriteLocalStorage: false;
      shouldSwitchSource: false;
      productionReady: false;
    }
  | {
      ok: true;
      found: false;
      canApplyAfterBackup: false;
      summary: null;
      warnings: MigrationDryRunWarning[];
      shouldWriteSqlite: false;
      shouldWriteLocalStorage: false;
      shouldSwitchSource: false;
      productionReady: false;
    }
  | {
      ok: false;
      found: false;
      canApplyAfterBackup: false;
      summary: null;
      warnings: MigrationDryRunWarning[];
      error: MigrationDryRunError;
      shouldWriteSqlite: false;
      shouldWriteLocalStorage: false;
      shouldSwitchSource: false;
      productionReady: false;
    };

export type LocalStorageToSqliteMigrationDryRunOptions = {
  storage?: AppDataStorageLike | null;
  readApiSnapshotSummary?: () => Promise<MigrationDryRunApiSummary>;
};

const noWriteFlags = {
  shouldWriteSqlite: false,
  shouldWriteLocalStorage: false,
  shouldSwitchSource: false,
  productionReady: false,
} as const;

const failure = (
  error: MigrationDryRunError,
  warnings: MigrationDryRunWarning[] = [],
): MigrationDryRunResult => ({
  ok: false,
  found: false,
  canApplyAfterBackup: false,
  summary: null,
  warnings,
  error,
  ...noWriteFlags,
});

const summarize = (data: AppData): MigrationDryRunSummary => ({
  schemaVersion: data.schemaVersion,
  storageVersion: STORAGE_VERSION,
  historyCount: data.history.length,
  templateCount: data.templates.length,
  activeSessionPresent: data.activeSession !== null,
  settingsPresent: typeof data.settings === 'object' && data.settings !== null,
});

const compareApiSummary = (summary: MigrationDryRunSummary, apiSummary: MigrationDryRunApiSummary) => {
  const warnings: MigrationDryRunWarning[] = [];

  if (typeof apiSummary.schemaVersion === 'number' && apiSummary.schemaVersion !== summary.schemaVersion) {
    warnings.push({
      code: 'api_snapshot_schema_mismatch',
      message: 'API snapshot schema version does not match localStorage schema version.',
    });
  }

  for (const key of ['historyCount', 'templateCount', 'activeSessionPresent'] as const) {
    if (typeof apiSummary[key] !== 'undefined' && apiSummary[key] !== summary[key]) {
      warnings.push({
        code: 'api_snapshot_count_mismatch',
        message: `API snapshot ${key} does not match localStorage ${key}.`,
      });
    }
  }

  return warnings;
};

export const runLocalStorageToSqliteMigrationDryRun = async (
  options: LocalStorageToSqliteMigrationDryRunOptions = {},
): Promise<MigrationDryRunResult> => {
  const warnings: MigrationDryRunWarning[] = [];
  const readResult = readStoredAppDataFromLocalStorage(options.storage);

  if (!readResult.ok) {
    return failure({
      code: 'local_storage_read_failed',
      message: 'Could not read localStorage AppData for migration dry-run.',
    });
  }

  if (!readResult.found) {
    return {
      ok: true,
      found: false,
      canApplyAfterBackup: false,
      summary: null,
      warnings: [{
        code: 'local_storage_empty',
        message: 'No localStorage AppData was found for migration dry-run.',
      }],
      ...noWriteFlags,
    };
  }

  if (!validateAppDataSchema(readResult.rawData)) {
    warnings.push({
      code: 'local_storage_raw_schema_mismatch',
      message: 'Raw localStorage AppData does not match the current schema before sanitization.',
    });
  }

  let sanitizedData: AppData;
  try {
    sanitizedData = sanitizeData(readResult.rawData);
  } catch {
    return failure({
      code: 'local_storage_sanitize_failed',
      message: 'Could not sanitize localStorage AppData for migration dry-run.',
    }, warnings);
  }

  if (!validateAppDataSchema(sanitizedData)) {
    return failure({
      code: 'local_storage_schema_invalid',
      message: 'Sanitized localStorage AppData does not match the current schema.',
    }, warnings);
  }

  const summary = summarize(sanitizedData);

  if (options.readApiSnapshotSummary) {
    try {
      warnings.push(...compareApiSummary(summary, await options.readApiSnapshotSummary()));
    } catch {
      warnings.push({
        code: 'api_snapshot_unavailable',
        message: 'API snapshot summary was unavailable during migration dry-run.',
      });
    }
  }

  return {
    ok: true,
    found: true,
    canApplyAfterBackup: true,
    summary,
    warnings,
    sanitizedData,
    ...noWriteFlags,
  };
};
