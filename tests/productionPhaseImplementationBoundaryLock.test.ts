import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const docPath = 'docs/PRODUCTION_PHASE_IMPLEMENTATION_BOUNDARY_LOCK.md';

describe('production phase implementation boundary lock', () => {
  it('documents accepted, planned-only, blocked, route, source, and runtime status sections', () => {
    const doc = readSource(docPath);

    for (const section of [
      '# Production Phase Implementation Boundary Lock',
      '## Scope / Non-goals',
      '## Accepted Capabilities',
      '## Planned-only Capabilities',
      '## Blocked Capabilities',
      '## Route Allowlist',
      '## Source-of-truth Status',
      '## Auth / Sync / Deployment Status',
      '## Decision',
      '## Final Recommendation',
    ]) {
      expect(doc).toContain(section);
    }
  });

  it('locks accepted and blocked capabilities', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'Node-only inert production backend adapter skeleton',
      'Type/interface-only auth provider adapter skeleton',
      'Production storage migration dry-run utility',
      'Pure local sync metadata conflict detector',
      'Environment validation skeleton',
      'Privacy-safe redaction utility',
      'production backend activation',
      'cloud sync runtime',
      'deployment runtime',
      'production source-of-truth switch',
      'Task 6.30 Production Release Readiness Checkpoint V1',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
