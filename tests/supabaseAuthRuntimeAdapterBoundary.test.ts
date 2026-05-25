import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readSource, repoRoot } from './runtimeBoundaryTestHelpers';

const collectFiles = (directory: string): string[] => {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return collectFiles(path);
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });
};

const readMany = (paths: string[]) => paths.map((path) => readFileSync(path, 'utf8')).join('\n');

describe('real Supabase auth runtime adapter boundary', () => {
  it('keeps the Supabase SDK isolated to the auth adapter and away from presentational UI', () => {
    const adapter = readSource('src/cloudProduction/supabaseAuthRuntimeAdapter.ts');
    const cloudSyncUi = readMany(collectFiles(resolve(repoRoot(), 'src/cloudSync')));
    const settingsSources = [
      'src/uiOs/settings/CloudSyncPolishSettingsPanel.tsx',
      'src/uiOs/settings/cloudSyncAuthActionController.ts',
      'src/uiOs/settings/cloudSyncRuntimeSettingsAdapter.ts',
    ].map(readSource).join('\n');

    expect(adapter).toContain("@supabase/supabase-js");
    expect(adapter).toContain('createClient');
    expect(cloudSyncUi).not.toContain('@supabase/supabase-js');
    expect(cloudSyncUi).not.toContain('createClient(');
    expect(settingsSources).not.toContain('@supabase/supabase-js');
    expect(settingsSources).not.toContain('createClient(');
  });

  it('uses only public browser configuration and does not expose service-role or token storage paths', () => {
    const source = readSource('src/cloudProduction/supabaseAuthRuntimeAdapter.ts');
    const settingsPanel = readSource('src/uiOs/settings/CloudSyncPolishSettingsPanel.tsx');

    expect(settingsPanel).toContain('VITE_SUPABASE_URL');
    expect(settingsPanel).toContain('VITE_SUPABASE_ANON_KEY');
    expect(settingsPanel).toContain('VITE_IRONPATH_AUTH_CALLBACK_URL');
    expect(settingsPanel).toContain('VITE_IRONPATH_CLOUD_ENVIRONMENT');
    expect(source).toContain('publicConfig');
    expect(source).toContain('persistSession: false');
    expect(source).toContain('autoRefreshToken: false');

    for (const forbidden of [
      'process.env',
      'import.meta.env',
      'SUPABASE_SERVICE_ROLE',
      'service_role',
      'localStorage.setItem',
      'localStorage.removeItem',
      'localStorage.clear',
      'writeAppDataToLocalStorage',
      'readStoredAppDataFromLocalStorage',
      '../storage/persistence',
      '../../storage/persistence',
      'document.cookie',
      'node:http',
      'node:sqlite',
    ]) {
      expect(source, `adapter should not contain ${forbidden}`).not.toContain(forbidden);
    }
  });

  it('does not add sync writes source-of-truth changes routes timers or plan/session mutation paths', () => {
    const source = [
      readSource('src/cloudProduction/supabaseAuthRuntimeAdapter.ts'),
      readSource('src/uiOs/settings/CloudSyncPolishSettingsPanel.tsx'),
      readSource('src/uiOs/settings/cloudSyncAuthActionController.ts'),
    ].join('\n');

    for (const forbidden of [
      'runCloudPushCandidate',
      'runCloudPullCandidate',
      'writeCloudAppDataCandidate',
      'uploadPerformed: true',
      'downloadPerformed: true',
      'cloudPrimaryEnabled: true',
      'defaultSyncEnabled: true',
      'backgroundWorkEnabled: true',
      'sourceOfTruthChanged: true',
      'localStorageDeleted: true',
      'setInterval',
      'serviceWorker',
      'backgroundSync',
      'ProgramAdjustmentDraft',
      'PendingSessionPatch',
    ]) {
      expect(source, `runtime auth path should not contain ${forbidden}`).not.toContain(forbidden);
    }
    expect(source).not.toMatch(/["'`]\/auth\/callback/);
    expect(source).not.toMatch(/["'`]\/sync/);
    expect(source).not.toMatch(/["'`]\/cloud/);
  });

  it('keeps package and lockfile boundaries clean for the real auth adapter task', () => {
    expect(existsSync(resolve(repoRoot(), 'pnpm-lock.yaml')), 'pnpm-lock.yaml should remain absent').toBe(false);

    for (const path of ['package.json', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml']) {
      const diff = execFileSync('git', ['diff', '--', path], {
        cwd: repoRoot(),
        encoding: 'utf8',
      }).trim();
      expect(diff, `${path} should not change`).toBe('');
    }
  });
});
