import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const allDocs = () => [
  'API_CONTRACT.md',
  'FULL_STACK_REFACTOR_PLAN.md',
  'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
  'docs/PHASE6_HANDOFF_PLAN.md',
  'docs/PRODUCTION_RELEASE_CANDIDATE_REGRESSION_LOCK.md',
].map(readSource).join('\n');

describe('production release candidate docs parity', () => {
  it('records Task 6.37 across contract, plan, checklist, and handoff docs', () => {
    expect(readSource('API_CONTRACT.md')).toContain('## Task 6.37: Production Release Candidate Regression Lock V1');
    expect(readSource('FULL_STACK_REFACTOR_PLAN.md')).toContain('### Task 6.37: Production Release Candidate Regression Lock V1');
    expect(readSource('docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md')).toContain('Task 6.37 Production Release Candidate Regression Lock');
    expect(readSource('docs/PHASE6_HANDOFF_PLAN.md')).toContain('Task 6.37 Production Release Candidate Regression Lock Alignment');
  });

  it('keeps docs aligned on release candidate boundaries', () => {
    const docs = allDocs();

    for (const expected of [
      'Task 6.37 Production Release Candidate Regression Lock V1',
      'accepted production capabilities',
      'blocked capabilities',
      'source-of-truth rules',
      'auth/sync/deployment status',
      'migration/rollback status',
      'CI/ruleset status',
      'browser build isolation',
      'no unapproved routes',
      'Task 6.38 Phase 6 Final Manual Acceptance V1',
    ]) {
      expect(docs.toLowerCase()).toContain(expected.toLowerCase());
    }
  });
});
