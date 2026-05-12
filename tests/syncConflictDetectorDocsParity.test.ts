import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const allDocs = () => [
  'API_CONTRACT.md',
  'FULL_STACK_REFACTOR_PLAN.md',
  'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
  'docs/CLOUD_SYNC_MODEL_PLAN.md',
  'docs/PHASE6_HANDOFF_PLAN.md',
  'docs/SYNC_METADATA_CONFLICT_DETECTOR_PROTOTYPE.md',
].map(readSource).join('\n');

describe('sync conflict detector docs parity', () => {
  it('records Task 6.19 across contract, plan, checklist, sync model, and handoff docs', () => {
    expect(readSource('API_CONTRACT.md')).toContain('## Task 6.19: Sync Metadata & Conflict Detector Prototype V1');
    expect(readSource('FULL_STACK_REFACTOR_PLAN.md')).toContain('### Task 6.19: Sync Metadata & Conflict Detector Prototype V1');
    expect(readSource('docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md')).toContain('Task 6.19 Sync Metadata Conflict Detector Prototype');
    expect(readSource('docs/CLOUD_SYNC_MODEL_PLAN.md')).toContain('Task 6.19 Follow-up');
    expect(readSource('docs/PHASE6_HANDOFF_PLAN.md')).toContain('Task 6.19 Sync Metadata Conflict Detector Alignment');
  });

  it('keeps docs aligned on pure conflict detector boundaries', () => {
    const docs = allDocs();

    for (const expected of [
      'Task 6.19 Sync Metadata & Conflict Detector Prototype V1',
      'pure local sync metadata',
      'conflict detector prototype',
      'idempotency',
      'no sync runtime',
      'no network calls',
      'no cloud writes',
      'Task 6.20 Sync Conflict Acceptance V1',
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
