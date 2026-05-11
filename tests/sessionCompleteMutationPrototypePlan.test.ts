import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('session complete mutation prototype plan', () => {
  it('exists and contains required planning sections', () => {
    const text = readSource('docs/SESSION_COMPLETE_MUTATION_PROTOTYPE_PLAN.md');

    for (const expected of [
      '# Session Complete Mutation Prototype Plan',
      '## Future Route',
      '## Future Flag Boundary',
      '## Request Shape',
      '## Duplicate Complete Risk',
      '## Active Session Missing Risk',
      '## History Duplicate Risk',
      '## Source Snapshot Mismatch',
      '## Failure Recovery',
      '## No-fake-success Rules',
      '## Manual Acceptance Plan',
      '## Explicit Non-goals',
      '## Decision',
      '## Decision Record',
      '## Final Recommendation',
    ]) {
      expect(text).toContain(expected);
    }
  });

  it('plans only POST /sessions/active/complete and keeps implementation blocked', () => {
    const text = readSource('docs/SESSION_COMPLETE_MUTATION_PROTOTYPE_PLAN.md');

    for (const expected of [
      'Task 5.16 plans a future dev-only browser prototype',
      '`POST /sessions/active/complete`',
      'VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT === "session-complete"',
      'duplicate-submit lock',
      'sourceSnapshotHash',
      'sourceSnapshotVersion',
      'mutationId',
      'idempotencyKey',
      'requestFingerprint',
      'confirmIncompleteMainWork',
      'no active session',
      'history duplicate',
      'visible failure',
      'no fake success',
      'Task 5.17 Session Complete Mutation Prototype V1',
    ]) {
      expect(text.toLowerCase()).toContain(expected.toLowerCase());
    }

    expect(text).toContain('This is planning-only.');
    expect(text).toContain('It does not implement `POST /sessions/active/complete`');
    expect(text).not.toMatch(/implement `?POST \/sessions\/active\/complete`? now/i);
  });

  it('keeps source-of-truth and production boundaries explicit', () => {
    const text = readSource('docs/SESSION_COMPLETE_MUTATION_PROTOTYPE_PLAN.md');

    for (const expected of [
      'localStorage remains source of truth',
      'API results never overwrite AppData or localStorage',
      'no App.tsx mount',
      'no `src/devApi` runtime change',
      'no session discard route',
      'no DataHealth repair',
      'no backup/import/export/reset/recovery HTTP route',
      'no source-of-truth migration',
      'no API primary runtime',
      'no localStorage replacement',
      'no broad mutation client',
      'no production backend/auth/sync/cloud/deployment',
    ]) {
      expect(text).toContain(expected);
    }
  });
});
