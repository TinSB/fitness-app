import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import type { DatabaseSync as NodeDatabaseSync } from 'node:sqlite';
import type { AppData } from '../../../packages/contracts/src';
import { analyzeImportedAppData, repairImportedAppData, type DataRepairReport } from '../../../src/engines/dataRepairEngine';
import { clone } from '../../../src/engines/engineUtils';
import { exportAppData, importAppData } from '../../../src/storage/backup';
import { sanitizeData } from '../../../src/storage/appDataSanitize';
import { validateAppDataSchema } from '../../../src/storage/appDataValidation';

export const NODE_SQLITE_REQUIRED_MESSAGE = 'Task 4.6 requires Node >= 24.15 with node:sqlite / DatabaseSync.';

type StatementValue = string | number | null;

export type SqliteDatabaseLike = Pick<NodeDatabaseSync, 'exec' | 'prepare'> & {
  close?: () => void;
};

export type CreateSqliteRepositoryOptions = {
  filename?: string;
  database?: SqliteDatabaseLike;
};

export type SqliteSnapshotWriteOptions = {
  snapshotId?: string;
  createdAt?: string;
  label?: string;
};

export type SqliteSnapshotWriteResult = {
  snapshotId: string;
  schemaVersion: number;
  createdAt: string;
};

export type SqliteBackupImportOptions = SqliteSnapshotWriteOptions & {
  confirmNeedsReview?: boolean;
};

export type SqliteBackupImportResult =
  | {
      ok: true;
      status: 'imported';
      snapshot: SqliteSnapshotWriteResult;
      report: DataRepairReport;
    }
  | {
      ok: false;
      status: 'unsafe' | 'needs_review' | 'invalid';
      message: string;
      report?: DataRepairReport;
    };

export class SqliteRepositoryError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'SqliteRepositoryError';
    this.code = code;
  }
}

const require = createRequire(import.meta.url);

export const assertNodeSqliteAvailable = () => {
  try {
    const sqlite = require('node:sqlite') as { DatabaseSync?: unknown };
    if (typeof sqlite.DatabaseSync !== 'function') throw new Error(NODE_SQLITE_REQUIRED_MESSAGE);
    return sqlite.DatabaseSync as typeof NodeDatabaseSync;
  } catch (error) {
    if (error instanceof Error && error.message === NODE_SQLITE_REQUIRED_MESSAGE) throw error;
    throw new Error(NODE_SQLITE_REQUIRED_MESSAGE);
  }
};

const transaction = <T>(database: SqliteDatabaseLike, operation: () => T): T => {
  database.exec('BEGIN IMMEDIATE');
  try {
    const result = operation();
    database.exec('COMMIT');
    return result;
  } catch (error) {
    try {
      database.exec('ROLLBACK');
    } catch {
      // Keep the original failure as the repository error surface.
    }
    throw error;
  }
};

const run = (database: SqliteDatabaseLike, sql: string, ...params: StatementValue[]) => {
  database.prepare(sql).run(...params);
};

const get = <TRow>(database: SqliteDatabaseLike, sql: string, ...params: StatementValue[]): TRow | undefined =>
  database.prepare(sql).get(...params) as TRow | undefined;

export const initializeSqliteRepositorySchema = (database: SqliteDatabaseLike) => {
  database.exec(`
    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_data_snapshots (
      row_id INTEGER PRIMARY KEY AUTOINCREMENT,
      id TEXT UNIQUE NOT NULL,
      schema_version INTEGER NOT NULL,
      app_data_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      label TEXT
    );
  `);
};

const normalizeSnapshotId = (value: string) => value.replace(/[^A-Za-z0-9_.:-]/g, '-');

const makeSnapshotId = (createdAt: string) => `snapshot-${normalizeSnapshotId(createdAt)}-${randomUUID()}`;

const stableDate = () => new Date().toISOString();

const parseSnapshotJson = (value: string) => {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new SqliteRepositoryError('invalid_snapshot_json', 'SQLite snapshot JSON is invalid.');
  }
};

const sanitizeAndValidate = (raw: unknown): AppData => {
  const data = sanitizeData(raw);
  if (!validateAppDataSchema(data)) {
    throw new SqliteRepositoryError('invalid_app_data', 'SQLite snapshot AppData failed validation.');
  }
  return data;
};

const backupPayloadToString = (payload: unknown) => (typeof payload === 'string' ? payload : JSON.stringify(payload));

const parseBackupPayload = (payload: unknown) => {
  try {
    return JSON.parse(backupPayloadToString(payload)) as unknown;
  } catch {
    return null;
  }
};

