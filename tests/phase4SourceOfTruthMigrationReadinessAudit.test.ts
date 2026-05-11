import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const docPath = 'docs/PHASE4_SOURCE_OF_TRUTH_MIGRATION_READINESS_AUDIT.md';

describe('Phase 4 source-of-truth migration readiness audit', () => {
  it('exists and contains the required audit sections', () => {
    const doc = readSource(docPath);

    for (const section of [
      '## Scope / Non-goals',
      '## Current Phase 4 Baseline',
      '## Readiness Finding',
      '## Required Gates Before Migration',
      '## Source-of-truth Risks',
      '## Decision',
      '## Decision Record',
      '## Final Recommendation',
    ]) {
      expect(doc).toContain(section);
    }
  });

  it('states migration is not ready and keeps localStorage as source of truth', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'Phase 4 is not ready to switch source of truth.',
      'localStorage remains source of truth',
      'API results never overwrite AppData or localStorage',
      'No API-backed runtime is implemented.',
      'No production backend, auth, sync, or deployment is added.',
      'Phase 5 is required before any source-of-truth migration implementation.',
      'Do not implement source-of-truth migration in Phase 4.',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('locks accepted routes and recommends Task 4.70 as planning-only', () => {
    const doc = readSource(docPath);

    for (const route of [
      'POST /data-health/issues/:issueId/dismiss',
      'POST /history/:id/data-flag',
      'POST /history/:id/edit',
      'POST /sessions/start',
    ]) {
      expect(doc).toContain(route);
    }

    expect(doc).toContain('Task 4.70 API-backed Runtime Strategy Plan V1');
    expect(doc).toContain('Task 4.70 must be planning-only.');
    expect(doc).not.toMatch(/switch source of truth now/i);
    expect(doc).not.toMatch(/replace localStorage now/i);
  });
});
