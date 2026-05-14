import { describe, expect, it } from 'vitest';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';
import { createRuntimeSourceSelector } from '../src/storage/runtimeSourceSelector';
import { resolveSourceOfTruthRuntimeSwitchGuard } from '../src/productionCutover/sourceOfTruthRuntimeSwitchGuard';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('phase 11 auth provider boundary still blocked', () => {
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

  it('documents auth provider candidate safety boundaries', () => {
    const doc = readSource('docs/PHASE11_AUTH_PROVIDER_INTEGRATION_ENTRY_GATE.md');

    for (const expected of [
      'Auth provider candidate must not imply cloud sync.',
      'Login candidate must not automatically upload local training data.',
      'Logout candidate must not delete local emergency backup.',
      'Session failure must not block local app usage.',
      'package dependency, package script, or lockfile changes',
      'POST /data-health/repair/apply',
      'backup/import/export over HTTP',
      'reset/recovery over HTTP',
      'eighth browser mutation route',
      'real personal training data',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
