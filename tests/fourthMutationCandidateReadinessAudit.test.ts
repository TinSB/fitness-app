import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readSource, repoRoot } from './runtimeBoundaryTestHelpers';

const auditPath = 'docs/FOURTH_MUTATION_CANDIDATE_READINESS_AUDIT.md';

const readAudit = () => readSource(auditPath);

const requiredSections = [
  '## Scope / Non-goals',
  '## Current Three-route Baseline',
  '## Candidate Inventory',
  '## Candidate Evaluation Criteria',
  '## Session Start Readiness Analysis',
  '## Session Patch Readiness Analysis',
  '## Session Complete Readiness Analysis',
  '## Session Discard Readiness Analysis',
  '## DataHealth Repair Readiness Analysis',
  '## Backup / Import / Export / Reset / Recovery Analysis',
  '## Source-of-truth Migration Analysis',
  '## Risk Matrix',
  '## Recommendation',
  '## Required Gates Before Any Fourth Mutation Prototype',
  '## Decision Record',
  '## Final Recommendation',
];

describe('fourth mutation candidate readiness audit', () => {
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
      'This is a fourth mutation candidate readiness audit.',
      'This is not a fourth mutation implementation.',
      'This does not add a browser route.',
      'This does not add a fourth mutation route.',
      'This does not modify App.tsx.',
      'This does not add App.tsx mutation integration.',
      'This does not modify src/devApi runtime behavior.',
      'This does not add a frontend mutation client.',
      'This does not replace localStorage.',
      'This does not switch source of truth.',
      'This does not add offline mutation queue.',
      'This does not add production backend, auth, sync, or deployment.',
      'This does not add a dependency or package script.',
      'This does not add UI writes to API.',
      'There are no UI writes to API added by Task 4.55.',
      'Write-path migration remains limited to the three accepted dev-only prototypes.',
    ]) {
      expect(audit).toContain(expected);
    }
  });

  it('records the current three-route baseline without expanding the allowlist', () => {
    const audit = readAudit();

    for (const expected of [
      'DataHealth dismiss is implemented, accepted, manually accepted, hardened, observability/recovery noted, and regression locked.',
      'History data-flag is implemented, accepted, manually accepted, hardened, and regression locked.',
      'Limited History Edit is implemented, accepted, manually accepted, hardened, observability/recovery noted, and regression locked.',
      'Browser mutation routes remain exactly three:',
      '`POST /data-health/issues/:issueId/dismiss`',
      '`POST /history/:id/data-flag`',
      '`POST /history/:id/edit`',
      'localStorage remains source of truth.',
      'API results never overwrite AppData or localStorage.',
      'No session mutation route is exposed from browser code.',
      'No DataHealth repair route is exposed from browser code.',
      'No backup/import/export/reset/recovery route is exposed from browser code.',
    ]) {
      expect(audit).toContain(expected);
    }
  });

  it('evaluates all required candidate categories and criteria', () => {
    const audit = readAudit();

    for (const expected of [
      '### Candidate C1: Session start',
      'Route: `POST /sessions/start`',
      '### Candidate C2: Session patch',
      'Route: `POST /sessions/active/patches`',
      '### Candidate C3: Session complete',
      'Route: `POST /sessions/active/complete`',
      '### Candidate C4: Session discard',
      'Route: `POST /sessions/active/discard`',
      '### Candidate D1: DataHealth repair',
      'Route: `POST /data-health/repair/apply`',
      '### Candidate D2: Backup/import/export over HTTP',
      '### Candidate D3: Reset/recovery over HTTP',
      '### Candidate D4: Source-of-truth migration',
      '### Candidate E: No fourth mutation yet; continue three-route hardening',
      'active session data-loss risk',
      'localStorage/source-of-truth impact',
      'unsaved training state risk',
      'duplicate-submit/idempotency requirement',
      'offline/PWA risk',
      'recovery/rollback requirement',
      'confirmation UX requirement',
      'readMirror parity impact',
      'PR/e1RM/effectiveSet impact',
      'audit trail requirement',
      'failure/no-fake-success requirement',
      'manual acceptance requirement',
      'browser route boundary risk',
      'user confusion risk',
      'production exposure risk',
    ]) {
      expect(audit).toContain(expected);
    }
  });

  it('marks active-session mutation as planning-only and rejects direct implementation', () => {
    const audit = readAudit();

    for (const expected of [
      'Session start creates active training state',
      'Duplicate start can create conflicting active sessions.',
      'Stale localStorage/API mismatch can start from the wrong source.',
      'Offline/PWA behavior is not ready.',
      'Session patches affect unsaved active session state.',
      'Patch ordering matters.',
      'Duplicate patch can duplicate or overwrite training values.',
      'Session complete writes the final history record.',
      'Duplicate complete can create duplicate records or lose the active session.',
      'Session discard can destroy unsaved training state.',
      'Session mutation is the only remaining plausible product-value candidate area.',
      'It is too risky for direct implementation.',
    ]) {
      expect(audit).toContain(expected);
    }
  });

  it('uniquely recommends Task 4.56 as planning-only and does not recommend direct implementation', () => {
    const audit = readAudit();

    expect(audit).toContain('Unique recommendation: Do not implement a fourth mutation next.');
    expect(audit).toContain('Next recommended task: `Task 4.56 Active Session Mutation Readiness & Recovery Plan V1`.');
    expect(audit).toContain('Task 4.56 must be planning-only.');
    expect(audit).toContain('It must not implement `POST /sessions/start`.');
    expect(audit).toContain('It must not implement `POST /sessions/active/patches`.');
    expect(audit).toContain('It must not implement `POST /sessions/active/complete`.');
    expect(audit).toContain('It must not implement `POST /sessions/active/discard`.');
    expect(audit).toContain('Task 4.55 must not recommend direct implementation.');
    expect(audit).toContain('No fourth mutation is implemented.');
    expect(audit).toContain('Write-path migration remains blocked beyond the existing three dev-only prototypes.');
    expect(audit).not.toMatch(/implement `POST \/sessions\/start` now/i);
    expect(audit).not.toMatch(/enable fourth mutation route now/i);
    expect(audit).not.toMatch(/direct implementation is recommended/i);
  });
});
