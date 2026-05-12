import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readSource, repoRoot } from './runtimeBoundaryTestHelpers';

describe('phase 6 exit coverage inventory', () => {
  it('references existing final Phase 6 evidence documents', () => {
    const doc = readSource('docs/PHASE6_EXIT_REGRESSION_LOCK.md');

    for (const path of [
      'docs/PHASE6_PREFLIGHT_PRODUCTION_BOUNDARY_LOCK.md',
      'docs/PRODUCTION_BACKEND_AUTH_SYNC_DEPLOYMENT_ARCHITECTURE_GATE.md',
      'docs/PRODUCTION_DATA_OWNERSHIP_PRIVACY_SECURITY_MATRIX.md',
      'docs/PRODUCTION_RELEASE_READINESS_CHECKPOINT.md',
      'docs/PRODUCTION_RELEASE_CANDIDATE_REGRESSION_LOCK.md',
      'docs/PHASE6_FINAL_MANUAL_ACCEPTANCE.md',
    ]) {
      expect(doc).toContain(path);
      expect(existsSync(resolve(repoRoot(), path))).toBe(true);
    }
  });
});
