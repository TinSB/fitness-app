import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const docs = () => [
  'API_CONTRACT.md',
  'FULL_STACK_REFACTOR_PLAN.md',
  'docs/FOURTH_MUTATION_CANDIDATE_READINESS_AUDIT.md',
  'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
  'docs/ACTIVE_SESSION_MUTATION_READINESS_RECOVERY_PLAN.md',
].map(readSource).join('\n');

describe('active-session mutation readiness docs parity', () => {
  it('records Task 4.56 in contract, refactor, audit, and manual docs', () => {
    expect(readSource('API_CONTRACT.md')).toContain('Task 4.56 Active Session Mutation Readiness & Recovery Plan V1');
    expect(readSource('FULL_STACK_REFACTOR_PLAN.md')).toContain('### Task 4.56: Active Session Mutation Readiness & Recovery Plan V1');
    expect(readSource('docs/FOURTH_MUTATION_CANDIDATE_READINESS_AUDIT.md')).toContain('Task 4.56 Active Session Mutation Readiness & Recovery Plan V1');
    expect(readSource('docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md')).toContain('Task 4.56 Active Session Mutation Readiness & Recovery Plan');
  });

  it('keeps current route allowlist, source-of-truth, and no-auto-next aligned', () => {
    const allDocs = docs();

    for (const expected of [
      'POST /data-health/issues/:issueId/dismiss',
      'POST /history/:id/data-flag',
      'POST /history/:id/edit',
      'No active-session mutation is implemented.',
      'No fourth mutation route is implemented.',
      'localStorage remains source of truth',
      'API results never overwrite AppData or localStorage',
      'No automatic next task is approved',
    ]) {
      expect(allDocs).toContain(expected);
    }
  });

  it('does not instruct forbidden implementation, source-of-truth, production, auth, sync, or route expansion steps', () => {
    const allDocs = docs();

    for (const blocked of [
      /implement active-session mutation now/i,
      /implement session mutation now/i,
      /implement `POST \/sessions\/start` now/i,
      /enable session mutation now/i,
      /enable fourth mutation route now/i,
      /replace localStorage now/i,
      /replace localStorage with/i,
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
