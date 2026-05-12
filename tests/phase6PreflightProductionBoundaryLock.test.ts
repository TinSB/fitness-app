import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readSource, repoRoot } from './runtimeBoundaryTestHelpers';

const docPath = 'docs/PHASE6_PREFLIGHT_PRODUCTION_BOUNDARY_LOCK.md';

describe('Phase 6 preflight production boundary lock', () => {
  it('exists and contains all required sections', () => {
    expect(existsSync(resolve(repoRoot(), docPath))).toBe(true);
    const doc = readSource(docPath);

    for (const section of [
      '# Phase 6 Preflight Production Boundary Lock',
      '## Scope / Non-goals',
      '## Phase 5 Final Baseline',
      '## Phase 6 Boundary',
      '## Production Backend Boundary',
      '## Auth / User Account Boundary',
      '## Cloud Sync Boundary',
      '## Deployment Boundary',
      '## CI / Ruleset Boundary',
      '## Real Data Safety Boundary',
      '## Source-of-truth Boundary',
      '## Route Boundary',
      '## Phase 6 Risk Register',
      '## Required Gates Before Task 6.1',
      '## Decision',
      '## Decision Record',
      '## Final Recommendation',
    ]) {
      expect(doc).toContain(section);
    }
  });

  it('states preflight-only boundaries and no production implementation', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'Task 6.0 is Phase 6 preflight.',
      'This is not production backend implementation.',
      'This is not auth implementation.',
      'This is not cloud sync implementation.',
      'This is not deployment implementation.',
      'This is not monitoring implementation.',
      'This is not source-of-truth migration implementation.',
      'This is not normalized database schema implementation.',
      'does not add dependencies or scripts',
      'does not use real personal training data',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('lists the Phase 5 final baseline and exact accepted and blocked routes', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'Phase 5 completed',
      '`localStorage` remains default runtime source',
      '`api-primary-dev` is explicit dev/local only',
      '`api-primary-dev` is not production-ready',
      'POST /data-health/issues/:issueId/dismiss',
      'POST /history/:id/data-flag',
      'POST /history/:id/edit',
      'POST /sessions/start',
      'POST /sessions/active/patches',
      'POST /sessions/active/complete',
      'POST /sessions/active/discard',
      'POST /data-health/repair/apply',
      'backup/import/export over HTTP',
      'reset/recovery over HTTP',
      'eighth browser mutation route',
      'auth/sync/cloud routes',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('includes risk register and gates before Task 6.1', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'production data loss',
      'auth leakage',
      'user identity mismatch',
      'sync conflict corruption',
      'cloud write duplication',
      'migration rollback failure',
      'localStorage/API divergence',
      'deployment misconfiguration',
      'secret leakage',
      'privacy exposure',
      'monitoring/logging sensitive data leakage',
      'branch protection bypass risk',
      'severity',
      'mitigation',
      'Required future gate',
      'Phase 6 preflight complete',
      'browser build isolation remains clean',
    ]) {
      expect(doc.toLowerCase()).toContain(expected.toLowerCase());
    }
  });

  it('recommends Task 6.1 as architecture gate only', () => {
    const doc = readSource(docPath);

    expect(doc).toContain('Task 6.1 Production Backend, Auth, Sync & Deployment Architecture Gate V1');
    expect(doc).toContain('Task 6.1 must be architecture gate only.');
    expect(doc).toContain('Task 6.1 must not implement production backend/auth/sync/deployment.');
    expect(doc).toContain('Do not auto-start Task 6.1.');
  });
});
