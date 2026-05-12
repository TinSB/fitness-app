import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const allDocs = () => [
  'API_CONTRACT.md',
  'FULL_STACK_REFACTOR_PLAN.md',
  'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
  'docs/PHASE6_HANDOFF_PLAN.md',
  'docs/PRODUCTION_MANUAL_ACCEPTANCE_RUNBOOK.md',
].map(readSource).join('\n');

describe('production manual acceptance docs parity', () => {
  it('records Task 6.26 across contract, plan, checklist, and handoff docs', () => {
    expect(readSource('API_CONTRACT.md')).toContain('## Task 6.26: Production Manual Acceptance Runbook V1');
    expect(readSource('FULL_STACK_REFACTOR_PLAN.md')).toContain('### Task 6.26: Production Manual Acceptance Runbook V1');
    expect(readSource('docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md')).toContain('Task 6.26 Production Manual Acceptance Runbook');
    expect(readSource('docs/PHASE6_HANDOFF_PLAN.md')).toContain('Task 6.26 Production Manual Acceptance Alignment');
  });

  it('keeps docs aligned on manual acceptance boundaries', () => {
    const docs = allDocs();

    for (const expected of [
      'Task 6.26 Production Manual Acceptance Runbook V1',
      'dedicated test environment',
      'no real personal data',
      'source-of-truth checks',
      'auth/account if implemented',
      'sync if implemented',
      'backup/export/delete/recovery',
      'rollback checks',
      'Task 6.27 Production Rollback & Incident Runbook V1',
    ]) {
      expect(docs).toContain(expected);
    }
  });

  it('does not instruct production implementation now', () => {
    const docs = allDocs();

    for (const pattern of [
      /deploy production now/i,
      /enable auth runtime now/i,
      /enable sync runtime now/i,
      /switch production source of truth now/i,
      /replace localStorage now/i,
      /use real personal data/i,
    ]) {
      expect(docs).not.toMatch(pattern);
    }
  });
});
