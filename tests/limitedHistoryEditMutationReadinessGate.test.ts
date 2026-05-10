import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readSource, repoRoot } from './runtimeBoundaryTestHelpers';

const gatePath = 'docs/LIMITED_HISTORY_EDIT_MUTATION_READINESS_GATE.md';
const gate = () => readSource(gatePath);

const requiredSections = [
  '## Scope / Non-goals',
  '## Current Baseline',
  '## Gate Summary',
  '## Field Constraint Gate',
  '## Server Contract Gate',
  '## Source Snapshot / Conflict Gate',
  '## No-fake-success Gate',
  '## Calculation Impact Gate',
  '## Audit Trail / Before-after Gate',
  '## UX / Confirmation Gate',
  '## Manual Acceptance Gate',
  '## Risk Gate',
  '## Decision',
  '## Rejected Alternatives',
  '## Final Recommendation',
];

describe('limited history edit mutation readiness gate', () => {
  it('exists and contains all required readiness sections', () => {
    expect(existsSync(resolve(repoRoot(), gatePath))).toBe(true);
    const doc = gate();

    for (const section of requiredSections) {
      expect(doc).toContain(section);
    }
  });

  it('states the gate-only no-runtime boundaries', () => {
    const doc = gate();

    for (const expected of [
      'This is a limited history edit readiness gate.',
      'This is not implementation.',
      'This does not implement `POST /history/:id/edit`.',
      'This does not add `POST /history/:id/edit` to the App.',
      'This does not add a third browser mutation route.',
      'This does not modify App.tsx.',
      'This does not modify src/devApi runtime behavior.',
      'This does not add App.tsx mutation integration.',
      'This does not add UI writes to API.',
      'This does not add a frontend mutation client.',
      'This does not replace localStorage.',
      'This does not switch source of truth.',
      'This does not add production backend, auth, sync, or deployment.',
      'This does not add a dependency, lockfile change, or package script.',
      'Write-path migration remains limited to the two accepted dev-only prototypes.',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('keeps the current baseline and source-of-truth boundaries explicit', () => {
    const doc = gate();

    for (const expected of [
      'DataHealth dismiss remains implemented and locked',
      'History data-flag remains implemented and locked',
      'Limited history edit is plan-only from Task 4.44.',
      '`POST /data-health/issues/:issueId/dismiss`',
      '`POST /history/:id/data-flag`',
      'localStorage remains source of truth.',
      'API results never overwrite AppData or localStorage.',
      'Read-only Dev API client remains GET-only.',
      'No session mutation route is exposed from browser code.',
      'No history edit route is exposed from browser code.',
      'No DataHealth repair route is exposed from browser code.',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('states the readiness result and blocks automatic Task 4.46 implementation', () => {
    const doc = gate();

    for (const expected of [
      'Ready for implementation task',
      'Ready with blockers',
      'Not ready',
      'Task 4.45 result: Ready with blockers, not direct implementation.',
      'Task 4.45 result: Ready for a user-approved implementation prompt, but not direct implementation.',
      'Task 4.45 result: Readiness gate only.',
      'Task 4.46 Limited History Edit Mutation Prototype V1 may be created only after explicit user approval.',
      'Task 4.46 requires explicit user approval and must not auto-start.',
      'Do not auto-start Task 4.46.',
    ]) {
      expect(doc).toContain(expected);
    }

    expect(doc).not.toMatch(/implement history edit now/i);
    expect(doc).not.toMatch(/connect POST \/history\/:id\/edit to App now/i);
    expect(doc).not.toMatch(/enable third mutation route now/i);
  });
});
