import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const allDocs = () => [
  'API_CONTRACT.md',
  'FULL_STACK_REFACTOR_PLAN.md',
  'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
  'docs/PHASE4_EXIT_REGRESSION_LOCK.md',
].map(readSource).join('\n');

describe('Phase 4 exit docs parity', () => {
  it('records Task 4.73 across contract, plan, checklist, and lock docs', () => {
    const docs = allDocs();

    expect(readSource('API_CONTRACT.md')).toContain('Task 4.73 Phase 4 Exit Regression Lock V1');
    expect(readSource('FULL_STACK_REFACTOR_PLAN.md')).toContain('### Task 4.73: Phase 4 Exit Regression Lock V1');
    expect(readSource('docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md')).toContain('Task 4.73 Phase 4 Exit Regression Lock');
    expect(docs).toContain('Task 4.74 Phase 5 Handoff Plan V1');
  });

  it('keeps Phase 4 exit boundaries aligned', () => {
    const docs = allDocs();

    for (const expected of [
      'POST /data-health/issues/:issueId/dismiss',
      'POST /history/:id/data-flag',
      'POST /history/:id/edit',
      'POST /sessions/start',
      'localStorage remains source of truth',
      'API results never overwrite AppData or localStorage',
      'No production backend, auth, sync, or deployment is added.',
      'No source-of-truth migration is implemented.',
    ]) {
      expect(docs).toContain(expected);
    }
  });
});
