import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const docPath = 'docs/PHASE5_FINAL_SOURCE_OF_TRUTH_AUDIT.md';

describe('Phase 5 final source-of-truth audit', () => {
  it('exists and contains the required audit sections', () => {
    const doc = readSource(docPath);

    for (const section of [
      '# Phase 5 Final Source-of-truth Audit',
      '## Scope / Non-goals',
      '## Phase 5 Runtime Source Status',
      '## API Primary Dev Mode Status',
      '## LocalStorage Fallback Status',
      '## Migration Status',
      '## Accepted Browser Mutation Routes',
      '## Blocked Routes And Capabilities',
      '## Source-of-truth Risk Register',
      '## Manual Acceptance Inputs',
      '## Browser Build Isolation',
      '## Decision',
      '## Decision Record',
      '## Final Recommendation',
    ]) {
      expect(doc).toContain(section);
    }
  });

  it('clarifies API primary dev mode, localStorage fallback, migration rollback, and production status', () => {
    const doc = readSource(docPath);

    for (const expected of [
      '`localStorage` remains the default runtime source',
      '`api-primary-dev` remains explicit dev/local opt-in only',
      'not production-ready',
      'localStorage remains:',
      'fallback source',
      'migration source',
      'rollback source',
      'rollback/recovery requires backup metadata and explicit confirmation',
      'no HTTP migration, reset, or recovery route exists',
      'Task 5.38 Phase 5 Final Manual Acceptance V1',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('locks routes, blocked capabilities, and manual acceptance inputs', () => {
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
      'backup/import/export over HTTP',
      'reset/recovery over HTTP',
      'dedicated test browser profile',
      'dedicated dev DB',
      'no real personal training data',
      'node:http',
      'node:sqlite',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
