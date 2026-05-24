import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { expectNoTrackedEnvironmentFiles, readSource, repoRoot } from './runtimeBoundaryTestHelpers';

const read = (path: string) => readSource(path);

const collectFiles = (directory: string): string[] => {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return collectFiles(path);
    return /\.(ts|tsx|json|md)$/.test(entry.name) ? [path] : [];
  });
};

describe('Phase 19K conflict offline rollback acceptance boundary', () => {
  it('documents 19K as acceptance only', () => {
    const doc = read('docs/CONFLICT_OFFLINE_ROLLBACK_ACCEPTANCE.md');

    for (const expected of [
      '# Phase 19K - Conflict / Offline / Rollback Acceptance V1',
      'acceptance only',
      'conflict review',
      'offline training remains available',
      'rollback remains available',
      'emergency local remains available',
      'No upload is performed.',
      'No download is performed.',
      'No local data is changed.',
      'No cloud data is changed.',
      'No source-of-truth switch is made.',
      'localStorage remains default, fallback, migration source, and emergency rollback source',
      '19L - Production Manual Acceptance V1',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('keeps source isolated from SDKs network storage writers routes timers and destructive paths', () => {
    const source = read('src/cloudProduction/conflictOfflineRollbackAcceptance.ts');

    for (const forbidden of [
      '@supabase/supabase-js',
      'createClient(',
      'fetch(',
      'XMLHttpRequest',
      'navigator.sendBeacon',
      'localStorage.setItem',
      'localStorage.removeItem',
      'writeAppDataToLocalStorage',
      'readStoredAppDataFromLocalStorage',
      'saveData(',
      'loadData(',
      '../storage/persistence',
      'apps/api/src',
      'node:http',
      'node:sqlite',
      'process.env',
      'document.cookie',
      '/auth/login',
      '/auth/callback',
      '/sync',
      '/cloud-sync',
      'setInterval',
      'setTimeout',
      'serviceWorker',
      'backgroundSync',
      'writeCloudAppDataCandidate',
      'runCloudPushCandidate',
      'runCloudPullCandidate',
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it('does not wire 19K into App UI storage API runtime or schemas', () => {
    const runtimeSources = [
      'src/App.tsx',
      'src/features/ProfileView.tsx',
      'src/storage/persistence.ts',
      'src/storage/localStorageAdapter.ts',
      'apps/api/src/index.ts',
      'src/models/training-model.ts',
      'src/models/training-data.schema.json',
    ].map(read);

    for (const source of runtimeSources) {
      for (const forbidden of [
        'buildPhase19kConflictOfflineRollbackAcceptance',
        'PHASE19K_CONFLICT_OFFLINE_ROLLBACK_ACCEPTANCE_ID',
        '/auth/login',
        '/auth/callback',
        '/sync',
        '/cloud-sync',
      ]) {
        expect(source).not.toContain(forbidden);
      }
    }
  });

  it('keeps API runtime files free of 19K acceptance expansion', () => {
    for (const file of collectFiles(resolve(repoRoot(), 'apps/api/src'))) {
      const source = readFileSync(file, 'utf8');
      expect(source).not.toContain('buildPhase19kConflictOfflineRollbackAcceptance');
      expect(source).not.toContain('PHASE19K_CONFLICT_OFFLINE_ROLLBACK_ACCEPTANCE_ID');
    }
  });

  it('keeps env package lockfile and schema boundaries unchanged', () => {
    expectNoTrackedEnvironmentFiles();
    expect(existsSync(resolve(repoRoot(), 'pnpm-lock.yaml')), 'pnpm-lock.yaml should not exist').toBe(false);

    const packageJson = JSON.parse(read('package.json')) as {
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
      scripts: Record<string, string>;
    };
    expect(packageJson.dependencies).toHaveProperty('@supabase/supabase-js');
    for (const forbidden of ['@clerk', 'next-auth', '@auth/core', 'firebase', 'auth0', 'workbox']) {
      expect(JSON.stringify(packageJson.dependencies)).not.toContain(forbidden);
      expect(JSON.stringify(packageJson.devDependencies)).not.toContain(forbidden);
    }
    for (const script of ['cloud:sync', 'auth:dev', 'supabase:start', 'deploy:production', 'db:migrate']) {
      expect(packageJson.scripts).not.toHaveProperty(script);
    }
  });

  it('records 19K in root phase docs without claiming default sync or cloud primary is live', () => {
    const docs = [
      read('docs/CONFLICT_OFFLINE_ROLLBACK_ACCEPTANCE.md'),
      read('docs/CLOUD_AUTH_SYNC_ENTRY_GATE.md'),
      read('API_CONTRACT.md'),
      read('FULL_STACK_REFACTOR_PLAN.md'),
    ].join('\n');

    for (const expected of [
      'Phase 19K - Conflict / Offline / Rollback Acceptance V1',
      'acceptedForManualProductionReview',
      'uploadPerformed: false',
      'downloadPerformed: false',
      'autoApplied: false',
      'defaultSyncEnabled: false',
      'backgroundWorkEnabled: false',
      'sourceOfTruthChanged: false',
      '19L - Production Manual Acceptance V1',
    ]) {
      expect(docs).toContain(expected);
    }

    for (const forbidden of [
      'default cloud sync is enabled',
      'background sync is enabled',
      'cloud primary is now default',
      'real auth is enabled',
      'automatic multi-device sync is enabled',
      'localStorage is replaced',
    ]) {
      expect(docs).not.toContain(forbidden);
    }
  });
});
