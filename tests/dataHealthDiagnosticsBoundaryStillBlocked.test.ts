import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('data health diagnostics boundary still blocked', () => {
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

  it('keeps repair upload routes and source-of-truth mutation out of source helpers', () => {
    const source = [
      readSource('src/personalProduction/dataHealthDiagnosticsClarity.ts'),
      readSource('src/personalProduction/DataHealthDiagnosticsSummaryPanel.tsx'),
    ].join('\n');

    for (const forbidden of [
      '/data-health/repair/apply',
      '/backup/import',
      '/backup/export',
      '/reset/',
      '/recovery/',
      'fetch(',
      'sendBeacon',
      '@supabase',
      'window.localStorage',
      '.localStorage',
      'sessionStorage',
      'repairActionAllowed: true',
      'sourceOfTruthChanged: true',
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it('keeps docs from claiming unsafe capabilities are enabled', () => {
    const content = readSource('docs/DATA_HEALTH_DIAGNOSTICS_CLARITY_PACK.md');

    for (const forbidden of [
      'automatic repair is enabled',
      'POST /data-health/repair/apply is accepted',
      'destructive repair is enabled',
      'external monitoring upload is active',
      'full AppData diagnostic upload is active',
      'default cloud sync is enabled',
      'background sync is enabled',
    ]) {
      expect(content).not.toContain(forbidden);
    }
  });

  it('keeps package scripts and dependency surface locked', () => {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));

    expect(packageJson.dependencies['@supabase/supabase-js']).toBeDefined();
    for (const forbidden of ['@sentry', 'sentry', 'analytics', 'telemetry', 'stripe', 'clerk', 'next-auth']) {
      expect(JSON.stringify(packageJson.dependencies)).not.toContain(forbidden);
      expect(JSON.stringify(packageJson.devDependencies)).not.toContain(forbidden);
    }
    expect(packageJson.scripts).not.toHaveProperty('deploy:production');
    expect(packageJson.scripts).not.toHaveProperty('monitoring:upload');
    expect(packageJson.scripts).not.toHaveProperty('cloud:sync');
    expect(packageJson.scripts).not.toHaveProperty('billing:start');
  });
});
