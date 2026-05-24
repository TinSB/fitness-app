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

describe('account boundary local inventory boundary', () => {
  it('documents 19B as pure account boundary and local inventory only', () => {
    const doc = read('docs/ACCOUNT_BOUNDARY_LOCAL_INVENTORY.md');

    for (const expected of [
      '# Phase 19B - Account Boundary & Local Inventory V1',
      'single-user multi-device sync',
      'local owner/account/device inventory',
      'backup/export preflight',
      '`localStorage` remains the current runtime source of truth',
      'Offline training remains available',
      'No last-write-wins default',
      'Supabase Auth + Supabase Postgres + RLS remains candidate architecture only',
      'service role key must never enter browser runtime',
      '19C - Supabase Data Model & RLS Contract V1',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('keeps the 19B source pure and isolated from auth sync storage writers and APIs', () => {
    const source = read('src/cloudProduction/accountBoundaryLocalInventory.ts');

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
      'setInterval',
      'setTimeout',
      'serviceWorker',
      'backgroundSync',
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it('does not wire 19B into App runtime storage APIs routes or Node server exports', () => {
    const runtimeSources = [
      'src/App.tsx',
      'src/storage/persistence.ts',
      'src/storage/localStorageAdapter.ts',
      'apps/api/src/index.ts',
    ].map(read);

    for (const source of runtimeSources) {
      for (const forbidden of [
        'accountBoundaryLocalInventory',
        'ACCOUNT_BOUNDARY_LOCAL_INVENTORY',
        'cloud_appdata_snapshots',
        '/auth/login',
        '/auth/callback',
        '/sync',
        '/cloud-sync',
      ]) {
        expect(source).not.toContain(forbidden);
      }
    }
  });

  it('does not add cloud sync fields to AppData or TrainingSession schemas', () => {
    const sources = [
      read('src/models/training-model.ts'),
      read('src/models/training-data.schema.json'),
      read('src/storage/persistence.ts'),
      read('src/storage/backup.ts'),
    ];

    for (const source of sources) {
      for (const forbidden of [
        'cloudAuthSync',
        'cloudSyncAccountId',
        'cloudSyncEnabled',
        'cloudAccountId',
        'supabaseUserId',
        'authUserId',
        'syncState',
        'cloud_appdata_snapshots',
      ]) {
        expect(source).not.toContain(forbidden);
      }
    }
  });

  it('does not add migrations env files routes or package drift', () => {
    for (const path of [
      'supabase/migrations',
      'database/migrations',
      'apps/api/src/cloudAuthSync.ts',
      'apps/api/src/authRoutes.ts',
      'apps/api/src/syncRoutes.ts',
      'src/cloudAuthSync',
      '.env',
      '.env.local',
      '.env.production',
      'pnpm-lock.yaml',
    ]) {
      expect(existsSync(resolve(repoRoot(), path)), `${path} should not exist`).toBe(false);
    }

    const packageJson = JSON.parse(read('package.json')) as {
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
      scripts: Record<string, string>;
    };

    for (const forbidden of ['@clerk', 'next-auth', '@auth/core', 'firebase', 'auth0', 'workbox']) {
      expect(JSON.stringify(packageJson.dependencies)).not.toContain(forbidden);
      expect(JSON.stringify(packageJson.devDependencies)).not.toContain(forbidden);
    }
    for (const script of ['cloud:sync', 'auth:dev', 'supabase:start', 'deploy:production', 'db:migrate']) {
      expect(packageJson.scripts).not.toHaveProperty(script);
    }
  });

  it('keeps API runtime files free of 19B cloud auth sync runtime expansion', () => {
    for (const file of collectFiles(resolve(repoRoot(), 'apps/api/src'))) {
      const source = readFileSync(file, 'utf8');
      expect(source).not.toContain('accountBoundaryLocalInventory');
      expect(source).not.toContain('ACCOUNT_BOUNDARY_LOCAL_INVENTORY');
      expect(source).not.toContain('cloud_appdata_snapshots');
    }
  });

  it('keeps docs from claiming live auth sync cloud primary or automatic upload', () => {
    const docs = [
      read('docs/ACCOUNT_BOUNDARY_LOCAL_INVENTORY.md'),
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
      'automatic upload is enabled',
      'public SaaS is launched',
    ]) {
      expect(docs).not.toContain(forbidden);
    }
  });
});
