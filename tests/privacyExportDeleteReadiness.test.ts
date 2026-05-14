import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('privacy export delete readiness', () => {
  const doc = () => readSource('docs/PRIVACY_EXPORT_DELETE_READINESS.md');

  it('defines all required readiness areas', () => {
    const content = doc();

    for (const expected of [
      'user data ownership',
      'local export readiness',
      'cloud export candidate readiness',
      'delete local data readiness',
      'delete cloud data candidate readiness',
      'account unlink readiness',
      'emergency backup retention',
      'audit log retention',
      'manual confirmation',
      'destructive action warning',
      'data lifecycle blocked until later explicit phase',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('keeps ownership and emergency backup boundaries explicit', () => {
    const content = doc();

    for (const expected of [
      'User-owned local data remains local by default.',
      'Backend/cloud candidate ownership remains explicit opt-in and reversible.',
      'Owner mismatch must block future cloud export/delete candidate behavior.',
      'Anonymous local data must not be silently uploaded or deleted.',
      'Emergency backup retention must be preserved',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('requires dry run and manual confirmation for future cloud export delete candidates', () => {
    const content = doc();

    for (const expected of [
      'future owner validation, account scope, dry run, manual confirmation, and redaction review',
      'future account owner validation, conflict review, dry run, and manual confirmation',
      'Data lifecycle remains blocked until a later explicit phase.',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('blocks destructive runtime routes and package changes', () => {
    const content = doc();

    for (const expected of [
      'No cloud delete.',
      'No delete API.',
      'No export HTTP route.',
      'No backup/import/export HTTP route.',
      'No reset/recovery HTTP route.',
      'No localStorage deletion.',
      'No package or lockfile change.',
    ]) {
      expect(content).toContain(expected);
    }

    for (const forbidden of [
      'cloud delete implemented',
      'delete API added',
      'export HTTP route added',
      'localStorage deletion implemented',
      'new package dependency',
    ]) {
      expect(content).not.toContain(forbidden);
    }
  });

  it('excludes full sensitive diagnostic data from audit retention', () => {
    const content = doc();

    for (const expected of [
      'full AppData',
      'full localStorage',
      'training logs',
      'secrets',
      'tokens',
      'service role',
      'personal notes',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('recommends only Task 13.14', () => {
    expect(doc()).toContain('Recommended next task: Task 13.14 Production Release Manual Acceptance V1.');
  });
});
