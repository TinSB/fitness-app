import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readSource, repoRoot } from './runtimeBoundaryTestHelpers';

const auditPath = 'docs/THIRD_MUTATION_CANDIDATE_READINESS_AUDIT.md';

const readAudit = () => readSource(auditPath);

const requiredSections = [
  '## Scope / Non-goals',
  '## Current Two-route Baseline',
  '## Candidate Inventory',
  '## Candidate Evaluation Criteria',
  '## Limited History Edit Readiness Analysis',
  '## Session Mutation Readiness Analysis',
  '## DataHealth Repair Readiness Analysis',
  '## Backup / Import / Export / Reset / Recovery Analysis',
  '## Source-of-truth Migration Analysis',
  '## Risk Matrix',
  '## Recommendation',
  '## Required Gates Before Any Third Mutation Prototype',
  '## Decision Record',
  '## Final Recommendation',
];

describe('third mutation candidate readiness audit', () => {
  it('exists and contains all required sections', () => {
    expect(existsSync(resolve(repoRoot(), auditPath))).toBe(true);
    const audit = readAudit();

    for (const section of requiredSections) {
      expect(audit).toContain(section);
    }
  });

  it('states implementation, UI, runtime, storage, production, and package boundaries', () => {
    const audit = readAudit();

    for (const expected of [
      'This is a third mutation candidate readiness audit.',
      'This is not a third mutation implementation.',
      'This does not add a browser route.',
      'This does not add a third mutation route.',
      'This does not modify App.tsx.',
      'This does not add App.tsx mutation integration.',
      'This does not modify src/devApi runtime behavior.',
      'This does not add a frontend mutation client.',
      'This does not replace localStorage.',
      'This does not switch source of truth.',
      'This does not add production backend, auth, sync, or deployment.',
      'This does not add a dependency or package script.',
      'There are no UI writes to API added by Task 4.43.',
      'Write-path migration remains limited to the two accepted dev-only prototypes.',
    ]) {
      expect(audit).toContain(expected);
    }
  });

  it('records the current two-route baseline without expanding the allowlist', () => {
    const audit = readAudit();

    for (const expected of [
      'DataHealth dismiss is implemented, accepted, manually accepted, hardened, observability/recovery noted, and regression locked.',
      'History data-flag is planned, implemented, accepted, manually accepted, hardened, and regression locked.',
      'Browser mutation routes remain exactly:',
      '`POST /data-health/issues/:issueId/dismiss`',
      '`POST /history/:id/data-flag`',
      'localStorage remains source of truth.',
      'API results never overwrite AppData or localStorage.',
      'No session mutation route is exposed from browser code.',
      'No history edit route is exposed from browser code.',
      'No DataHealth repair route is exposed from browser code.',
      'No backup/import/export/reset/recovery route is exposed from browser code.',
    ]) {
      expect(audit).toContain(expected);
    }
  });

  it('evaluates all required candidate categories and criteria', () => {
    const audit = readAudit();

    for (const expected of [
      '### Candidate B2: Limited history edit',
      'Route: `POST /history/:id/edit`',
      '### Candidate C: Session mutations',
      '`POST /sessions/start`',
      '`POST /sessions/active/patches`',
      '`POST /sessions/active/complete`',
      '`POST /sessions/active/discard`',
      '### Candidate D1: DataHealth repair',
      '`POST /data-health/repair/apply`',
      '### Candidate D2: Backup/import/export over HTTP',
      '### Candidate D3: Reset/recovery over HTTP',
      '### Candidate D4: Source-of-truth migration',
      '### Candidate E: No third mutation yet; continue two-route hardening',
      'data semantics risk',
      'localStorage/source-of-truth impact',
      'PR/e1RM/effectiveSet impact',
      'readMirror parity impact',
      'audit trail requirement',
      'confirmation UX requirement',
      'rollback requirement',
      'idempotency/duplicate-submit requirement',
      'conflict/source snapshot requirement',
      'failure/no-fake-success requirement',
      'manual acceptance requirement',
      'browser route boundary risk',
      'offline/PWA risk',
      'user confusion risk',
    ]) {
      expect(audit).toContain(expected);
    }
  });

  it('analyzes limited history edit as planning-only and rejects direct implementation', () => {
    const audit = readAudit();

    for (const expected of [
      'Limited history edit is the most plausible future third candidate only for future planning, not implementation.',
      'Edit may affect set logs.',
      'Edit may affect actualWeightKg-derived calculations.',
      'Edit may affect PR/e1RM/effectiveSet.',
      'Edit may affect effective sets and weighted effective sets.',
      'Edit may affect summaries, calendar, history, and readMirror output.',
      'Edit requires strong audit trail visibility.',
      'Edit requires a stronger rollback plan than dataFlag changes.',
      'Edit requires field-level constraints that reject broad history edit.',
      'Edit requires before/after display.',
      'Edit requires manual acceptance and no-fake-success coverage.',
      'Task 4.44 must be planning-only.',
      'Task 4.44 must not implement `POST /history/:id/edit`.',
      'Task 4.44 must define field-level constraints and reject broad history edit.',
      'Task 4.43 must not recommend direct implementation.',
    ]) {
      expect(audit).toContain(expected);
    }

    expect(audit).not.toMatch(/implement `POST \/history\/:id\/edit` now/i);
    expect(audit).not.toMatch(/enable third mutation route now/i);
    expect(audit).not.toMatch(/direct implementation is recommended/i);
  });

  it('includes the risk matrix and uniquely recommends Task 4.44 as planning-only', () => {
    const audit = readAudit();

    expect(audit).toContain('## Risk Matrix');
    expect(audit).toContain('Unique recommendation: Do not implement a third mutation next.');
    expect(audit).toContain('Next recommended task: `Task 4.44 Limited History Edit Mutation Prototype Plan V1`.');
    expect(audit).toContain('No third mutation is implemented.');
    expect(audit).toContain('Limited History edit is the only plausible future third candidate for planning.');
    expect(audit).toContain('Write-path migration remains blocked beyond the existing two dev-only prototypes.');
    expect(audit).not.toContain('Next recommended task: `Task 4.44 History Edit Implementation');
  });
});
