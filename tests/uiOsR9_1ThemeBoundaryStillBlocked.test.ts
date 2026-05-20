import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('UI-OS R9.1 real light theme boundary locks', () => {
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

  it('keeps theme parity work out of source-of-truth AppData routes and cloud behavior', () => {
    const scopedRuntime = [
      'src/App.tsx',
      'src/features/TrainingView.tsx',
      'src/features/RecordView.tsx',
      'src/features/TrainingFocusView.tsx',
      'src/uiOs/theme/themeSurfaceModel.ts',
      'src/uiOs/theme/uiThemePreferenceStorage.ts',
    ].map(read).join('\n');

    for (const forbidden of [
      '/data-health/repair/apply',
      'POST /data-health/repair/apply',
      '/backup/import',
      '/backup/export',
      '/reset/',
      '/recovery/',
      'default cloud sync',
      'background sync',
      'sourceOfTruthChanged: true',
      'persistenceChanged: true',
      'src/prototype',
      'IronPathOS2',
    ]) {
      expect(scopedRuntime).not.toContain(forbidden);
    }
  });

  it('does not add package script dependency or lockfile drift', () => {
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
});
