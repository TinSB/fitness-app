import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PHASE19D_SUPABASE_MIGRATION_FILE } from '../src/cloudProduction/supabaseMigrationLocalTypeContracts';
import { readSource, repoRoot } from './runtimeBoundaryTestHelpers';

const read = (path: string) => readSource(path);

const collectFiles = (directory: string): string[] => {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return collectFiles(path);
    return /\.(ts|tsx|json|md|sql)$/.test(entry.name) ? [path] : [];
  });
};

const listSupabaseMigrations = () => {
  const directory = resolve(repoRoot(), 'supabase/migrations');
  if (!existsSync(directory)) return [];
  return readdirSync(directory).map((name) => `supabase/migrations/${name}`).sort();
};

describe('supabase migration local type contracts boundary', () => {
  it('documents 19D as reviewed migration files plus local type contracts only', () => {
    const doc = read('docs/SUPABASE_MIGRATIONS_LOCAL_TYPE_CONTRACTS.md');

    for (const expected of [
      '# Phase 19D - Supabase Migration Files + Local Type Contracts V1',
      PHASE19D_SUPABASE_MIGRATION_FILE,
      'local type contracts',
      'SQL is not applied by the app',
      'No Supabase connection is made',
      'localStorage remains default, fallback, migration source, and emergency rollback source',
      '19E - Auth Client Skeleton + Env Guard V1',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('allows only the exact 19D Supabase migration file and no database migration directory', () => {
    expect(listSupabaseMigrations()).toEqual([PHASE19D_SUPABASE_MIGRATION_FILE]);
    expect(existsSync(resolve(repoRoot(), 'database/migrations'))).toBe(false);
  });

  it('keeps the 19D type-contract source pure and isolated from runtime clients storage writers and APIs', () => {
    const source = read('src/cloudProduction/supabaseMigrationLocalTypeContracts.ts');

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

  it('does not wire 19D into App runtime storage API runtime or schemas', () => {
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
        'supabaseMigrationLocalTypeContracts',
        'SUPABASE_MIGRATIONS_LOCAL_TYPE_CONTRACTS',
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

  it('keeps API runtime files free of 19D migration and contract expansion', () => {
    for (const file of collectFiles(resolve(repoRoot(), 'apps/api/src'))) {
      const source = readFileSync(file, 'utf8');
      expect(source).not.toContain('supabaseMigrationLocalTypeContracts');
      expect(source).not.toContain('SUPABASE_MIGRATIONS_LOCAL_TYPE_CONTRACTS');
      expect(source).not.toContain('cloud_appdata_snapshots');
    }
  });

  it('keeps docs from claiming SQL was applied or runtime auth sync is live', () => {
    const docs = [
      read('docs/SUPABASE_MIGRATIONS_LOCAL_TYPE_CONTRACTS.md'),
      read('docs/SUPABASE_DATA_MODEL_RLS_CONTRACT.md'),
      read('docs/CLOUD_AUTH_SYNC_ENTRY_GATE.md'),
      read('API_CONTRACT.md'),
      read('FULL_STACK_REFACTOR_PLAN.md'),
    ].join('\n');

    for (const forbidden of [
      'SQL was applied',
      'migration was applied',
      'tables are live',
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
