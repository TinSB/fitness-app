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

describe('Phase 20B Supabase project runtime readiness boundary', () => {
  it('documents 20B as a readiness check only', () => {
    const doc = read('docs/SUPABASE_PROJECT_RUNTIME_READINESS_CHECK.md');

    for (const expected of [
      '# Phase 20B - Supabase Project Env & Runtime Readiness Check V1',
      'pure readiness check',
      'does not create a Supabase client',
      'does not start auth runtime',
      'does not start sync runtime',
      '`VITE_SUPABASE_URL`',
      '`VITE_SUPABASE_ANON_KEY`',
      '`VITE_IRONPATH_AUTH_CALLBACK_URL`',
      '`VITE_IRONPATH_CLOUD_ENVIRONMENT`',
      'The service role key must never be present in browser config.',
      'readyFor20C: true',
      'clientCreated: false',
      'networkAttempted: false',
      'authRuntimeEnabled: false',
      'syncRuntimeEnabled: false',
      'liveCloudSyncActivated: false',
      'cloudPrimaryEnabled: false',
      'defaultSyncEnabled: false',
      'backgroundWorkEnabled: false',
      'sourceOfTruthChanged: false',
      'localStorageDeleted: false',
      '20C may begin',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('keeps 20B source isolated from env reads SDK clients networks storage and routes', () => {
    const source = read('src/cloudProduction/supabaseProjectRuntimeReadinessCheck.ts');

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
      'deploy(',
      'writeCloudAppDataCandidate',
      'runCloudPushCandidate',
      'runCloudPullCandidate',
    ]) {
      expect(source, `source should not contain ${forbidden}`).not.toContain(forbidden);
    }
    expect(source).not.toMatch(/["'`]\/auth/);
  });

  it('does not wire 20B into App UI storage API runtime or schemas', () => {
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
        'buildSupabaseProjectRuntimeReadinessCheck',
        'PHASE20B_SUPABASE_PROJECT_RUNTIME_READINESS_CHECK_ID',
        'readyFor20C',
        '/auth',
        '/sync',
        '/cloud',
      ]) {
        expect(source).not.toContain(forbidden);
      }
    }
  });

  it('keeps API runtime files free of 20B runtime expansion', () => {
    for (const file of collectFiles(resolve(repoRoot(), 'apps/api/src'))) {
      const source = readFileSync(file, 'utf8');
      expect(source).not.toContain('buildSupabaseProjectRuntimeReadinessCheck');
      expect(source).not.toContain('PHASE20B_SUPABASE_PROJECT_RUNTIME_READINESS_CHECK_ID');
      expect(source).not.toContain('readyFor20C');
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

  it('records 20B in root docs without claiming runtime is live', () => {
    const docs = [
      read('docs/SUPABASE_PROJECT_RUNTIME_READINESS_CHECK.md'),
      read('docs/CLOUD_AUTH_SYNC_ENTRY_GATE.md'),
      read('API_CONTRACT.md'),
      read('FULL_STACK_REFACTOR_PLAN.md'),
    ].join('\n');

    for (const expected of [
      'Phase 20B - Supabase Project Env & Runtime Readiness Check V1',
      'VITE_SUPABASE_URL',
      'VITE_SUPABASE_ANON_KEY',
      'VITE_IRONPATH_AUTH_CALLBACK_URL',
      'VITE_IRONPATH_CLOUD_ENVIRONMENT',
      'readyFor20C',
      'clientCreated: false',
      'networkAttempted: false',
      'authRuntimeEnabled: false',
      'syncRuntimeEnabled: false',
      'liveCloudSyncActivated: false',
      'sourceOfTruthChanged: false',
      'localStorageDeleted: false',
      '20C - Auth Runtime Wiring V1',
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
