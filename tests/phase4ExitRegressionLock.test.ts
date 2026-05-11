import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const docPath = 'docs/PHASE4_EXIT_REGRESSION_LOCK.md';

describe('Phase 4 exit regression lock', () => {
  it('exists and contains required sections', () => {
    const doc = readSource(docPath);

    for (const section of [
      '## Scope / Non-goals',
      '## Final Accepted Browser Mutation Routes',
      '## Final Blocked Routes',
      '## Source-of-truth Exit Lock',
      '## Browser Build Isolation',
      '## Coverage Inventory',
      '## Decision',
      '## Decision Record',
      '## Final Recommendation',
    ]) {
      expect(doc).toContain(section);
    }
  });

  it('locks final accepted routes, blocked routes, and source of truth', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'POST /data-health/issues/:issueId/dismiss',
      'POST /history/:id/data-flag',
      'POST /history/:id/edit',
      'POST /sessions/start',
      'POST /sessions/active/patches',
      'POST /sessions/active/complete',
      'POST /sessions/active/discard',
      'POST /data-health/repair/apply',
      'No other browser mutation route is accepted at Phase 4 exit.',
      'localStorage remains current source of truth',
      'API results do not overwrite AppData',
      'No source-of-truth switch is approved in Phase 4',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('recommends Phase 5 handoff only', () => {
    const doc = readSource(docPath);

    expect(doc).toContain('Task 4.74 Phase 5 Handoff Plan V1');
    expect(doc).toContain('Task 4.74 must be handoff planning only.');
    expect(doc).toContain('Do not start Phase 5 implementation from this task.');
    expect(doc).not.toMatch(/implement Phase 5 now/i);
  });
});
