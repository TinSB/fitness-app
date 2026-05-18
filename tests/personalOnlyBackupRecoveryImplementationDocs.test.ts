import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('personal-only backup recovery implementation docs', () => {
  const doc = () => readSource('docs/PERSONAL_ONLY_BACKUP_RECOVERY_IMPLEMENTATION_PACK.md');

  it('records Task 16C identity and Task 16B baseline evidence', () => {
    const content = doc();

    for (const expected of [
      'Task 16C',
      'Personal-Only Backup & Recovery Implementation Pack',
      'Task 16B complete',
      'PR #257',
      '367420b14382d61aae8a10a3f4be10775fb74f7f',
      '1060 files / 4267 tests',
      'dist token scan clean',
      'personal-only polish/reliability',
      'SaaS remains deferred',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('documents non-goals and preserved safety boundaries', () => {
    const content = doc();

    for (const expected of [
      'change source-of-truth behavior.',
      'enable default cloud sync.',
      'enable background sync.',
      'add backup/import/export HTTP routes.',
      'add reset/recovery HTTP routes.',
      'perform destructive migration.',
      'use real personal training data in tests.',
      'localStorage default/fallback/migration/emergency remains preserved.',
      'backend/cloud candidate remains explicit opt-in and reversible.',
      'cloud pull does not auto-apply.',
      'cloud push requires manual confirmation.',
      'conflict resolution remains manual.',
      'rollback / kill switch available.',
      'emergency local mode available.',
      'accepted browser mutation routes exactly seven.',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('documents helpers readiness categories and recommended actions', () => {
    const content = doc();

    for (const expected of [
      'backup/recovery readiness helper.',
      'backup/recovery copy helper.',
      'tests for pure/no-side-effect behavior.',
      'ready',
      'backup_recommended',
      'backup_stale',
      'backup_missing',
      'backup_unverified',
      'restore_rehearsal_needed',
      'emergency_local_ready',
      'emergency_local_unavailable',
      'cloud_candidate_paused',
      'recovery_blocked',
      'source_of_truth_unclear',
      'owner_review_required',
      'schema_review_required',
      'local_first_safe_mode',
      'continue_localStorage_primary',
      'create_manual_backup',
      'verify_latest_backup',
      'rehearse_restore',
      'pause_cloud_candidate',
      'do_not_cloud_pull',
      'do_not_cloud_push',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('documents owner daily and cloud rehearsal checklists', () => {
    const content = doc();

    for (const expected of [
      'confirm app opens locally.',
      'confirm latest workout appears in local history.',
      'confirm emergency local mode is available.',
      'confirm rollback / kill switch is available.',
      'confirm backup freshness.',
      'confirm backup verification.',
      'only attempt cloud candidate if backup/recovery is safe.',
      'backup is fresh or manually accepted.',
      'backup is verified or restore rehearsal completed.',
      'owner scope is clear.',
      'schema validation is clear.',
      'dry run completed.',
      'manual confirmation required.',
      'no auto-apply / no auto-upload.',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('documents emergency guidance and Task 16D recommendation without starting it', () => {
    const content = doc();

    for (const expected of [
      'stop cloud operations.',
      'pause cloud candidate.',
      'return to localStorage-primary.',
      'use emergency local mode if needed.',
      'keep local data unchanged.',
      'do not delete backups.',
      'record incident note.',
      'escalate if source-of-truth unclear.',
      'Task 16D — Daily Training UX Polish Pack V1',
      'session logging friction.',
      'safer start/complete flow.',
      'clearer history review.',
      'better empty/error states.',
      'owner-friendly local-first training UX.',
      'Task 16D should not be started by Task 16C.',
      'Task 16C does not start Task 16D.',
    ]) {
      expect(content).toContain(expected);
    }
  });
});
