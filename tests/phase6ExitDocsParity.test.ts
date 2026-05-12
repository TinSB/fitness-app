import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const allDocs = () => [
  'API_CONTRACT.md',
  'FULL_STACK_REFACTOR_PLAN.md',
  'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
  'docs/PHASE6_HANDOFF_PLAN.md',
  'docs/PHASE6_EXIT_REGRESSION_LOCK.md',
].map(readSource).join('\n');

describe('phase 6 exit docs parity', () => {
  it('records Task 6.39 across contract, plan, checklist, and handoff docs', () => {
    expect(readSource('API_CONTRACT.md')).toContain('## Task 6.39: Phase 6 Exit Regression Lock V1');
    expect(readSource('FULL_STACK_REFACTOR_PLAN.md')).toContain('### Task 6.39: Phase 6 Exit Regression Lock V1');
    expect(readSource('docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md')).toContain('Task 6.39 Phase 6 Exit Regression Lock');
    expect(readSource('docs/PHASE6_HANDOFF_PLAN.md')).toContain('Task 6.39 Phase 6 Exit Regression Lock Alignment');
  });

  it('keeps docs aligned on exit lock boundaries', () => {
    const docs = allDocs();

    for (const expected of [
      'Task 6.39 Phase 6 Exit Regression Lock V1',
      'final Phase 6 accepted capabilities',
      'final blocked capabilities',
      'final source-of-truth status',
      'final auth/sync/deployment status',
      'final migration/rollback status',
      'final route allowlist',
      'final CI/ruleset policy',
      'no Phase 7 auto-start',
      'Task 6.40 Phase 6 Completion Archive V1',
    ]) {
      expect(docs.toLowerCase()).toContain(expected.toLowerCase());
    }
  });
});
