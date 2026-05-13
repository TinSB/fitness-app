import type { AppData } from '../../../../src/models/training-model';
import { validateAppDataSchema } from '../../../../src/storage/appDataValidation';

export type BackendAppDataRepositoryCandidateErrorCode =
  | 'repository_disabled'
  | 'appdata_not_found'
  | 'appdata_validation_failed'
  | 'backup_required'
  | 'write_rejected'
  | 'write_failed'
  | 'candidate_not_source_of_truth';

export type BackendAppDataRepositoryCandidateError = {
  code: BackendAppDataRepositoryCandidateErrorCode;
  message: string;
};

export type BackendAppDataRepositoryCandidateResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: BackendAppDataRepositoryCandidateError };

export type BackendAppDataBackupCandidate = {
  backupId: string;
  schemaVersion: number;
  sourceOfTruth: false;
};

export type BackendAppDataWriteCandidateInput = {
  data: AppData;
  backupId?: string;
  reject?: boolean;
};

export type BackendAppDataWriteCandidateResult = {
  snapshotId: string;
  schemaVersion: number;
  backupId: string;
  sourceOfTruth: false;
};

export type BackendAppDataRepositoryCandidate = {
  kind: 'backend-appdata-repository-candidate';
  enabled: boolean;
  sourceOfTruth: false;
  storageModel: 'document-appdata-snapshot';
  normalizedTables: false;
  readLatestAppData: () => BackendAppDataRepositoryCandidateResult<AppData>;
  createBackupCandidate: () => BackendAppDataRepositoryCandidateResult<BackendAppDataBackupCandidate>;
  validateBeforeWrite: (data: unknown) => BackendAppDataRepositoryCandidateResult<AppData>;
  writeAppDataCandidate: (
    input: BackendAppDataWriteCandidateInput,
  ) => BackendAppDataRepositoryCandidateResult<BackendAppDataWriteCandidateResult>;
};

export type BackendAppDataRepositoryCandidateOptions = {
  enabled?: boolean;
  initialData?: AppData;
};

const cloneAppData = (data: AppData): AppData => JSON.parse(JSON.stringify(data)) as AppData;

const errorResult = <T>(
  code: BackendAppDataRepositoryCandidateErrorCode,
  message: string,
): BackendAppDataRepositoryCandidateResult<T> => ({
  ok: false,
  error: { code, message },
});

export const createInMemoryBackendAppDataRepositoryCandidate = ({
  enabled = false,
  initialData,
}: BackendAppDataRepositoryCandidateOptions = {}): BackendAppDataRepositoryCandidate => {
  let latest = initialData === undefined ? undefined : cloneAppData(initialData);
  let backupSequence = 0;
  let snapshotSequence = 0;
  const backups = new Map<string, AppData>();

  const assertEnabled = <T>(): BackendAppDataRepositoryCandidateResult<T> | undefined =>
    enabled ? undefined : errorResult('repository_disabled', 'Backend AppData repository candidate is disabled.');

  const validateBeforeWrite = (data: unknown): BackendAppDataRepositoryCandidateResult<AppData> => {
    const disabled = assertEnabled<AppData>();
    if (disabled) return disabled;

    if (!validateAppDataSchema(data)) {
      return errorResult('appdata_validation_failed', 'AppData document failed schema validation.');
    }

    return { ok: true, value: cloneAppData(data as unknown as AppData) };
  };

  return {
    kind: 'backend-appdata-repository-candidate',
    enabled,
    sourceOfTruth: false,
    storageModel: 'document-appdata-snapshot',
    normalizedTables: false,
    readLatestAppData: () => {
      const disabled = assertEnabled<AppData>();
      if (disabled) return disabled;
      if (latest === undefined) return errorResult('appdata_not_found', 'No AppData candidate snapshot exists.');
      return { ok: true, value: cloneAppData(latest) };
    },
    createBackupCandidate: () => {
      const disabled = assertEnabled<BackendAppDataBackupCandidate>();
      if (disabled) return disabled;
      if (latest === undefined) return errorResult('appdata_not_found', 'No AppData candidate snapshot exists.');

      backupSequence += 1;
      const backupId = `candidate-backup-${backupSequence}`;
      backups.set(backupId, cloneAppData(latest));

      return {
        ok: true,
        value: {
          backupId,
          schemaVersion: latest.schemaVersion,
          sourceOfTruth: false,
        },
      };
    },
    validateBeforeWrite,
    writeAppDataCandidate: (input) => {
      const disabled = assertEnabled<BackendAppDataWriteCandidateResult>();
      if (disabled) return disabled;
      if (input.reject) return errorResult('write_rejected', 'Backend AppData candidate write was rejected.');
      if (input.backupId === undefined || !backups.has(input.backupId)) {
        return errorResult('backup_required', 'A candidate backup is required before writing AppData.');
      }

      const validation = validateBeforeWrite(input.data);
      if (!validation.ok) return validation;

      try {
        snapshotSequence += 1;
        latest = cloneAppData(validation.value);
        return {
          ok: true,
          value: {
            snapshotId: `candidate-snapshot-${snapshotSequence}`,
            schemaVersion: latest.schemaVersion,
            backupId: input.backupId,
            sourceOfTruth: false,
          },
        };
      } catch {
        return errorResult('write_failed', 'Backend AppData candidate write failed.');
      }
    },
  };
};
