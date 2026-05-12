import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readSource, repoRoot } from './runtimeBoundaryTestHelpers';

describe('production release candidate coverage inventory', () => {
  it('references existing release candidate coverage documents', () => {
    const doc = readSource('docs/PRODUCTION_RELEASE_CANDIDATE_REGRESSION_LOCK.md');

    for (const path of [
      'docs/PRODUCTION_BACKEND_ADAPTER_ACCEPTANCE.md',
      'docs/AUTH_ACCOUNT_LIFECYCLE_ACCEPTANCE.md',
      'docs/PRODUCTION_STORAGE_MIGRATION_DRY_RUN.md',
      'docs/PRODUCTION_BACKUP_EXPORT_DELETE_RECOVERY_ACCEPTANCE.md',
      'docs/PRODUCTION_SYNC_CONFLICT_FINAL_AUDIT.md',
      'docs/PRODUCTION_DEPLOYMENT_ENVIRONMENT_FINAL_AUDIT.md',
      'docs/PRODUCTION_MONITORING_LOGGING_PRIVACY_LOCK.md',
      'docs/PRODUCTION_MANUAL_ACCEPTANCE_RUNBOOK.md',
      'docs/PRODUCTION_ROLLBACK_INCIDENT_RUNBOOK.md',
    ]) {
      expect(doc).toContain(path);
      expect(existsSync(resolve(repoRoot(), path))).toBe(true);
    }
  });
});
