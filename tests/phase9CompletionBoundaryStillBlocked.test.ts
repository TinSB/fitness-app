import { describe, expect, it } from 'vitest';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';
import { createRuntimeSourceSelector } from '../src/storage/runtimeSourceSelector';
import { resolveSourceOfTruthRuntimeSwitchGuard } from '../src/productionCutover/sourceOfTruthRuntimeSwitchGuard';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('phase 9 completion boundary still blocked', () => {
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

  it('keeps localStorage default and backend-primary explicit opt-in', () => {
    expect(createRuntimeSourceSelector({ DEV: true })).toMatchObject({
      mode: 'localStorage',
      sourceOfTruth: 'localStorage',
      apiWriteEnabled: false,
    });
    expect(resolveSourceOfTruthRuntimeSwitchGuard()).toMatchObject({
      state: 'localStorage-primary',
      sourceOfTruth: 'localStorage',
      backendPrimaryCandidateEnabled: false,
    });
    expect(resolveSourceOfTruthRuntimeSwitchGuard({
      requestedState: 'backend-primary-candidate',
      explicitOptIn: true,
      backendAvailable: true,
      localStorageBackupAvailable: true,
    })).toMatchObject({
      state: 'backend-primary-candidate',
      backendPrimaryCandidateEnabled: true,
      localStorageFallbackAvailable: true,
      localStorageEmergencyBackupAvailable: true,
      localStorageDeleted: false,
    });
  });

  it('documents final blocked production capabilities', () => {
    const doc = readSource('docs/PHASE9_COMPLETION_ARCHIVE.md');

    for (const expected of [
      '`localStorage` remains default runtime source, fallback, migration source, and emergency backup.',
      'Backend-primary candidate remains explicit opt-in.',
      'Fallback, rollback, and emergency restore remain available.',
      '`api-primary-dev` remains explicit dev/local only and not production-ready.',
      'Auth/user accounts remain unimplemented.',
      'Cloud sync remains unimplemented.',
      'Deployment runtime remains unimplemented.',
      'Monitoring runtime remains unimplemented.',
      'SaaS/multi-user runtime remains unimplemented.',
      'No normalized tables were added.',
      'No destructive migration was added.',
      'Real personal training data remains excluded',
      'POST /data-health/repair/apply',
      'backup/import/export over HTTP',
      'reset/recovery over HTTP',
      'eighth browser mutation route',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
