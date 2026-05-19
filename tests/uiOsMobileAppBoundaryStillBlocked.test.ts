import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';
import { readSource, repoRoot } from './runtimeBoundaryTestHelpers';

describe('UI-OS mobile app boundary still blocked', () => {
  const doc = () => readSource('docs/UI_OS_MOBILE_APP_PRD_BLUEPRINT.md');

  it('documents preserved local-first cloud candidate and safety boundaries', () => {
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
      'devApiRunner is not production backend.',
      'service role key must never enter browser.',
      'accepted browser mutation routes remain exactly seven.',
      'blocked repair/reset/import/export HTTP routes remain blocked.',
      'no default cloud sync.',
      'no background sync.',
      'no automatic worker/timer/polling sync.',
      'no production deployment auto-start.',
      'no external monitoring upload.',
      'no SaaS/multi-user runtime.',
      'no billing/public onboarding.',
      'no normalized training tables.',
      'no destructive migration.',
      'no real personal training data in automated tests.',
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

  it('documents exact accepted route inventory and blocked route families', () => {
    const content = doc();

    for (const expected of [
      '1. POST /data-health/issues/:issueId/dismiss',
      '2. POST /history/:id/data-flag',
      '3. POST /history/:id/edit',
      '4. POST /sessions/start',
      '5. POST /sessions/active/patches',
      '6. POST /sessions/active/complete',
      '7. POST /sessions/active/discard',
      'no eighth browser mutation route.',
      'POST /data-health/repair/apply remains blocked.',
      'backup/import/export over HTTP remains blocked.',
      'reset/recovery over HTTP remains blocked.',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('does not claim UI-OS 1 changed runtime architecture or shipped runtime UI', () => {
    const content = doc();

    for (const forbidden of [
      'UI-OS 1 implemented runtime UI',
      'App.tsx was changed',
      'source-of-truth changed',
      'cloud sync is enabled',
      'SaaS launched',
      'training algorithm changed',
      'new routes were added',
      'default cloud sync is enabled',
      'background sync is enabled',
    ]) {
      expect(content).not.toContain(forbidden);
    }
    expect(content).not.toMatch(/(^|\n)- v0 code was added/i);
    expect(content).toContain('No v0 code was added.');
  });

  it('keeps npm package-lock path and package surface locked', () => {
    const packageJson = JSON.parse(readSource('package.json')) as {
      scripts: Record<string, string>;
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };

    expect(Object.keys(packageJson.dependencies)).toEqual(['@supabase/supabase-js', 'ajv', 'lucide-react', 'react', 'react-dom']);
    expect(packageJson.scripts).not.toHaveProperty('deploy:production');
    expect(packageJson.scripts).not.toHaveProperty('cloud:sync');
    expect(packageJson.scripts).not.toHaveProperty('monitoring:upload');
    expect(packageJson.scripts).not.toHaveProperty('billing:start');
    expect(existsSync(resolve(repoRoot(), 'package-lock.json'))).toBe(true);
    expect(existsSync(resolve(repoRoot(), 'pnpm-lock.yaml'))).toBe(false);
  });
});
