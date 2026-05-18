import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('exercise equipment profiles boundary still blocked', () => {
  const doc = () => readSource('docs/EXERCISE_EQUIPMENT_PROFILE_DEFAULTS.md');

  it('documents Task 17C evidence defaults and next task', () => {
    const content = doc();

    for (const expected of [
      'Task 17C',
      'Exercise Equipment Profile Defaults',
      'PR #264',
      '0c1e1a6a06f520089e04d7d8fc19be86b2205e12',
      '1083 files / 4397 tests',
      'Olympic barbell 45 lb',
      'Smith machine 25 lb',
      'Plates 2.5 / 5 / 10 / 25 / 45',
      'Dumbbell increment 5 lb',
      'Barbell display total + per-side plates',
      'Dumbbell display per-hand',
      'Selectorized / Pin-Loaded Machine',
      'Plate-loaded optional base/sled weight',
      'Cable Stack',
      'Bodyweight',
      'Assisted Bodyweight',
      'Unknown/Custom',
      'Task 17D is recommended next.',
      'Task 17D is not started by Task 17C.',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('does not claim blocked integrations or behavior changes', () => {
    const content = doc();

    for (const forbidden of [
      'UI integration is complete',
      'live recommendation UI changed',
      'training algorithm changed',
      'warmup algorithm changed',
      'source-of-truth changed',
      'routes were added',
      'history was migrated',
      'cloud sync is enabled',
      'default cloud sync is enabled',
      'background sync is enabled',
    ]) {
      expect(content).not.toContain(forbidden);
    }
  });

  it('keeps new exercise profile source browser-safe and side-effect free', () => {
    const source = readSource('src/engines/exerciseEquipmentProfiles.ts');

    for (const forbidden of [
      'localStorage',
      'sessionStorage',
      'fetch(',
      'XMLHttpRequest',
      'sendBeacon',
      '@supabase',
      'node:',
      '/data-health/repair/apply',
      '/backup/import',
      '/backup/export',
      '/reset/',
      '/recovery/',
      'sourceOfTruthChanged: true',
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it('preserves safety boundaries in docs', () => {
    const content = doc();

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
      'blocked repair/reset/import/export HTTP routes remain blocked.',
      'no default cloud sync.',
      'no background sync.',
      'no production deployment auto-start.',
      'no external monitoring upload.',
      'no SaaS/multi-user runtime.',
      'no normalized training tables.',
      'no destructive migration.',
      'no real personal training data in tests.',
      'no new package/dependency/script/lockfile drift beyond Phase 12 authorized `@supabase/supabase-js`.',
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