const isCurrentSanitizedCompatibilityReview = (report: DataRepairReport) =>
  report.status === 'needs_review' &&
  report.issues.length > 0 &&
  report.issues.every((issue) => issue.id === 'template.active_day_id');

export const createSqliteRepository = (options: CreateSqliteRepositoryOptions = {}) => {
  const DatabaseSync = options.database ? null : assertNodeSqliteAvailable();
  const database = options.database || new DatabaseSync!(options.filename || ':memory:');
  initializeSqliteRepositorySchema(database);

  const writeSnapshot = (appData: AppData, writeOptions: SqliteSnapshotWriteOptions = {}): SqliteSnapshotWriteResult => {
    const input = clone(appData);
    const sanitized = sanitizeAndValidate(input);
    const appDataJson = exportAppData(sanitized);
    const schemaVersion = sanitized.schemaVersion;
    const createdAt = writeOptions.createdAt || stableDate();
    const snapshotId = writeOptions.snapshotId || makeSnapshotId(createdAt);
    const label = writeOptions.label || null;

    return transaction(database, () => {
      run(database, 'INSERT OR REPLACE INTO app_meta(key, value) VALUES (?, ?)', 'schema_version', String(schemaVersion));
      run(database, 'INSERT OR REPLACE INTO app_meta(key, value) VALUES (?, ?)', 'latest_snapshot_id', snapshotId);
      run(
        database,
        'INSERT INTO app_data_snapshots(id, schema_version, app_data_json, created_at, label) VALUES (?, ?, ?, ?, ?)',
        snapshotId,
        schemaVersion,
        appDataJson,
        createdAt,
        label,
      );
      return { snapshotId, schemaVersion, createdAt };
    });
  };

  const readSnapshot = (snapshotId?: string): AppData => {
    const row = snapshotId
      ? get<{ app_data_json: string }>(
          database,
          'SELECT app_data_json FROM app_data_snapshots WHERE id = ? LIMIT 1',
          snapshotId,
        )
      : get<{ app_data_json: string }>(
          database,
          'SELECT app_data_json FROM app_data_snapshots ORDER BY row_id DESC LIMIT 1',
        );

    if (!row) {
      throw new SqliteRepositoryError('snapshot_not_found', snapshotId ? 'SQLite snapshot was not found.' : 'SQLite repository has no snapshots.');
    }

    return sanitizeAndValidate(parseSnapshotJson(row.app_data_json));
  };

  const exportBackupFromSnapshot = (snapshotId?: string) => exportAppData(readSnapshot(snapshotId));

  const importBackupToSnapshot = (backupPayload: unknown, importOptions: SqliteBackupImportOptions = {}): SqliteBackupImportResult => {
    const parsed = parseBackupPayload(backupPayload);
    if (parsed === null) {
      return { ok: false, status: 'invalid', message: 'Backup payload is not valid JSON.' };
    }

    const report = analyzeImportedAppData(parsed);
    if (report.status === 'unsafe') {
      return {
        ok: false,
        status: 'unsafe',
        message: report.issues[0]?.message || 'Unsafe backup import rejected.',
        report,
      };
    }
    if (
      report.status === 'needs_review' &&
      !isCurrentSanitizedCompatibilityReview(report) &&
      importOptions.confirmNeedsReview !== true
    ) {
      return {
        ok: false,
        status: 'needs_review',
        message: 'Backup import requires review before writing a SQLite snapshot.',
        report,
      };
    }

    try {
      const repairedAt = importOptions.createdAt || stableDate();
      const data =
        report.status === 'needs_review' && !isCurrentSanitizedCompatibilityReview(report)
          ? repairImportedAppData(parsed, {
              repairDate: repairedAt.slice(0, 10),
              sourceFileName: importOptions.label,
            }).repairedData
          : (() => {
              const imported = importAppData(backupPayloadToString(backupPayload));
              if (!imported.ok || !imported.data) {
                throw new SqliteRepositoryError('invalid_backup_import', imported.error || 'Backup import failed.');
              }
              return imported.data;
            })();
      return {
        ok: true,
        status: 'imported',
        snapshot: writeSnapshot(data, importOptions),
        report,
      };
    } catch (error) {
      return {
        ok: false,
        status: 'invalid',
        message: error instanceof Error ? error.message : 'Backup import failed.',
        report,
      };
    }
  };

  const close = () => {
    database.close?.();
  };

  return {
    database,
    writeSnapshot,
    readSnapshot,
    exportBackupFromSnapshot,
    importBackupToSnapshot,
    close,
  };
};
