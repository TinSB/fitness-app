import { describe, expect, it } from 'vitest';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('emergency local restore rehearsal', () => {
  const doc = () => readSource('docs/EMERGENCY_LOCAL_RESTORE_REHEARSAL.md');

  it('keeps emergency local restore available without local deletion', () => {
    const content = doc();

    for (const expected of [
      'Verify emergency local mode available',
      'Verify emergency backup available.',
      'cloud failure does not block local app',
      'no local data deletion',
      'Source-of-truth changed is false',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('preserves cloud candidate and source of truth gates', () => {
    const content = doc();

    for (const expected of [
      'Backend/cloud candidate remains explicit opt-in and reversible.',
      'Cloud pull does not auto-apply.',
      'Cloud push requires manual confirmation.',
      'rollback / kill switch remains available',
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

  it('blocks deployment monitoring schema migration data and package drift', () => {
    const content = doc();

    for (const expected of [
      'No destructive migration.',
      'No normalized training tables.',
      'No real personal training data in automated tests.',
      'No production deployment auto-start.',
      'No external monitoring upload.',
      'No package or lockfile change.',
    ]) {
      expect(content).toContain(expected);
    }
  });
});
