import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';
import { expectSourceNotToContain, readSource, repoRoot } from './runtimeBoundaryTestHelpers';

describe('equipment-aware primary prescription apply fix boundary still blocked', () => {
  it('documents the user-visible bug, root cause, fix, examples, and boundaries', () => {
    const docPath = resolve(repoRoot(), 'docs/EQUIPMENT_AWARE_PRIMARY_PRESCRIPTION_APPLY_FIX.md');
    expect(existsSync(docPath)).toBe(true);

    const doc = readSource('docs/EQUIPMENT_AWARE_PRIMARY_PRESCRIPTION_APPLY_FIX.md');
    expect(doc).toContain('Task 17H');
    expect(doc).toContain('17lb');
    expect(doc).toContain('空杆 45 lb');
    expect(doc).toContain('Root cause');
    expect(doc).toContain('Theoretical recommendation weight remained');
    expect(doc).toContain('apply path');
    expect(doc).toContain('Training algorithm output');
    expect(doc).toContain('No route change');
    expect(doc).toContain('No package dependency');
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

  it('keeps new actionable helper and touched focus files free of storage, cloud, route, and Node-only behavior', () => {
    for (const source of [
      'src/engines/equipmentAwareActionablePrescription.ts',
      'src/engines/focusModeStateEngine.ts',
      'src/features/TrainingFocusView.tsx',
    ]) {
      expectSourceNotToContain(source, [
        'localStorage',
        'sessionStorage',
        'fetch(',
        'XMLHttpRequest',
        'sendBeacon',
        '@supabase/supabase-js',
        'node:http',
        'node:sqlite',
        '/data-health/repair/apply',
        '/backup/import',
        '/backup/export',
        '/reset/',
        '/recovery/',
      ]);
    }
  });

  it('keeps package scripts, dependencies, and lockfile surface unchanged', () => {
    const packageJson = JSON.parse(readSource('package.json')) as {
      scripts: Record<string, string>;
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };

    expect(Object.keys(packageJson.dependencies)).toEqual(['@supabase/supabase-js', 'ajv', 'lucide-react', 'react', 'react-dom']);
    expect(packageJson.scripts).not.toHaveProperty('deploy');
    expect(packageJson.scripts).not.toHaveProperty('deploy:production');
    expect(existsSync(resolve(repoRoot(), 'package-lock.json'))).toBe(true);
    expect(existsSync(resolve(repoRoot(), 'pnpm-lock.yaml'))).toBe(false);
  });
});
