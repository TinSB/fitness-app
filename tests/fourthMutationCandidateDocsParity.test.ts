import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const docs = () => [
  'API_CONTRACT.md',
  'FULL_STACK_REFACTOR_PLAN.md',
  'docs/WRITE_PATH_THREE_ROUTE_REGRESSION_LOCK.md',
  'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
  'docs/FOURTH_MUTATION_CANDIDATE_READINESS_AUDIT.md',
].map(readSource).join('\n');

describe('fourth mutation candidate docs parity', () => {
  it('records Task 4.55 in contract, refactor, regression lock, and manual docs', () => {
    expect(readSource('API_CONTRACT.md')).toContain('Task 4.55 Fourth Mutation Candidate Readiness Audit V1');
    expect(readSource('FULL_STACK_REFACTOR_PLAN.md')).toContain('### Task 4.55: Fourth Mutation Candidate Readiness Audit V1');
    expect(readSource('docs/WRITE_PATH_THREE_ROUTE_REGRESSION_LOCK.md')).toContain('Task 4.55 Fourth Mutation Candidate Readiness Audit V1');
    expect(readSource('docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md')).toContain('Task 4.55 Fourth Mutation Candidate Readiness Audit');
  });

  it('keeps current three-route state and planning-only next task aligned', () => {
    const allDocs = docs();

    for (const expected of [
      'POST /data-health/issues/:issueId/dismiss',
      'POST /history/:id/data-flag',
      'POST /history/:id/edit',
      'No fourth mutation is implemented.',
      'localStorage remains source of truth',
      'API results never overwrite AppData or localStorage',
      'Task 4.56 Active Session Mutation Readiness & Recovery Plan V1',
      'planning-only',
    ]) {
      expect(allDocs).toContain(expected);
    }
  });

  it('does not instruct forbidden implementation, source-of-truth, production, auth, sync, or route expansion steps', () => {
    const allDocs = docs();

    for (const blocked of [
      /implement session mutation now/i,
      /implement `POST \/sessions\/start` now/i,
      /enable fourth mutation route now/i,
      /enable DataHealth repair/i,
      /enable backup\/import\/reset over HTTP/i,
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
