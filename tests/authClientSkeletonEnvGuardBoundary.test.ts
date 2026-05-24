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
    return /\.(ts|tsx|json|md|sql)$/.test(entry.name) ? [path] : [];
  });
};

describe('Phase 19E auth client skeleton env guard boundary', () => {
  it('documents 19E as auth client skeleton and env guard only', () => {
    const doc = read('docs/AUTH_CLIENT_SKELETON_ENV_GUARD.md');

    for (const expected of [
      '# Phase 19E - Auth Client Skeleton + Env Guard V1',
      'guarded auth client skeleton',
      'environment guard',
      'Login is not required',
      'No token is stored.',
      'No Supabase network request is made.',
      'No AppData or TrainingSession schema changes are made.',
      'localStorage remains default, fallback, migration source, and emergency rollback source',
      '19F - Auth UI Skeleton V1',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('keeps the 19E source isolated from SDK creation network storage routes and Node APIs', () => {
    const source = read('src/cloudProduction/authClientSkeletonEnvGuard.ts');

    for (const forbidden of [
      '@supabase/supabase-js',
      'createClient(',
      'fetch(',
      'XMLHttpRequest',
      'localStorage.setItem',
      'localStorage.removeItem',
      'writeAppDataToLocalStorage',
      'readStoredAppDataFromLocalStorage',
      'saveData(',
      'loadData(',
      '../storage/persistence',
      './supabaseClientAdapterCandidate',
      './cloudAppDataRepositoryCandidate',
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
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it('does not wire 19E into App runtime storage API runtime or schemas', () => {
    const runtimeSources = [
      'src/App.tsx',
      'src/storage/persistence.ts',
      'src/storage/localStorageAdapter.ts',
      'apps/api/src/index.ts',
      'src/models/training-model.ts',
      'src/models/training-data.schema.json',
    ].map(read);

    for (const source of runtimeSources) {
      for (const forbidden of [
        'authClientSkeletonEnvGuard',
        'AUTH_CLIENT_SKELETON_ENV_GUARD',
        '/auth/login',
        '/auth/callback',
        '/sync',
        '/cloud-sync',
        'cloud_appdata_snapshots',
      ]) {
        expect(source).not.toContain(forbidden);
      }
    }
  });

  it('keeps API runtime files free of 19E auth client expansion', () => {
    for (const file of collectFiles(resolve(repoRoot(), 'apps/api/src'))) {
      const source = readFileSync(file, 'utf8');
      expect(source).not.toContain('authClientSkeletonEnvGuard');
      expect(source).not.toContain('AUTH_CLIENT_SKELETON_ENV_GUARD');
      expect(source).not.toContain('cloud_appdata_snapshots');
    }
  });

  it('keeps env files package scripts dependencies and lockfiles unchanged', () => {
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

  it('keeps docs from claiming auth sync cloud primary or login requirement is live', () => {
    const docs = [
      read('docs/AUTH_CLIENT_SKELETON_ENV_GUARD.md'),
      read('docs/CLOUD_AUTH_SYNC_ENTRY_GATE.md'),
      read('API_CONTRACT.md'),
      read('FULL_STACK_REFACTOR_PLAN.md'),
    ].join('\n');

    for (const forbidden of [
      'login is required',
      'tokens are stored',
      'default cloud sync is enabled',
      'background sync is enabled',
      'cloud primary is now default',
      'real auth is enabled',
      'automatic multi-device sync is enabled',
      'automatic upload is enabled',
      'public SaaS is launched',
    ]) {
      expect(docs).not.toContain(forbidden);
    }
  });
});
