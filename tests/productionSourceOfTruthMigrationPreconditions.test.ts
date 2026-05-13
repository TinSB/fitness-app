import { describe, expect, it } from 'vitest';
import { createRuntimeSourceSelector } from '../src/storage/runtimeSourceSelector';
import { readSource } from './runtimeBoundaryTestHelpers';

const docPath = 'docs/PRODUCTION_SOURCE_OF_TRUTH_MIGRATION_PRECONDITIONS.md';

describe('production source of truth migration preconditions', () => {
  it('documents current truth and blocked switch status', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'localStorage remains the current source of truth',
      'default runtime source, fallback, migration source, and emergency backup',
      '`api-primary-dev` remains explicit dev/local only',
      'Task 7.4 does not authorize source-of-truth switch.',
    ]) {
      expect(doc).toContain(expected);
    }

    expect(createRuntimeSourceSelector({ DEV: true })).toMatchObject({
      mode: 'localStorage',
      sourceOfTruth: 'localStorage',
      apiWriteEnabled: false,
    });
  });

  it('locks all required preconditions', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'production backend exists',
      'auth/user identity exists',
      'user data ownership model exists',
      'backup/export safety exists',
      'rollback plan exists',
      'offline/failure behavior exists',
      'migration dry run exists',
      'localStorage emergency backup remains available',
      'no destructive real-data migration',
      'user-visible confirmation model exists',
      'monitoring/diagnostics exists before production switch',
      'manual acceptance checklist exists',
      'privacy/data safety reviewed',
      'production route surface frozen',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('documents failure modes and next task boundary', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'API unavailable',
      'auth mismatch',
      'ownership mismatch',
      'stale snapshot',
      'partial write',
      'rollback failure',
      'localStorage/API divergence',
      'no fake success',
      'Task 7.5 is not started by Task 7.4.',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
