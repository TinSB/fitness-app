import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const docPath = 'docs/PHASE4_MANUAL_FINAL_ACCEPTANCE.md';

describe('Phase 4 manual final acceptance docs', () => {
  it('exists, uses checkboxes, and contains required sections', () => {
    const doc = readSource(docPath);

    expect(doc).toContain('- [ ]');
    for (const section of [
      '## Scope / Non-goals',
      '## Accepted Browser Mutation Routes',
      '## Blocked Routes',
      '## Prerequisites',
      '## Start Dev API Runner',
      '## Start App With Read-only Diagnostics',
      '## Accepted Mutation Prototype Checks',
      '## Route Boundary Verification',
      '## LocalStorage Integrity',
      '## No-fake-success',
      '## Failure Recovery',
      '## Browser Build Safety',
      '## Cleanup',
      '## Manual Pass / Fail Template',
      '## Final Recommendation',
    ]) {
      expect(doc).toContain(section);
    }
  });

  it('contains commands, accepted routes, blocked routes, cleanup, and pass/fail fields', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'npm run api:dev -- --port 8787 --seed-empty --db .ironpath/phase4-final-acceptance.sqlite',
      'IronPath dev API ready: <url>',
      '$env:VITE_IRONPATH_DEV_API_COMPARE="1"',
      'VITE_IRONPATH_DEV_API_COMPARE=1 VITE_IRONPATH_DEV_API_BASE_URL=http://127.0.0.1:8787 npm run dev',
      'POST /data-health/issues/:issueId/dismiss',
      'POST /history/:id/data-flag',
      'POST /history/:id/edit',
      'POST /sessions/start',
      'POST /sessions/active/patches',
      'POST /sessions/active/complete',
      'POST /sessions/active/discard',
      'POST /data-health/repair/apply',
      'backup/import/export/reset/recovery HTTP routes',
      'Remove-Item Env:VITE_IRONPATH_DEV_API_COMPARE -ErrorAction SilentlyContinue',
      'unset VITE_IRONPATH_DEV_API_COMPARE',
      'Read-only diagnostics result',
      'Session Start result',
      'Pass / Fail',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('states localStorage source-of-truth, no real data, and no production readiness', () => {
    const doc = readSource(docPath);

    expect(doc).toContain('localStorage remains source of truth');
    expect(doc).toContain('API results never overwrite AppData or localStorage');
    expect(doc).toContain('Do not use real personal training data');
    expect(doc).toContain('This is not production readiness.');
    expect(doc).toContain('Task 4.73 Phase 4 Exit Regression Lock V1');
  });
});
