import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readSource, repoRoot } from './runtimeBoundaryTestHelpers';

const planPath = 'docs/HISTORY_DATA_FLAG_MUTATION_PROTOTYPE_PLAN.md';

const readPlan = () => readSource(planPath);

const requiredSections = [
  '## Scope / Non-goals',
  '## Current Baseline',
  '## Data-flag Semantics',
  '## Data Semantics Impact Analysis',
  '## Candidate Route Plan',
  '## Confirmation UX Plan',
  '## Pending / Success / Failure UX Plan',
  '## Idempotency / Duplicate-submit Plan',
  '## Conflict / Source Snapshot Plan',
  '## Rollback Plan',
  '## Audit Trail / Visibility Plan',
  '## Manual Acceptance Plan',
  '## Explicitly Rejected Scope',
  '## Task 4.36 Recommendation',
  '## Decision Record',
  '## Final Recommendation',
];

describe('history data-flag mutation prototype plan', () => {
  it('exists and includes all required sections', () => {
    expect(existsSync(resolve(repoRoot(), planPath))).toBe(true);
    const plan = readPlan();

    for (const section of requiredSections) {
      expect(plan).toContain(section);
    }
  });

  it('states implementation and runtime boundaries remain blocked', () => {
    const plan = readPlan();

    expect(plan).toContain('This is not implementation.');
    expect(plan).toContain('This does not add `POST /history/:id/data-flag` to the App.');
    expect(plan).toContain('This does not add browser mutation client.');
    expect(plan).toContain('This does not add mutation feature flag runtime wiring.');
    expect(plan).toContain('This does not modify App.tsx.');
    expect(plan).toContain('This does not replace localStorage.');
    expect(plan).toContain('This does not switch source of truth.');
    expect(plan).toContain('This does not add production backend, auth, sync, or deployment.');
    expect(plan).toContain('This does not add dependency or script.');
    expect(plan).toContain('There are no UI writes to API.');
    expect(plan).toContain('There is no frontend mutation client.');
    expect(plan).toContain('Write-path migration remains blocked.');
  });

  it('defines dataFlag semantics and data semantics impact', () => {
    const plan = readPlan();

    for (const phrase of [
      '`normal`: record participates in normal statistics.',
      '`test`: record remains visible but is excluded from default production-like statistics.',
      '`excluded`: record remains visible but is excluded from default production-like statistics.',
      'DataFlag is more risky than DataHealth dismiss',
      'DataFlag is less risky than history edit',
      'History list',
      'History detail',
      'Calendar summaries',
      'Session summaries',
      'readMirror output',
      'DataHealth report',
      'PR / e1RM',
      'effectiveSet / weighted effectiveSet',
      'audit trail / editHistory',
      'backup export/import semantic safety',
      'test/excluded default-stat exclusion must remain locked.',
      'identityInvalid semantics must remain unchanged.',
      'actualWeightKg remains the trusted calculation source.',
      'No training algorithm changes are allowed.',
    ]) {
      expect(plan).toContain(phrase);
    }
  });

  it('plans the future route and payload without implementing a browser request', () => {
    const plan = readPlan();

    for (const phrase of [
      'Future route:',
      'POST /history/:id/data-flag',
      'record/session id',
      'target dataFlag: `normal | test | excluded`',
      '`mutationId`',
      '`idempotencyKey`',
      '`requestFingerprint`',
      '`sourceSnapshotHash` or `sourceSnapshotVersion`',
      '`confirmed: true`',
      'optional `reason` developer/user note if safe',
      'optional `nowIso` for tests if the existing server handler supports it',
      'Task 4.35 does not add this browser request.',
      'Future server contract must not be broken.',
      'future frontend prototype may track metadata locally',
    ]) {
      expect(plan).toContain(phrase);
    }
  });

  it('documents confirmation and pending/success/failure UX plans', () => {
    const plan = readPlan();

    for (const phrase of [
      '`normal` -> `test`',
      '`normal` -> `excluded`',
      '`test` -> `normal`',
      '`excluded` -> `normal`',
      '`test` -> `excluded`',
      '`excluded` -> `test`',
      'clear label for current and target state',
      'explanation that statistics may change',
      'cancel behavior that sends no request and preserves localStorage/AppData',
      'confirmation required before POST',
      'no silent mutation',
      'pending disables repeated submit',
      'no optimistic success',
      'success only after strict server success and snapshot metadata',
      'localStorage remains source of truth',
      'manual re-check/comparison after success',
      'unavailable',
      'timeout',
      'malformed response',
      'record not found',
      'invalid dataFlag',
      'no_change',
      'source snapshot mismatch',
      'write_failed',
      'transaction_failed',
      'database_closed',
      'unsupported_route',
      'missing snapshot metadata',
    ]) {
      expect(plan).toContain(phrase);
    }
  });

  it('documents idempotency, conflict, rollback, audit, and manual acceptance gates', () => {
    const plan = readPlan();

    for (const phrase of [
      'pending lock',
      'duplicate submit disabled',
      'no repeated writes',
      'no double audit trail event',
      'compare local source snapshot hash/version before mutation',
      'reject or block mutation on mismatch',
      'not auto-merge',
      'not overwrite localStorage',
      'not overwrite API snapshot into AppData',
      'If there is no optimistic local write, rollback is failure state only.',
      'Disable mutation flag to rollback feature.',
      'Backup dev DB before experiments.',
      'Backup localStorage before experiments',
      'preserve existing audit trail semantics',
      'show original flag and new flag in audit context',
      'readMirror parity after mutation',
      'flag off no mutation UI',
      'flag on one route only',
      'confirm dataFlag change',
      'cancel dataFlag change',
      'browser Network shows only `POST /history/:id/data-flag`',
    ]) {
      expect(plan).toContain(phrase);
    }
  });

  it('rejects out-of-scope routes and recommends Task 4.36 only after gates', () => {
    const plan = readPlan();

    for (const phrase of [
      'no `POST /history/:id/edit`',
      'no `POST /sessions/*`',
      'no `POST /data-health/repair/apply`',
      'no backup/import/export over HTTP',
      'no reset/recovery over HTTP',
      'no source-of-truth migration',
      'no dual-write',
      'no production backend',
      '`Task 4.36 History Data-flag Mutation Prototype V1`',
      'Task 4.35 acceptance passes',
      'one route only',
      'no broad mutation client',
      'Task 4.36 History Data-flag Prototype Blocker Resolution V1',
      'No second mutation is implemented.',
      'DataHealth dismiss remains the only implemented browser mutation.',
      'Next task should be Task 4.36 History Data-flag Mutation Prototype V1 only if gates are accepted.',
    ]) {
      expect(plan).toContain(phrase);
    }

    expect(plan).not.toMatch(/implement history data-flag now/i);
    expect(plan).not.toMatch(/connect POST \/history\/:id\/data-flag to App now/i);
    expect(plan).not.toMatch(/enable second mutation route now/i);
  });
});
