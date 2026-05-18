import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('personal-only vs SaaS boundary still blocked', () => {
  const doc = () => readSource('docs/PERSONAL_ONLY_VS_SAAS_PRODUCT_DECISION.md');

  it('does not claim SaaS billing sync deployment or monitoring is enabled', () => {
    const content = doc();

    for (const forbidden of [
      'IronPath launched public SaaS',
      'default cloud sync is enabled',
      'background sync is enabled',
      'production deployment is live',
      'external monitoring upload is active',
      'billing is implemented',
      'multi-user SaaS runtime exists',
      'cloud pull auto-applies',
      'cloud push runs without manual confirmation',
    ]) {
      expect(content).not.toContain(forbidden);
    }
  });

  it('explicitly blocks SaaS billing onboarding admin and public deployment work', () => {
    const content = doc();

    for (const expected of [
      'SaaS is deferred.',
      'Do not start SaaS now.',
      'Do not start billing.',
      'Do not start public onboarding.',
      'Do not start multi-user admin.',
      'Do not start production deployment for public users.',
      'No billing/subscription system.',
      'No public onboarding.',
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
