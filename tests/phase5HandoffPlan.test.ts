import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const docPath = 'docs/PHASE5_HANDOFF_PLAN.md';

describe('Phase 5 handoff plan', () => {
  it('exists and contains required sections', () => {
    const doc = readSource(docPath);

    for (const section of [
      '## Scope / Non-goals',
      '## Phase 4 Final State',
      '## Source-of-truth Migration Prerequisites',
      '## API-backed Runtime Prerequisites',
      '## Production / Auth / Sync Prerequisites',
      '## Risk Register',
      '## Recommended Phase 5 First Task',
      '## Decision Record',
      '## Final Recommendation',
    ]) {
      expect(doc).toContain(section);
    }
  });

  it('records Phase 4 final state and Phase 5 prerequisites', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'POST /data-health/issues/:issueId/dismiss',
      'POST /history/:id/data-flag',
      'POST /history/:id/edit',
      'POST /sessions/start',
      'localStorage remains source of truth',
      'source snapshot and checksum strategy approved',
      'read client architecture approved',
      'production environment ownership defined',
      'authentication model designed',
      'sync model designed',
      'Task 5.1 Source-of-truth Migration Architecture Gate V1',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('states no implementation and recommends Task 4.75 next', () => {
    const doc = readSource(docPath);

    expect(doc).toContain('This does not start Phase 5 implementation.');
    expect(doc).toContain('Do not start Phase 5 automatically.');
    expect(doc).toContain('Task 4.75 Phase 4 Completion & Archive V1');
    expect(doc).not.toMatch(/implement Phase 5 now/i);
    expect(doc).not.toMatch(/replace localStorage now/i);
  });
});
