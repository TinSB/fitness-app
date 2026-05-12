import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readSource, repoRoot } from './runtimeBoundaryTestHelpers';

const requiredDocs = [
  'docs/API_BACKED_READ_RUNTIME_REGRESSION_LOCK.md',
  'docs/ACTIVE_SESSION_FULL_WRITE_PATH_REGRESSION_LOCK.md',
  'docs/API_PRIMARY_RUNTIME_REGRESSION_LOCK.md',
  'docs/MIGRATION_REGRESSION_LOCK.md',
  'docs/PHASE5_FINAL_SOURCE_OF_TRUTH_AUDIT.md',
  'docs/PHASE5_FINAL_MANUAL_ACCEPTANCE.md',
  'docs/PHASE5_EXIT_REGRESSION_LOCK.md',
];

const requiredTests = [
  'tests/apiBackedReadRuntimeRegressionLock.test.ts',
  'tests/activeSessionFullWritePathRegressionLock.test.ts',
  'tests/apiPrimaryRuntimeRegressionLock.test.ts',
  'tests/migrationRegressionLock.test.ts',
  'tests/phase5FinalSourceOfTruthAudit.test.ts',
  'tests/phase5FinalManualAcceptanceDocs.test.ts',
  'tests/phase5ExitRegressionLock.test.ts',
  'tests/phase5ExitBoundaryLock.test.ts',
];

const exists = (path: string) => existsSync(resolve(repoRoot(), path));

describe('Phase 5 exit coverage inventory', () => {
  it('keeps final Phase 5 docs present', () => {
    for (const path of requiredDocs) {
      expect(exists(path), `${path} should exist`).toBe(true);
    }
  });

  it('keeps final Phase 5 coverage present', () => {
    for (const path of requiredTests) {
      expect(exists(path), `${path} should exist`).toBe(true);
    }
  });

  it('records coverage inventory in the exit lock doc', () => {
    const doc = readSource('docs/PHASE5_EXIT_REGRESSION_LOCK.md');

    for (const expected of [
      'API-backed read runtime plan, prototype, acceptance, manual acceptance, and regression',
      'active session start, patch, complete, discard prototype acceptance/hardening/regression',
      'API write-through runtime prototype, acceptance, manual acceptance, hardening, and regression',
      'localStorage to SQLite migration dry-run/apply/acceptance/rollback/regression',
      'Phase 5 final source-of-truth audit',
      'Phase 5 final manual acceptance',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
