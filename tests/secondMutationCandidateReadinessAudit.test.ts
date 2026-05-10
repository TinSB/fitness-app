import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readSource, repoRoot } from './runtimeBoundaryTestHelpers';

const auditPath = 'docs/SECOND_MUTATION_CANDIDATE_READINESS_AUDIT.md';

const readAudit = () => readSource(auditPath);

const requiredSections = [
  '## Scope / Non-goals',
  '## Current Baseline',
  '## Candidate Inventory',
  '## Candidate Evaluation Criteria',
  '## History Data-flag Readiness Analysis',
  '## Why Not History Edit Next',
  '## Why Not Session Mutation Next',
  '## Why Not Repair / Backup / Reset',
  '## Recommendation',
  '## Required Gates Before History Data-flag Prototype',
  '## Route Boundary Rules For Future Prototype',
  '## Decision Record',
  '## Final Recommendation',
];

describe('second mutation candidate readiness audit', () => {
  it('exists and includes all required sections', () => {
    expect(existsSync(resolve(repoRoot(), auditPath))).toBe(true);
    const audit = readAudit();

    for (const section of requiredSections) {
      expect(audit).toContain(section);
    }
  });

  it('states implementation and source-of-truth boundaries remain blocked', () => {
    const audit = readAudit();

    expect(audit).toContain('This is not implementation.');
    expect(audit).toContain('This does not add `POST /history/:id/data-flag` to the App.');
    expect(audit).toContain('This does not add any browser mutation route.');
    expect(audit).toContain('This does not add a frontend mutation client.');
    expect(audit).toContain('This does not change App.tsx.');
    expect(audit).toContain('This does not replace localStorage.');
    expect(audit).toContain('This does not switch source of truth.');
    expect(audit).toContain('This does not add production backend, auth, sync, or deployment.');
    expect(audit).toContain('This does not add a package dependency or package script.');
    expect(audit).toContain('There are no UI writes to API added by Task 4.34.');
    expect(audit).toContain('Write-path migration remains blocked.');
  });

  it('documents the current baseline and evaluates the full candidate inventory', () => {
    const audit = readAudit();

    expect(audit).toContain('DataHealth dismiss is the only implemented browser mutation prototype.');
    expect(audit).toContain('DataHealth dismiss is dev-only and explicit opt-in.');
    expect(audit).toContain('DataHealth dismiss is regression-locked.');
    expect(audit).toContain('localStorage remains source of truth.');
    expect(audit).toContain('Read-only diagnostics remain the only broad App integration mode.');
    expect(audit).toContain('Node/dev API mutation routes still exist server-side, but they are not approved for browser runtime.');

    expect(audit).toContain('### Candidate B1: history data-flag');
    expect(audit).toContain('Route: `POST /history/:id/data-flag`');
    expect(audit).toContain('### Candidate B2: history edit');
    expect(audit).toContain('Route: `POST /history/:id/edit`');
    expect(audit).toContain('### Candidate C: session mutations');
    expect(audit).toContain('POST /sessions/start');
    expect(audit).toContain('POST /sessions/active/patches');
    expect(audit).toContain('POST /sessions/active/complete');
    expect(audit).toContain('POST /sessions/active/discard');
    expect(audit).toContain('### Candidate D: blocked high-risk operations');
    expect(audit).toContain('POST /data-health/repair/apply');
    expect(audit).toContain('backup import/export over HTTP');
    expect(audit).toContain('reset/recovery over HTTP');
    expect(audit).toContain('source-of-truth migration');
  });

  it('captures data-flag semantics and why it is second-candidate material only', () => {
    const audit = readAudit();

    for (const phrase of [
      '`normal`',
      '`test`',
      '`excluded`',
      'default stats',
      'PR/e1RM/effectiveSet eligibility',
      'readMirror `analyticsSessionCount`, `byDataFlag`, list item `dataFlag`, and `excludedFromStats`',
      'higher risk than DataHealth dismiss',
      'lower risk than history edit or session mutation',
      'explicit confirmation UX with before/after dataFlag value',
      'visible audit trail',
      'readMirror parity checks after mutation',
      'rollback strategy',
    ]) {
      expect(audit).toContain(phrase);
    }
  });

  it('uniquely recommends history data-flag as a future candidate without implementing it', () => {
    const audit = readAudit();

    expect(audit).toContain('Second future candidate: `POST /history/:id/data-flag`.');
    expect(audit).toContain('Task 4.34 does not implement it.');
    expect(audit).toContain('Task 4.34 does not approve direct implementation.');
    expect(audit).toContain('Task 4.34 does not add `POST /history/:id/data-flag` to browser runtime.');
    expect(audit).toContain('No second mutation is implemented.');
    expect(audit).toContain('Next task should be `Task 4.35 History Data-flag Mutation Prototype Plan V1`.');
    expect(audit).toContain('Task 4.35 should still be planning-only unless explicitly approved otherwise.');
    expect(audit).not.toMatch(/implement history data-flag now/i);
    expect(audit).not.toMatch(/connect POST \/history\/:id\/data-flag to App now/i);
    expect(audit).not.toMatch(/enable second mutation route now/i);
  });

  it('documents required gates and future route boundary rules', () => {
    const audit = readAudit();

    for (const phrase of [
      'source-of-truth remains localStorage',
      'explicit dev-only mutation flag',
      'single-route-only implementation',
      'confirmation UX',
      'audit trail visibility',
      'idempotency key',
      'mutationId',
      'request fingerprint',
      'source snapshot hash/version',
      'duplicate-submit prevention',
      'no-fake-success rule',
      'readMirror parity after mutation',
      'test/excluded/default-stat semantics locked',
      'localStorage backup plan',
      'dev DB backup plan',
      'manual acceptance runbook',
      'Only `POST /history/:id/data-flag` may be considered in a future plan.',
      'No `POST /history/:id/edit`.',
      'No `POST /sessions/*`.',
      'No `POST /data-health/repair/apply`.',
      'No broad mutation client.',
      'No source-of-truth switch.',
    ]) {
      expect(audit).toContain(phrase);
    }
  });
});
