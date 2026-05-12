import type { AppData } from '../models/training-model';
import { sanitizeData } from './appDataSanitize';
import { validateAppDataSchema } from './appDataValidation';
import type { MigrationApplySqliteSnapshot } from './localStorageToSqliteMigrationApply';

export type MigrationRollbackEnv = {
  DEV?: boolean | string;
  VITE_IRONPATH_MIGRATION_ROLLBACK?: string;
};

export type MigrationRollbackTarget = 'localStorageBackup' | 'devDbBackup';

export type MigrationRollbackBackup = {
  backupId: string;
  createdAt: string;
  appData?: unknown;
  sqliteSnapshot?: unknown;
};

export type MigrationRollbackRestoreLocalStorage = (input: {
  backup: MigrationRollbackBackup;
  appData: AppData;
}) => Promise<void>;

export type MigrationRollbackRestoreDevDb = (input: {
  backup: MigrationRollbackBackup;
  sqliteSnapshot: MigrationApplySqliteSnapshot;
}) => Promise<MigrationApplySqliteSnapshot>;

export type MigrationRollbackErrorCode =
  | 'migration_rollback_disabled'
  | 'migration_rollback_confirmation_required'
  | 'migration_rollback_backup_required'
  | 'migration_rollback_corrupt_backup'
  | 'migration_rollback_schema_mismatch'
  | 'migration_rollback_restore_missing'
  | 'migration_rollback_restore_failed'
  | 'migration_rollback_invalid_restored_snapshot';

export type MigrationRollbackError = {
  code: MigrationRollbackErrorCode;
  message: string;
};

export type MigrationRollbackOptions = {
  target: MigrationRollbackTarget;
  confirmRestore?: boolean;
  backup?: MigrationRollbackBackup;
  restoreLocalStorageBackup?: MigrationRollbackRestoreLocalStorage;
  restoreDevDbBackup?: MigrationRollbackRestoreDevDb;
};

export type MigrationRollbackResult =
  | {
      ok: true;
      status: 'success';
      target: MigrationRollbackTarget;
      backup: MigrationRollbackBackup;
      restoredAppData?: AppData;
      restoredSqliteSnapshot?: MigrationApplySqliteSnapshot;
      failureStateCleared: true;
      shouldDeleteLocalStorage: false;
      shouldSwitchSource: false;
      productionReady: false;
    }
  | {
      ok: false;
      status: 'blocked' | 'failed';
      target?: MigrationRollbackTarget;
      backup?: MigrationRollbackBackup;
      error: MigrationRollbackError;
      failureStateCleared: false;
      shouldDeleteLocalStorage: false;
      shouldSwitchSource: false;
      productionReady: false;
    };

export const MIGRATION_ROLLBACK_FLAG_VALUE = 'localstorage-to-sqlite-rollback';

const noDestructiveFlags = {
  shouldDeleteLocalStorage: false,
  shouldSwitchSource: false,
  productionReady: false,
} as const;

const isDevValue = (value: MigrationRollbackEnv['DEV']) => value === true || value === 'true';

const failure = ({
  status,
  error,
  target,
  backup,
}: {
  status: 'blocked' | 'failed';
  error: MigrationRollbackError;
  target?: MigrationRollbackTarget;
  backup?: MigrationRollbackBackup;
}): MigrationRollbackResult => ({
  ok: false,
  status,
  ...(target ? { target } : {}),
  ...(backup ? { backup } : {}),
  error,
  failureStateCleared: false,
  ...noDestructiveFlags,
});

const hasBackupMetadata = (backup: MigrationRollbackBackup | undefined): backup is MigrationRollbackBackup =>
  typeof backup?.backupId === 'string'
  && backup.backupId.trim().length > 0
  && typeof backup.createdAt === 'string'
  && backup.createdAt.trim().length > 0;

const isSqliteSnapshot = (snapshot: unknown): snapshot is MigrationApplySqliteSnapshot =>
  typeof snapshot === 'object'
  && snapshot !== null
  && !Array.isArray(snapshot)
  && typeof (snapshot as MigrationApplySqliteSnapshot).snapshotId === 'string'
  && (snapshot as MigrationApplySqliteSnapshot).snapshotId.trim().length > 0
  && typeof (snapshot as MigrationApplySqliteSnapshot).createdAt === 'string'
  && (snapshot as MigrationApplySqliteSnapshot).createdAt.trim().length > 0
  && typeof (snapshot as MigrationApplySqliteSnapshot).schemaVersion === 'number';

