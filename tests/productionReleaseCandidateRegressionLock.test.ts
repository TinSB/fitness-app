import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const docPath = 'docs/PRODUCTION_RELEASE_CANDIDATE_REGRESSION_LOCK.md';

describe('production release candidate regression lock', () => {
  it('documents required regression lock sections', () => {
    const doc = readSource(docPath);

    for (const section of [
      '# Production Release Candidate Regression Lock',
      '## Scope / Non-goals',
      '## Phase 6 Baseline',
      '## Accepted Production Capabilities',
      '## Blocked Capabilities',
      '## Source-of-truth Rules',
      '## Auth / Sync / Deployment Status',
      '## Migration / Rollback Status',
      '## CI / Ruleset Status',
      '## Browser Build Isolation',
      '## No Unapproved Routes',
      '## Coverage Inventory',
      '## Decision',
      '## Decision Record',
      '## Final Recommendation',
    ]) {
      expect(doc).toContain(section);
    }
  });

  it('locks accepted and blocked release candidate capabilities', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'Node-only production backend adapter skeleton',
      'Auth provider adapter types and pure boundary only',
      'Production storage migration dry-run only with no write',
      'Pure local sync metadata/conflict detector only',
      'Environment validation skeleton',
      'Privacy-safe redaction utility',
      'Production backend activation.',
      'Auth runtime is not implemented.',
      'Sync runtime is not implemented.',
      'Production deployment is not implemented.',
      'Task 6.38 Phase 6 Final Manual Acceptance V1',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
