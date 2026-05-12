import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('session discard mutation prototype plan', () => {
  it('exists and contains required planning sections', () => {
    const text = readSource('docs/SESSION_DISCARD_MUTATION_PROTOTYPE_PLAN.md');

    for (const expected of [
      '# Session Discard Mutation Prototype Plan',
      '## Future Route',
      '## Future Flag Boundary',
      '## Request Shape',
      '## Unsaved Training State Risk',
      '## Strong Confirmation',
      '## Visible Recovery Policy',
      '## No History Write',
      '## Source Snapshot And Idempotency',
      '## Duplicate Discard Prevention',
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

  it('plans only POST /sessions/active/discard and keeps implementation blocked', () => {
    const text = readSource('docs/SESSION_DISCARD_MUTATION_PROTOTYPE_PLAN.md');

    for (const expected of [
      'Task 5.19 plans a future dev-only browser prototype',
      '`POST /sessions/active/discard`',
      'VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT === "session-discard"',
      'discard can lose unsaved training state',
      'strong confirmation',
      'visible failure',
      'no history write',
      'sourceSnapshotHash',
      'sourceSnapshotVersion',
      'mutationId',
      'idempotencyKey',
      'requestFingerprint',
      'duplicate-submit lock',
      'no fake success',
      'localStorage remains source of truth',
      'API results never overwrite AppData or localStorage',
      'Task 5.20 Session Discard Mutation Prototype V1',
    ]) {
      expect(text.toLowerCase()).toContain(expected.toLowerCase());
    }

    expect(text).toContain('This is planning-only.');
    expect(text).toContain('It does not implement `POST /sessions/active/discard`');
    expect(text).not.toMatch(/implement `?POST \/sessions\/active\/discard`? now/i);
  });

  it('keeps source-of-truth and production boundaries explicit', () => {
    const text = readSource('docs/SESSION_DISCARD_MUTATION_PROTOTYPE_PLAN.md');

    for (const expected of [
      'no App.tsx mount',
      'no `src/devApi` runtime change',
      'no session patch route change',
      'no session complete route change',
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
