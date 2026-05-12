import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const allDocs = () => [
  'API_CONTRACT.md',
  'FULL_STACK_REFACTOR_PLAN.md',
  'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
  'docs/PHASE6_HANDOFF_PLAN.md',
  'docs/PRODUCTION_DATA_EXPORT_DELETE_PLAN.md',
].map(readSource).join('\n');

describe('production data export delete docs parity', () => {
  it('records Task 6.28 across contract, plan, checklist, and handoff docs', () => {
    expect(readSource('API_CONTRACT.md')).toContain('## Task 6.28: Production Data Export / Delete Plan V1');
    expect(readSource('FULL_STACK_REFACTOR_PLAN.md')).toContain('### Task 6.28: Production Data Export / Delete Plan V1');
    expect(readSource('docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md')).toContain('Task 6.28 Production Data Export Delete Plan');
    expect(readSource('docs/PHASE6_HANDOFF_PLAN.md')).toContain('Task 6.28 Production Data Export Delete Alignment');
  });

  it('keeps docs aligned on export/delete planning boundaries', () => {
    const docs = allDocs();

    for (const expected of [
      'Task 6.28 Production Data Export / Delete Plan V1',
      'export',
      'delete',
      'account deletion',
      'backup retention',
      'audit record retention',
      'no implementation',
      'Task 6.29 Production Phase Implementation Boundary Lock V1',
    ]) {
      expect(docs.toLowerCase()).toContain(expected.toLowerCase());
    }
  });

  it('does not instruct export/delete runtime now', () => {
    const docs = allDocs();

    for (const pattern of [
      /enable export runtime now/i,
      /enable delete runtime now/i,
      /delete account data now/i,
      /enable backup export route now/i,
      /switch production source of truth now/i,
      /replace localStorage now/i,
      /use real personal data/i,
    ]) {
      expect(docs).not.toMatch(pattern);
    }
  });
});
