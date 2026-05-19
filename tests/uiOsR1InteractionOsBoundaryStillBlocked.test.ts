import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';

const doc = readFileSync('docs/UI_OS_R1_INTERACTION_OS_PRODUCT_SPEC.md', 'utf8');
const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
  scripts: Record<string, string>;
  dependencies: Record<string, string>;
};

describe('UI-OS R1 Interaction OS boundary still blocked', () => {
  it('documents preserved local-first cloud candidate and safety boundaries', () => {
    for (const expected of [
      'localStorage remains default/fallback/migration/emergency',
      'backend/cloud candidate remains explicit opt-in and reversible',
      'cloud pull does not auto-apply',
      'cloud push requires manual confirmation',
      'conflict resolution remains manual',
      'rollback / kill switch remains available',
      'emergency local mode remains available',
      'api-primary-dev remains dev/local only and not production-ready',
      'devApiRunner is not production backend',
      'service role key never enters browser',
      'accepted browser mutation routes remain exactly seven',
      'blocked repair/reset/import/export HTTP routes remain blocked',
      'no default cloud sync',
      'no background sync',
      'no automatic worker/timer/polling sync',
      'no production deployment auto-start',
      'no external monitoring upload',
      'no SaaS/multi-user runtime',
      'no billing/public onboarding',
      'no normalized training tables',
      'no destructive migration',
      'no real personal training data in automated tests',
      'no new package/dependency/script/lockfile drift beyond Phase 12 @supabase/supabase-js',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('keeps exact accepted browser mutation route inventory at seven', () => {
    expect(API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES).toEqual([
      '/data-health/issues/:issueId/dismiss',
      '/history/:id/data-flag',
      '/history/:id/edit',
      '/sessions/start',
      '/sessions/active/patches',
      '/sessions/active/complete',
      '/sessions/active/discard',
    ]);
    for (const expected of [
      '1. `POST /data-health/issues/:issueId/dismiss`',
      '2. `POST /history/:id/data-flag`',
      '3. `POST /history/:id/edit`',
      '4. `POST /sessions/start`',
      '5. `POST /sessions/active/patches`',
      '6. `POST /sessions/active/complete`',
      '7. `POST /sessions/active/discard`',
      'No eighth browser mutation route',
      '`POST /data-health/repair/apply` remains blocked',
      'backup/import/export over HTTP remains blocked',
      'reset/recovery over HTTP remains blocked',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('does not claim R1 shipped runtime changes or started R2', () => {
    for (const forbidden of [
      'R1 implemented UI changes',
      'R1 changed App.tsx',
      'R1 changed source-of-truth',
      'R1 changed training algorithm',
      'R1 enabled cloud sync',
      'R1 started SaaS',
      'R1 added new routes',
      'UI-OS R2 has started',
      'UI-OS R2 was started',
    ]) {
      expect(doc).not.toContain(forbidden);
    }
    expect(doc).toContain('Task UI-OS R1 does not implement UI changes');
    expect(doc).toContain('Task UI-OS R1 does not start R2');
  });

  it('keeps package scripts dependencies and lockfile surface unchanged', () => {
    expect(Object.keys(packageJson.dependencies)).toEqual(['@supabase/supabase-js', 'ajv', 'lucide-react', 'react', 'react-dom']);
    expect(packageJson.scripts).not.toHaveProperty('deploy:production');
    expect(packageJson.scripts).not.toHaveProperty('cloud:sync');
    expect(packageJson.scripts).not.toHaveProperty('monitoring:upload');
    expect(packageJson.scripts).not.toHaveProperty('billing:start');
    expect(existsSync('package-lock.json')).toBe(true);
    expect(existsSync('pnpm-lock.yaml')).toBe(false);
  });
});
