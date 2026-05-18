import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('phase 16 personal-only boundary still blocked', () => {
  const doc = () => readSource('docs/PHASE16_PERSONAL_ONLY_ROADMAP_ARCHIVE.md');

  it('does not claim blocked runtime product capabilities are enabled', () => {
    const content = doc();

    for (const forbidden of [
      'IronPath launched public SaaS',
      'Phase 16 launched SaaS',
      'default cloud sync is enabled',
      'background sync is enabled',
      'service-worker sync is enabled',
      'production deployment is live',
      'external monitoring upload is active',
      'automatic upload is enabled',
      'cloud pull auto-applies',
      'cloud push runs without manual confirmation',
      'destructive migration is enabled',
      'normalized training tables are active',
      'Phase 17 is started',
    ]) {
      expect(content).not.toContain(forbidden);
    }
  });

  it('explicitly keeps SaaS cloud sync deployment monitoring and migration blocked', () => {
    const content = doc();

    for (const expected of [
      'SaaS remains deferred.',
      'Public SaaS.',
      'Default cloud sync system.',
      'Background sync system.',
      'Production deployment runtime.',
      'External monitoring upload system.',
      'SaaS/multi-user runtime.',
      'no default cloud sync.',
      'no background sync.',
      'no automatic worker/timer/polling sync.',
      'no production deployment auto-start.',
      'no external monitoring upload.',
      'no SaaS/multi-user runtime.',
      'no billing/payment/subscription runtime.',
      'no public onboarding runtime.',
      'no normalized training tables.',
      'no destructive migration.',
      'no real personal training data in automated tests.',
      'Phase 16 archive does not authorize SaaS.',
      'Phase 16 archive does not authorize default cloud sync.',
      'Phase 16 archive does not authorize automatic upload of real training data.',
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

  it('keeps blocked HTTP route families documented as blocked', () => {
    const content = doc();

    for (const expected of [
      '`POST /data-health/repair/apply` remains blocked.',
      'backup/import/export over HTTP remains blocked.',
      'reset/recovery over HTTP remains blocked.',
      'No eighth browser mutation route was added.',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('keeps package scripts and dependency surface locked', () => {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));

    expect(packageJson.dependencies['@supabase/supabase-js']).toBeDefined();
    for (const forbidden of ['@sentry', 'sentry', 'analytics', 'telemetry', 'stripe', 'clerk', 'next-auth', 'workbox']) {
      expect(JSON.stringify(packageJson.dependencies)).not.toContain(forbidden);
      expect(JSON.stringify(packageJson.devDependencies)).not.toContain(forbidden);
    }
    expect(packageJson.scripts).not.toHaveProperty('deploy:production');
    expect(packageJson.scripts).not.toHaveProperty('monitoring:upload');
    expect(packageJson.scripts).not.toHaveProperty('cloud:sync');
    expect(packageJson.scripts).not.toHaveProperty('billing:start');
  });
});
