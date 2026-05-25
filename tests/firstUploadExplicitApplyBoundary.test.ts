import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { expectNoTrackedEnvironmentFiles, readSource, repoRoot } from './runtimeBoundaryTestHelpers';

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

describe('Phase 21E first upload explicit apply boundary', () => {
  it('documents 21E as first upload explicit apply only before parity check', () => {
    const docs = [
      read('docs/FIRST_UPLOAD_EXPLICIT_APPLY.md'),
      read('docs/CLOUD_AUTH_SYNC_ENTRY_GATE.md'),
      read('API_CONTRACT.md'),
      read('FULL_STACK_REFACTOR_PLAN.md'),
    ].join('\n');

    for (const expected of [
      'Phase 21E - First Upload Explicit Apply V1',
      'First Upload Explicit Apply only',
      'buildFirstUploadExplicitApply',
      'readyFor21F: true',
      'firstUploadExplicitlyApplied: true',
      'uploadPerformed: true',
      'cloudWriteAttempted: true',
      'cloudDataChanged: true',
      'syncRuntimeEnabled: true',
      'downloadPerformed: false',
      'autoApplied: false',
      'localDataChanged: false',
      'cloudPrimaryEnabled: false',
      'defaultSyncEnabled: false',
      'backgroundWorkEnabled: false',
      'sourceOfTruthChanged: false',
      'localStorageDeleted: false',
      '21F - Cloud Parity Check V1',
    ]) {
      expect(docs).toContain(expected);
    }
  });

  it('keeps 21E source free of unsafe storage writes routes timers and SDK clients', () => {
    const source = read('src/cloudProduction/firstUploadExplicitApply.ts');

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
      'createCloudAppDataRepositoryCandidate',
      'SupabaseClientAdapterCandidate',
      'ProgramAdjustmentDraft',
      'PendingSessionPatch',
      'TrainingSession',
    ]) {
      expect(source, `source should not contain ${forbidden}`).not.toContain(forbidden);
    }
    expect(source).not.toMatch(/["'`]\/cloud/);
    expect(source).toContain('writeCloudAppDataCandidate');
  });

  it('does not wire 21E into App UI storage API runtime or schemas yet', () => {
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
        'buildFirstUploadExplicitApply',
        'PHASE21E_FIRST_UPLOAD_EXPLICIT_APPLY_ID',
        'readyFor21F',
        '/auth',
        '/sync',
        '/cloud',
      ]) {
        expect(source).not.toContain(forbidden);
      }
    }
  });

  it('keeps API runtime files free of 21E first upload expansion', () => {
    for (const file of collectFiles(resolve(repoRoot(), 'apps/api/src'))) {
      const source = readFileSync(file, 'utf8');
      expect(source).not.toContain('buildFirstUploadExplicitApply');
      expect(source).not.toContain('PHASE21E_FIRST_UPLOAD_EXPLICIT_APPLY_ID');
      expect(source).not.toContain('readyFor21F');
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
      'src/App.tsx',
      'apps/api/src/index.ts',
    ]) {
      expect(gitDiff(path), `${path} should not be changed`).toBe('');
    }
  });

  it('keeps touched copy free of forbidden terms and unsafe sync claims', () => {
    const source = [
      read('src/cloudProduction/firstUploadExplicitApply.ts'),
      read('docs/FIRST_UPLOAD_EXPLICIT_APPLY.md'),
    ].join('\n');

    for (const expected of [
      '同步完成',
      'First Upload Explicit Apply only',
      'Cloud Parity Check',
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
