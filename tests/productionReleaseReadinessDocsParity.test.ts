import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const allDocs = () => [
  'API_CONTRACT.md',
  'FULL_STACK_REFACTOR_PLAN.md',
  'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
  'docs/PHASE6_HANDOFF_PLAN.md',
  'docs/PRODUCTION_RELEASE_READINESS_CHECKPOINT.md',
].map(readSource).join('\n');

describe('production release readiness docs parity', () => {
  it('records Task 6.30 across contract, plan, checklist, and handoff docs', () => {
    expect(readSource('API_CONTRACT.md')).toContain('## Task 6.30: Production Release Readiness Checkpoint V1');
    expect(readSource('FULL_STACK_REFACTOR_PLAN.md')).toContain('### Task 6.30: Production Release Readiness Checkpoint V1');
    expect(readSource('docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md')).toContain('Task 6.30 Production Release Readiness Checkpoint');
    expect(readSource('docs/PHASE6_HANDOFF_PLAN.md')).toContain('Task 6.30 Production Release Readiness Alignment');
  });

  it('keeps docs aligned on release readiness checkpoint status', () => {
    const docs = allDocs();

    for (const expected of [
      'Task 6.30 Production Release Readiness Checkpoint V1',
      'implemented production capabilities',
      'still blocked production capabilities',
      'auth/account status',
      'backend status',
      'sync status',
      'deployment status',
      'source-of-truth status',
      'Task 6.31 Production Manual Acceptance Runbook V1',
    ]) {
      expect(docs.toLowerCase()).toContain(expected.toLowerCase());
    }
  });
});
