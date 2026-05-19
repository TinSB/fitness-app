import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';
import { collectSrcRuntimeFiles, expectSourceNotToContain } from './runtimeBoundaryTestHelpers';

const read = (path: string) => readFileSync(path, 'utf8');

const browserUiSources = [
  'src/App.tsx',
  'src/features/TodayView.tsx',
  'src/features/TrainingFocusView.tsx',
  'src/features/TrainingView.tsx',
  'src/features/RecordView.tsx',
  'src/features/ProfileView.tsx',
  'src/uiOs/theme/themeSurfaceModel.ts',
  'src/uiOs/settings/SettingsControlCenter.tsx',
  'src/uiOs/settings/CloudCandidateSettingsPanel.tsx',
].map(read).join('\n');

describe('UI-OS R8.2 boundaries stay blocked', () => {
  it('keeps accepted browser mutation routes exactly seven', () => {
    expect(API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES).toEqual([
      '/data-health/issues/:issueId/dismiss',
      '/history/:id/data-flag',
      '/history/:id/edit',
      '/sessions/start',
      '/sessions/active/patches',
      '/sessions/active/complete',
      '/sessions/active/discard',
    ]);
  });

  it('keeps blocked route families out of runtime source', () => {
    for (const file of collectSrcRuntimeFiles()) {
      expectSourceNotToContain(file, [
        '/data-health/repair/apply',
        '/backup/import',
        '/backup/export',
        '/reset/',
        '/recovery/',
      ]);
    }
  });

  it('keeps algorithms source of truth cloud and prototype boundaries unchanged', () => {
    for (const forbidden of [
      'sourceOfTruthChanged: true',
      'trainingAlgorithmChanged: true',
      'calculationChanged: true',
      'persistenceChanged: true',
      'routeSurfaceChanged: true',
      'cloudSyncChanged: true',
      '@supabase/supabase-js',
      'createClient',
      'node:',
      'src/prototype',
      'IronPathOS2',
      'prototypePreview',
    ]) {
      expect(browserUiSources).not.toContain(forbidden);
    }
  });

  it('keeps package and lockfile boundaries unchanged', () => {
    const packageJson = JSON.parse(read('package.json')) as { scripts: Record<string, string> };

    for (const forbiddenScript of ['cloud:sync', 'sync:background', 'deploy:production', 'monitoring:upload', 'billing:start']) {
      expect(packageJson.scripts).not.toHaveProperty(forbiddenScript);
    }
    expect(existsSync('package-lock.json')).toBe(true);
    expect(existsSync('pnpm-lock.yaml')).toBe(false);
  });
});
