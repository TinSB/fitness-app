import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readSource, repoRoot } from './runtimeBoundaryTestHelpers';

const planPath = 'docs/DEV_API_READONLY_APP_INTEGRATION_PLAN.md';

const readPlan = () => readSource(planPath);

const requiredSections = [
  '## Scope / Non-goals',
  '## Current Architecture Baseline',
  '## Recommended Mode',
  '## Read-only Scope Candidate',
  '## Future API Client Strategy',
  '## Future Feature Flag Strategy',
  '## Source-of-truth Rules',
  '## API-unavailable Fallback Plan',
  '## Data Comparison Strategy',
  '## Security / Privacy / Localhost Boundary',
  '## Rollback Plan',
  '## Required Acceptance Gates Before Task 4.20',
  '## Proposed Task 4.20',
  '## Decision Record',
  '## Final Recommendation',
];

const requiredBoundaryPhrases = [
  'There is no App.tsx implementation.',
  'There is no UI change.',
  'There is no frontend API client implementation.',
  'There is no feature flag runtime implementation.',
  'There is no localStorage replacement.',
  'There is no mutation integration.',
  'There is no production backend.',
  'There is no auth / sync / deployment.',
  'There is no package dependency.',
  'There is no package script.',
  'App runtime still uses localStorage by default.',
];

const requiredPlanPhrases = [
  'Recommended mode: Dual-read comparison mode only.',
  'localStorage remains the only active App source of truth.',
  'API response must never overwrite localStorage.',
  'UI must not write to API.',
  'App continues using localStorage.',
  'Comparison mode is skipped.',
  'Mismatch never overwrites data.',
  'Mismatch never blocks training.',
  'Remove or disable the future read-only comparison flag.',
  'Task 4.20 Read-only App Integration Prototype V1',
  'Task 4.20 must remain:',
  'dual-read comparison mode only',
  'Formal App.tsx HTTP migration and write-path migration remain blocked.',
];

const misleadingActionInstructions = [
  /\bconnect App\.tsx to API now\b/i,
  /\bcreate frontend API client now\b/i,
  /\benable feature flag runtime now\b/i,
  /\b(?:should|must|will)\s+(?!not\b)replace localStorage\b/i,
  /\bdeploy production backend\b/i,
  /\benable auth\b/i,
  /\benable sync\b/i,
];

describe('dev API read-only App integration plan', () => {
  it('exists and contains all required sections', () => {
    expect(existsSync(resolve(repoRoot(), planPath))).toBe(true);
    const plan = readPlan();

    requiredSections.forEach((section) => expect(plan).toContain(section));
  });

  it('documents the required plan-only boundaries', () => {
    const plan = readPlan();

    requiredBoundaryPhrases.forEach((phrase) => expect(plan).toContain(phrase));
    expect(plan).toContain('apps/api/src/index.ts` is browser-facing');
    expect(plan).toContain('apps/api/src/node/index.ts` is Node-only');
    expect(plan).toContain('Browser build must remain free of `node:http`, `node:sqlite`');
  });

  it('locks the dual-read source-of-truth and fallback rules', () => {
    const plan = readPlan();

    requiredPlanPhrases.forEach((phrase) => expect(plan).toContain(phrase));
    expect(plan).toContain('Dev API is comparison/shadow read only.');
    expect(plan).toContain('There is no dual-write.');
    expect(plan).toContain('There is no mutation route from App.');
    expect(plan).toContain('There is no backup/import route from App.');
    expect(plan).toContain('There is no repair/reset route from App.');
    expect(plan).toContain('There is no automatic merge.');
    expect(plan).toContain('There is no automatic migration.');
  });

  it('documents candidate read-only scope without expanding to mutations', () => {
    const plan = readPlan();

    expect(plan).toContain('App data summary');
    expect(plan).toContain('Sessions summary');
    expect(plan).toContain('History list');
    expect(plan).toContain('History detail');
    expect(plan).toContain('DataHealth summary');
    expect(plan).toContain('Focus Mode runtime');
    expect(plan).toContain('session start / complete / discard from UI');
    expect(plan).toContain('record edit from UI');
    expect(plan).toContain('DataHealth repair from UI');
    expect(plan).toContain('backup import/export over HTTP');
  });

  it('rejects action-oriented migration instructions while allowing negative boundary statements', () => {
    const plan = readPlan();

    misleadingActionInstructions.forEach((pattern) => expect(plan).not.toMatch(pattern));
    expect(plan).toContain('There is no App.tsx implementation.');
    expect(plan).toContain('Task 4.19 does not create API client files.');
    expect(plan).toContain('Task 4.19 does not implement a feature flag.');
  });

  it('keeps supporting docs aligned with the Task 4.19 plan result', () => {
    const apiContract = readSource('API_CONTRACT.md');
    const refactorPlan = readSource('FULL_STACK_REFACTOR_PLAN.md');
    const readinessAudit = readSource('docs/APP_RUNTIME_MIGRATION_READINESS_AUDIT.md');
    const checklist = readSource('docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md');

    expect(apiContract).toContain('Dev API Read-only App Integration Plan');
    expect(apiContract).toContain('docs/DEV_API_READONLY_APP_INTEGRATION_PLAN.md');
    expect(apiContract).toContain('App runtime still uses localStorage');
    expect(apiContract).toContain('No mutation route should be used by App runtime');

    expect(refactorPlan).toContain('Task 4.19: Dev API Read-only App Integration Plan V1');
    expect(refactorPlan).toContain('Completed as a read-only App integration plan and decision record');
    expect(refactorPlan).toContain('Task 4.20 Read-only App Integration Prototype V1 is only the next recommended task if Task 4.19 acceptance passes');
    expect(refactorPlan).toContain('Formal `App.tsx` HTTP migration and write-path migration remain blocked');

    expect(readinessAudit).toContain('Task 4.19 Follow-up');
    expect(readinessAudit).toContain('Task 4.18 conclusion unchanged');
    expect(checklist).toContain('Task 4.19 adds the read-only App integration plan');
    expect(checklist).toContain('still planning-only');
  });
});