const sanitizeBackupAppData = (backup: MigrationRollbackBackup): AppData | MigrationRollbackError => {
  if (typeof backup.appData === 'undefined') {
    return {
      code: 'migration_rollback_corrupt_backup',
      message: 'Rollback backup is missing AppData.',
    };
  }

  if (typeof backup.appData !== 'object' || backup.appData === null || Array.isArray(backup.appData)) {
    return {
      code: 'migration_rollback_corrupt_backup',
      message: 'Rollback backup AppData is not an object.',
    };
  }

  let appData: AppData;
  try {
    appData = sanitizeData(backup.appData);
  } catch {
    return {
      code: 'migration_rollback_corrupt_backup',
      message: 'Rollback backup AppData could not be sanitized.',
    };
  }

  if (!validateAppDataSchema(appData)) {
    return {
      code: 'migration_rollback_schema_mismatch',
      message: 'Rollback backup AppData does not match current schema.',
    };
  }

  return appData;
};

export const runMigrationRollbackRecovery = async (
  env: MigrationRollbackEnv,
  options: MigrationRollbackOptions,
): Promise<MigrationRollbackResult> => {
  if (!isDevValue(env.DEV) || env.VITE_IRONPATH_MIGRATION_ROLLBACK !== MIGRATION_ROLLBACK_FLAG_VALUE) {
    return failure({
      status: 'blocked',
      target: options.target,
      error: {
        code: 'migration_rollback_disabled',
        message: 'Migration rollback requires explicit dev-only rollback flag.',
      },
    });
  }

  if (options.confirmRestore !== true) {
    return failure({
      status: 'blocked',
      target: options.target,
      error: {
        code: 'migration_rollback_confirmation_required',
        message: 'Migration rollback requires explicit confirmation.',
      },
    });
  }

  if (!hasBackupMetadata(options.backup)) {
    return failure({
      status: 'blocked',
      target: options.target,
      error: {
        code: 'migration_rollback_backup_required',
        message: 'Migration rollback requires backup metadata.',
      },
    });
  }

  if (options.target === 'localStorageBackup') {
    if (!options.restoreLocalStorageBackup) {
      return failure({
        status: 'blocked',
        target: options.target,
        backup: options.backup,
        error: {
          code: 'migration_rollback_restore_missing',
          message: 'Migration rollback requires an injected localStorage restore function.',
        },
      });
    }

    const appData = sanitizeBackupAppData(options.backup);
    if ('code' in appData) {
      return failure({
        status: 'blocked',
        target: options.target,
        backup: options.backup,
        error: appData,
      });
    }

    try {
      await options.restoreLocalStorageBackup({ backup: options.backup, appData });
    } catch {
      return failure({
        status: 'failed',
        target: options.target,
        backup: options.backup,
        error: {
          code: 'migration_rollback_restore_failed',
          message: 'localStorage backup restore failed.',
        },
      });
    }

    return {
      ok: true,
      status: 'success',
      target: options.target,
      backup: options.backup,
      restoredAppData: appData,
      failureStateCleared: true,
      ...noDestructiveFlags,
    };
  }

  if (!options.restoreDevDbBackup) {
    return failure({
      status: 'blocked',
      target: options.target,
      backup: options.backup,
      error: {
        code: 'migration_rollback_restore_missing',
        message: 'Migration rollback requires an injected dev DB restore function.',
      },
    });
  }

  if (!isSqliteSnapshot(options.backup.sqliteSnapshot)) {
    return failure({
      status: 'blocked',
      target: options.target,
      backup: options.backup,
      error: {
        code: 'migration_rollback_corrupt_backup',
        message: 'Migration rollback backup is missing valid SQLite snapshot metadata.',
      },
    });
  }

  let restoredSqliteSnapshot: MigrationApplySqliteSnapshot;
  try {
    restoredSqliteSnapshot = await options.restoreDevDbBackup({
      backup: options.backup,
      sqliteSnapshot: options.backup.sqliteSnapshot,
    });
  } catch {
    return failure({
      status: 'failed',
      target: options.target,
      backup: options.backup,
      error: {
        code: 'migration_rollback_restore_failed',
        message: 'Dev DB backup restore failed.',
      },
    });
  }

  if (!isSqliteSnapshot(restoredSqliteSnapshot)) {
    return failure({
      status: 'failed',
      target: options.target,
      backup: options.backup,
      error: {
        code: 'migration_rollback_invalid_restored_snapshot',
        message: 'Dev DB backup restore returned invalid snapshot metadata.',
      },
    });
  }

  return {
    ok: true,
    status: 'success',
    target: options.target,
    backup: options.backup,
    restoredSqliteSnapshot,
    failureStateCleared: true,
    ...noDestructiveFlags,
  };
};
