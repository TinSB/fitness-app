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

describe('supabase data model rls contract boundary', () => {
  it('documents 19C as a contract-only Supabase data model and RLS phase', () => {
    const doc = read('docs/SUPABASE_DATA_MODEL_RLS_CONTRACT.md');

    for (const expected of [
      '# Phase 19C - Supabase Data Model & RLS Contract V1',
      'contract-only',
      'Supabase Auth + Supabase Postgres + RLS',
      'document-first AppData snapshot model',
      'cloud_appdata_snapshots',
      'cloud_sync_operations',
      'cloud_devices',
      'cloud_conflicts',
      'cloud_export_delete_requests',
      'owner_user_id = auth.uid()',
      'account_id = owner_user_id',
      '19D - Supabase Migration Files + Local Type Contracts V1',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('keeps the 19C source pure and isolated from Supabase runtime APIs storage writers and Node servers', () => {
    const source = read('src/cloudProduction/supabaseDataModelRlsContract.ts');

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

  it('does not add unapproved migration files env files routes or package drift', () => {
    expect(existsSync(resolve(repoRoot(), 'supabase/migrations/20260524000000_phase19d_appdata_snapshot.sql'))).toBe(true);
    for (const path of [
      'database/migrations',
      'apps/api/src/cloudAuthSync.ts',
      'apps/api/src/authRoutes.ts',
      'apps/api/src/syncRoutes.ts',
      'src/cloudAuthSync',
      'pnpm-lock.yaml',
    ]) {
      expect(existsSync(resolve(repoRoot(), path)), `${path} should not exist`).toBe(false);
    }
    expectNoTrackedEnvironmentFiles();

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

  it('does not wire 19C into App runtime storage API runtime or schemas', () => {
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
        'supabaseDataModelRlsContract',
        'SUPABASE_DATA_MODEL_RLS_CONTRACT',
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

  it('keeps API runtime files free of 19C cloud schema and RLS expansion', () => {
    for (const file of collectFiles(resolve(repoRoot(), 'apps/api/src'))) {
      const source = readFileSync(file, 'utf8');
      expect(source).not.toContain('supabaseDataModelRlsContract');
      expect(source).not.toContain('SUPABASE_DATA_MODEL_RLS_CONTRACT');
      expect(source).not.toContain('create policy');
      expect(source).not.toContain('cloud_appdata_snapshots');
    }
  });

  it('keeps docs from claiming SQL migrations runtime auth sync or cloud primary are live', () => {
    const docs = [
      read('docs/SUPABASE_DATA_MODEL_RLS_CONTRACT.md'),
      read('docs/SUPABASE_MIGRATIONS_LOCAL_TYPE_CONTRACTS.md'),
      read('docs/CLOUD_AUTH_SYNC_ENTRY_GATE.md'),
      read('docs/ACCOUNT_BOUNDARY_LOCAL_INVENTORY.md'),
      read('API_CONTRACT.md'),
      read('FULL_STACK_REFACTOR_PLAN.md'),
    ].join('\n');

    for (const expected of [
      'No SQL is applied.',
      'SQL is not applied by the app.',
      'No table is created.',
      'No Supabase connection is made.',
      'localStorage remains default, fallback, migration source, and emergency rollback source',
    ]) {
      expect(docs).toContain(expected);
    }

    for (const forbidden of [
      'SQL applied',
      'tables created',
      'connected to Supabase production',
      'default cloud sync is enabled',
      'cloud primary is now default',
      'real auth is enabled',
      'automatic multi-device sync is enabled',
    ]) {
      expect(docs).not.toContain(forbidden);
    }
  });
});
