import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readSource, repoRoot } from './runtimeBoundaryTestHelpers';

const read = (path: string) => readSource(path);

const collectFiles = (directory: string): string[] => {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return collectFiles(path);
    return /\.(ts|tsx|json|md)$/.test(entry.name) ? [path] : [];
  });
};

describe('Phase 20C auth runtime wiring boundary', () => {
  it('documents 20C as auth runtime wiring only', () => {
    const doc = read('docs/AUTH_RUNTIME_WIRING.md');

    for (const expected of [
      '# Phase 20C - Auth Runtime Wiring V1',
      'pure auth runtime wiring boundary',
      'requires Phase 20B readiness',
      'injected auth adapter',
      'explicit user action',
      'does not create a Supabase client',
      'does not write localStorage',
      'does not store tokens',
      'does not start sync runtime',
      'does not change source of truth',
      'session_checked',
      'signed_in',
      'signed_out',
      'clientCreated: false',
      'tokenStored: false',
      'localStorageChanged: false',
      'syncRuntimeEnabled: false',
      'liveCloudSyncActivated: false',
      'cloudPrimaryEnabled: false',
      'defaultSyncEnabled: false',
      'sourceOfTruthChanged: false',
      '20D may begin',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('keeps 20C source isolated from SDK clients env reads storage APIs and routes', () => {
    const source = read('src/cloudProduction/authRuntimeWiring.ts');

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

  it('does not wire 20C into App UI storage API runtime or schemas', () => {
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
        'buildAuthRuntimeWiring',
        'PHASE20C_AUTH_RUNTIME_WIRING_ID',
        'readyFor20D',
        '/auth',
        '/sync',
        '/cloud',
      ]) {
        expect(source).not.toContain(forbidden);
      }
    }
  });

  it('keeps API runtime files free of 20C auth runtime expansion', () => {
    for (const file of collectFiles(resolve(repoRoot(), 'apps/api/src'))) {
      const source = readFileSync(file, 'utf8');
      expect(source).not.toContain('buildAuthRuntimeWiring');
      expect(source).not.toContain('PHASE20C_AUTH_RUNTIME_WIRING_ID');
      expect(source).not.toContain('readyFor20D');
    }
  });

  it('keeps env package lockfile route and schema boundaries unchanged', () => {
    for (const path of ['.env', '.env.local', '.env.production', 'pnpm-lock.yaml']) {
      expect(existsSync(resolve(repoRoot(), path)), `${path} should not exist`).toBe(false);
    }

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

  it('records 20C in root docs without claiming sync cloud primary or default sync is live', () => {
    const docs = [
      read('docs/AUTH_RUNTIME_WIRING.md'),
      read('docs/CLOUD_AUTH_SYNC_ENTRY_GATE.md'),
      read('API_CONTRACT.md'),
      read('FULL_STACK_REFACTOR_PLAN.md'),
    ].join('\n');

    for (const expected of [
      'Phase 20C - Auth Runtime Wiring V1',
      'buildAuthRuntimeWiring',
      'readyFor20D',
      'tokenStored: false',
      'localStorageChanged: false',
      'syncRuntimeEnabled: false',
      'liveCloudSyncActivated: false',
      'cloudPrimaryEnabled: false',
      'defaultSyncEnabled: false',
      'sourceOfTruthChanged: false',
      '20D - Explicit Opt-In Sync Runtime Wiring V1',
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
