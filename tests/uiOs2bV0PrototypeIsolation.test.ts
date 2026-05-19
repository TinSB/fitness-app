import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';
import { readSource, repoRoot } from './runtimeBoundaryTestHelpers';

describe('UI-OS 2B v0 prototype isolation', () => {
  const prototypeSource = () => readSource('src/prototype/IronPathOS2.tsx');
  const previewSource = () => readSource('src/prototypePreview.tsx');
  const doc = () => readSource('docs/UI_OS_2B_V0_PROTOTYPE_REVIEW_BOUNDARY_LOCK.md');

  it('keeps App runtime free of prototype imports', () => {
    expect(readSource('src/App.tsx')).not.toContain('IronPathOS2');
    expect(readSource('src/App.tsx')).not.toContain('prototypePreview');
    expect(readSource('src/main.tsx')).not.toContain('IronPathOS2');
    expect(readSource('src/main.tsx')).not.toContain('prototypePreview');
    expect(readSource('index.html')).not.toContain('prototypePreview');
    expect(readSource('prototype.html')).toContain('/src/prototypePreview.tsx');
  });

  it('keeps prototype and preview free of storage network Supabase and source-of-truth mutations', () => {
    const combined = `${prototypeSource()}\n${previewSource()}`;

    for (const forbidden of [
      'localStorage.setItem',
      'sessionStorage.setItem',
      'fetch(',
      'XMLHttpRequest',
      'sendBeacon',
      '@supabase/supabase-js',
      'createClient',
      'cloud:sync',
      'sourceOfTruth',
      'AppData',
      '/data-health/repair/apply',
      '/backup/import',
      '/backup/export',
      '/reset/',
      '/recovery/',
    ]) {
      expect(combined).not.toContain(forbidden);
    }
  });

  it('keeps exact seven accepted browser mutation routes', () => {
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

  it('keeps package and lockfile surface unchanged', () => {
    const packageJson = JSON.parse(readSource('package.json')) as {
      scripts: Record<string, string>;
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };

    expect(Object.keys(packageJson.dependencies)).toEqual(['@supabase/supabase-js', 'ajv', 'lucide-react', 'react', 'react-dom']);
    expect(packageJson.scripts).not.toHaveProperty('cloud:sync');
    expect(packageJson.scripts).not.toHaveProperty('deploy:production');
    expect(packageJson.scripts).not.toHaveProperty('monitoring:upload');
    expect(existsSync(resolve(repoRoot(), 'package-lock.json'))).toBe(true);
    expect(existsSync(resolve(repoRoot(), 'pnpm-lock.yaml'))).toBe(false);
  });

  it('does not document runtime integration source-of-truth cloud SaaS or package approval', () => {
    const content = doc();

    for (const forbidden of [
      'integrated into App.tsx',
      'production runtime was switched',
      'source-of-truth changed',
      'cloud sync is enabled',
      'default cloud sync is enabled',
      'background sync is enabled',
      'SaaS launched',
      'package dependency was added',
      'route was added',
      'training algorithm changed',
    ]) {
      expect(content).not.toContain(forbidden);
    }
  });
});
