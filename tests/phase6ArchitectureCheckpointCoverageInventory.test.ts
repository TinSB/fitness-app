import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readSource, repoRoot } from './runtimeBoundaryTestHelpers';

const requiredDocs = [
  'docs/PHASE6_PREFLIGHT_PRODUCTION_BOUNDARY_LOCK.md',
  'docs/PRODUCTION_BACKEND_AUTH_SYNC_DEPLOYMENT_ARCHITECTURE_GATE.md',
  'docs/PRODUCTION_DATA_OWNERSHIP_PRIVACY_SECURITY_MATRIX.md',
  'docs/AUTH_USER_ACCOUNT_LIFECYCLE_ARCHITECTURE_GATE.md',
  'docs/PRODUCTION_BACKEND_DATABASE_ARCHITECTURE_DECISION.md',
  'docs/CLOUD_SYNC_CONFLICT_RESOLUTION_ARCHITECTURE_GATE.md',
  'docs/DEPLOYMENT_ENVIRONMENT_SECRETS_STRATEGY.md',
  'docs/PRODUCTION_MIGRATION_BACKUP_ROLLBACK_STRATEGY.md',
  'docs/PHASE6_ARCHITECTURE_CHECKPOINT_BOUNDARY_LOCK.md',
];

describe('phase 6 architecture checkpoint coverage inventory', () => {
  it('has all architecture checkpoint source documents', () => {
    for (const doc of requiredDocs) {
      expect(existsSync(resolve(repoRoot(), doc)), doc).toBe(true);
    }
  });

  it('records all architecture areas in the checkpoint', () => {
    const doc = readSource('docs/PHASE6_ARCHITECTURE_CHECKPOINT_BOUNDARY_LOCK.md');

    for (const expected of [
      'preflight',
      'production architecture',
      'data ownership/privacy/security',
      'auth lifecycle',
      'backend/database',
      'sync/conflict',
      'deployment/secrets',
      'migration/backup/rollback',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('requires future skeletons to prove browser isolation and no production activation', () => {
    const doc = readSource('docs/PHASE6_ARCHITECTURE_CHECKPOINT_BOUNDARY_LOCK.md');

    for (const expected of [
      'no browser pollution',
      'no production activation',
      'no unapproved routes',
      'no package drift',
      'no skeleton/runtime is implemented by Task 6.8',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
