import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const docs = () => [
  'API_CONTRACT.md',
  'FULL_STACK_REFACTOR_PLAN.md',
  'docs/ACTIVE_SESSION_MUTATION_READINESS_RECOVERY_PLAN.md',
  'docs/ACTIVE_SESSION_SOURCE_SNAPSHOT_IDEMPOTENCY_PLAN.md',
  'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
].map(readSource).join('\n');

describe('active-session source snapshot docs parity', () => {
  it('records Task 4.57 in contract, refactor, readiness, and manual docs', () => {
    expect(readSource('API_CONTRACT.md')).toMatch(/Task 4\.57:? Active Session Source Snapshot & Idempotency Plan V1/);
    expect(readSource('FULL_STACK_REFACTOR_PLAN.md')).toContain('### Task 4.57: Active Session Source Snapshot & Idempotency Plan V1');
    expect(readSource('docs/ACTIVE_SESSION_MUTATION_READINESS_RECOVERY_PLAN.md')).toContain('Task 4.57 Active Session Source Snapshot & Idempotency Plan V1');
    expect(readSource('docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md')).toContain('Task 4.57 Active Session Source Snapshot & Idempotency Plan');
  });

  it('keeps route and source-of-truth wording aligned', () => {
    const allDocs = docs();

    for (const expected of [
      'POST /data-health/issues/:issueId/dismiss',
      'POST /history/:id/data-flag',
      'POST /history/:id/edit',
      'localStorage remains source of truth',
      'API results never overwrite AppData or localStorage',
      'No active-session route is implemented',
      'Task 4.58 Active Session UX Confirmation & Rollback Plan V1',
    ]) {
      expect(allDocs).toContain(expected);
    }
  });

  it('does not instruct implementation or source-of-truth migration', () => {
    const allDocs = docs();

    for (const blocked of [
      /implement `POST \/sessions\/start` now/i,
      /enable session start route now/i,
      /replace localStorage now/i,
      /make API source of truth/i,
      /deploy production backend/i,
      /enable auth/i,
      /enable sync/i,
      /direct implementation is recommended/i,
    ]) {
      expect(allDocs).not.toMatch(blocked);
    }
  });
});
