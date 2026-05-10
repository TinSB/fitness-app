import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readSource, repoRoot } from './runtimeBoundaryTestHelpers';

const planPath = 'docs/LOWEST_RISK_MUTATION_PROTOTYPE_PLAN.md';

const readPlan = () => readSource(planPath);

const requiredSections = [
  '## Scope / Non-goals',
  '## Current Baseline',
  '## Candidate Evaluation',
  '## Unique Recommendation',
  '## Required Prototype Gates',
  '## Proposed DataHealth Dismiss Prototype Shape',
  '## Source-of-truth Handling For First Prototype',
  '## Rollback Plan For First Prototype',
  '## Manual Acceptance Requirements',
  '## Explicitly Rejected First Prototypes',
  '## Task 4.28 Recommendation',
  '## Decision Record',
];

describe('lowest-risk mutation prototype plan', () => {
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

  it('evaluates all requested candidates', () => {
    const plan = readPlan();

    expect(plan).toContain('Candidate A1: DataHealth issue dismiss');
    expect(plan).toContain('Route: `POST /data-health/issues/:issueId/dismiss`');
    expect(plan).toContain('Lowest-risk candidate');
    expect(plan).toContain('does not change training set logs');
    expect(plan).toContain('does not alter PR/e1RM/effectiveSet calculations');
    expect(plan).toContain('Candidate A2: Diagnostics acknowledged state, if ever added');
    expect(plan).toContain('This task must not invent the route, state model, or storage behavior.');
    expect(plan).toContain('Candidate B1: history data-flag');
    expect(plan).toContain('Route: `POST /history/:id/data-flag`');
    expect(plan).toContain('Candidate B2: limited history edit');
    expect(plan).toContain('Route: `POST /history/:id/edit`');
    expect(plan).toContain('Candidate C: session mutations');
    expect(plan).toContain('POST /sessions/start');
    expect(plan).toContain('POST /sessions/active/patches');
    expect(plan).toContain('POST /sessions/active/complete');
    expect(plan).toContain('POST /sessions/active/discard');
    expect(plan).toContain('Candidate D: blocked high-risk operations');
    expect(plan).toContain('POST /data-health/repair/apply');
    expect(plan).toContain('backup import/export over HTTP');
    expect(plan).toContain('reset/recovery over HTTP');
    expect(plan).toContain('source-of-truth migration');
  });

  it('uniquely recommends DataHealth issue dismiss without implementing it', () => {
    const plan = readPlan();

    expect(plan).toContain('First future prototype candidate: DataHealth issue dismiss.');
    expect(plan).toContain('Task 4.27 does not implement it.');
    expect(plan).toContain('Task 4.27 does not approve direct App POST calls.');
    expect(plan).toContain('one route only');
    expect(plan).toContain('no session mutation');
    expect(plan).toContain('no record edit');
    expect(plan).toContain('no repair');
    expect(plan).toContain('no backup/reset');
  });

  it('documents gates, prototype shape, source-of-truth handling, rollback, and manual acceptance', () => {
    const plan = readPlan();

    expect(plan).toContain('idempotency key design');
    expect(plan).toContain('mutationId design');
    expect(plan).toContain('request fingerprint design');
    expect(plan).toContain('source snapshot hash/version design');
    expect(plan).toContain('write_failed / transaction_failed handling');
    expect(plan).toContain('readMirror parity after mutation');
    expect(plan).toContain('Future request payload must include:');
    expect(plan).toContain('`issueId`');
    expect(plan).toContain('`mutationId`');
    expect(plan).toContain('`idempotencyKey`');
    expect(plan).toContain('`requestFingerprint`');
    expect(plan).toContain('`sourceSnapshotHash` or `sourceSnapshotVersion`');
    expect(plan).toContain('`confirmed: true`');
    expect(plan).toContain('success only if HTTP response includes snapshot metadata');
    expect(plan).toContain('Recommendation: for the first prototype, use shadow-only / diagnostics mode unless a later task explicitly designs localStorage reconciliation.');
    expect(plan).toContain('disable mutation flag');
    expect(plan).toContain('no localStorage overwrite means no user data rollback needed');
    expect(plan).toContain('flag off no mutation');
    expect(plan).toContain('browser network shows only allowed POST route');
    expect(plan).toContain('no session/history/repair/backup/reset POSTs');
  });

  it('rejects unsafe first prototypes and recommends Task 4.28 as a plan', () => {
    const plan = readPlan();

    expect(plan).toContain('session start rejected as first prototype');
    expect(plan).toContain('session complete rejected as first prototype');
    expect(plan).toContain('history edit rejected as first prototype');
    expect(plan).toContain('history data-flag rejected as first prototype');
    expect(plan).toContain('DataHealth repair rejected');
    expect(plan).toContain('backup/import over HTTP rejected');
    expect(plan).toContain('reset/recovery over HTTP rejected');
    expect(plan).toContain('API source-of-truth switch rejected');
    expect(plan).toContain('dual-write rejected');
    expect(plan).toContain('Next task should be Task 4.28 DataHealth Dismiss Mutation Prototype Plan V1.');
    expect(plan).toContain('Task 4.28 should still be a plan.');
    expect(plan).not.toMatch(/implement DataHealth dismiss now/i);
  });
});
