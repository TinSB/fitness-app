import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RECORD_DATA_HEALTH_MUTATION_ROUTES, SESSION_MUTATION_ROUTES } from '../apps/api/src';
import { readSource, repoRoot } from './runtimeBoundaryTestHelpers';

const auditPath = 'docs/MUTATION_INTEGRATION_READINESS_AUDIT.md';

const readAudit = () => readSource(auditPath);

const requiredSections = [
  '## Scope / Non-goals',
  '## Current Safe Baseline',
  '## Existing Mutation Route Inventory',
  '## Remaining Blockers Before Any Mutation Integration',
  '## Risk Analysis',
  '## Mutation Category Readiness Matrix',
  '## Recommended Mutation Integration Path',
  '## Source-of-truth Rules For Future Mutation Work',
  '## Required Gates Before Any Mutation Prototype',
  '## Rollback Plan Requirements',
  '## Decision Record',
  '## Final Recommendation',
];

const requiredBlockers = [
  'no frontend mutation client strategy',
  'no mutation feature flag strategy',
  'no source-of-truth switch strategy',
  'no offline/PWA mutation queue strategy',
  'no idempotency / duplicate-submit strategy',
  'no optimistic update / rollback strategy',
  'no conflict resolution strategy',
  'no localStorage/API snapshot reconciliation strategy',
  'no user confirmation UX strategy',
  'no API unavailable mutation fallback strategy',
  'no auth/privacy model',
  'no production deployment model',
  'no manual mutation acceptance runbook',
  'no mutation observability/diagnostics model',
  'no safe backup/restore checkpoint strategy before writes',
];

const requiredRisks = [
  'data loss',
  'double-write divergence',
  'localStorage vs API snapshot conflict',
  'duplicate mutation submission',
  'stale active session mutation',
  'offline/PWA failed mutation',
  'partial snapshot write',
  'user thinks write succeeded but snapshot failed',
  'accidental production exposure',
  'backup/import safety regression',
  'DataHealth repair misuse',
  'history edit corruption',
  'active session loss',
  'rollback complexity',
  'browser bundle pollution',
  'UX confusion',
  'auth/privacy gap',
];

describe('mutation integration readiness audit', () => {
  it('exists and includes the required audit sections', () => {
    expect(existsSync(resolve(repoRoot(), auditPath))).toBe(true);
    const audit = readAudit();

    for (const section of requiredSections) {
      expect(audit).toContain(section);
    }
  });

  it('states the mutation integration boundary remains blocked', () => {
    const audit = readAudit();

    expect(audit).toContain('There is no App.tsx mutation integration.');
    expect(audit).toContain('There are no UI writes to API.');
    expect(audit).toContain('There is no localStorage replacement.');
    expect(audit).toContain('There is no source-of-truth switch.');
    expect(audit).toContain('There is no production backend.');
    expect(audit).toContain('There is no auth, sync, or deployment.');
    expect(audit).toContain('There is no package dependency or package script.');
    expect(audit).toContain('Write-path migration remains blocked.');
  });

  it('records the existing server-side mutation route inventory without approving App usage', () => {
    const audit = readAudit();
    const routes = [...SESSION_MUTATION_ROUTES, ...RECORD_DATA_HEALTH_MUTATION_ROUTES];

    for (const route of routes) {
      expect(audit).toContain(`${route.method} ${route.path}`);
    }

    expect(audit).toContain('They are not browser App runtime routes');
    expect(audit).toContain('they are not approved for UI integration');
    expect(audit).toContain('they require future readiness gates');
  });

  it('lists blockers, risk table columns, readiness matrix, source-of-truth rules, and rollback requirements', () => {
    const audit = readAudit();

    for (const blocker of requiredBlockers) {
      expect(audit).toContain(blocker);
    }

    expect(audit).toContain('| Risk | Description | Severity | Mitigation | Required test gate |');
    for (const risk of requiredRisks) {
      expect(audit).toContain(risk);
    }

    expect(audit).toContain('Category A: Lowest-risk future candidate, still blocked');
    expect(audit).toContain('Category B: Medium-risk future candidate');
    expect(audit).toContain('Category C: High-risk future candidate');
    expect(audit).toContain('Category D: Very high-risk / not ready');
    expect(audit).toContain('localStorage remains current App source of truth');
    expect(audit).toContain('No mutation route from App until a source-of-truth strategy exists');
    expect(audit).toContain('No dual-write without a reconciliation plan');
    expect(audit).toContain('No API write without a rollback plan');
    expect(audit).toContain('disable mutation flag');
    expect(audit).toContain('backup localStorage before write experiments');
    expect(audit).toContain('backup dev DB before write experiments');
  });

  it('gives a unique planning-only recommendation and rejects direct mutation prototype guidance', () => {
    const audit = readAudit();

    expect(audit).toContain('Task 4.24 result: Not ready for mutation integration.');
    expect(audit).toContain('Next task should be Task 4.25 Write-path Source-of-truth & Offline Strategy V1.');
    expect(audit).toContain('Do not implement App mutation routes yet.');
    expect(audit).toContain('Task 4.25 must be strategy/planning only');
    expect(audit).toContain('no App mutation calls');
    expect(audit).toContain('no POST route UI wiring');
    expect(audit).toContain('no source-of-truth switch implementation');
    expect(audit).not.toMatch(/next recommended task:\s*Task 4\.\d+.*mutation prototype/i);
  });
});
