import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readSource, repoRoot } from './runtimeBoundaryTestHelpers';

const docPath = 'docs/SESSION_PATCH_MUTATION_PROTOTYPE_PLAN.md';

describe('session patch mutation prototype plan', () => {
  it('exists and contains required sections', () => {
    expect(existsSync(resolve(repoRoot(), docPath))).toBe(true);
    const doc = readSource(docPath);

    for (const section of [
      '## Scope / Non-goals',
      '## Future Route',
      '## Future Opt-in Boundary',
      '## Patch Ordering Risk',
      '## Stale Step and Set Risk',
      '## Duplicate Patch Risk',
      '## Partial Update Risk',
      '## Current Set Corruption Risk',
      '## Request Payload Plan',
      '## No-fake-success Rules',
      '## Manual Acceptance Plan',
      '## Still Blocked',
      '## Decision',
      '## Decision Record',
      '## Final Recommendation',
    ]) {
      expect(doc).toContain(section);
    }
  });

  it('plans the exact future route and required payload metadata', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'POST /sessions/active/patches',
      'VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT === "session-patch"',
      'sourceSnapshotHash',
      'sourceSnapshotVersion',
      'mutationId',
      'idempotencyKey',
      'requestFingerprint',
      'activeSessionId',
      'pendingPatchId',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('covers patch ordering, stale step, duplicate patch, partial update, and current set corruption', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'Patch ordering must be explicit',
      'Stale step/set updates',
      'Duplicate submit must be blocked while pending.',
      'Partial update must not silently succeed.',
      'Current set, rest timer, focus mode, and active workout state are high risk.',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('states no implementation and keeps source-of-truth boundaries', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'This is planning-only.',
      'The route is not exposed from browser runtime by Task 5.13.',
      'localStorage remains source of truth',
      'API results never overwrite AppData or localStorage',
      'No session patch browser route is implemented.',
      'Task 5.14 Session Patch Mutation Prototype V1',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
