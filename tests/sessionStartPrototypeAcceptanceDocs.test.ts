import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const doc = () => readFileSync(resolve(process.cwd(), 'docs/SESSION_START_PROTOTYPE_ACCEPTANCE.md'), 'utf8');

describe('Session Start prototype acceptance docs', () => {
  it('exists as a checkbox acceptance runbook with required sections', () => {
    const text = doc();
    expect(text).toContain('- [ ]');
    [
      '## Scope / Non-goals',
      '## Flag Matrix Acceptance',
      '## No Stable Target Acceptance',
      '## Confirmation / Cancel Acceptance',
      '## Pending / Duplicate Start Acceptance',
      '## Strict Success Acceptance',
      '## Failure / No-fake-success Acceptance',
      '## LocalStorage Integrity Acceptance',
      '## Route Boundary Acceptance',
      '## Manual Runbook Stub',
      '## Decision',
    ].forEach((section) => expect(text).toContain(section));
  });

  it('documents exact routes, failure states, source-of-truth, and next task', () => {
    const text = doc();
    [
      'POST /data-health/issues/:issueId/dismiss',
      'POST /history/:id/data-flag',
      'POST /history/:id/edit',
      'POST /sessions/start',
      'POST /sessions/active/patches',
      'POST /sessions/active/complete',
      'POST /sessions/active/discard',
      'active_session_exists',
      'template_not_found',
      'write_failed',
      'transaction_failed',
      'database_closed',
      'localStorage remains source of truth',
      'API results never overwrite AppData or localStorage',
      'Task 4.62 Session Start Manual App Acceptance V1',
    ].forEach((term) => expect(text).toContain(term));
  });
});
