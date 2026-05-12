import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const docPath = 'docs/PHASE6_EXIT_REGRESSION_LOCK.md';

describe('phase 6 exit regression lock', () => {
  it('documents required exit lock sections', () => {
    const doc = readSource(docPath);

    for (const section of [
      '# Phase 6 Exit Regression Lock',
      '## Scope / Non-goals',
      '## Phase 6 Baseline',
      '## Final Accepted Capabilities',
      '## Final Blocked Capabilities',
      '## Final Source-of-truth Status',
      '## Final Auth / Sync / Deployment Status',
      '## Final Migration / Rollback Status',
      '## Final Route Allowlist',
      '## Final CI / Ruleset Policy',
      '## Browser Build Isolation',
      '## No Phase 7 Auto-start',
      '## Coverage Inventory',
      '## Decision',
      '## Decision Record',
      '## Final Recommendation',
    ]) {
      expect(doc).toContain(section);
    }
  });

  it('locks final phase 6 exit status and next task', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'Production backend activation.',
      'Auth runtime is not implemented.',
      'Sync runtime is not implemented.',
      'Production deployment is not implemented.',
      'Production storage migration remains dry-run only.',
      'No additional browser mutation route is accepted.',
      'Task 6.40 Phase 6 Completion Archive V1',
      'Do not start Phase 7.',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
