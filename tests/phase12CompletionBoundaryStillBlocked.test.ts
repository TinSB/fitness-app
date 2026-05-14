import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('phase 12 completion boundary still blocked', () => {
  it('keeps accepted browser mutation routes exactly seven and blocked routes absent', () => {
    expect(API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES).toEqual([
      '/data-health/issues/:issueId/dismiss',
      '/history/:id/data-flag',
      '/history/:id/edit',
      '/sessions/start',
      '/sessions/active/patches',
      '/sessions/active/complete',
      '/sessions/active/discard',
    ]);

    const adapterSource = readSource('src/storage/apiStorageAdapter.ts');
    for (const forbidden of [
      '/data-health/repair/apply',
      '/backup/import',
      '/backup/export',
      '/reset/',
      '/recovery/',
    ]) {
      expect(adapterSource).not.toContain(forbidden);
    }
  });

  it('keeps packages limited to the authorized Supabase dependency drift', () => {
    const packageJson = JSON.parse(readSource('package.json')) as {
      dependencies: Record<string, string>;
      scripts: Record<string, string>;
    };

    expect(Object.keys(packageJson.dependencies)).toEqual([
      '@supabase/supabase-js',
      'ajv',
      'lucide-react',
      'react',
      'react-dom',
    ]);
    expect(packageJson.scripts).not.toHaveProperty('deploy:prod');
    expect(packageJson.scripts).not.toHaveProperty('cloud:sync');
    expect(packageJson.scripts).not.toHaveProperty('monitoring:upload');
  });

  it('keeps normalized tables migrations deployment and monitoring surfaces absent', () => {
    for (const path of [
      'supabase/migrations',
      'database/migrations',
      'src/cloudProduction/normalizedTrainingTables.ts',
      'Dockerfile',
      'src/cloudProduction/externalMonitoringUpload.ts',
    ]) {
      expect(existsSync(path)).toBe(false);
    }
  });

  it('keeps the archive from starting Phase 13', () => {
    const archive = readSource('docs/PHASE12_COMPLETION_ARCHIVE.md');

    expect(archive).toContain('Phase 13 is not started.');
    expect(archive).not.toContain('Phase 13 is started');
    expect(archive).not.toContain('Production deployment runtime is implemented');
    expect(archive).not.toContain('external monitoring upload is implemented');
  });
});
