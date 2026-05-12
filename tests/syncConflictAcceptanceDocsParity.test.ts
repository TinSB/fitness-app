import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const allDocs = () => [
  'API_CONTRACT.md',
  'FULL_STACK_REFACTOR_PLAN.md',
  'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
  'docs/SYNC_METADATA_CONFLICT_DETECTOR_PROTOTYPE.md',
  'docs/PHASE6_HANDOFF_PLAN.md',
  'docs/SYNC_CONFLICT_ACCEPTANCE.md',
].map(readSource).join('\n');

describe('sync conflict acceptance docs parity', () => {
  it('records Task 6.20 across contract, plan, checklist, detector doc, and handoff docs', () => {
    expect(readSource('API_CONTRACT.md')).toContain('## Task 6.20: Sync Conflict Acceptance V1');
    expect(readSource('FULL_STACK_REFACTOR_PLAN.md')).toContain('### Task 6.20: Sync Conflict Acceptance V1');
    expect(readSource('docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md')).toContain('Task 6.20 Sync Conflict Acceptance');
    expect(readSource('docs/SYNC_METADATA_CONFLICT_DETECTOR_PROTOTYPE.md')).toContain('Task 6.20 Follow-up');
    expect(readSource('docs/PHASE6_HANDOFF_PLAN.md')).toContain('Task 6.20 Sync Conflict Acceptance Alignment');
  });

  it('keeps docs aligned on sync conflict acceptance boundaries', () => {
    const docs = allDocs();

    for (const expected of [
      'Task 6.20 Sync Conflict Acceptance V1',
      'docs/static tests only',
      'no auto-merge',
      'no remote writes',
      'no sync runtime',
      'user-visible conflict policy',
      'Task 6.21 Production Environment Config Boundary V1',
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
      /auto-merge conflicts now/i,
      /switch production source of truth now/i,
      /replace localStorage now/i,
      /use real personal data/i,
    ]) {
      expect(docs).not.toMatch(pattern);
    }
  });
});
