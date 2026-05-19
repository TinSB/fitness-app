import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('UI-OS R9.1 boundaries stay blocked', () => {
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

  it('keeps blocked route cloud and prototype boundaries out of runtime source', () => {
    const scopedRuntime = [
      'src/App.tsx',
      'src/features/TodayView.tsx',
      'src/features/TrainingFocusView.tsx',
      'src/features/ProfileView.tsx',
      'src/uiOs/MobileAppShell.tsx',
      'src/uiOs/BottomNav.tsx',
      'src/uiOs/navigation/FloatingBottomNav.tsx',
      'src/uiOs/theme/uiThemePreferenceStorage.ts',
    ].map(read).join('\n');

    for (const token of [
        '/data-health/repair/apply',
        'POST /data-health/repair/apply',
        '/backup/import',
        '/backup/export',
        '/reset/',
        '/recovery/',
        'default cloud sync',
        'background sync',
        'src/prototype',
        'IronPathOS2',
      ]) {
      expect(scopedRuntime).not.toContain(token);
    }
  });

  it('does not add package scripts dependencies or lockfiles', () => {
    const packageJson = JSON.parse(read('package.json')) as {
      scripts: Record<string, string>;
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };

    for (const forbiddenScript of ['cloud:sync', 'sync:background', 'deploy:production', 'monitoring:upload', 'billing:start']) {
      expect(packageJson.scripts).not.toHaveProperty(forbiddenScript);
    }
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
    expect(existsSync(resolve(root, 'package-lock.json'))).toBe(true);
    expect(existsSync(resolve(root, 'pnpm-lock.yaml'))).toBe(false);
  });

  it('keeps theme work UI-only instead of AppData or source-of-truth behavior', () => {
    const combined = [
      'src/App.tsx',
      'src/features/ProfileView.tsx',
      'src/uiOs/theme/uiThemePreferenceStorage.ts',
      'src/uiOs/theme/UiThemeProvider.tsx',
    ].map(read).join('\n');

    expect(combined).toContain('ironpath:ui-theme');
    expect(combined).not.toContain('sourceOfTruthChanged: true');
    expect(combined).not.toContain('persistenceChanged: true');
    expect(combined).not.toContain('AppData schema');
  });
});
