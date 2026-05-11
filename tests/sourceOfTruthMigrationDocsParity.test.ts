import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const allDocs = () => [
  'docs/SOURCE_OF_TRUTH_MIGRATION_ARCHITECTURE_GATE.md',
  'docs/PHASE5_HANDOFF_PLAN.md',
  'docs/PHASE4_COMPLETION_ARCHIVE.md',
  'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
  'API_CONTRACT.md',
  'FULL_STACK_REFACTOR_PLAN.md',
].map(readSource).join('\n');

describe('source-of-truth migration docs parity', () => {
  it('records Task 5.1 across docs and keeps Task 5.2 next', () => {
    expect(readSource('API_CONTRACT.md')).toContain('Task 5.1 Source-of-truth Migration Architecture Gate V1');
    expect(readSource('FULL_STACK_REFACTOR_PLAN.md')).toContain('### Task 5.1: Source-of-truth Migration Architecture Gate V1');
    expect(readSource('docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md')).toContain('Task 5.1 Source-of-truth Migration Architecture Gate');

    const docs = allDocs();
    expect(docs).toContain('Task 5.2 AppData Ownership Matrix V1');
    expect(docs).toContain('docs/SOURCE_OF_TRUTH_MIGRATION_ARCHITECTURE_GATE.md');
  });

  it('keeps Phase 5 entry routes and source-of-truth wording aligned', () => {
    const docs = allDocs();

    for (const expected of [
      'POST /data-health/issues/:issueId/dismiss',
      'POST /history/:id/data-flag',
      'POST /history/:id/edit',
      'POST /sessions/start',
      'localStorage remains source of truth',
      'API results never overwrite AppData',
      'No source-of-truth migration is implemented.',
      'No API-backed runtime is implemented.',
    ]) {
      expect(docs).toContain(expected);
    }
  });

  it('does not instruct forbidden Phase 5 work from Task 5.1', () => {
    const docs = allDocs();

    for (const pattern of [
      /replace localStorage now/i,
      /switch source of truth now/i,
      /enable production backend now/i,
      /enable auth now/i,
      /enable sync now/i,
      /add cloud sync now/i,
      /add normalized tables now/i,
    ]) {
      expect(docs).not.toMatch(pattern);
    }
  });
});

