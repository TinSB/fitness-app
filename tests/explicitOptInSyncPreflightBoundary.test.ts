import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { expectNoTrackedEnvironmentFiles, expectNoUnexpectedAppDiff, readSource, repoRoot } from './runtimeBoundaryTestHelpers';

const read = (path: string) => readSource(path);

const collectFiles = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return collectFiles(path);
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });

const gitDiff = (path: string): string =>
  execFileSync('git', ['diff', '--', path], {
    cwd: repoRoot(),
    encoding: 'utf8',
  }).trim();

describe('Phase 21A explicit opt-in sync preflight boundary', () => {
  it('documents 21A as preflight only before backup and dry-run UI', () => {
    const docs = [
      read('docs/EXPLICIT_OPT_IN_SYNC_PREFLIGHT.md'),
      read('docs/CLOUD_AUTH_SYNC_ENTRY_GATE.md'),
      read('API_CONTRACT.md'),
      read('FULL_STACK_REFACTOR_PLAN.md'),
    ].join('\n');

    for (const expected of [
      'Phase 21A - Explicit Opt-In Sync Preflight V1',
      'preflight only',
      'readyFor21B: true',
      'uploadPerformed: false',
      'downloadPerformed: false',
      'syncRuntimeEnabled: false',
      'cloudPrimaryEnabled: false',
      'defaultSyncEnabled: false',
      'backgroundWorkEnabled: false',
      'sourceOfTruthChanged: false',
      'localStorageDeleted: false',
      '21B - Local Backup Dry Run UI V1',
    ]) {
      expect(docs).toContain(expected);
    }
  });

  it('keeps the 21A preflight source free of cloud IO storage routes timers and SDK clients', () => {
    const source = read('src/cloudProduction/explicitOptInSyncPreflight.ts');

    for (const forbidden of [
      '@supabase/supabase-js',
      'createClient(',
      'fetch(',
      'XMLHttpRequest',
      'navigator.sendBeacon',
      'localStorage.setItem',
      'localStorage.removeItem',
      'localStorage.clear',
      'writeAppDataToLocalStorage',
      'readStoredAppDataFromLocalStorage',
      '../storage/persistence',
      '../../storage/persistence',
      'apps/api/src',
      'node:http',
      'node:sqlite',
      'process.env',
      'import.meta.env',
      '.env',
      'document.cookie',
      '/sync',
      '/cloud',
      'setInterval',
      'setTimeout',
      'serviceWorker',
      'backgroundSync',
      'runCloudPushCandidate',
      'runCloudPullCandidate',
      'writeCloudAppDataCandidate',
      'writeCloudAppData',
      'buildLocalBackupDryRunMigrationRuntimeFlow',
      'buildCloudReadWriteVerificationFlow',
      'ProgramAdjustmentDraft',
      'PendingSessionPatch',
      'TrainingSession',
    ]) {
      expect(source, `source should not contain ${forbidden}`).not.toContain(forbidden);
    }
  });

  it('keeps runtime wiring limited to Settings and the presentational cloud sync section', () => {
    const app = read('src/App.tsx');
    const profile = read('src/features/ProfileView.tsx');
    const record = read('src/features/RecordView.tsx');
    const training = read('src/features/TrainingFocusView.tsx');
    const today = existsSync(resolve(repoRoot(), 'src/features/TodayView.tsx'))
      ? read('src/features/TodayView.tsx')
      : '';
    const settingsAdapter = read('src/uiOs/settings/cloudSyncRuntimeSettingsAdapter.ts');
    const settingsPanel = read('src/uiOs/settings/CloudSyncPolishSettingsPanel.tsx');
    const cloudSection = read('src/cloudSync/CloudSyncSettingsSection.tsx');

    expect(settingsAdapter).toContain('buildExplicitOptInSyncPreflight');
    expect(cloudSection).toContain('ironpath-explicit-sync-preflight');
    expect(settingsPanel).toContain('buildExplicitOptInSyncPreflight');
    expect(profile).toContain('<CloudSyncPolishSettingsPanel appData={data} />');

    for (const source of [app, record, training, today]) {
      expect(source).not.toContain('buildExplicitOptInSyncPreflight');
      expect(source).not.toContain('ironpath-explicit-sync-preflight');
    }
  });

  it('does not change schemas routes packages lockfiles or API runtime behavior', () => {
    expectNoTrackedEnvironmentFiles();
    expect(existsSync(resolve(repoRoot(), 'pnpm-lock.yaml')), 'pnpm-lock.yaml should remain absent').toBe(false);

    for (const path of [
      'package.json',
      'package-lock.json',
      'yarn.lock',
      'src/models/training-model.ts',
      'src/models/training-data.schema.json',
      'apps/api/src/index.ts',
    ]) {
      expect(gitDiff(path), `${path} should not be changed`).toBe('');
    }
    expectNoUnexpectedAppDiff(gitDiff('src/App.tsx'));

    for (const file of collectFiles(resolve(repoRoot(), 'apps/api/src'))) {
      const source = readFileSync(file, 'utf8');
      expect(source).not.toContain('buildExplicitOptInSyncPreflight');
      expect(source).not.toContain('PHASE21A_EXPLICIT_OPT_IN_SYNC_PREFLIGHT_ID');
      expect(source).not.toContain('readyFor21B');
    }
  });

  it('keeps touched visible copy free of forbidden terms and unsafe sync claims', () => {
    const source = [
      read('src/cloudProduction/explicitOptInSyncPreflight.ts'),
      read('src/cloudSync/CloudSyncSettingsSection.tsx'),
      read('src/uiOs/settings/cloudSyncRuntimeSettingsAdapter.ts'),
    ].join('\n');

    for (const expected of [
      '本地数据仍会保留',
      '开启前先备份',
      '检查本地数据',
      '查看将同步的内容',
    ]) {
      expect(source).toContain(expected);
    }

    for (const forbidden of [
      '引擎',
      '算法',
      '自动化',
      '模型',
      'AI 教练',
      '系统判断',
      '智能推荐',
      '决策系统',
      '自动上传',
      '自动应用',
      '默认开启',
      '后台同步',
      '云端优先',
      '删除本地数据',
      'billing',
      'subscription',
      'admin',
      'team',
      'coach',
      'social',
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });
});
