import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('daily training UX boundary still blocked', () => {
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

  it('documents blocked routes without adding route strings to source helpers', () => {
    const doc = readSource('docs/DAILY_TRAINING_UX_POLISH_PACK.md');
    const source = [
      readSource('src/personalProduction/dailyTrainingUxCopy.ts'),
      readSource('src/personalProduction/DailyTrainingStatusPanel.tsx'),
    ].join('\n');

    for (const expected of [
      'add POST /data-health/repair/apply.',
      'add backup/import/export HTTP routes.',
      'add reset/recovery HTTP routes.',
    ]) {
      expect(doc).toContain(expected);
    }

    for (const forbidden of [
      '/data-health/repair/apply',
      '/backup/import',
      '/backup/export',
      '/reset/',
      '/recovery/',
    ]) {
      expect(source).not.toContain(forbidden);
    }

    const combined = `${doc}\n${source}`;
    for (const forbidden of [
      'default cloud sync is enabled',
      'background sync is enabled',
      'production deployment is live',
      'external monitoring upload is active',
      'SaaS is started',
      'real personal training data fixture',
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
