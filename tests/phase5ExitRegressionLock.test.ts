import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const docPath = 'docs/PHASE5_EXIT_REGRESSION_LOCK.md';

describe('Phase 5 exit regression lock', () => {
  it('exists and contains required sections', () => {
    const doc = readSource(docPath);

    for (const section of [
      '# Phase 5 Exit Regression Lock',
      '## Scope / Non-goals',
      '## Accepted Runtime Modes',
      '## Accepted Browser Mutation Routes',
      '## Blocked Routes And Capabilities',
      '## Source-of-truth Exit Lock',
      '## Fallback Rules',
      '## Migration Rules',
      '## Browser Build Isolation',
      '## Coverage Inventory',
      '## Decision',
      '## Decision Record',
      '## Final Recommendation',
    ]) {
      expect(doc).toContain(section);
    }
  });

  it('locks accepted runtime modes, routes, blocked routes, and source rules', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'localStorage',
      'api-readonly',
      'api-primary-dev',
      'POST /data-health/issues/:issueId/dismiss',
      'POST /history/:id/data-flag',
      'POST /history/:id/edit',
      'POST /sessions/start',
      'POST /sessions/active/patches',
      'POST /sessions/active/complete',
      'POST /sessions/active/discard',
      'POST /data-health/repair/apply',
      'backup/import/export over HTTP',
      'reset/recovery over HTTP',
      'No other browser mutation route is accepted at Phase 5 exit.',
      'No production source-of-truth switch is approved in Phase 5.',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('locks fallback and migration rules and recommends handoff only', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'missing runtime source -> `localStorage`',
      'non-localhost API base URL -> `localStorage`',
      'dry-run is warning-only and no-write',
      'apply is dev-only, backup-first, explicit-confirmation only',
      'rollback/recovery uses injected restore callbacks only',
      'no HTTP reset route exists',
      'Task 5.40 Phase 6 Handoff Plan V1',
      'Task 5.40 must be handoff planning only.',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
