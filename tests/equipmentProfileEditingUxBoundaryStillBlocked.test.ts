import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('equipment profile editing UX boundary still blocked', () => {
  it('keeps draft and editor source browser-safe and non-persistent', () => {
    const sources = [
      readSource('src/engines/equipmentProfileDraft.ts'),
      readSource('src/ui/EquipmentProfileEditor.tsx'),
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
        'persistenceChanged: true',
        'apiStorageAdapter',
      ]) {
        expect(source).not.toContain(forbidden);
      }
    }
  });

  it('does not claim blocked behavior changes', () => {
    const content = readSource('docs/EQUIPMENT_PROFILE_EDITING_UX.md');

    for (const forbidden of [
      'profile edits are persisted',
      'source-of-truth changed',
      'history was migrated',
      'training algorithm changed',
      'warmup algorithm changed',
      'saved set values changed',
      'session mutation payloads changed',
      'routes were added',
      'cloud sync is enabled',
      'default cloud sync is enabled',
      'background sync is enabled',
    ]) {
      expect(content).not.toContain(forbidden);
    }
  });

  it('preserves safety boundaries in docs', () => {
    const content = readSource('docs/EQUIPMENT_PROFILE_EDITING_UX.md');

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
    const content = readSource('docs/EQUIPMENT_PROFILE_EDITING_UX.md');

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
