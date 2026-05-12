import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readSource, repoRoot } from './runtimeBoundaryTestHelpers';

const docPath = 'docs/PRODUCTION_BACKEND_AUTH_SYNC_DEPLOYMENT_ARCHITECTURE_GATE.md';

describe('production backend auth sync deployment architecture gate', () => {
  it('exists and contains all required sections', () => {
    expect(existsSync(resolve(repoRoot(), docPath))).toBe(true);
    const doc = readSource(docPath);

    for (const section of [
      '# Production Backend Auth Sync Deployment Architecture Gate',
      '## Scope / Non-goals',
      '## Phase 5 / 6.0 Baseline',
      '## Architecture Decision Categories',
      '## Production Backend Architecture Options',
      '## Production Database / Storage Architecture',
      '## Auth / User Identity Architecture',
      '## Cloud Sync / Multi-device Architecture',
      '## Deployment / Environment Architecture',
      '## Privacy / Security Architecture',
      '## Production Migration / Rollback Architecture',
      '## CI / Ruleset Architecture',
      '## Risk Matrix',
      '## Required Gates Before Any Production Implementation',
      '## Decision',
      '## Decision Record',
      '## Final Recommendation',
    ]) {
      expect(doc).toContain(section);
    }
  });

  it('states architecture-gate-only boundaries and no implementation', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'Task 6.1 is a Phase 6 architecture gate.',
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

  it('lists the Phase 5 and Task 6.0 baseline with exact accepted routes', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'Phase 5 completed',
      'Task 6.0 preflight completed',
      '`localStorage` remains default runtime source',
      '`api-primary-dev` remains explicit dev/local only',
      '`api-primary-dev` is not production-ready',
      'production backend/auth/sync/deployment/monitoring remain unimplemented',
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

  it('includes architecture options and one planning-only recommendation', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'Option A: no production backend yet, keep local/dev API only',
      'Option B: single Node backend with existing API adapter model',
      'Option C: serverless API routes',
      'Option D: hosted backend/database service',
      'Option E: desktop/local-first backend only',
      'benefits',
      'risks',
      'blocker',
      'Required future gate',
      'Phase 6 should start with production architecture planning, not implementation.',
      'Do not select production backend implementation yet.',
    ]) {
      expect(doc.toLowerCase()).toContain(expected.toLowerCase());
    }
  });

  it('includes risk matrix and recommends Task 6.2 as docs/static tests only', () => {
    const doc = readSource(docPath);

    expect(doc).toContain('## Risk Matrix');
    expect(doc).toContain('Task 6.2 Production Data Ownership, Privacy & Security Matrix V1');
    expect(doc).toContain('Task 6.2 must be docs/static tests only.');
    expect(doc).toContain('Task 6.2 must not implement auth, production backend, sync, deployment, or migration.');
    expect(doc).toContain('Do not auto-start Task 6.2.');
  });
});
