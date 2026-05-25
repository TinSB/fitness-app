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
    return /\.(ts|tsx|json|md)$/.test(entry.name) ? [path] : [];
  });

const gitDiff = (path: string): string =>
  execFileSync('git', ['diff', '--', path], {
    cwd: repoRoot(),
    encoding: 'utf8',
  }).trim();

describe('Phase 21F cloud parity check boundary', () => {
  it('documents 21F as read-after-upload local parity verification only', () => {
    const docs = [
      read('docs/CLOUD_PARITY_CHECK.md'),
      read('docs/CLOUD_AUTH_SYNC_ENTRY_GATE.md'),
      read('API_CONTRACT.md'),
      read('FULL_STACK_REFACTOR_PLAN.md'),
    ].join('\n');

    for (const expected of [
      'Phase 21F - Cloud Parity Check V1',
      'Cloud Parity Check only',
      'buildCloudParityCheck',
      'readyFor21G: true',
      'cloudReadAfterUploadVerified: true',
      'localParityVerified: true',
      'uploadReceiptVerified: true',
      'firstUploadPreviouslyPerformed: true',
      'newUploadPerformed: false',
      'cloudWriteAttempted: false',
      'uploadPerformed: false',
      'cloudDataChanged: false',
      'downloadPerformed: false',
      'autoApplied: false',
      'localDataChanged: false',
      'cloudPrimaryEnabled: false',
      'defaultSyncEnabled: false',
      'backgroundWorkEnabled: false',
      'sourceOfTruthChanged: false',
      'localStorageDeleted: false',
      '21G - Conflict Review V1',
    ]) {
      expect(docs).toContain(expected);
    }
  });

  it('keeps 21F source free of cloud writes storage writes routes timers and SDK clients', () => {
    const source = read('src/cloudProduction/cloudParityCheck.ts');

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
      '/auth',
      'setInterval',
      'setTimeout',
      'serviceWorker',
      'backgroundSync',
      'writeCloudAppDataCandidate',
      'createCloudAppDataRepositoryCandidate',
      'SupabaseClientAdapterCandidate',
      'ProgramAdjustmentDraft',
      'PendingSessionPatch',
      'TrainingSession',
    ]) {
      expect(source, `source should not contain ${forbidden}`).not.toContain(forbidden);
    }
    expect(source).not.toMatch(/["'`]\/cloud/);
    expect(source).toContain('readLatestCloudAppDataCandidate');
    expect(source).toContain('buildPhase19gCloudReadMirror');
  });

  it('does not wire 21F into App UI storage API runtime or schemas yet', () => {
    const runtimeSources = [
      'src/App.tsx',
      'src/features/ProfileView.tsx',
      'src/storage/persistence.ts',
      'src/storage/localStorageAdapter.ts',
      'apps/api/src/index.ts',
      'src/models/training-model.ts',
      'src/models/training-data.schema.json',
    ].map(read);

    for (const source of runtimeSources) {
      for (const forbidden of [
        'buildCloudParityCheck',
        'PHASE21F_CLOUD_PARITY_CHECK_ID',
        'readyFor21G',
        '/auth',
        '/sync',
        '/cloud',
      ]) {
        expect(source).not.toContain(forbidden);
      }
    }
  });

  it('keeps API runtime files free of 21F parity check expansion', () => {
    for (const file of collectFiles(resolve(repoRoot(), 'apps/api/src'))) {
      const source = readFileSync(file, 'utf8');
      expect(source).not.toContain('buildCloudParityCheck');
      expect(source).not.toContain('PHASE21F_CLOUD_PARITY_CHECK_ID');
      expect(source).not.toContain('readyFor21G');
    }
  });

  it('does not change schemas routes packages lockfiles or tracked env files', () => {
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
  });

  it('keeps touched copy free of forbidden terms and unsafe sync claims', () => {
    const source = [
      read('src/cloudProduction/cloudParityCheck.ts'),
      read('docs/CLOUD_PARITY_CHECK.md'),
    ].join('\n');

    for (const expected of [
      '同步完成',
      '发现冲突',
      'Cloud Parity Check only',
      'Conflict Review',
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
