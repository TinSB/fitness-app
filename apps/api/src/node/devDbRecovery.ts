import { copyFileSync, existsSync, lstatSync, mkdirSync, realpathSync, rmSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import {
  assertNodeSqliteAvailable,
  SQLITE_REPOSITORY_SCHEMA_VERSION,
  SqliteRepositoryError,
} from '../sqliteRepository';
import { validateAppDataSchema } from '../../../../src/storage/appDataValidation';

export const DEV_DB_RESET_CONFIRM_TOKEN = 'RESET_DEV_API_DB';

export type DevDbRecoveryErrorCode =
  | 'dev_db_not_found'
  | 'dev_db_invalid_path'
  | 'dev_db_outside_allowed_dir'
  | 'dev_db_confirmation_required'
  | 'dev_db_backup_failed'
  | 'dev_db_reset_failed'
  | 'dev_db_inspect_failed'
  | 'dev_db_artifact_unsafe'
  | 'dev_db_recovery_unavailable';

export type DevDbRecoveryStableError = {
  code: DevDbRecoveryErrorCode | string;
  message: string;
};

export class DevDbRecoveryError extends Error {
  code: DevDbRecoveryErrorCode;

  constructor(code: DevDbRecoveryErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = 'DevDbRecoveryError';
    this.code = code;
    if (cause !== undefined) {
      Object.defineProperty(this, 'cause', { value: cause, enumerable: false });
    }
  }
}

export type DevDbArtifacts = {
  main: string;
  wal: string;
  shm: string;
  journal: string;
};

export type DevDbArtifactKind = keyof DevDbArtifacts;

export type DevDbArtifactRecord = {
  kind: DevDbArtifactKind;
  path: string;
};

export type DevDbLatestSnapshotInfo = {
  id: string;
  schemaVersion: number;
  createdAt: string;
  label?: string;
};

export type InspectDevDbStateResult = {
  dbFile: string;
  exists: boolean;
  artifacts: DevDbArtifacts;
  canOpen: boolean;
  hasLatestSnapshot: boolean;
  latestSnapshot?: DevDbLatestSnapshotInfo;
  error?: DevDbRecoveryStableError;
};

export type BackupDevDbArtifactsResult = {
  backupDir: string;
  copiedArtifacts: DevDbArtifactRecord[];
  skippedArtifacts: DevDbArtifactRecord[];
  createdAt: string;
};

export type ResetDevDbArtifactsResult = {
  artifacts: DevDbArtifacts;
  deletedArtifacts: DevDbArtifactRecord[];
  skippedArtifacts: DevDbArtifactRecord[];
  backup?: BackupDevDbArtifactsResult;
  dryRun: boolean;
};

export type ResolveDevDbArtifactsOptions = {
  dbFile: string;
};

export type InspectDevDbStateOptions = ResolveDevDbArtifactsOptions;

export type BackupDevDbArtifactsOptions = ResolveDevDbArtifactsOptions & {
  backupDir?: string;
  nowIso?: string;
  label?: string;
};

export type ResetDevDbArtifactsOptions = ResolveDevDbArtifactsOptions & {
  confirmToken: string;
  backupFirst?: boolean;
  nowIso?: string;
  allowOutsideIronPath?: boolean;
  dryRun?: boolean;
};

const safeNowIso = () => new Date().toISOString();

const artifactEntries = (artifacts: DevDbArtifacts): DevDbArtifactRecord[] => [
  { kind: 'main', path: artifacts.main },
  { kind: 'wal', path: artifacts.wal },
  { kind: 'shm', path: artifacts.shm },
  { kind: 'journal', path: artifacts.journal },
];

const normalizeDbFile = (dbFile: string) => {
  const normalized = resolve(dbFile);
  if (!basename(normalized).toLowerCase().endsWith('.sqlite')) {
    throw new DevDbRecoveryError('dev_db_invalid_path', 'Dev API DB path must end with .sqlite.');
  }
  return normalized;
};

const repoRoot = () => process.cwd();

const ironPathRoot = () => resolve(repoRoot(), '.ironpath');

const backupRoot = () => resolve(ironPathRoot(), 'backups');

const runnerOutputRoot = () => resolve(ironPathRoot(), 'dev-api-runner');

const pathKey = (value: string) => (process.platform === 'win32' ? value.toLowerCase() : value);

const isWithinOrEqual = (path: string, parent: string) => {
  const rel = relative(parent, path);
  return rel === '' || (!rel.startsWith('..') && !rel.startsWith('/') && !rel.startsWith('\\'));
};

const safeTimestamp = (value: string) => value.replace(/[^A-Za-z0-9_.-]/g, '-');

const stableError = (error: unknown, fallbackCode: DevDbRecoveryErrorCode): DevDbRecoveryStableError => {
  if (error instanceof DevDbRecoveryError || error instanceof SqliteRepositoryError) {
    return { code: error.code, message: error.message };
  }
  return {
    code: fallbackCode,
    message: 'Dev API DB recovery operation failed.',
  };
};

const validateExistingArtifact = (artifact: DevDbArtifactRecord, allowedBase: string) => {
  if (!existsSync(artifact.path)) return;
  const stat = lstatSync(artifact.path);
  if (stat.isDirectory() || stat.isSymbolicLink()) {
    throw new DevDbRecoveryError('dev_db_artifact_unsafe', 'Dev API DB artifact is not a regular file.');
  }
  const real = realpathSync.native(artifact.path);
  if (!isWithinOrEqual(real, allowedBase)) {
    throw new DevDbRecoveryError('dev_db_artifact_unsafe', 'Dev API DB artifact resolves outside the allowed directory.');
  }
};

const assertResetPathAllowed = (artifacts: DevDbArtifacts, allowOutsideIronPath: boolean) => {
  const main = artifacts.main;
  const ironPath = ironPathRoot();

  if (isWithinOrEqual(main, runnerOutputRoot()) || isWithinOrEqual(main, backupRoot())) {
    throw new DevDbRecoveryError('dev_db_artifact_unsafe', 'Dev API DB reset target cannot be runner output or backup output.');
  }

  if (!allowOutsideIronPath && !isWithinOrEqual(main, ironPath)) {
    throw new DevDbRecoveryError(
      'dev_db_outside_allowed_dir',
      'Dev API DB reset is limited to .ironpath unless allowOutsideIronPath=true.',
    );
  }

  const allowedBase = allowOutsideIronPath ? dirname(main) : ironPath;
  const allowedArtifactPaths = new Set(artifactEntries(artifacts).map((artifact) => pathKey(artifact.path)));
  artifactEntries(artifacts).forEach((artifact) => {
    if (!allowedArtifactPaths.has(pathKey(artifact.path))) {
      throw new DevDbRecoveryError('dev_db_artifact_unsafe', 'Dev API DB artifact is outside the resolved artifact set.');
    }
    validateExistingArtifact(artifact, allowedBase);
  });
};

export const resolveDevDbArtifacts = ({ dbFile }: ResolveDevDbArtifactsOptions): DevDbArtifacts => {
  const main = normalizeDbFile(dbFile);
  return {
    main,
    wal: `${main}-wal`,
    shm: `${main}-shm`,
    journal: `${main}-journal`,
  };
};

export const inspectDevDbState = ({ dbFile }: InspectDevDbStateOptions): InspectDevDbStateResult => {
  let artifacts: DevDbArtifacts;
  try {
    artifacts = resolveDevDbArtifacts({ dbFile });
  } catch (error) {
    const fallback = resolve(dbFile);
    return {
      dbFile: fallback,
      exists: existsSync(fallback),
      artifacts: {
        main: fallback,
        wal: `${fallback}-wal`,
        shm: `${fallback}-shm`,
        journal: `${fallback}-journal`,
      },
      canOpen: false,
      hasLatestSnapshot: false,
      error: stableError(error, 'dev_db_inspect_failed'),
    };
  }

  if (!existsSync(artifacts.main)) {
    return {
      dbFile: artifacts.main,
      exists: false,
      artifacts,
      canOpen: false,
      hasLatestSnapshot: false,
    };
  }

  try {
    const DatabaseSync = assertNodeSqliteAvailable();
    const database = new DatabaseSync(artifacts.main, { readOnly: true });
    try {
      const metaTable = database
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'app_meta' LIMIT 1")
        .get() as { name?: string } | undefined;
      if (metaTable) {
        const storedSchemaVersion = (
          database
            .prepare('SELECT value FROM app_meta WHERE key = ? LIMIT 1')
            .get('repository_schema_version') as { value?: string } | undefined
        )?.value;
        if (storedSchemaVersion !== undefined && storedSchemaVersion !== String(SQLITE_REPOSITORY_SCHEMA_VERSION)) {
          return {
            dbFile: artifacts.main,
            exists: true,
            artifacts,
            canOpen: true,
            hasLatestSnapshot: false,
            error: {
              code: 'repository_schema_mismatch',
              message: `SQLite repository schema version ${storedSchemaVersion} is not supported.`,
            },
          };
        }
      }

      const snapshotTable = database
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'app_data_snapshots' LIMIT 1")
        .get() as { name?: string } | undefined;
      if (!snapshotTable) {
        return {
          dbFile: artifacts.main,
          exists: true,
          artifacts,
          canOpen: true,
          hasLatestSnapshot: false,
        };
      }

      const row = database
        .prepare(
          'SELECT id, schema_version, app_data_json, created_at, label FROM app_data_snapshots ORDER BY row_id DESC LIMIT 1',
        )
        .get() as
        | { id: string; schema_version: number; app_data_json: string; created_at: string; label?: string | null }
        | undefined;

      if (!row) {
        return {
          dbFile: artifacts.main,
          exists: true,
          artifacts,
          canOpen: true,
          hasLatestSnapshot: false,
        };
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(row.app_data_json);
      } catch {
        return {
          dbFile: artifacts.main,
          exists: true,
          artifacts,
          canOpen: true,
          hasLatestSnapshot: false,
          error: { code: 'snapshot_json_invalid', message: 'SQLite snapshot JSON is invalid.' },
        };
      }

      if (!validateAppDataSchema(parsed)) {
        return {
          dbFile: artifacts.main,
          exists: true,
          artifacts,
          canOpen: true,
          hasLatestSnapshot: false,
          error: { code: 'snapshot_validation_failed', message: 'SQLite snapshot AppData failed validation.' },
        };
      }

      return {
        dbFile: artifacts.main,
        exists: true,
        artifacts,
        canOpen: true,
        hasLatestSnapshot: true,
        latestSnapshot: {
          id: row.id,
          schemaVersion: row.schema_version,
          createdAt: row.created_at,
          label: row.label || undefined,
        },
      };
    } finally {
      database.close();
    }
  } catch (error) {
    return {
      dbFile: artifacts.main,
      exists: true,
      artifacts,
      canOpen: false,
      hasLatestSnapshot: false,
      error: stableError(error, 'dev_db_inspect_failed'),
    };
  }
};

export const backupDevDbArtifacts = ({
  dbFile,
  backupDir,
  nowIso,
  label,
}: BackupDevDbArtifactsOptions): BackupDevDbArtifactsResult => {
  const artifacts = resolveDevDbArtifacts({ dbFile });
  const createdAt = nowIso || safeNowIso();
  const backupName = `${safeTimestamp(createdAt)}${label ? `-${safeTimestamp(label)}` : ''}`;
  const targetDir = resolve(backupDir || join(ironPathRoot(), 'backups', 'dev-api', backupName));
  const copiedArtifacts: DevDbArtifactRecord[] = [];
  const skippedArtifacts: DevDbArtifactRecord[] = [];

  try {
    mkdirSync(targetDir, { recursive: true });
    artifactEntries(artifacts).forEach((artifact) => {
      if (!existsSync(artifact.path)) {
        skippedArtifacts.push(artifact);
        return;
      }
      validateExistingArtifact(artifact, dirname(artifacts.main));
      const targetPath = join(targetDir, basename(artifact.path));
      copyFileSync(artifact.path, targetPath);
      copiedArtifacts.push({ kind: artifact.kind, path: targetPath });
    });
  } catch (error) {
    throw new DevDbRecoveryError('dev_db_backup_failed', 'Dev API DB artifacts could not be backed up.', error);
  }

  return {
    backupDir: targetDir,
    copiedArtifacts,
    skippedArtifacts,
    createdAt,
  };
};

export const resetDevDbArtifacts = ({
  dbFile,
  confirmToken,
  backupFirst = true,
  nowIso,
  allowOutsideIronPath = false,
  dryRun = false,
}: ResetDevDbArtifactsOptions): ResetDevDbArtifactsResult => {
  const artifacts = resolveDevDbArtifacts({ dbFile });
  if (confirmToken !== DEV_DB_RESET_CONFIRM_TOKEN) {
    throw new DevDbRecoveryError('dev_db_confirmation_required', 'Dev API DB reset requires RESET_DEV_API_DB confirmation.');
  }
  assertResetPathAllowed(artifacts, allowOutsideIronPath);

  const existingArtifacts = artifactEntries(artifacts).filter((artifact) => existsSync(artifact.path));
  const skippedArtifacts = artifactEntries(artifacts).filter((artifact) => !existsSync(artifact.path));
  if (dryRun) {
    return {
      artifacts,
      deletedArtifacts: existingArtifacts,
      skippedArtifacts,
      dryRun: true,
    };
  }

  let backup: BackupDevDbArtifactsResult | undefined;
  if (backupFirst) {
    try {
      backup = backupDevDbArtifacts({ dbFile: artifacts.main, nowIso, label: 'pre-reset' });
    } catch (error) {
      throw new DevDbRecoveryError('dev_db_backup_failed', 'Dev API DB reset backup failed; no files were deleted.', error);
    }
  }

  const deletedArtifacts: DevDbArtifactRecord[] = [];
  try {
    existingArtifacts.forEach((artifact) => {
      validateExistingArtifact(artifact, allowOutsideIronPath ? dirname(artifacts.main) : ironPathRoot());
      rmSync(artifact.path, { force: false });
      deletedArtifacts.push(artifact);
    });
  } catch (error) {
    throw new DevDbRecoveryError('dev_db_reset_failed', 'Dev API DB artifacts could not be reset.', error);
  }

  return {
    artifacts,
    deletedArtifacts,
    skippedArtifacts,
    backup,
    dryRun: false,
  };
};
