import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('personal production regression lock', () => {
  const doc = () => readSource('docs/PERSONAL_PRODUCTION_REGRESSION_LOCK.md');

  it('locks local storage cloud candidate and emergency boundaries', () => {
    const content = doc();

    for (const expected of [
      'localStorage remains default/fallback/migration/emergency.',
      'backend/cloud candidate remains explicit opt-in and reversible.',
      'cloud pull does not auto-apply.',
      'cloud push requires manual confirmation.',
      'conflict resolution remains manual.',
      'rollback / kill switch exists.',
      'emergency local mode exists.',
      'service role not in browser.',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('keeps release launch sync monitoring and SaaS behavior blocked', () => {
    const content = doc();

    for (const expected of [
      'no default cloud sync.',
      'no background sync.',
      'no polling/timer/automatic worker.',
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

  it('documents blocked routes data schema and package drift', () => {
    const content = doc();

    for (const expected of [
      '`POST /data-health/repair/apply` remains blocked.',
      'backup/import/export over HTTP remains blocked.',
      'reset/recovery over HTTP remains blocked.',
      'no normalized training tables.',
      'no destructive migration.',
      'no real personal training data in automated tests.',
      '`@supabase/supabase-js` remains the only authorized dependency drift from Phase 12.',
      'no new Phase 14 dependency drift.',
      'no new package scripts.',
      'no lockfile drift.',
    ]) {
      expect(content).toContain(expected);
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
  });
});
