import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const allDocs = () => [
  'API_CONTRACT.md',
  'FULL_STACK_REFACTOR_PLAN.md',
  'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
  'docs/PHASE6_HANDOFF_PLAN.md',
  'docs/PRODUCTION_PHASE_IMPLEMENTATION_BOUNDARY_LOCK.md',
].map(readSource).join('\n');

describe('production phase implementation docs parity', () => {
  it('records Task 6.29 across contract, plan, checklist, and handoff docs', () => {
    expect(readSource('API_CONTRACT.md')).toContain('## Task 6.29: Production Phase Implementation Boundary Lock V1');
    expect(readSource('FULL_STACK_REFACTOR_PLAN.md')).toContain('### Task 6.29: Production Phase Implementation Boundary Lock V1');
    expect(readSource('docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md')).toContain('Task 6.29 Production Phase Implementation Boundary Lock');
    expect(readSource('docs/PHASE6_HANDOFF_PLAN.md')).toContain('Task 6.29 Production Phase Implementation Boundary Alignment');
  });

  it('keeps docs aligned on implementation boundary lock', () => {
    const docs = allDocs();

    for (const expected of [
      'Task 6.29 Production Phase Implementation Boundary Lock V1',
      'accepted capabilities',
      'planned-only capabilities',
      'blocked capabilities',
      'route allowlist',
      'source-of-truth status',
      'auth/sync/deployment status',
      'Task 6.30 Production Release Readiness Checkpoint V1',
    ]) {
      expect(docs.toLowerCase()).toContain(expected.toLowerCase());
    }
  });
});
