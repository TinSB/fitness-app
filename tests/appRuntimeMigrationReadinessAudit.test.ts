import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readSource, repoRoot } from './runtimeBoundaryTestHelpers';

const auditPath = 'docs/APP_RUNTIME_MIGRATION_READINESS_AUDIT.md';

const readAudit = () => readSource(auditPath);

const requiredSections = [
  '## Scope / Non-goals',
  '## Current Architecture Snapshot',
  '## Completed Gates From Task 4.0-4.17',
  '## Remaining Blockers Before Any App.tsx Integration',
  '## Risk Analysis',
  '## Recommended Migration Path',
  '## Proposed Read-only Integration Principles',
  '## Source-of-truth Strategy Options',
  '## Required Acceptance Gates Before App Integration',
  '## Rollback Plan',
  '## Decision Record',
  '## Final Recommendation',
];

const boundaryPhrases = [
  'no App.tsx integration',
  'no UI integration',
  'no localStorage replacement',
  'no frontend API client',
  'no feature flag wiring',
  'no production backend',
  'no auth / sync / deployment',
  'no normalized tables',
  'no package dependency',
  'no package script',
  'App runtime still uses localStorage',
  'apps/api/src/index.ts` remains browser-facing and safe',
  'apps/api/src/node/index.ts` is Node-only',
];

const blockerPhrases = [
  'No frontend API client strategy',
  'No feature-flag/runtime switch strategy',
  'No localStorage to API source-of-truth strategy',
  'No offline/PWA behavior strategy',
  'No user data migration strategy',
  'No conflict resolution strategy',
  'No rollback strategy for a UI-connected prototype',
  'No auth/privacy model',
  'No production server/deployment model',
  'No monitoring or diagnostics strategy',
  'No UX fallback strategy when the API is unavailable',
  'No manual acceptance for a read-only app prototype',
];

const misleadingActionInstructions = [
  /\bconnect App\.tsx to API\b/i,
  /\bcreate frontend API client\b/i,
  /\benable feature flag runtime\b/i,
  /\breplace localStorage\b/i,
  /\bdeploy production backend\b/i,
];

describe('app runtime migration readiness audit', () => {
  it('exists and contains all required sections', () => {
    expect(existsSync(resolve(repoRoot(), auditPath))).toBe(true);
    const audit = readAudit();

    requiredSections.forEach((section) => expect(audit).toContain(section));
  });

  it('documents the blocked migration boundaries without action-oriented migration instructions', () => {
    const audit = readAudit();

    boundaryPhrases.forEach((phrase) => expect(audit).toContain(phrase));
    misleadingActionInstructions.forEach((pattern) => expect(audit).not.toMatch(pattern));
  });

  it('documents blockers before any App integration', () => {
    const audit = readAudit();

    blockerPhrases.forEach((phrase) => expect(audit).toContain(phrase));
  });

  it('contains the required risk analysis table columns and key risks', () => {
    const audit = readAudit();

    expect(audit).toContain('| Risk | Description | Severity | Mitigation | Required test gate |');
    expect(audit).toContain('| Data loss risk |');
    expect(audit).toContain('| Double-write risk |');
    expect(audit).toContain('| Stale localStorage vs SQLite snapshot risk |');
    expect(audit).toContain('| API unavailable risk |');
    expect(audit).toContain('| PWA offline risk |');
    expect(audit).toContain('| Accidental production exposure risk |');
    expect(audit).toContain('| Backup/import safety risk |');
    expect(audit).toContain('| Corrupted dev DB risk |');
    expect(audit).toContain('| Browser bundle pollution risk |');
    expect(audit).toContain('| User confusion risk |');
    expect(audit).toContain('| Debugging complexity risk |');
  });

  it('evaluates source-of-truth options and gives one short-term recommendation', () => {
    const audit = readAudit();

    expect(audit).toContain('### Option A: localStorage primary plus API read-only shadow');
    expect(audit).toContain('### Option B: API primary read source plus localStorage fallback');
    expect(audit).toContain('### Option C: dual-read comparison mode only');
    expect(audit.match(/Short-term recommendation: Option C/g) || []).toHaveLength(1);
  });

  it('records rollback gates and the unique next task instead of direct App.tsx migration', () => {
    const audit = readAudit();

    expect(audit).toContain('The only recommended next task is `Task 4.19 Dev API Read-only App Integration Plan V1`');
    expect(audit).toContain('After Task 4.18, do not directly do App.tsx migration');
    expect(audit).toContain('No mutation route used by App runtime');
    expect(audit).toContain('No localStorage replacement');
    expect(audit).toContain('Keep App runtime on localStorage');
    expect(audit).toContain(
      'Task 4.18 result: Not ready for App.tsx migration. Ready for Task 4.19 Dev API Read-only App Integration Plan V1. Formal App.tsx HTTP migration remains blocked.',
    );
  });

  it('keeps API contract and refactor plan aligned with the readiness result', () => {
    const apiContract = readSource('API_CONTRACT.md');
    const refactorPlan = readSource('FULL_STACK_REFACTOR_PLAN.md');
    const checklist = readSource('docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md');
    const runnerAcceptance = readSource('docs/DEV_API_RUNNER_MANUAL_ACCEPTANCE.md');

    expect(apiContract).toContain('App Runtime Migration Readiness Audit');
    expect(apiContract).toContain('docs/APP_RUNTIME_MIGRATION_READINESS_AUDIT.md');
    expect(apiContract).toContain('App runtime still uses localStorage');
    expect(apiContract).toContain('formal App HTTP migration remains blocked');

    expect(refactorPlan).toContain('Task 4.18: App Runtime Migration Readiness Audit V1');
    expect(refactorPlan).toContain('Completed as a readiness audit and decision record');
    expect(refactorPlan).toContain('Task 4.19 Dev API Read-only App Integration Plan V1');
    expect(refactorPlan).toContain('Do not migrate `App.tsx` to HTTP/SQLite after Task 4.18');

    expect(checklist).toContain('App runtime migration remains blocked');
    expect(runnerAcceptance).toContain('Runner acceptance does not authorize App runtime migration');
  });
});
