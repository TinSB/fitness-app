import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readSource, repoRoot } from './runtimeBoundaryTestHelpers';

const planPath = 'docs/LIMITED_HISTORY_EDIT_MUTATION_PROTOTYPE_PLAN.md';

const readPlan = () => readSource(planPath);

const requiredSections = [
  '## Scope / Non-goals',
  '## Current Two-route Baseline',
  '## Future Candidate Route Boundary',
  '## Field-Level Constraints',
  '## Rejected Broad History Edit',
  '## Data Semantics and Calculation Impact',
  '## ReadMirror and History Surface Impact',
  '## Request Metadata Plan',
  '## Confirmation UX Plan',
  '## Pending / Success / Failure UX Plan',
  '## Audit Trail Before/After Plan',
  '## Rollback Plan',
  '## Manual Acceptance Plan',
  '## Route Boundary and Source-of-truth Gates',
  '## Prototype Gate Checklist',
  '## Decision Record',
  '## Final Recommendation',
];

describe('limited history edit mutation prototype plan', () => {
  it('exists and contains all required sections', () => {
    expect(existsSync(resolve(repoRoot(), planPath))).toBe(true);
    const plan = readPlan();

    for (const section of requiredSections) {
      expect(plan).toContain(section);
    }
  });

  it('states the planning-only and no-runtime boundaries', () => {
    const plan = readPlan();

    for (const expected of [
      'This is Limited History Edit Mutation Prototype Plan V1.',
      'This is planning-only.',
      'This is not implementation.',
      'This does not implement `POST /history/:id/edit`.',
      'This does not add `POST /history/:id/edit` to the App.',
      'This does not add a third browser mutation route.',
      'This does not expand the current browser mutation allowlist.',
      'This does not modify App.tsx.',
      'This does not modify src/devApi runtime behavior.',
      'This does not add a frontend mutation client.',
      'This does not add mutation feature flag runtime wiring.',
      'This does not replace localStorage.',
      'This does not switch source of truth.',
      'This does not add production backend, auth, sync, or deployment.',
      'This does not add a dependency, lockfile change, or package script.',
      'There are no UI writes to API.',
      'Write-path migration remains blocked beyond the existing two dev-only prototypes.',
    ]) {
      expect(plan).toContain(expected);
    }
  });

  it('keeps the current two-route baseline and treats history edit as a future candidate only', () => {
    const plan = readPlan();

    for (const expected of [
      '`POST /data-health/issues/:issueId/dismiss`',
      '`POST /history/:id/data-flag`',
      'No third browser mutation route is accepted.',
      'localStorage remains source of truth.',
      'API results never overwrite AppData or localStorage.',
      'Read-only diagnostics remain GET-only.',
      'Future candidate route:',
      '`POST /history/:id/edit`',
      'Task 4.44 does not add this browser request.',
      'single-route, dev-only, explicit opt-in prototype',
    ]) {
      expect(plan).toContain(expected);
    }
  });

  it('documents impact, request metadata, confirmation, no-fake-success, audit, rollback, and manual acceptance gates', () => {
    const plan = readPlan();

    for (const expected of [
      'PR/e1RM/effectiveSet impact warning',
      'actualWeightKg remains the trusted calculation source',
      'readMirror history list item',
      'readMirror history detail',
      '`mutationId`',
      '`idempotencyKey`',
      '`requestFingerprint`',
      '`sourceSnapshotHash` or `sourceSnapshotVersion`',
      '`confirmed: true`',
      'cancel action that sends no request',
      'does not optimistically update localStorage',
      'requires snapshot metadata',
      'no fake success',
      'missing snapshot metadata',
      'source snapshot mismatch',
      'before summary',
      'after summary',
      'affected stats',
      'no direct editHistory patching from browser code',
      'disable the future mutation experiment flag',
      'dedicated test browser profile',
      'DevTools Network shows only `POST /history/:id/edit`',
    ]) {
      expect(plan).toContain(expected);
    }
  });

  it('does not recommend automatic implementation after Task 4.44', () => {
    const plan = readPlan();

    expect(plan).toContain('Next task: none automatic.');
    expect(plan).toContain('A future implementation task remains blocked until a later user-approved single-route prototype task explicitly defines implementation files, gates, validation, and rollback.');
    expect(plan).toContain('Do not implement a third mutation automatically after Task 4.44.');
    expect(plan).toContain('Task 4.44 result: Plan only.');
    expect(plan).toContain('No third mutation is implemented.');
    expect(plan).toContain('`POST /history/:id/edit` remains blocked from browser runtime.');
    expect(plan).not.toMatch(/implement history edit now/i);
    expect(plan).not.toMatch(/connect POST \/history\/:id\/edit to App now/i);
    expect(plan).not.toMatch(/enable third mutation route now/i);
  });
});
