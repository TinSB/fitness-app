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

describe('Phase 21C cloud write shadow candidate boundary', () => {
  it('documents 21C as in-memory shadow candidate only before cloud read mirror', () => {
    const docs = [
      read('docs/CLOUD_WRITE_SHADOW_CANDIDATE.md'),
      read('docs/CLOUD_AUTH_SYNC_ENTRY_GATE.md'),
      read('API_CONTRACT.md'),
      read('FULL_STACK_REFACTOR_PLAN.md'),
    ].join('\n');

    for (const expected of [
      'Phase 21C - Cloud Write Shadow Candidate V1',
      'Cloud Write Shadow Candidate only',
      'buildCloudWriteShadowCandidate',
      'readyFor21D: true',
      'shadowCandidateAccepted: true',
      'inMemoryShadowCandidateOnly: true',
      'requiresFirstUploadExplicitApply: true',
      'requiresCloudReadMirrorBeforeApply: true',
      'uploadPerformed: false',
      'downloadPerformed: false',
      'cloudWriteAttempted: false',
      'cloudDataChanged: false',
      'syncRuntimeEnabled: false',
      'cloudPrimaryEnabled: false',
      'defaultSyncEnabled: false',
      'backgroundWorkEnabled: false',
      'sourceOfTruthChanged: false',
      'localStorageDeleted: false',
      '21D - Cloud Read Mirror Verification V1',
    ]) {
      expect(docs).toContain(expected);
    }
  });

  it('keeps 21C source free of real cloud IO storage writes routes timers and SDK clients', () => {
    const source = read('src/cloudProduction/cloudWriteShadowCandidate.ts');

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
    expect(source).toContain('buildPhase19hCloudWriteShadowMode');
  });

  it('does not wire 21C into App UI storage API runtime or schemas', () => {
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
        'buildCloudWriteShadowCandidate',
        'PHASE21C_CLOUD_WRITE_SHADOW_CANDIDATE_ID',
        'readyFor21D',
        '/auth',
        '/sync',
        '/cloud',
      ]) {
        expect(source).not.toContain(forbidden);
      }
    }
  });

  it('keeps API runtime files free of 21C shadow candidate expansion', () => {
    for (const file of collectFiles(resolve(repoRoot(), 'apps/api/src'))) {
      const source = readFileSync(file, 'utf8');
      expect(source).not.toContain('buildCloudWriteShadowCandidate');
      expect(source).not.toContain('PHASE21C_CLOUD_WRITE_SHADOW_CANDIDATE_ID');
      expect(source).not.toContain('readyFor21D');
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
      read('src/cloudProduction/cloudWriteShadowCandidate.ts'),
      read('docs/CLOUD_WRITE_SHADOW_CANDIDATE.md'),
    ].join('\n');

    for (const expected of [
      '查看后再继续',
      'Cloud Write Shadow Candidate only',
      'First Upload Explicit Apply',
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
