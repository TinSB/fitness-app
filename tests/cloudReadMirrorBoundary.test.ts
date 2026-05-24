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

describe('Phase 19G cloud read mirror boundary', () => {
  it('documents 19G as read mirror only', () => {
    const doc = read('docs/CLOUD_READ_MIRROR.md');

    for (const expected of [
      '# Phase 19G - Cloud Read Mirror V1',
      'read mirror only',
      'compares cloud candidate metadata with local snapshot metadata',
      'No cloud write is attempted.',
      'No local data is changed.',
      'No source-of-truth switch is made.',
      'localStorage remains default, fallback, migration source, and emergency rollback source',
      '19H - Cloud Write Shadow Mode V1',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('keeps source isolated from SDKs network storage writers routes and timers', () => {
    const source = read('src/cloudProduction/cloudReadMirror.ts');

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

  it('does not wire 19G into App UI storage API runtime or schemas', () => {
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
        'cloudReadMirror',
        'CLOUD_READ_MIRROR',
        '/auth/login',
        '/auth/callback',
        '/sync',
        '/cloud-sync',
      ]) {
        expect(source).not.toContain(forbidden);
      }
    }
  });

  it('keeps API runtime files free of 19G mirror expansion', () => {
    for (const file of collectFiles(resolve(repoRoot(), 'apps/api/src'))) {
      const source = readFileSync(file, 'utf8');
      expect(source).not.toContain('cloudReadMirror');
      expect(source).not.toContain('CLOUD_READ_MIRROR');
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

  it('keeps docs from claiming live sync writes or source-of-truth switch', () => {
    const docs = [
      read('docs/CLOUD_READ_MIRROR.md'),
      read('docs/CLOUD_AUTH_SYNC_ENTRY_GATE.md'),
      read('API_CONTRACT.md'),
      read('FULL_STACK_REFACTOR_PLAN.md'),
    ].join('\n');

    for (const forbidden of [
      'default cloud sync is enabled',
      'background sync is enabled',
      'cloud primary is now default',
      'real auth is enabled',
      'automatic multi-device sync is enabled',
      'cloud write is live',
      'localStorage is replaced',
    ]) {
      expect(docs).not.toContain(forbidden);
    }
  });
});
