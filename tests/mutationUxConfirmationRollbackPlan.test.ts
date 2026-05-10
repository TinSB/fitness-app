import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readSource, repoRoot } from './runtimeBoundaryTestHelpers';

const planPath = 'docs/MUTATION_UX_CONFIRMATION_ROLLBACK_PLAN.md';

const readPlan = () => readSource(planPath);

const requiredSections = [
  '## Scope / Non-goals',
  '## Current Baseline',
  '## Mutation UX Principles',
  '## Confirmation Levels',
  '## Pending State UX',
  '## Success State UX',
  '## Failure State UX',
  '## Rollback UX',
  '## Duplicate-submit Prevention',
  '## Conflict UX',
  '## Mutation Category UX Matrix',
  '## First Prototype Recommendation',
  '## Required Gates Before Mutation Prototype',
  '## Decision Record',
  '## Final Recommendation',
];

describe('mutation UX confirmation and rollback plan', () => {
  it('exists and includes all required sections', () => {
    expect(existsSync(resolve(repoRoot(), planPath))).toBe(true);
    const plan = readPlan();

    for (const section of requiredSections) {
      expect(plan).toContain(section);
    }
  });

  it('states mutation implementation boundaries remain blocked', () => {
    const plan = readPlan();

    expect(plan).toContain('There is no App.tsx mutation integration.');
    expect(plan).toContain('There are no UI writes to API.');
    expect(plan).toContain('There is no frontend mutation client.');
    expect(plan).toContain('There is no mutation feature flag.');
    expect(plan).toContain('There is no localStorage replacement.');
    expect(plan).toContain('There is no source-of-truth switch.');
    expect(plan).toContain('There is no production backend.');
    expect(plan).toContain('There is no auth, sync, or deployment.');
    expect(plan).toContain('There is no package dependency or package script.');
    expect(plan).toContain('Write-path migration remains blocked.');
  });

  it('documents confirmation levels and mutation categories', () => {
    const plan = readPlan();

    expect(plan).toContain('Level 0: No mutation allowed');
    expect(plan).toContain('DataHealth repair; backup import/export over HTTP; reset/recovery over HTTP; source-of-truth migration');
    expect(plan).toContain('Level 1: Light confirmation candidate');
    expect(plan).toContain('DataHealth issue dismiss; diagnostics acknowledged state, if ever added');
    expect(plan).toContain('Level 2: Explicit confirmation required');
    expect(plan).toContain('history data-flag; limited history edit');
    expect(plan).toContain('Level 3: Strong confirmation / high-risk flow');
    expect(plan).toContain('session start; session patches; session complete; session discard');
    expect(plan).toContain('| Level | Candidate mutations | User prompt style | Required warning | Cancel behavior | Retry behavior | Rollback requirement | Why not implemented yet |');
  });

  it('documents pending, success, failure, rollback, duplicate-submit, and conflict UX', () => {
    const plan = readPlan();

    expect(plan).toContain('no fake success');
    expect(plan).toContain('Disable repeated submit while pending.');
    expect(plan).toContain('Do not show optimistic success.');
    expect(plan).toContain('Success only after API confirms writeSnapshot success.');
    expect(plan).toContain('Success must not be shown if repository write fails.');
    expect(plan).toContain('| Failure state | User-facing message | Retry allowed | Local state changed | Rollback requirement | Diagnostic log requirement |');
    expect(plan).toContain('network unavailable');
    expect(plan).toContain('timeout');
    expect(plan).toContain('snapshot_not_found');
    expect(plan).toContain('source snapshot mismatch');
    expect(plan).toContain('requiresConfirmation');
    expect(plan).toContain('no_change');
    expect(plan).toContain('write_failed');
    expect(plan).toContain('transaction_failed');
    expect(plan).toContain('database_closed');
    expect(plan).toContain('unsupported_route');
    expect(plan).toContain('If there is no local optimistic update, rollback is showing failure only.');
    expect(plan).toContain('idempotency key');
    expect(plan).toContain('mutationId');
    expect(plan).toContain('pending lock');
    expect(plan).toContain('source snapshot hash');
    expect(plan).toContain('No automatic merge.');
    expect(plan).toContain('No automatic overwrite.');
    expect(plan).toContain('No repair button.');
  });

  it('documents the mutation category UX matrix and gates', () => {
    const plan = readPlan();

    expect(plan).toContain('| Category | Confirmation level | Pending UX | Success UX | Failure UX | Rollback UX | Required gates |');
    expect(plan).toContain('Category A: Lowest-risk future candidate');
    expect(plan).toContain('Category B: Medium-risk');
    expect(plan).toContain('Category C: High-risk');
    expect(plan).toContain('Category D: Very high-risk / blocked');
    expect(plan).toContain('source-of-truth strategy completed');
    expect(plan).toContain('confirmation UX completed');
    expect(plan).toContain('rollback UX completed');
    expect(plan).toContain('no fake success rule tested');
    expect(plan).toContain('no duplicate submit rule tested');
  });

  it('does not recommend direct mutation implementation and chooses Task 4.27 next', () => {
    const plan = readPlan();

    expect(plan).toContain('Task 4.26 does not approve direct mutation implementation.');
    expect(plan).toContain('Task 4.26 does not approve App POST calls.');
    expect(plan).toContain('The only recommended next task is `Task 4.27 Lowest-risk Mutation Prototype Plan V1`.');
    expect(plan).toContain('Task 4.27 should still be a plan.');
    expect(plan).toContain('Task 4.26 result: UX/rollback plan only.');
    expect(plan).toContain('No mutation prototype is implemented.');
    expect(plan).not.toMatch(/Task 4\.27 should implement/i);
  });
});
