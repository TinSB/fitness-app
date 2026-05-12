import type { AppDataStorageLike } from './localStorageAdapter';
import {
  runLocalStorageToSqliteMigrationDryRun,
  type MigrationDryRunResult,
  type MigrationDryRunSummary,
  type MigrationDryRunWarning,
} from './localStorageToSqliteMigrationDryRun';

export type MigrationApplyEnv = {
  DEV?: boolean | string;
  VITE_IRONPATH_MIGRATION_APPLY?: string;
};

export type MigrationApplyBackup = {
  backupId: string;
  createdAt: string;
  localStorageSnapshot: unknown;
};

export type MigrationApplySqliteSnapshot = {
  snapshotId: string;
  createdAt: string;
  schemaVersion: number;
};

export type MigrationApplyWriteInput = {
  data: unknown;
  summary: MigrationDryRunSummary;
  backup: MigrationApplyBackup;
};

export type MigrationApplyWriter = (
  input: MigrationApplyWriteInput,
) => Promise<MigrationApplySqliteSnapshot>;

export type MigrationApplyErrorCode =
  | 'migration_apply_disabled'
  | 'migration_apply_confirmation_required'
  | 'migration_apply_backup_required'
  | 'migration_apply_writer_missing'
  | 'migration_apply_dry_run_failed'
  | 'migration_apply_no_local_storage_data'
  | 'migration_apply_write_failed'
  | 'migration_apply_invalid_snapshot';

export type MigrationApplyError = {
  code: MigrationApplyErrorCode;
  message: string;
};

export type LocalStorageToSqliteMigrationApplyOptions = {
  storage?: AppDataStorageLike | null;
  confirmApply?: boolean;
  backup?: MigrationApplyBackup;
  writeSqliteSnapshot?: MigrationApplyWriter;
};

export type MigrationApplyResult =
  | {
      ok: true;
      status: 'success';
      dryRun: Extract<MigrationDryRunResult, { ok: true; found: true }>;
      sqliteSnapshot: MigrationApplySqliteSnapshot;
      backup: MigrationApplyBackup;
      warnings: MigrationDryRunWarning[];
      shouldDeleteLocalStorage: false;
      shouldWriteLocalStorage: false;
      shouldSwitchSource: false;
      productionReady: false;
    }
  | {
      ok: false;
      status: 'blocked' | 'failed';
      dryRun?: MigrationDryRunResult;
      backup?: MigrationApplyBackup;
      error: MigrationApplyError;
      warnings: MigrationDryRunWarning[];
      shouldDeleteLocalStorage: false;
      shouldWriteLocalStorage: false;
      shouldSwitchSource: false;
      productionReady: false;
    };

export const MIGRATION_APPLY_FLAG_VALUE = 'localstorage-to-sqlite-apply';

const noWriteFlags = {
  shouldDeleteLocalStorage: false,
  shouldWriteLocalStorage: false,
  shouldSwitchSource: false,
  productionReady: false,
} as const;

const isDevValue = (value: MigrationApplyEnv['DEV']) => value === true || value === 'true';

const failure = ({
  status,
  error,
  dryRun,
  backup,
  warnings = [],
}: {
  status: 'blocked' | 'failed';
  error: MigrationApplyError;
  dryRun?: MigrationDryRunResult;
  backup?: MigrationApplyBackup;
  warnings?: MigrationDryRunWarning[];
}): MigrationApplyResult => ({
  ok: false,
  status,
  error,
  ...(dryRun ? { dryRun } : {}),
  ...(backup ? { backup } : {}),
  warnings,
  ...noWriteFlags,
});

const hasBackup = (backup: MigrationApplyBackup | undefined): backup is MigrationApplyBackup =>
  typeof backup?.backupId === 'string'
  && backup.backupId.trim().length > 0
  && typeof backup.createdAt === 'string'
  && backup.createdAt.trim().length > 0
  && typeof backup.localStorageSnapshot !== 'undefined';

const isSnapshot = (snapshot: unknown): snapshot is MigrationApplySqliteSnapshot =>
  typeof snapshot === 'object'
  && snapshot !== null
  && !Array.isArray(snapshot)
  && typeof (snapshot as MigrationApplySqliteSnapshot).snapshotId === 'string'
  && (snapshot as MigrationApplySqliteSnapshot).snapshotId.trim().length > 0
  && typeof (snapshot as MigrationApplySqliteSnapshot).createdAt === 'string'
  && (snapshot as MigrationApplySqliteSnapshot).createdAt.trim().length > 0
  && typeof (snapshot as MigrationApplySqliteSnapshot).schemaVersion === 'number';

export const runLocalStorageToSqliteMigrationApply = async (
  env: MigrationApplyEnv,
  options: LocalStorageToSqliteMigrationApplyOptions = {},
): Promise<MigrationApplyResult> => {
  if (!isDevValue(env.DEV) || env.VITE_IRONPATH_MIGRATION_APPLY !== MIGRATION_APPLY_FLAG_VALUE) {
    return failure({
      status: 'blocked',
      error: {
        code: 'migration_apply_disabled',
        message: 'Migration apply requires explicit dev-only migration apply flag.',
      },
    });
  }

  if (options.confirmApply !== true) {
    return failure({
      status: 'blocked',
      error: {
        code: 'migration_apply_confirmation_required',
        message: 'Migration apply requires explicit confirmation.',
      },
    });
  }

  if (!hasBackup(options.backup)) {
    return failure({
      status: 'blocked',
      error: {
        code: 'migration_apply_backup_required',
        message: 'Migration apply requires a localStorage backup before writing SQLite snapshot.',
      },
    });
  }

  if (!options.writeSqliteSnapshot) {
    return failure({
      status: 'blocked',
      backup: options.backup,
      error: {
        code: 'migration_apply_writer_missing',
        message: 'Migration apply requires an injected SQLite snapshot writer.',
      },
    });
  }

  const dryRun = await runLocalStorageToSqliteMigrationDryRun({ storage: options.storage });
  if (!dryRun.ok) {
    return failure({
      status: 'blocked',
      dryRun,
      backup: options.backup,
      warnings: dryRun.warnings,
      error: {
        code: 'migration_apply_dry_run_failed',
        message: 'Migration apply is blocked because dry-run validation failed.',
      },
    });
  }

  if (!dryRun.found) {
    return failure({
      status: 'blocked',
      dryRun,
      backup: options.backup,
      warnings: dryRun.warnings,
      error: {
        code: 'migration_apply_no_local_storage_data',
        message: 'Migration apply is blocked because no localStorage AppData was found.',
      },
    });
  }

  let sqliteSnapshot: MigrationApplySqliteSnapshot;
  try {
    sqliteSnapshot = await options.writeSqliteSnapshot({
      data: dryRun.sanitizedData,
      summary: dryRun.summary,
      backup: options.backup,
    });
  } catch {
    return failure({
      status: 'failed',
      dryRun,
      backup: options.backup,
      warnings: dryRun.warnings,
      error: {
        code: 'migration_apply_write_failed',
        message: 'SQLite snapshot writer failed during migration apply prototype.',
      },
    });
  }

  if (!isSnapshot(sqliteSnapshot)) {
    return failure({
      status: 'failed',
      dryRun,
      backup: options.backup,
      warnings: dryRun.warnings,
      error: {
        code: 'migration_apply_invalid_snapshot',
        message: 'SQLite snapshot writer did not return valid snapshot metadata.',
      },
    });
  }

  return {
    ok: true,
    status: 'success',
    dryRun,
    sqliteSnapshot,
    backup: options.backup,
    warnings: dryRun.warnings,
    ...noWriteFlags,
  };
};
