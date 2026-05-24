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

describe('Phase 20A live cloud sync activation authorization boundary', () => {
  it('documents 20A as authorization only with runtime activation still off', () => {
    const doc = read('docs/LIVE_CLOUD_SYNC_ACTIVATION_AUTHORIZATION_GATE.md');

    for (const expected of [
      '# Phase 20A - Live Cloud Sync Activation Authorization Gate V1',
      'authorization gate only',
      'Phase 19L manual acceptance evidence',
      'explicit activation intent',
      'single-user personal scope',
      'localStorage fallback',
      'no silent overwrite',
      'no service role in browser',
      '20B - Supabase Project Env & Runtime Readiness Check V1',
      '20I - v0 UI Polish Handoff Contract V1',
      'liveCloudSyncActivated: false',
      'authRuntimeEnabled: false',
      'syncRuntimeEnabled: false',
      'cloudPrimaryEnabled: false',
      'defaultSyncEnabled: false',
      'backgroundWorkEnabled: false',
      'sourceOfTruthChanged: false',
      'localStorageDeleted: false',
      'Live sync remains inactive.',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('keeps the 20A source pure and isolated from runtime side effects', () => {
    const source = read('src/cloudProduction/liveCloudSyncActivationAuthorizationGate.ts');

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
      '/auth',
      '/login',
      '/signup',
      '/sync',
      '/cloud',
      'setInterval',
      'setTimeout',
      'serviceWorker',
      'backgroundSync',
      'deploy(',
      'writeCloudAppDataCandidate',
      'runCloudPushCandidate',
      'runCloudPullCandidate',
    ]) {
      expect(source, `source should not contain ${forbidden}`).not.toContain(forbidden);
    }
  });

  it('does not wire 20A into App UI storage API runtime or schemas', () => {
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
        'buildLiveCloudSyncActivationAuthorizationGate',
        'PHASE20A_LIVE_CLOUD_SYNC_ACTIVATION_AUTHORIZATION_GATE_ID',
        'liveCloudSyncActivated',
        '/auth',
        '/sync',
        '/cloud',
      ]) {
        expect(source).not.toContain(forbidden);
      }
    }
  });

  it('keeps API runtime files free of 20A activation expansion', () => {
    for (const file of collectFiles(resolve(repoRoot(), 'apps/api/src'))) {
      const source = readFileSync(file, 'utf8');
      expect(source).not.toContain('buildLiveCloudSyncActivationAuthorizationGate');
      expect(source).not.toContain('PHASE20A_LIVE_CLOUD_SYNC_ACTIVATION_AUTHORIZATION_GATE_ID');
      expect(source).not.toContain('liveCloudSyncActivated');
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

  it('records 20A in root docs without claiming live runtime behavior is enabled', () => {
    const docs = [
      read('docs/LIVE_CLOUD_SYNC_ACTIVATION_AUTHORIZATION_GATE.md'),
      read('docs/CLOUD_AUTH_SYNC_ENTRY_GATE.md'),
      read('API_CONTRACT.md'),
      read('FULL_STACK_REFACTOR_PLAN.md'),
    ].join('\n');

    for (const expected of [
      'Phase 20A - Live Cloud Sync Activation Authorization Gate V1',
      'runtimeImplementationAuthorized',
      'canStart20B',
      'liveCloudSyncActivated: false',
      'authRuntimeEnabled: false',
      'syncRuntimeEnabled: false',
      'cloudPrimaryEnabled: false',
      'defaultSyncEnabled: false',
      'backgroundWorkEnabled: false',
      'sourceOfTruthChanged: false',
      'localStorageDeleted: false',
      '20B - Supabase Project Env & Runtime Readiness Check V1',
    ]) {
      expect(docs).toContain(expected);
    }

    for (const forbidden of [
      'live sync is active',
      'default cloud sync is enabled',
      'background sync is enabled',
      'cloud primary is now default',
      'real auth is enabled',
      'automatic multi-device sync is enabled',
      'localStorage is replaced',
      'v0 polish has started',
    ]) {
      expect(docs).not.toContain(forbidden);
    }
  });
});
