import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const allDocs = () => [
  'API_CONTRACT.md',
  'FULL_STACK_REFACTOR_PLAN.md',
  'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
  'docs/PRODUCTION_STORAGE_BACKUP_RESTORE_ACCEPTANCE.md',
  'docs/PHASE6_HANDOFF_PLAN.md',
  'docs/CLOUD_SYNC_MODEL_PLAN.md',
].map(readSource).join('\n');

describe('cloud sync model docs parity', () => {
  it('records Task 6.18 across contract, plan, checklist, backup/restore, and handoff docs', () => {
    expect(readSource('API_CONTRACT.md')).toContain('## Task 6.18: Cloud Sync Model Plan V1');
    expect(readSource('FULL_STACK_REFACTOR_PLAN.md')).toContain('### Task 6.18: Cloud Sync Model Plan V1');
    expect(readSource('docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md')).toContain('Task 6.18 Cloud Sync Model Plan');
    expect(readSource('docs/PRODUCTION_STORAGE_BACKUP_RESTORE_ACCEPTANCE.md')).toContain('Task 6.18 Follow-up');
    expect(readSource('docs/PHASE6_HANDOFF_PLAN.md')).toContain('Task 6.18 Cloud Sync Model Alignment');
  });

  it('keeps docs aligned on sync model planning boundaries', () => {
    const docs = allDocs();

    for (const expected of [
      'Task 6.18 Cloud Sync Model Plan V1',
      'docs/static tests only',
      'sync model',
      'device identity',
      'conflict policy',
      'idempotency',
      'no sync runtime',
      'Task 6.19 Sync Metadata & Conflict Detector Prototype V1',
    ]) {
      expect(docs).toContain(expected);
    }
  });

  it('does not instruct sync runtime implementation now', () => {
    const docs = allDocs();

    for (const pattern of [
      /implement sync runtime now/i,
      /write to cloud now/i,
      /start background sync now/i,
      /enable remote queue now/i,
      /switch production source of truth now/i,
      /replace localStorage now/i,
      /use real personal data/i,
    ]) {
      expect(docs).not.toMatch(pattern);
    }
  });
});
