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

describe('Phase 20E local backup and dry-run migration runtime flow boundary', () => {
  it('documents 20E as local backup and dry-run runtime flow only', () => {
    const doc = read('docs/LOCAL_BACKUP_DRY_RUN_MIGRATION_RUNTIME_FLOW.md');

    for (const expected of [
      '# Phase 20E - Local Backup + Dry-Run Migration Runtime Flow V1',
      'local backup plus migration dry-run runtime flow',
      'does not upload data',
      'does not download data',
      'does not write localStorage',
      'does not write cloud data',
      'does not change source of truth',
      'backup/export confirmation',
      'account boundary inventory',
      'dry-run migration readiness',
      'readyFor20F: true',
      'uploadPerformed: false',
      'downloadPerformed: false',
      'liveCloudSyncActivated: false',
      'cloudPrimaryEnabled: false',
      'defaultSyncEnabled: false',
      'backgroundWorkEnabled: false',
      'sourceOfTruthChanged: false',
      'localStorageDeleted: false',
      '20F - Cloud Read/Write Verification Flow V1',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('keeps 20E source isolated from SDK clients networks routes timers persistence and cloud IO', () => {
    const source = read('src/cloudProduction/localBackupDryRunMigrationRuntimeFlow.ts');

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
      'import.meta.env',
      '.env',
      'document.cookie',
      '/login',
      '/signup',
      '/sync',
      '/cloud',
      'setInterval',
      'setTimeout',
      'serviceWorker',
      'backgroundSync',
      'writeCloudAppDataCandidate',
      'runCloudPushCandidate',
      'runCloudPullCandidate',
      'applyCloud',
      'uploadCloud',
      'downloadCloud',
    ]) {
      expect(source, `source should not contain ${forbidden}`).not.toContain(forbidden);
    }
    expect(source).toContain("from '../storage/backup'");
  });

  it('does not wire 20E into App UI storage API runtime or schemas', () => {
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
        'buildLocalBackupDryRunMigrationRuntimeFlow',
        'PHASE20E_LOCAL_BACKUP_DRY_RUN_MIGRATION_RUNTIME_FLOW_ID',
        'readyFor20F',
        '/auth',
        '/sync',
        '/cloud',
      ]) {
        expect(source).not.toContain(forbidden);
      }
    }
  });

  it('keeps API runtime files free of 20E runtime expansion', () => {
    for (const file of collectFiles(resolve(repoRoot(), 'apps/api/src'))) {
      const source = readFileSync(file, 'utf8');
      expect(source).not.toContain('buildLocalBackupDryRunMigrationRuntimeFlow');
      expect(source).not.toContain('PHASE20E_LOCAL_BACKUP_DRY_RUN_MIGRATION_RUNTIME_FLOW_ID');
      expect(source).not.toContain('readyFor20F');
    }
  });

  it('keeps env package lockfile route and schema boundaries unchanged', () => {
    expectNoTrackedEnvironmentFiles();
    expect(existsSync(resolve(repoRoot(), 'pnpm-lock.yaml')), 'pnpm-lock.yaml should not exist').toBe(false);

    const packageJson = JSON.parse(read('package.json')) as {
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
      scripts: Record<string, string>;
    };
    expect(Object.keys(packageJson.dependencies)).toEqual(['@supabase/supabase-js', 'ajv', 'lucide-react', 'react', 'react-dom']);
    expect(Object.keys(packageJson.devDependencies)).toEqual([
      '@tailwindcss/vite',
      '@types/node',
      '@types/react',
      '@types/react-dom',
      '@vitejs/plugin-react',
      'tailwindcss',
      'typescript',
      'vite',
      'vitest',
    ]);
    expect(Object.keys(packageJson.scripts)).toEqual([
      'dev',
      'api:dev:build',
      'api:dev',
      'build',
      'build:stats',
      'build:size-check',
      'predeploy:check',
      'preview',
      'typecheck',
      'test',
      'test:watch',
    ]);
  });

  it('records 20E in root docs without claiming live sync cloud primary or default sync is live', () => {
    const docs = [
      read('docs/LOCAL_BACKUP_DRY_RUN_MIGRATION_RUNTIME_FLOW.md'),
      read('docs/CLOUD_AUTH_SYNC_ENTRY_GATE.md'),
      read('API_CONTRACT.md'),
      read('FULL_STACK_REFACTOR_PLAN.md'),
    ].join('\n');

    for (const expected of [
      'Phase 20E - Local Backup + Dry-Run Migration Runtime Flow V1',
      'buildLocalBackupDryRunMigrationRuntimeFlow',
      'readyFor20F',
      'uploadPerformed: false',
      'downloadPerformed: false',
      'autoApplied: false',
      'liveCloudSyncActivated: false',
      'cloudPrimaryEnabled: false',
      'defaultSyncEnabled: false',
      'backgroundWorkEnabled: false',
      'sourceOfTruthChanged: false',
      'localStorageDeleted: false',
      '20F - Cloud Read/Write Verification Flow V1',
    ]) {
      expect(docs).toContain(expected);
    }

    for (const forbidden of [
      'live sync is active',
      'default cloud sync is enabled',
      'background sync is enabled',
      'cloud primary is now default',
      'automatic multi-device sync is enabled',
      'localStorage is replaced',
      'v0 polish has started',
    ]) {
      expect(docs).not.toContain(forbidden);
    }
  });
});
