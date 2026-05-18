import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('phase 15 stabilization boundary still blocked', () => {
  const doc = () => readSource('docs/PHASE15_STABILIZATION_ARCHIVE.md');

  it('does not claim blocked production capabilities are enabled', () => {
    const content = doc();

    for (const forbidden of [
      'Phase 15 launched public SaaS',
      'default cloud sync is enabled',
      'background sync is enabled',
      'production deployment is live',
      'external monitoring upload is active',
      'cloud pull auto-applies',
      'cloud push runs without manual confirmation',
      'automatic upload of real training data is authorized',
    ]) {
      expect(content).not.toContain(forbidden);
    }
  });

  it('explicitly keeps blocked systems blocked', () => {
    const content = doc();

    for (const expected of [
      'Public SaaS.',
      'Default cloud sync system.',
      'Background sync system.',
      'Production deployment runtime.',
      'External monitoring upload system.',
      'no default cloud sync.',
      'no background sync.',
      'no automatic worker/timer/polling sync.',
      'no production deployment auto-start.',
      'no external monitoring upload.',
      'no SaaS/multi-user runtime.',
      'no normalized training tables.',
      'no destructive migration.',
      'no real personal training data in automated tests.',
      'Phase 15 completion does not equal public SaaS launch.',
      'Phase 15 completion does not enable default cloud sync.',
      'Phase 15 completion does not authorize automatic upload of real training data.',
    ]) {
      expect(content).toContain(expected);
    }
  });

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
  });
});
