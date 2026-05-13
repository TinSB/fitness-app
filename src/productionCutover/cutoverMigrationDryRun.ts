import type { AppData } from '../models/training-model';
import { sanitizeData } from '../storage/appDataSanitize';
import { validateAppDataSchema } from '../storage/appDataValidation';

export type CutoverMigrationDryRunIssue = {
  code: string;
  message: string;
};

export type CutoverMigrationDryRunRepositoryCapability = {
  enabled: boolean;
  backupCandidateAvailable: boolean;
  writesSupported: boolean;
};

export type CutoverMigrationDryRunInput = {
  data: unknown;
  repository: CutoverMigrationDryRunRepositoryCapability;
};

export type CutoverMigrationDryRunResult = {
  ok: boolean;
  safeToCutover: boolean;
  warnings: CutoverMigrationDryRunIssue[];
  blockingErrors: CutoverMigrationDryRunIssue[];
  summary: {
    schemaVersion?: number;
    historyCount: number;
    hasActiveSession: boolean;
    dismissedDataHealthIssues: number;
    backendRepositoryEnabled: boolean;
    backendWritesSupported: boolean;
  };
  backupRequired: true;
  sourceOfTruthChanged: false;
  localStorageMutated: false;
};

const issue = (code: string, message: string): CutoverMigrationDryRunIssue => ({ code, message });

const emptySummary = (repository: CutoverMigrationDryRunRepositoryCapability): CutoverMigrationDryRunResult['summary'] => ({
  historyCount: 0,
  hasActiveSession: false,
  dismissedDataHealthIssues: 0,
  backendRepositoryEnabled: repository.enabled,
  backendWritesSupported: repository.writesSupported,
});

const summarize = (
  data: AppData | undefined,
  repository: CutoverMigrationDryRunRepositoryCapability,
): CutoverMigrationDryRunResult['summary'] => ({
  schemaVersion: data?.schemaVersion,
  historyCount: data?.history.length ?? 0,
  hasActiveSession: data?.activeSession !== undefined && data?.activeSession !== null,
  dismissedDataHealthIssues: data?.dismissedDataHealthIssues?.length ?? 0,
  backendRepositoryEnabled: repository.enabled,
  backendWritesSupported: repository.writesSupported,
});

export const runCutoverMigrationDryRun = ({
  data,
  repository,
}: CutoverMigrationDryRunInput): CutoverMigrationDryRunResult => {
  const warnings: CutoverMigrationDryRunIssue[] = [];
  const blockingErrors: CutoverMigrationDryRunIssue[] = [];
  let sanitized: AppData | undefined;

  if (data === null || typeof data !== 'object') {
    blockingErrors.push(issue('invalid_appdata_schema', 'AppData failed schema validation.'));
  } else if (validateAppDataSchema(data)) {
    sanitized = JSON.parse(JSON.stringify(data)) as AppData;
  } else {
    try {
      const candidate = sanitizeData(data);
      if (validateAppDataSchema(candidate)) {
        sanitized = candidate;
        warnings.push(issue(
          'appdata_required_sanitize_or_migration',
          'AppData required sanitize/migration before backend-primary candidate cutover.',
        ));
      } else {
        blockingErrors.push(issue('invalid_appdata_schema', 'AppData failed schema validation after sanitize.'));
      }
    } catch {
      blockingErrors.push(issue('invalid_appdata_schema', 'AppData failed schema validation.'));
    }
  }

  if (!repository.enabled) {
    blockingErrors.push(issue('backend_repository_unavailable', 'Backend AppData repository candidate is unavailable.'));
  }

  if (!repository.writesSupported) {
    blockingErrors.push(issue('backend_repository_write_unavailable', 'Backend AppData repository candidate writes are unavailable.'));
  }

  if (!repository.backupCandidateAvailable) {
    blockingErrors.push(issue('backup_not_ready', 'A backend candidate backup must be available before cutover.'));
  }

  if (sanitized?.activeSession) {
    warnings.push(issue('active_session_present', 'Active session should be completed or intentionally preserved before cutover.'));
  }

  if ((sanitized?.dismissedDataHealthIssues?.length ?? 0) > 0) {
    warnings.push(issue('data_health_state_present', 'DataHealth dismissal state should be included in manual acceptance review.'));
  }

  const safeToCutover = blockingErrors.length === 0;

  return {
    ok: safeToCutover,
    safeToCutover,
    warnings,
    blockingErrors,
    summary: sanitized === undefined ? emptySummary(repository) : summarize(sanitized, repository),
    backupRequired: true,
    sourceOfTruthChanged: false,
    localStorageMutated: false,
  };
};
