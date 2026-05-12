import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const allDocs = () => [
  'API_CONTRACT.md',
  'FULL_STACK_REFACTOR_PLAN.md',
  'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
  'docs/PHASE5_EXIT_REGRESSION_LOCK.md',
].map(readSource).join('\n');

describe('Phase 5 exit docs parity', () => {
  it('records Task 5.39 across contract, plan, checklist, and lock docs', () => {
    const docs = allDocs();

    expect(readSource('API_CONTRACT.md')).toContain('Task 5.39 Phase 5 Exit Regression Lock V1');
    expect(readSource('FULL_STACK_REFACTOR_PLAN.md')).toContain('### Task 5.39: Phase 5 Exit Regression Lock V1');
    expect(readSource('docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md')).toContain('Task 5.39 Phase 5 Exit Regression Lock');
    expect(docs).toContain('Task 5.40 Phase 6 Handoff Plan V1');
  });

  it('keeps Phase 5 exit boundaries aligned', () => {
    const docs = allDocs();

    for (const expected of [
      'localStorage',
      'api-readonly',
      'api-primary-dev',
      'POST /data-health/issues/:issueId/dismiss',
      'POST /history/:id/data-flag',
      'POST /history/:id/edit',
      'POST /sessions/start',
      'POST /sessions/active/patches',
      'POST /sessions/active/complete',
      'POST /sessions/active/discard',
      'localStorage remains default runtime source',
      'No production backend',
      'No other browser mutation route is accepted at Phase 5 exit.',
    ]) {
      expect(docs).toContain(expected);
    }
  });

  it('does not instruct production, auth, sync, deployment, or Phase 6 implementation', () => {
    const docs = allDocs();

    for (const pattern of [
      /implement Phase 6 now/i,
      /make API primary production default now/i,
      /delete localStorage now/i,
      /enable production backend now/i,
      /enable auth now/i,
      /enable sync now/i,
      /enable deployment now/i,
      /enable eighth browser mutation route/i,
    ]) {
      expect(docs).not.toMatch(pattern);
    }
  });
});
