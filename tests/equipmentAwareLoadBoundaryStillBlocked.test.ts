import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('equipment-aware load boundary still blocked', () => {
  const doc = () => readSource('docs/EQUIPMENT_AWARE_LOAD_MODEL_FEASIBLE_WEIGHT_ENGINE.md');

  it('documents Task 17B evidence real-world fixes and next task', () => {
    const content = doc();

    for (const expected of [
      'Task 17B',
      'Equipment-Aware Load Model & Feasible Weight Engine',
      'PR #263',
      '0cb0021c0444afeeedda8b2be902a319fe3e6f17',
      '1080 files / 4375 tests',
      'Task 17A opened equipment-aware load model gate',
      'Bench warmup 17 lb now resolves to 45 lb empty Olympic bar.',
      'Smith machine default bar is 25 lb.',
      'Dumbbells are per-hand with 5 lb increment.',
      'Barbell recommendations use 2.5 / 5 / 10 / 25 / 45 lb plates.',
      'Selectorized machines use machine-specific options.',
      'Plate-loaded machines support optional base/sled weight.',
      'Task 17C is recommended next.',
      'Task 17C is not started by Task 17B.',
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

  it('keeps new model and engine source browser-safe and side-effect free', () => {
    const source = [
      readSource('src/engines/equipmentAwareLoadModel.ts'),
      readSource('src/engines/feasibleLoadEngine.ts'),
    ].join('\n');

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
