import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const docPath = 'docs/PRODUCTION_RELEASE_READINESS_CHECKPOINT.md';

describe('production release readiness checkpoint', () => {
  it('documents readiness checkpoint sections', () => {
    const doc = readSource(docPath);

    for (const section of [
      '# Production Release Readiness Checkpoint',
      '## Scope / Non-goals',
      '## Implemented Production Capabilities',
      '## Still Blocked Production Capabilities',
      '## Status Matrix',
      '## Route Allowlist',
      '## Decision',
      '## Final Recommendation',
    ]) {
      expect(doc).toContain(section);
    }
  });

  it('covers implemented, blocked, and status categories', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'Node-only production backend adapter skeleton',
      'Auth provider adapter type/interface skeleton',
      'Sync metadata conflict detector',
      'Still blocked capabilities',
      'Auth/account status',
      'Backend status',
      'Sync status',
      'Deployment status',
      'Source-of-truth status',
      'Data migration status',
      'Privacy/security status',
      'Rollback status',
      'CI/ruleset status',
      'Task 6.31 Production Manual Acceptance Runbook V1',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
