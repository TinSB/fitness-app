import { describe, expect, it } from 'vitest';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('phase 13 completion boundary still blocked', () => {
  const doc = () => readSource('docs/PHASE13_COMPLETION_ARCHIVE.md');

  it('confirms production launch deployment monitoring and SaaS boundaries remain blocked', () => {
    const content = doc();

    for (const expected of [
      'No production launch.',
      'No default cloud sync.',
      'No background sync.',
      'No production deployment auto-start.',
      'No external monitoring upload.',
      'No SaaS/multi-user runtime.',
      'No normalized training tables.',
      'No destructive migration.',
      'No real personal training data.',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('confirms source of truth rollback and localStorage boundaries remain preserved', () => {
    const content = doc();

    for (const expected of [
      'Backend/cloud candidate remains explicit opt-in and reversible.',
      '`localStorage` remains default, fallback, migration source, and emergency backup.',
      'Fallback/rollback/emergency restore remain available.',
      'Cloud pull does not auto-apply.',
      'Cloud push requires manual confirmation.',
      'Conflict resolution remains manual.',
      '`api-primary-dev` remains explicit dev/local only and not production-ready.',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('keeps route inventory exactly seven and blocked routes documented', () => {
    expect(API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES).toEqual([
      '/data-health/issues/:issueId/dismiss',
      '/history/:id/data-flag',
      '/history/:id/edit',
      '/sessions/start',
      '/sessions/active/patches',
      '/sessions/active/complete',
      '/sessions/active/discard',
    ]);

    const content = doc();
    for (const expected of [
      'Accepted browser mutation routes remain exactly seven.',
      '`POST /data-health/repair/apply` remains blocked.',
      'Backup/import/export over HTTP remains blocked.',
      'Reset/recovery over HTTP remains blocked.',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('confirms no new Phase 13 package drift beyond Phase 12 Supabase dependency', () => {
    const content = doc();

    expect(content).toContain('`@supabase/supabase-js` remains the only authorized dependency drift from Phase 12.');
    expect(content).toContain('No new Phase 13 dependencies, scripts, or lockfile drift.');
  });
});
