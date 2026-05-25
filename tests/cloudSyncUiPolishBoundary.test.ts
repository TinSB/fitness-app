import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readSource, repoRoot } from './runtimeBoundaryTestHelpers';

const read = (path: string) => readSource(path);

const collectFiles = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return collectFiles(path);
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });

const cloudSyncSource = () =>
  collectFiles(resolve(repoRoot(), 'src/cloudSync')).map((file) => readFileSync(file, 'utf8')).join('\n');

const cloudSyncSettingsControllerSource = () =>
  [
    resolve(repoRoot(), 'src/uiOs/settings/CloudSyncPolishSettingsPanel.tsx'),
    resolve(repoRoot(), 'src/uiOs/settings/cloudSyncAuthActionController.ts'),
    resolve(repoRoot(), 'src/uiOs/settings/cloudSyncRuntimeSettingsAdapter.ts'),
  ].map((file) => readFileSync(file, 'utf8')).join('\n');

describe('Cloud Sync UI Polish V1 boundary', () => {
  it('keeps v0 cloud sync components presentational and free of cloud/storage logic', () => {
    const source = cloudSyncSource();

    for (const forbidden of [
      '@supabase/supabase-js',
      'createClient(',
      'signInWithOtp',
      'VITE_SUPABASE',
      'SUPABASE_SERVICE_ROLE',
      'process.env',
      'import.meta.env',
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
      'setInterval',
      'setTimeout',
      'serviceWorker',
      'backgroundSync',
      'ProgramAdjustmentDraft',
      'PendingSessionPatch',
      'TrainingSession',
    ]) {
      expect(source, `cloud sync UI source should not contain ${forbidden}`).not.toContain(forbidden);
    }
  });

  it('keeps the Settings runtime controller free of direct Supabase storage and sync side effects', () => {
    const source = cloudSyncSettingsControllerSource();

    expect(source).toContain('buildSupabaseProjectRuntimeReadinessCheck');
    expect(source).toContain('buildAuthRuntimeWiring');
    expect(source).toContain('buildCloudSyncSettingsSectionPropsFromRuntime');

    for (const forbidden of [
      '@supabase/supabase-js',
      'createClient(',
      'signInWithOtp',
      'gmail',
      'GOOGLE_GMAIL',
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
      'setInterval',
      'setTimeout',
      'serviceWorker',
      'backgroundSync',
      'runCloudPushCandidate',
      'runCloudPullCandidate',
      'writeCloudAppDataCandidate',
      'ProgramAdjustmentDraft',
      'PendingSessionPatch',
      'TrainingSession',
    ]) {
      expect(source, `cloud sync Settings controller should not contain ${forbidden}`).not.toContain(forbidden);
    }
  });

  it('preserves all v0 handoff data-testid markers', () => {
    const source = cloudSyncSource();

    for (const testId of [
      'ironpath-auth-card',
      'ironpath-sync-status-center',
      'ironpath-first-sync-flow',
      'ironpath-conflict-review',
      'ironpath-offline-recovery',
      'ironpath-account-settings',
    ]) {
      expect(source).toContain(testId);
    }
  });

  it('mounts the cloud sync polish surface only in Settings/Profile', () => {
    const profile = read('src/features/ProfileView.tsx');
    const app = read('src/App.tsx');
    const today = existsSync(resolve(repoRoot(), 'src/features/TodayView.tsx'))
      ? read('src/features/TodayView.tsx')
      : '';
    const record = read('src/features/RecordView.tsx');
    const training = existsSync(resolve(repoRoot(), 'src/features/TrainingFocusView.tsx'))
      ? read('src/features/TrainingFocusView.tsx')
      : read('src/features/TrainingView.tsx');

    expect(profile).toContain("import { CloudSyncPolishSettingsPanel } from '../uiOs/settings/CloudSyncPolishSettingsPanel';");
    expect(profile).toContain('<CloudSyncPolishSettingsPanel appData={data} />');

    for (const source of [app, today, record, training]) {
      expect(source).not.toContain('CloudSyncPolishSettingsPanel');
      expect(source).not.toContain('ironpath-cloud-sync-settings-section');
    }
  });

  it('does not change schemas routes packages or lockfiles', () => {
    expect(existsSync(resolve(repoRoot(), 'pnpm-lock.yaml')), 'pnpm-lock.yaml should remain absent').toBe(false);

    for (const path of [
      'package.json',
      'package-lock.json',
      'yarn.lock',
      'src/models/training-model.ts',
      'src/models/training-data.schema.json',
      'apps/api/src/index.ts',
    ]) {
      const diff = readFileSafeDiff(path);
      expect(diff, `${path} should not be changed`).toBe('');
    }
  });

  it('keeps forbidden product scope and unsafe sync copy out of touched cloud sync UI source', () => {
    const source = [cloudSyncSource(), cloudSyncSettingsControllerSource()].join('\n');

    for (const forbidden of [
      '引擎',
      '算法',
      '自动化',
      '模型',
      'AI 教练',
      '系统判断',
      '智能推荐',
      '决策系统',
      '订阅',
      '付费',
      '管理后台',
      '团队',
      '教练',
      '社交',
      'billing',
      'subscription',
      'admin',
      'team',
      'coach',
      'social',
      '同步已开启',
      '默认开启',
      '后台同步',
      '自动上传',
      '自动应用',
      '云端已成为默认',
      '自动覆盖',
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });
});

function readFileSafeDiff(path: string): string {
  return execFileSync('git', ['diff', '--', path], {
    cwd: repoRoot(),
    encoding: 'utf8',
  }).trim();
}
