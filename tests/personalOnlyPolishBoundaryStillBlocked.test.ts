import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('personal-only polish boundary still blocked', () => {
  const doc = () => readSource('docs/PERSONAL_ONLY_POLISH_BACKUP_RELIABILITY_ROADMAP.md');

  it('does not claim SaaS sync deployment monitoring or billing is enabled', () => {
    const content = doc();

    for (const forbidden of [
      'IronPath launched SaaS',
      'default cloud sync is enabled',
      'background sync is enabled',
      'production deployment is live',
      'external monitoring upload is active',
      'billing is implemented',
      'cloud pull auto-applies',
      'cloud push runs without manual confirmation',
      'SaaS is recommended next',
      'Recommended next task: SaaS',
    ]) {
      expect(content).not.toContain(forbidden);
    }
  });

  it('explicitly keeps personal-only reliability next and SaaS deferred', () => {
    const content = doc();

    for (const expected of [
      'Task 16C is recommended next.',
      'Task 16C is not started by Task 16B.',
      'SaaS remains deferred.',
      'Public SaaS launch remains deferred.',
      'Billing/subscription remains deferred.',
      'no default cloud sync.',
      'no background sync.',
      'no production deployment auto-start.',
      'no external monitoring upload.',
      'no SaaS/multi-user runtime.',
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
    expect(packageJson.scripts).not.toHaveProperty('billing:start');
  });
});
