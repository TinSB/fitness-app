import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';
import { createRuntimeSourceSelector } from '../src/storage/runtimeSourceSelector';
import { expectNoTrackedEnvironmentFiles, readSource, repoRoot } from './runtimeBoundaryTestHelpers';

const read = (path: string) => readFileSync(resolve(repoRoot(), path), 'utf8');

const collectFiles = (directory: string): string[] => {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return collectFiles(path);
    return /\.(ts|tsx|json|md)$/.test(entry.name) ? [path] : [];
  });
};

describe('cloud auth sync boundary', () => {
  it('keeps localStorage default and accepted browser mutation routes exactly seven', () => {
    expect(createRuntimeSourceSelector({ DEV: true })).toMatchObject({
      mode: 'localStorage',
      sourceOfTruth: 'localStorage',
      apiWriteEnabled: false,
    });

    expect(API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES).toEqual([
      '/data-health/issues/:issueId/dismiss',
      '/history/:id/data-flag',
      '/history/:id/edit',
      '/sessions/start',
      '/sessions/active/patches',
      '/sessions/active/complete',
      '/sessions/active/discard',
    ]);
    expect(API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES).not.toContain('/data-health/repair/apply');
  });

  it('does not add cloud auth sync fields to AppData or TrainingSession schemas', () => {
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

  it('does not wire the entry gate into App runtime storage or API exports', () => {
    const runtimeSources = [
      'src/App.tsx',
      'src/storage/persistence.ts',
      'src/storage/localStorageAdapter.ts',
      'apps/api/src/index.ts',
    ].map(read);

    for (const source of runtimeSources) {
      for (const forbidden of [
        'CLOUD_AUTH_SYNC_ENTRY_GATE',
        'cloudAuthSyncEntryGate',
        'cloudAuthSync',
        '/cloud-auth-sync',
        '/sync',
        '/auth/login',
        '/auth/callback',
        'cloud_appdata_snapshots',
      ]) {
        expect(source).not.toContain(forbidden);
      }
    }
  });

  it('does not add unapproved migrations env files routes or cloud auth sync runtime modules', () => {
    expect(existsSync(resolve(repoRoot(), 'supabase/migrations/20260524000000_phase19d_appdata_snapshot.sql'))).toBe(true);
    for (const path of [
      'database/migrations',
      'apps/api/src/cloudAuthSync.ts',
      'apps/api/src/authRoutes.ts',
      'apps/api/src/syncRoutes.ts',
      'src/cloudAuthSync',
    ]) {
      expect(existsSync(resolve(repoRoot(), path)), `${path} should not exist`).toBe(false);
    }
    expectNoTrackedEnvironmentFiles();

    for (const file of collectFiles(resolve(repoRoot(), 'apps/api/src'))) {
      const source = readFileSync(file, 'utf8');
      expect(source).not.toContain('CLOUD_AUTH_SYNC_ENTRY_GATE');
      expect(source).not.toContain('cloudAuthSync');
      expect(source).not.toContain('cloud_appdata_snapshots');
    }
  });

  it('keeps package scripts dependencies and lockfiles unchanged by 19A', () => {
    const packageJson = JSON.parse(readSource('package.json')) as {
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
      scripts: Record<string, string>;
    };

    expect(packageJson.dependencies['@supabase/supabase-js']).toBeDefined();
    for (const forbidden of ['@clerk', 'next-auth', '@auth/core', 'firebase', 'auth0', 'workbox', '@sentry', 'stripe']) {
      expect(JSON.stringify(packageJson.dependencies)).not.toContain(forbidden);
      expect(JSON.stringify(packageJson.devDependencies)).not.toContain(forbidden);
    }
    for (const script of ['cloud:sync', 'auth:dev', 'supabase:start', 'deploy:production', 'db:migrate']) {
      expect(packageJson.scripts).not.toHaveProperty(script);
    }
    expect(readSource('package.json')).not.toContain('cloudAuthSync');
    expect(readSource('package-lock.json')).not.toContain('cloudAuthSync');
    expect(existsSync(resolve(repoRoot(), 'pnpm-lock.yaml'))).toBe(false);
  });

  it('documents blocked capabilities without claiming sync auth or cloud primary is live', () => {
    const docs = [
      readSource('docs/CLOUD_AUTH_SYNC_ENTRY_GATE.md'),
      readSource('API_CONTRACT.md'),
      readSource('FULL_STACK_REFACTOR_PLAN.md'),
    ].join('\n');

    for (const expected of [
      'no default cloud sync',
      'no background sync',
      'no automatic worker/timer/polling sync',
      'no route changes',
      'no AppData schema change',
      'no TrainingSession schema change',
      'no source-of-truth switch',
      'no package or lockfile drift',
      'no public SaaS',
      'no coach/student runtime',
    ]) {
      expect(docs).toContain(expected);
    }

    for (const forbidden of [
      'default cloud sync is enabled',
      'background sync is enabled',
      'cloud primary is now default',
      'real auth is enabled',
      'automatic multi-device sync is enabled',
      'public SaaS is launched',
      'coach/student runtime is enabled',
    ]) {
      expect(docs).not.toContain(forbidden);
    }
  });
});
