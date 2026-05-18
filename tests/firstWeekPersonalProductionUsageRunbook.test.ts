import { describe, expect, it } from 'vitest';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('first week personal production usage runbook', () => {
  const doc = () => readSource('docs/FIRST_WEEK_PERSONAL_PRODUCTION_USAGE_RUNBOOK.md');

  it('records Task 15A identity and Phase 14 baseline evidence', () => {
    const content = doc();

    for (const expected of [
      'Task 15A',
      'First Week Personal Production Usage Runbook',
      'Phase 15 start',
      'Phase 14 complete',
      'PR: #251',
      'c03bf8c56dff6192dae33c155ec004c751dec2b0',
      '1048 files / 4184 tests',
      'dist token scan clean',
      'Personal production candidate release path exists',
      'Phase 15 was not started before this task',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('preserves local storage cloud candidate conflict rollback and route boundaries', () => {
    const content = doc();

    for (const expected of [
      'localStorage remains default/fallback/migration/emergency',
      'backend/cloud candidate remains explicit opt-in and reversible',
      'cloud pull does not auto-apply',
      'cloud push requires manual confirmation',
      'conflict resolution remains manual',
      'rollback / kill switch remains available',
      'emergency local mode remains available',
      'accepted browser mutation routes remain exactly seven',
      'api-primary-dev remains dev/local only and not production-ready',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('keeps accepted browser mutation routes exactly seven', () => {
    expect(API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES).toEqual([
      '/data-health/issues/:issueId/dismiss',
      '/history/:id/data-flag',
      '/history/:id/edit',
      '/sessions/start',
      '/sessions/active/patches',
      '/sessions/active/complete',
      '/sessions/active/discard',
    ]);
  });

  it('blocks sync deployment monitoring SaaS schema migration data and route drift', () => {
    const content = doc();

    for (const expected of [
      'enable default cloud sync',
      'enable background sync',
      'enable automatic multi-device sync',
      'enable production deployment auto-start',
      'enable external monitoring upload',
      'launch public SaaS',
      'add normalized training tables',
      'perform destructive migration',
      'use real personal training data in automated tests',
      'blocked repair/reset/import/export HTTP routes remain blocked',
      'Service role key appears in browser context',
      'Any route adds repair/reset/import/export over HTTP',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('blocks service role in browser committed env files and package drift', () => {
    const content = doc();

    for (const expected of [
      'service role key must not enter browser',
      '`.env` files must not be committed',
      'Confirm no service role key is in browser config',
      'Confirm no `.env` file is committed',
      'add package/dependency/script/lockfile changes',
      'No route/package boundary drift',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('includes Day 0 before workout after workout and daily log sections', () => {
    const content = doc();

    for (const expected of [
      '## Day 0 Preparation Checklist',
      '## Daily Before-Workout Checklist',
      '## Daily After-Workout Checklist',
      '## First-Week Daily Log Template',
      '| Date | Workout completed? | Runtime source | localStorage status | Cloud pull attempted? | Cloud push attempted? | Conflict detected? | Rollback needed? | Emergency local mode used? | Issue summary | Next action |',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('includes cloud pull and push rehearsal rules', () => {
    const content = doc();

    for (const expected of [
      'Cloud pull is optional.',
      'Cloud pull must be explicit.',
      'Cloud pull must never auto-apply.',
      'Owner check required.',
      'Schema validation required.',
      'Manual confirmation required before any future apply.',
      'Cloud push is optional.',
      'Cloud push must be explicit.',
      'Dry run required.',
      'Backup check required.',
      'No fake success.',
      'Source-of-truth unchanged unless later explicitly authorized.',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('includes stop conditions emergency local mode procedure and success criteria', () => {
    const content = doc();

    for (const expected of [
      '## Stop Conditions',
      'Unexpected data loss.',
      'Source-of-truth unclear.',
      'Owner mismatch.',
      'Schema validation failure.',
      'Rollback unavailable.',
      'Emergency local unavailable.',
      '## Emergency Local Mode Procedure',
      'Stop cloud operations.',
      'Disable cloud pull.',
      'Disable cloud push.',
      'Disable Supabase adapter candidate.',
      'Return to localStorage-primary.',
      'Do not delete localStorage backup.',
      '## Success Criteria For The First Week',
      'App usable locally every training day.',
      'No local data loss.',
      'No unconfirmed cloud overwrite.',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('recommends Task 15B but does not start it', () => {
    const content = doc();

    for (const expected of [
      'Recommended next task: Task 15B — Real-World Failure / Recovery Hardening.',
      'Task 15B should be triggered if',
      'Task 15A does not start Task 15B.',
      'Phase 15 continues only after explicit instruction.',
      'personal production candidate usage only, not public SaaS launch',
    ]) {
      expect(content).toContain(expected);
    }
  });
});
