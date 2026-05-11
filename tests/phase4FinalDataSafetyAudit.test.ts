import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const docPath = 'docs/PHASE4_FINAL_DATA_SAFETY_AUDIT.md';

describe('Phase 4 final data safety audit', () => {
  it('exists and contains the required audit sections', () => {
    const doc = readSource(docPath);

    for (const section of [
      '## Scope / Non-goals',
      '## Accepted Routes',
      '## Blocked Routes',
      '## Source-of-truth Lock',
      '## LocalStorage Integrity',
      '## No-fake-success Lock',
      '## Backup / Import Safety',
      '## ReadMirror / Read-only Parity',
      '## Runtime Boundary',
      '## Risk Register',
      '## Decision',
      '## Decision Record',
      '## Final Recommendation',
    ]) {
      expect(doc).toContain(section);
    }
  });

  it('locks accepted routes, blocked routes, and source-of-truth behavior', () => {
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
      'localStorage remains current source of truth',
      'API results do not overwrite AppData',
      'API results do not overwrite localStorage',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('covers no-fake-success, backup/import safety, readMirror parity, runtime boundary, and next task', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'Unavailable, timeout, abort, malformed response',
      'No backup/import/export HTTP route is exposed to the browser',
      'Read-only diagnostics remain GET-only',
      'Mismatch remains diagnostic-only',
      'node:http',
      'node:sqlite',
      'Task 4.72 Phase 4 Manual Final Acceptance V1',
      'Task 4.72 must be manual-acceptance documentation and static tests only.',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
