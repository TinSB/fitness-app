import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('personal-only backup recovery boundary still blocked', () => {
  const doc = () => readSource('docs/PERSONAL_ONLY_BACKUP_RECOVERY_IMPLEMENTATION_PACK.md');

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

  it('does not add route expansion or unsafe behavior claims', () => {
    const content = doc();

    for (const expected of [
      'add backup/import/export HTTP routes.',
      'add reset/recovery HTTP routes.',
      'change source-of-truth behavior.',
      'enable default cloud sync.',
      'enable background sync.',
      'perform cloud pull.',
      'perform cloud push.',
      'perform destructive migration.',
    ]) {
      expect(content).toContain(expected);
    }

    for (const forbidden of [
      'accepts backup/import/export HTTP routes',
      'accepts reset/recovery HTTP routes',
      'cloud pull auto-applies',
      'cloud push runs without manual confirmation',
      'default cloud sync is enabled',
      'background sync is enabled',
      'production deployment is live',
      'external monitoring upload is active',
      'real personal training data fixture',
    ]) {
      expect(content).not.toContain(forbidden);
    }
  });

  it('keeps helper sources free of blocked route strings and direct side effects', () => {
    const combined = [
      readSource('src/personalProduction/backupRecoveryReadiness.ts'),
      readSource('src/personalProduction/backupRecoveryCopy.ts'),
    ].join('\n');

    for (const forbidden of [
      '/data-health/repair/apply',
      '/backup/import',
      '/backup/export',
      '/reset/',
      '/recovery/',
      'fetch(',
      'XMLHttpRequest',
      'sendBeacon',
      '@supabase',
      'window.localStorage',
      '.localStorage',
      'sessionStorage',
      'real personal training data',
    ]) {
      expect(combined).not.toContain(forbidden);
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
