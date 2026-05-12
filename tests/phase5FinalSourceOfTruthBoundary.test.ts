import { describe, expect, it } from 'vitest';
import { createRuntimeSourceSelector } from '../src/storage/runtimeSourceSelector';
import { collectSrcRuntimeFiles, expectSourceNotToContain, readSource } from './runtimeBoundaryTestHelpers';

describe('Phase 5 final source-of-truth boundary', () => {
  it('keeps runtime source selector default-localStorage and dev/local only', () => {
    expect(createRuntimeSourceSelector({ DEV: true })).toMatchObject({
      mode: 'localStorage',
      sourceOfTruth: 'localStorage',
      appWriteTarget: 'localStorage',
      apiWriteEnabled: false,
    });

    expect(createRuntimeSourceSelector({
      DEV: false,
      VITE_IRONPATH_RUNTIME_SOURCE: 'api-primary-dev',
      VITE_IRONPATH_DEV_API_BASE_URL: 'http://127.0.0.1:8787',
    })).toMatchObject({
      mode: 'localStorage',
      sourceOfTruth: 'localStorage',
      apiWriteEnabled: false,
    });

    expect(createRuntimeSourceSelector({
      DEV: true,
      VITE_IRONPATH_RUNTIME_SOURCE: 'api-primary-dev',
      VITE_IRONPATH_DEV_API_BASE_URL: 'http://127.0.0.1:8787',
    })).toMatchObject({
      mode: 'api-primary-dev',
      sourceOfTruth: 'api-primary-dev',
      productionReady: false,
    });
  });

  it('keeps App.tsx free of direct migration and API primary runtime wiring', () => {
    const app = readSource('src/App.tsx');
    expect(app).not.toMatch(/apiWriteThroughRuntime|bootFromApiSnapshot|apiStorageAdapter|localStorageToSqliteMigration|migrationRollbackRecovery|VITE_IRONPATH_RUNTIME_SOURCE|api-primary-dev/);
  });

  it('keeps browser runtime free of blocked routes and Node-only tokens', () => {
    for (const file of collectSrcRuntimeFiles()) {
      expectSourceNotToContain(file, [
        '/data-health/repair/apply',
        '/backup/import',
        '/backup/export',
        '/reset/',
        '/recovery/',
        'node:http',
        'node:sqlite',
        'devLauncher',
        'httpRuntimeAdapter',
        'serverAdapter',
        'sqliteRepository',
        'devApiRunner',
        'devDbRecovery',
      ]);
    }
  });

  it('keeps docs from instructing production source-of-truth promotion', () => {
    const docs = [
      'docs/PHASE5_FINAL_SOURCE_OF_TRUTH_AUDIT.md',
      'docs/MIGRATION_REGRESSION_LOCK.md',
      'docs/API_PRIMARY_RUNTIME_REGRESSION_LOCK.md',
      'API_CONTRACT.md',
      'FULL_STACK_REFACTOR_PLAN.md',
    ].map(readSource).join('\n');

    for (const pattern of [
      /make API primary production default now/i,
      /delete localStorage now/i,
      /replace localStorage now/i,
      /enable production backend now/i,
      /enable auth now/i,
      /enable sync now/i,
      /enable cloud/i,
      /enable eighth browser mutation route/i,
    ]) {
      expect(docs).not.toMatch(pattern);
    }
  });
});
