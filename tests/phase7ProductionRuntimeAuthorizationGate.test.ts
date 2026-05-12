import { describe, expect, it } from 'vitest';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';
import { createRuntimeSourceSelector } from '../src/storage/runtimeSourceSelector';
import { readSource } from './runtimeBoundaryTestHelpers';

const docPath = 'docs/PHASE7_PRODUCTION_RUNTIME_IMPLEMENTATION_AUTHORIZATION_GATE.md';

describe('phase 7 production runtime implementation authorization gate', () => {
  it('records Phase 6 completion evidence and validation baseline', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'Task 6.40 Phase 6 Completion Archive V1',
      'PR: #152',
      'Merge commit: `790c49d`',
      '`npm run api:dev:build`: passed',
      '`npm run typecheck`: passed',
      '`npm test`: passed, 915 files / 3557 tests',
      '`npm run build`: passed',
      'dist token scan: clean',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('locks authorization categories and blocked implementation', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'docs/static authorization gate',
      'production runtime contract planning',
      'production runtime scaffold candidate',
      'production backend runtime',
      'auth/user accounts runtime',
      'cloud sync runtime',
      'deployment runtime',
      'monitoring runtime',
      'production source-of-truth switch',
      'normalized tables/schema migration',
      'destructive real-data migration',
      'additional browser mutation routes',
      'backup/import/export over HTTP',
      'reset/recovery over HTTP',
      'api-primary-dev production promotion',
      'Task 7.2 is not started by Task 7.1.',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('keeps runtime source and accepted route boundaries unchanged', () => {
    expect(API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES).toEqual([
      '/data-health/issues/:issueId/dismiss',
      '/history/:id/data-flag',
      '/history/:id/edit',
      '/sessions/start',
      '/sessions/active/patches',
      '/sessions/active/complete',
      '/sessions/active/discard',
    ]);
    expect(createRuntimeSourceSelector({ DEV: true })).toMatchObject({
      mode: 'localStorage',
      sourceOfTruth: 'localStorage',
      apiWriteEnabled: false,
    });
  });
});
