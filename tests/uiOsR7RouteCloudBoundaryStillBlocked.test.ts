import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';
import { collectSrcRuntimeFiles, expectSourceNotToContain } from './runtimeBoundaryTestHelpers';

const read = (path: string) => readFileSync(path, 'utf8');

const browserUiSources = [
  'src/App.tsx',
  'src/main.tsx',
  'src/features/TodayView.tsx',
  'src/features/TrainingView.tsx',
  'src/features/TrainingFocusView.tsx',
  'src/features/RecordView.tsx',
  'src/features/ProfileView.tsx',
  'src/uiOs/MobileAppShell.tsx',
  'src/uiOs/BottomNav.tsx',
  'src/uiOs/navigation/FloatingBottomNav.tsx',
  'src/uiOs/primitives/ActionButton.tsx',
  'src/uiOs/primitives/SegmentedControl.tsx',
  'src/uiOs/surfaces/BottomSheet.tsx',
  'src/uiOs/training/FocusModeActionBar.tsx',
  'src/uiOs/training/FocusActualSetRecordSheet.tsx',
  'src/uiOs/settings/SettingsControlCenter.tsx',
  'src/uiOs/settings/CloudCandidateSettingsPanel.tsx',
  'src/uiOs/settings/DiagnosticsDataSafetyPanel.tsx',
];

describe('UI-OS R7 route cloud source boundaries stay blocked', () => {
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

  it('keeps UI-OS browser components free of Supabase Node-only prototype and mutation behavior', () => {
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
      'persistenceChanged: true',
      'routeSurfaceChanged: true',
      'cloudSyncChanged: true',
      'repairActionAllowed: true',
      'destructiveActionAllowed: true',
      'externalUploadAllowed: true',
    ]) {
      expect(combined).not.toContain(forbidden);
    }
    expect(read('prototype.html')).toContain('/src/prototypePreview.tsx');
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

  it('documents hard behavior boundaries without changing algorithms or persistence', () => {
    const doc = read('docs/UI_OS_R7_MOBILE_SAFE_AREA_COMPONENT_STATE_REGRESSION_LOCK.md');

    for (const expected of [
      'localStorage remains default/fallback/migration/emergency',
      'No default cloud sync',
      'No background sync',
      'No automatic sync worker',
      'No package/script/lockfile drift',
    ]) {
      expect(doc).toContain(expected);
    }
    for (const forbidden of [
      'R7 changed training algorithm',
      'R7 changed warmup algorithm',
      'R7 changed PR/e1RM',
      'R7 changed effective-set',
      'R7 changed source-of-truth',
      'R7 changed persistence',
      'R7 added route',
      'R7 enabled cloud sync',
      'R7 added package dependency',
    ]) {
      expect(doc).not.toContain(forbidden);
    }
  });
});
