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

describe('Phase 19F auth UI skeleton boundary', () => {
  it('documents 19F as passive auth UI skeleton only', () => {
    const doc = read('docs/AUTH_UI_SKELETON.md');

    for (const expected of [
      '# Phase 19F - Auth UI Skeleton V1',
      'passive account surface',
      'No login flow is started.',
      'No token is stored.',
      'No sync is started.',
      'No cloud data is read or written.',
      'localStorage remains default, fallback, migration source, and emergency rollback source',
      '19G - Cloud Read Mirror V1',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('keeps the UI component isolated from auth clients storage routes and APIs', () => {
    const source = read('src/uiOs/settings/AuthUiSkeletonPanel.tsx');

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
      'authClientSkeletonEnvGuard',
      'buildPhase19eAuthClientSkeleton',
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
      'onClick',
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it('does not add AppData TrainingSession storage API route or env changes', () => {
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
        'AUTH_UI_SKELETON',
        '/auth/login',
        '/auth/callback',
        '/sync',
        '/cloud-sync',
        'cloud_appdata_snapshots',
      ]) {
        expect(source).not.toContain(forbidden);
      }
    }

    for (const path of ['.env', '.env.local', '.env.production', 'pnpm-lock.yaml']) {
      expect(existsSync(resolve(repoRoot(), path)), `${path} should not exist`).toBe(false);
    }
  });

  it('keeps API runtime files free of 19F UI expansion', () => {
    for (const file of collectFiles(resolve(repoRoot(), 'apps/api/src'))) {
      const source = readFileSync(file, 'utf8');
      expect(source).not.toContain('AuthUiSkeletonPanel');
      expect(source).not.toContain('AUTH_UI_SKELETON');
      expect(source).not.toContain('cloud_appdata_snapshots');
    }
  });

  it('keeps docs from claiming live auth sync cloud primary or login requirement', () => {
    const docs = [
      read('docs/AUTH_UI_SKELETON.md'),
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
