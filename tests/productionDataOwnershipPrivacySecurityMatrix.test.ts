import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readSource, repoRoot } from './runtimeBoundaryTestHelpers';

const docPath = 'docs/PRODUCTION_DATA_OWNERSHIP_PRIVACY_SECURITY_MATRIX.md';

const dataDomains = [
  'training history',
  'active session',
  'program templates',
  'settings',
  'screening profile',
  'DataHealth state',
  'backup metadata',
  'readMirror summaries',
  'derived analytics',
  'migration state',
  'account identity metadata',
  'auth/session metadata',
  'sync metadata',
  'audit/security logs',
  'support/diagnostic data',
  'deletion/export records',
];

describe('production data ownership privacy security matrix', () => {
  it('exists and contains all required sections', () => {
    expect(existsSync(resolve(repoRoot(), docPath))).toBe(true);
    const doc = readSource(docPath);

    for (const section of [
      '# Production Data Ownership Privacy Security Matrix',
      '## Scope / Non-goals',
      '## Phase 5 / 6.0 / 6.1 Baseline',
      '## Data Ownership Matrix',
      '## Privacy Classification Matrix',
      '## Security Controls Matrix',
      '## Retention / Export / Delete Policy Matrix',
      '## Logging / Diagnostics Boundary',
      '## Sync / Migration Eligibility Matrix',
      '## Real Data Safety Boundary',
      '## Required Gates Before Production Data Implementation',
      '## Decision',
      '## Decision Record',
      '## Final Recommendation',
    ]) {
      expect(doc).toContain(section);
    }
  });

  it('states docs/static-test-only boundaries and no implementation', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'Task 6.2 is a production data ownership, privacy, and security matrix.',
      'This is docs/static tests only.',
      'This is not production backend implementation.',
      'This is not auth implementation.',
      'This is not user account implementation.',
      'This is not cloud sync implementation.',
      'This is not deployment implementation.',
      'This is not monitoring implementation.',
      'This is not production source-of-truth migration implementation.',
      'This is not normalized schema implementation.',
      'does not add dependencies or scripts',
      'does not use real personal training data',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('preserves Phase 5, Task 6.0, and Task 6.1 baselines with exact accepted routes', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'Phase 5 completed',
      'Task 6.0 preflight completed',
      'Task 6.1 architecture gate completed',
      '`localStorage` remains default runtime source',
      '`api-primary-dev` remains explicit dev/local only',
      '`api-primary-dev` is not production-ready',
      'production backend/auth/sync/deployment/monitoring remain unimplemented',
      'Production source-of-truth migration remains unimplemented',
      'POST /data-health/issues/:issueId/dismiss',
      'POST /history/:id/data-flag',
      'POST /history/:id/edit',
      'POST /sessions/start',
      'POST /sessions/active/patches',
      'POST /sessions/active/complete',
      'POST /sessions/active/discard',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('classifies every required data domain', () => {
    const doc = readSource(docPath);

    for (const domain of dataDomains) {
      expect(doc).toContain(`| ${domain} |`);
    }
  });

  it('recommends Task 6.3 as docs/static tests only', () => {
    const doc = readSource(docPath);

    expect(doc).toContain('Task 6.3 Auth & User Account Lifecycle Architecture Gate V1');
    expect(doc).toContain('Task 6.3 must be docs/static tests only.');
    expect(doc).toContain('Task 6.3 must not implement auth, production backend, sync, deployment, migration, or source-of-truth switching.');
    expect(doc).toContain('Do not auto-start Task 6.3.');
  });
});
