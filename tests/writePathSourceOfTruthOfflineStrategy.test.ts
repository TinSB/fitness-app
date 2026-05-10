import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readSource, repoRoot } from './runtimeBoundaryTestHelpers';

const strategyPath = 'docs/WRITE_PATH_SOURCE_OF_TRUTH_OFFLINE_STRATEGY.md';

const readStrategy = () => readSource(strategyPath);

const requiredSections = [
  '## Scope / Non-goals',
  '## Current Baseline',
  '## Source-of-truth Options',
  '## Recommended Short-term Source-of-truth Rule',
  '## Offline / PWA Strategy',
  '## Idempotency / Duplicate-submit Strategy',
  '## Conflict / Reconciliation Strategy',
  '## Rollback Strategy',
  '## Mutation Category Strategy',
  '## First Mutation Prototype Recommendation',
  '## Required Gates Before Any Mutation Prototype',
  '## Decision Record',
  '## Final Recommendation',
];

describe('write-path source-of-truth and offline strategy', () => {
  it('exists and includes all required sections', () => {
    expect(existsSync(resolve(repoRoot(), strategyPath))).toBe(true);
    const strategy = readStrategy();

    for (const section of requiredSections) {
      expect(strategy).toContain(section);
    }
  });

  it('states write-path implementation boundaries remain blocked', () => {
    const strategy = readStrategy();

    expect(strategy).toContain('There is no App.tsx mutation integration.');
    expect(strategy).toContain('There are no UI writes to API.');
    expect(strategy).toContain('There is no frontend mutation client.');
    expect(strategy).toContain('There is no mutation feature flag.');
    expect(strategy).toContain('There is no localStorage replacement.');
    expect(strategy).toContain('There is no source-of-truth switch.');
    expect(strategy).toContain('There is no production backend.');
    expect(strategy).toContain('There is no auth, sync, or deployment.');
    expect(strategy).toContain('There is no package dependency or package script.');
    expect(strategy).toContain('Write-path migration remains blocked.');
  });

  it('evaluates source-of-truth options and uniquely recommends staged migration', () => {
    const strategy = readStrategy();

    expect(strategy).toContain('Option A: localStorage remains primary; API mutation disabled');
    expect(strategy).toContain('Option B: localStorage primary; API writes shadow snapshots only');
    expect(strategy).toContain('Option C: API/SQLite becomes write source of truth; localStorage read fallback');
    expect(strategy).toContain('Option D: dual-write localStorage + API');
    expect(strategy).toContain('Option E: staged migration with read-only comparison -> lowest-risk mutation prototype -> explicit source-of-truth switch later');
    expect(strategy).toContain('This is the unique short-term recommendation.');
    expect(strategy).toContain('Mutation remains blocked until strategy gates pass.');
    expect(strategy).toContain('immediate API source-of-truth switch');
    expect(strategy).toContain('dual-write without reconciliation');
    expect(strategy).toContain('App mutation prototype before offline, idempotency, and rollback strategy');
  });

  it('documents source-of-truth, offline, idempotency, conflict, rollback, and category strategy', () => {
    const strategy = readStrategy();

    expect(strategy).toContain('localStorage remains current App source of truth.');
    expect(strategy).toContain('App must not call mutation routes yet.');
    expect(strategy).toContain('No API response overwrites localStorage.');
    expect(strategy).toContain('No dual-write yet.');
    expect(strategy).toContain('No API-backed persistence adapter.');
    expect(strategy).toContain('No offline mutation queue in first mutation prototype.');
    expect(strategy).toContain('stable mutationId');
    expect(strategy).toContain('idempotency key');
    expect(strategy).toContain('request fingerprint');
    expect(strategy).toContain('Compare source snapshot hash/version before mutation.');
    expect(strategy).toContain('Reject mutation if source mismatch.');
    expect(strategy).toContain('No automatic merge.');
    expect(strategy).toContain('No localStorage overwrite.');
    expect(strategy).toContain('Create localStorage backup.');
    expect(strategy).toContain('Backup dev DB.');
    expect(strategy).toContain('Category A: Lowest-risk future candidate');
    expect(strategy).toContain('Category B: Medium-risk');
    expect(strategy).toContain('Category C: High-risk');
    expect(strategy).toContain('Category D: Very high-risk / blocked');
  });

  it('does not recommend direct mutation prototype and chooses Task 4.26 next', () => {
    const strategy = readStrategy();

    expect(strategy).toContain('Do not implement mutation prototype next.');
    expect(strategy).toContain('Task 4.25 does not approve direct mutation prototype.');
    expect(strategy).toContain('Task 4.25 does not approve App POST calls.');
    expect(strategy).toContain('The only recommended next task is `Task 4.26 Mutation UX Confirmation & Rollback Plan V1`.');
    expect(strategy).toContain('Task 4.25 result: Strategy only.');
    expect(strategy).toContain('Source-of-truth remains localStorage.');
    expect(strategy).toContain('No offline mutation queue yet.');
    expect(strategy).not.toMatch(/Next task should be Task 4\.26 Lowest-risk Mutation Prototype Plan V1/i);
  });
});
