import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('phase 17 equipment aware boundary still blocked', () => {
  const archive = () => readSource('docs/PHASE17_EQUIPMENT_AWARE_LOAD_MODEL_ARCHIVE.md');

  it('confirms preserved algorithm source-of-truth route cloud and package boundaries', () => {
    const content = archive();

    for (const expected of [
      'no training algorithm changed',
      'no warmup algorithm changed directly',
      'no PR/e1RM/effective-set calculations changed',
      'no source-of-truth behavior changed',
      'no historical migration',
      'no package/script/lockfile drift',
      'no routes added',
      'no default cloud sync',
      'no background sync',
      'no deployment/monitoring/SaaS runtime',
      'no external monitoring upload',
      'no SaaS/multi-user runtime',
      'no real personal training data in tests',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('confirms personal-only production boundaries', () => {
    const content = archive();

    for (const expected of [
      'localStorage remains default/fallback/migration/emergency.',
      'backend/cloud candidate remains explicit opt-in and reversible.',
      'cloud pull does not auto-apply.',
      'cloud push requires manual confirmation.',
      'conflict resolution remains manual.',
      'rollback / kill switch remains available.',
      'emergency local mode remains available.',
      'api-primary-dev remains dev/local only and not production-ready.',
      'accepted browser mutation routes remain exactly seven.',
      'SaaS remains deferred.',
      'personal-only direction remains active.',
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
    const content = archive();

    for (const expected of [
      '`POST /data-health/repair/apply` remains blocked.',
      'backup/import/export over HTTP remains blocked.',
      'reset/recovery over HTTP remains blocked.',
      'No eighth browser mutation route was added.',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('does not claim Phase 18 or SaaS or default cloud sync has started', () => {
    const content = archive();

    for (const forbidden of [
      'Phase 18 is started',
      'Task 18A is started',
      'SaaS is authorized',
      'default cloud sync is authorized',
      'default cloud sync is enabled',
      'background sync is enabled',
      'training algorithm changed.',
      'source-of-truth changed.',
      'routes were added',
    ]) {
      expect(content).not.toContain(forbidden);
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
