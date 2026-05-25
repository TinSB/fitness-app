import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';
import { createRuntimeSourceSelector } from '../src/storage/runtimeSourceSelector';
import { collectSrcRuntimeFiles, expectSourceNotToContain, readSource, relativePath, repoRoot } from './runtimeBoundaryTestHelpers';

const authorizedEmailPasswordAuthFiles = new Set([
  'src/cloudProduction/authRuntimeWiring.ts',
  'src/cloudProduction/supabaseAuthRuntimeAdapter.ts',
  'src/uiOs/settings/CloudSyncPolishSettingsPanel.tsx',
  'src/uiOs/settings/cloudSyncAuthActionController.ts',
  'src/uiOs/settings/cloudSyncRuntimeSettingsAdapter.ts',
  'src/cloudSync/CloudAuthCard.tsx',
  'src/cloudSync/index.ts',
]);

const authBlockedRuntimeFiles = () =>
  collectSrcRuntimeFiles().filter((path) => {
    const relative = relativePath(path).replace(/\\/g, '/');
    return !relative.startsWith('src/auth/') && !authorizedEmailPasswordAuthFiles.has(relative);
  });

describe('auth boundary still blocked', () => {
  it('keeps browser runtime free of auth/account routes and provider runtime', () => {
    for (const file of authBlockedRuntimeFiles()) {
      expectSourceNotToContain(file, [
        '/auth',
        '/login',
        '/signup',
        '/users',
        'OAuth',
        'password',
        'token storage',
        'authProvider',
        '/data-health/repair/apply',
        '/backup/import',
        '/backup/export',
        '/reset/',
        '/recovery/',
        'node:http',
        'node:sqlite',
        'devLauncher',
        'httpRuntimeAdapter',
        'serverAdapter',
        'sqliteRepository',
        'devApiRunner',
        'devDbRecovery',
      ]);
    }
  });

  it('allows only the Settings email/password auth adapter while keeping sync and storage blocked', () => {
    const source = [
      readSource('src/cloudProduction/supabaseAuthRuntimeAdapter.ts'),
      readSource('src/uiOs/settings/CloudSyncPolishSettingsPanel.tsx'),
      readSource('src/cloudSync/CloudAuthCard.tsx'),
    ].join('\n');

    expect(source).toContain('signInWithPassword');
    expect(source).toContain('signUp');
    expect(source).toContain('ironpath-auth-password-input');
    expect(source).not.toContain('signInWithOtp');
    for (const forbidden of [
      'SUPABASE_SERVICE_ROLE',
      'localStorage.removeItem',
      'localStorage.clear',
      'upsertPlanAdjustmentDraftByFingerprint',
      'upsertPendingSessionPatch',
      'applySessionPatches',
      'syncRuntimeEnabled: true',
      'cloudPrimaryEnabled: true',
      'defaultSyncEnabled: true',
      'backgroundWorkEnabled: true',
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it('keeps exact accepted browser mutation routes and localStorage default', () => {
    expect(API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES).toEqual([
      '/data-health/issues/:issueId/dismiss',
      '/history/:id/data-flag',
      '/history/:id/edit',
      '/sessions/start',
      '/sessions/active/patches',
      '/sessions/active/complete',
      '/sessions/active/discard',
    ]);
    expect(createRuntimeSourceSelector({ DEV: true })).toMatchObject({
      mode: 'localStorage',
      sourceOfTruth: 'localStorage',
      apiWriteEnabled: false,
    });
  });

  it('keeps package files unchanged and limits auth skeleton files after Task 6.13', () => {
    const packageJson = JSON.parse(readSource('package.json')) as {
      scripts: Record<string, string>;
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
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
    expect(readdirSync(resolve(repoRoot(), 'src/auth')).sort()).toEqual([
      'authBoundary.ts',
      'authProviderTypes.ts',
    ]);
  });
});
