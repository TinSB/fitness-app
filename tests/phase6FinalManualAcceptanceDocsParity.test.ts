import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const allDocs = () => [
  'API_CONTRACT.md',
  'FULL_STACK_REFACTOR_PLAN.md',
  'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
  'docs/PHASE6_HANDOFF_PLAN.md',
  'docs/PHASE6_FINAL_MANUAL_ACCEPTANCE.md',
].map(readSource).join('\n');

describe('phase 6 final manual acceptance docs parity', () => {
  it('records Task 6.38 across contract, plan, checklist, and handoff docs', () => {
    expect(readSource('API_CONTRACT.md')).toContain('## Task 6.38: Phase 6 Final Manual Acceptance V1');
    expect(readSource('FULL_STACK_REFACTOR_PLAN.md')).toContain('### Task 6.38: Phase 6 Final Manual Acceptance V1');
    expect(readSource('docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md')).toContain('Task 6.38 Phase 6 Final Manual Acceptance');
    expect(readSource('docs/PHASE6_HANDOFF_PLAN.md')).toContain('Task 6.38 Phase 6 Final Manual Acceptance Alignment');
  });

  it('keeps docs aligned on final manual acceptance boundaries', () => {
    const docs = allDocs();

    for (const expected of [
      'Task 6.38 Phase 6 Final Manual Acceptance V1',
      'production readiness scenario matrix',
      'local/dev fallback',
      'source-of-truth checks',
      'auth/account if implemented',
      'sync if implemented',
      'backup/export/delete/recovery',
      'deployment if implemented',
      'rollback',
      'Task 6.39 Phase 6 Exit Regression Lock V1',
    ]) {
      expect(docs.toLowerCase()).toContain(expected.toLowerCase());
    }
  });
});
