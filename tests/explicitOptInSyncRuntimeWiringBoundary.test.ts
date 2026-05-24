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

describe('Phase 20D explicit opt-in sync runtime wiring boundary', () => {
  it('documents 20D as explicit opt-in runtime wiring only', () => {
    const doc = read('docs/EXPLICIT_OPT_IN_SYNC_RUNTIME_WIRING.md');

    for (const expected of [
      '# Phase 20D - Explicit Opt-In Sync Runtime Wiring V1',
      'explicit opt-in sync runtime wiring',
      'does not upload data',
      'does not download data',
      'localStorage fallback confirmation',
      'no silent overwrite confirmation',
      'backup-before-sync confirmation',
      'readyFor20E: true',
      'syncRuntimeEnabled: true',
      'uploadPerformed: false',
      'downloadPerformed: false',
      'liveCloudSyncActivated: false',
      'cloudPrimaryEnabled: false',
      'defaultSyncEnabled: false',
      'backgroundWorkEnabled: false',
      'sourceOfTruthChanged: false',
      'localStorageDeleted: false',
      '20E - Local Backup + Dry-Run Migration Runtime Flow V1',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('keeps 20D source isolated from SDK clients networks storage routes timers and cloud IO', () => {
    const source = read('src/cloudProduction/explicitOptInSyncRuntimeWiring.ts');

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
      'buildPhase19hCloudWriteShadowMode',
      'apply',
    ]) {
      expect(source, `source should not contain ${forbidden}`).not.toContain(forbidden);
    }
    expect(source).not.toMatch(/["'`]\/auth/);
  });

  it('does not wire 20D into App UI storage API runtime or schemas', () => {
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
        'buildExplicitOptInSyncRuntimeWiring',
        'PHASE20D_EXPLICIT_OPT_IN_SYNC_RUNTIME_WIRING_ID',
        'readyFor20E',
        '/auth',
        '/sync',
        '/cloud',
      ]) {
        expect(source).not.toContain(forbidden);
      }
    }
  });

  it('keeps API runtime files free of 20D sync runtime expansion', () => {
    for (const file of collectFiles(resolve(repoRoot(), 'apps/api/src'))) {
      const source = readFileSync(file, 'utf8');
      expect(source).not.toContain('buildExplicitOptInSyncRuntimeWiring');
      expect(source).not.toContain('PHASE20D_EXPLICIT_OPT_IN_SYNC_RUNTIME_WIRING_ID');
      expect(source).not.toContain('readyFor20E');
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

  it('records 20D in root docs without claiming data sync cloud primary or default sync is live', () => {
    const docs = [
      read('docs/EXPLICIT_OPT_IN_SYNC_RUNTIME_WIRING.md'),
      read('docs/CLOUD_AUTH_SYNC_ENTRY_GATE.md'),
      read('API_CONTRACT.md'),
      read('FULL_STACK_REFACTOR_PLAN.md'),
    ].join('\n');

    for (const expected of [
      'Phase 20D - Explicit Opt-In Sync Runtime Wiring V1',
      'buildExplicitOptInSyncRuntimeWiring',
      'readyFor20E',
      'syncRuntimeEnabled: true',
      'uploadPerformed: false',
      'downloadPerformed: false',
      'autoApplied: false',
      'liveCloudSyncActivated: false',
      'cloudPrimaryEnabled: false',
      'defaultSyncEnabled: false',
      'backgroundWorkEnabled: false',
      'sourceOfTruthChanged: false',
      'localStorageDeleted: false',
      '20E - Local Backup + Dry-Run Migration Runtime Flow V1',
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
