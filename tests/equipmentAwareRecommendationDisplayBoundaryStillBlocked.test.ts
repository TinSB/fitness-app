import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('equipment aware recommendation display boundary still blocked', () => {
  const doc = () => readSource('docs/EQUIPMENT_AWARE_TRAINING_RECOMMENDATION_DISPLAY.md');

  it('documents Task 17D evidence display behavior and next task', () => {
    const content = doc();

    for (const expected of [
      'Task 17D',
      'Equipment-Aware Training Recommendation Display',
      'PR #265',
      '9253382ec4bf9e02ad90a63406c5d9874c624053',
      '1085 files / 4411 tests',
      'Bench theoretical 17 lb warmup displays empty Olympic bar 45 lb.',
      'Barbell displays total + per-side plates.',
      'Dumbbell displays per-hand weight.',
      'Smith machine displays 25 lb bar default.',
      'Selectorized machines display machine stack values.',
      'Plate-loaded machines support base/sled weight warnings.',
      'Unknown/custom exercises fall back safely.',
      'no training algorithm change',
      'source-of-truth is unchanged',
      'Task 17E is recommended next.',
      'Task 17E is not started by Task 17D.',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('does not claim blocked integrations or behavior changes', () => {
    const content = doc();

    for (const forbidden of [
      'training algorithm changed',
      'warmup algorithm changed',
      'PR/e1RM/effective-set calculations changed',
      'source-of-truth changed',
      'routes were added',
      'history was migrated',
      'cloud sync is enabled',
      'default cloud sync is enabled',
      'background sync is enabled',
      'live UI integration is complete',
      'App.tsx integration is complete',
    ]) {
      expect(content).not.toContain(forbidden);
    }
  });

  it('keeps new display source browser-safe side-effect free and presentation-only', () => {
    const sources = [
      readSource('src/engines/equipmentAwareRecommendationDisplay.ts'),
      readSource('src/ui/EquipmentAwareLoadDisplay.tsx'),
    ];

    for (const source of sources) {
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
        'trainingAlgorithmChanged: true',
        'apiStorageAdapter',
      ]) {
        expect(source).not.toContain(forbidden);
      }
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
