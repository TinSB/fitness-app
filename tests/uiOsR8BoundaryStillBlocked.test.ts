import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';
import { collectSrcRuntimeFiles, expectSourceNotToContain } from './runtimeBoundaryTestHelpers';

const read = (path: string) => readFileSync(path, 'utf8');

const browserUiSources = [
  'src/App.tsx',
  'src/main.tsx',
  'src/features/TodayView.tsx',
  'src/features/TrainingFocusView.tsx',
  'src/features/RecordView.tsx',
  'src/features/ProfileView.tsx',
  'src/uiOs/MobileAppShell.tsx',
  'src/uiOs/BottomNav.tsx',
  'src/uiOs/navigation/FloatingBottomNav.tsx',
  'src/uiOs/theme/themeSurfaceModel.ts',
  'src/uiOs/today/TodayFocusOverridePanel.tsx',
  'src/uiOs/training/FocusModeActionBar.tsx',
  'src/uiOs/training/FocusModeSecondaryActions.tsx',
  'src/uiOs/settings/SettingsControlCenter.tsx',
];

describe('UI-OS R8 boundaries stay blocked', () => {
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

  it('keeps blocked route families out of browser runtime source', () => {
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

  it('keeps UI browser components free of cloud source prototype and algorithm mutation flags', () => {
    const combined = browserUiSources.map(read).join('\n');

    for (const forbidden of [
      '@supabase/supabase-js',
      'createClient',
      'node:',
      'IronPathOS2',
      'prototypePreview',
      'src/prototype',
      'sourceOfTruthChanged: true',
      'trainingAlgorithmChanged: true',
      'calculationChanged: true',
      'persistenceChanged: true',
      'routeSurfaceChanged: true',
      'cloudSyncChanged: true',
      'repairActionAllowed: true',
      'destructiveActionAllowed: true',
      'externalUploadAllowed: true',
    ]) {
      expect(combined).not.toContain(forbidden);
    }
  });

  it('keeps package lockfile script and pnpm boundaries unchanged', () => {
    const packageJson = JSON.parse(read('package.json')) as {
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
    for (const forbiddenScript of ['cloud:sync', 'sync:background', 'deploy:production', 'monitoring:upload', 'billing:start']) {
      expect(packageJson.scripts).not.toHaveProperty(forbiddenScript);
    }
    expect(existsSync('package-lock.json')).toBe(true);
    expect(existsSync('pnpm-lock.yaml')).toBe(false);
  });
});
