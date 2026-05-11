import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readSource, repoRoot } from './runtimeBoundaryTestHelpers';

const docPath = 'docs/PHASE4_COMPLETION_ARCHIVE.md';

describe('Phase 4 completion archive', () => {
  it('exists and contains required sections', () => {
    expect(existsSync(resolve(repoRoot(), docPath))).toBe(true);
    const doc = readSource(docPath);

    for (const section of [
      '## Scope / Non-goals',
      '## Final Accepted Browser Mutation Routes',
      '## Final Blocked Routes',
      '## Source-of-truth Archive',
      '## Final Coverage Archive',
      '## Final Validation Commands',
      '## Phase 5 Handoff Boundary',
      '## Decision Record',
      '## Final Recommendation',
    ]) {
      expect(doc).toContain(section);
    }
  });

  it('archives final accepted and blocked routes', () => {
    const doc = readSource(docPath);

    for (const expected of [
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
      'fifth browser mutation route',
      'No other browser mutation route is accepted at Phase 4 completion.',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('records source-of-truth and Phase 5 boundaries', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'Phase 4 is complete.',
      'Do not start Phase 5 automatically.',
      'localStorage remains source of truth at Phase 4 exit.',
      'API results never overwrite AppData or localStorage.',
      'API-backed runtime is Phase 5 work.',
      'production backend, auth, sync, and deployment are Phase 5+ work.',
      'Task 5.1 Source-of-truth Migration Architecture Gate V1',
    ]) {
      expect(doc).toContain(expected);
    }

    expect(doc).not.toMatch(/implement Phase 5 now/i);
    expect(doc).not.toMatch(/replace localStorage now/i);
  });

  it('records final validation commands and coverage inventory', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'npm run api:dev:build',
      'npm run typecheck',
      'npm test',
      'npm run build',
      'node:http',
      'devApiRunner',
      'DataHealth dismiss implementation, acceptance, manual acceptance, hardening, observability/recovery, and regression lock.',
      'Session Start plan, implementation, acceptance, manual acceptance, hardening, observability/recovery, and regression lock.',
      'Phase 5 handoff plan.',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});

