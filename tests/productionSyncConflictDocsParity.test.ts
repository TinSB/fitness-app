import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const allDocs = () => [
  'API_CONTRACT.md',
  'FULL_STACK_REFACTOR_PLAN.md',
  'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
  'docs/PHASE6_HANDOFF_PLAN.md',
  'docs/PRODUCTION_SYNC_CONFLICT_FINAL_AUDIT.md',
].map(readSource).join('\n');

describe('production sync conflict docs parity', () => {
  it('records Task 6.34 across contract, plan, checklist, and handoff docs', () => {
    expect(readSource('API_CONTRACT.md')).toContain('## Task 6.34: Production Sync / Conflict Final Audit V1');
    expect(readSource('FULL_STACK_REFACTOR_PLAN.md')).toContain('### Task 6.34: Production Sync / Conflict Final Audit V1');
    expect(readSource('docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md')).toContain('Task 6.34 Production Sync Conflict Final Audit');
    expect(readSource('docs/PHASE6_HANDOFF_PLAN.md')).toContain('Task 6.34 Production Sync Conflict Final Audit Alignment');
  });

  it('keeps docs aligned on sync conflict final audit boundaries', () => {
    const docs = allDocs();

    for (const expected of [
      'Task 6.34 Production Sync / Conflict Final Audit V1',
      'no sync runtime',
      'sync scope if implemented',
      'conflict model',
      'idempotency',
      'duplicate cloud write prevention',
      'offline behavior',
      'source-of-truth rules',
      'rollback',
      'Task 6.35 Production Deployment & Environment Final Audit V1',
    ]) {
      expect(docs.toLowerCase()).toContain(expected.toLowerCase());
    }
  });

  it('does not instruct sync or production implementation now', () => {
    const docs = allDocs();

    for (const pattern of [
      /deploy production now/i,
      /enable auth runtime now/i,
      /enable sync runtime now/i,
      /start cloud writes now/i,
      /switch production source of truth now/i,
      /replace localStorage now/i,
      /use real personal data/i,
      /create remote write queue now/i,
    ]) {
      expect(docs).not.toMatch(pattern);
    }
  });
});
