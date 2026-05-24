import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('phase 13 release boundary still blocked', () => {
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

  it('does not add package scripts dependencies or lockfile drift in entry gate', () => {
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
    expect(packageJson.scripts).not.toHaveProperty('monitoring:upload');
    expect(packageJson.scripts).not.toHaveProperty('cloud:sync');
  });

  it('keeps public launch deployment monitoring and unapproved schema surfaces absent', () => {
    expect(existsSync('supabase/migrations/20260524000000_phase19d_appdata_snapshot.sql')).toBe(true);
    for (const path of [
      'Dockerfile',
      'database/migrations',
      'src/cloudProduction/externalMonitoringUpload.ts',
      'src/cloudProduction/normalizedTrainingTables.ts',
    ]) {
      expect(existsSync(path)).toBe(false);
    }
  });

  it('keeps entry gate docs from claiming production launch or external upload', () => {
    const content = readSource('docs/PHASE13_PRODUCTION_DEPLOYMENT_MONITORING_RELEASE_HARDENING_ENTRY_GATE.md');

    for (const forbidden of [
      'production is launched',
      'default cloud sync is enabled',
      'external monitoring upload is enabled',
      'SaaS runtime is implemented',
    ]) {
      expect(content).not.toContain(forbidden);
    }
  });
});
