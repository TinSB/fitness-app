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

describe('Phase 21B local backup dry-run UI boundary', () => {
  it('documents 21B as local backup dry-run UI only before cloud write shadow', () => {
    const docs = [
      read('docs/LOCAL_BACKUP_DRY_RUN_UI.md'),
      read('docs/CLOUD_AUTH_SYNC_ENTRY_GATE.md'),
      read('API_CONTRACT.md'),
      read('FULL_STACK_REFACTOR_PLAN.md'),
    ].join('\n');

    for (const expected of [
      'Phase 21B - Local Backup Dry Run UI V1',
      'Local Backup Dry Run UI only',
      'readyFor21C: true',
      'backupReady: true',
      'dryRunReady: true',
      'uploadPerformed: false',
      'downloadPerformed: false',
      'syncRuntimeEnabled: false',
      'cloudPrimaryEnabled: false',
      'defaultSyncEnabled: false',
      'backgroundWorkEnabled: false',
      'sourceOfTruthChanged: false',
      'localStorageDeleted: false',
      '21C - Cloud Write Shadow Candidate V1',
    ]) {
      expect(docs).toContain(expected);
    }
  });

  it('keeps the 21B source free of cloud IO storage writes routes timers and SDK clients', () => {
    const source = read('src/cloudProduction/localBackupDryRunUi.ts');

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
      '/auth',
      'setInterval',
      'setTimeout',
      'serviceWorker',
      'backgroundSync',
      'runCloudPushCandidate',
      'runCloudPullCandidate',
      'writeCloudAppDataCandidate',
      'writeCloudAppData',
      'buildCloudReadWriteVerificationFlow',
      'buildCloudWriteShadowMode',
      'ProgramAdjustmentDraft',
      'PendingSessionPatch',
      'TrainingSession',
    ]) {
      expect(source, `source should not contain ${forbidden}`).not.toContain(forbidden);
    }
  });

  it('keeps runtime wiring limited to Settings and presentational sync components', () => {
    const app = read('src/App.tsx');
    const profile = read('src/features/ProfileView.tsx');
    const record = read('src/features/RecordView.tsx');
    const training = read('src/features/TrainingFocusView.tsx');
    const today = existsSync(resolve(repoRoot(), 'src/features/TodayView.tsx'))
      ? read('src/features/TodayView.tsx')
      : '';
    const settingsAdapter = read('src/uiOs/settings/cloudSyncRuntimeSettingsAdapter.ts');
    const settingsPanel = read('src/uiOs/settings/CloudSyncPolishSettingsPanel.tsx');
    const firstSyncFlow = read('src/cloudSync/FirstSyncFlow.tsx');

    expect(settingsAdapter).toContain('localBackupDryRunUi');
    expect(settingsPanel).toContain('buildLocalBackupDryRunUi');
    expect(profile).toContain('<CloudSyncPolishSettingsPanel appData={data} />');
    expect(firstSyncFlow).toContain('ironpath-local-backup-dry-run-preview');

    for (const source of [app, record, training, today]) {
      expect(source).not.toContain('buildLocalBackupDryRunUi');
      expect(source).not.toContain('ironpath-local-backup-dry-run-preview');
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
      expect(source).not.toContain('buildLocalBackupDryRunUi');
      expect(source).not.toContain('PHASE21B_LOCAL_BACKUP_DRY_RUN_UI_ID');
      expect(source).not.toContain('readyFor21C');
    }
  });

  it('keeps touched visible copy free of forbidden terms and unsafe sync claims', () => {
    const source = [
      read('src/cloudProduction/localBackupDryRunUi.ts'),
      read('src/cloudSync/FirstSyncFlow.tsx'),
      read('src/uiOs/settings/CloudSyncPolishSettingsPanel.tsx'),
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
