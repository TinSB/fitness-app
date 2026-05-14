import { describe, expect, it } from 'vitest';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('phase 14 completion boundary still blocked', () => {
  const archive = () => readSource('docs/PHASE14_COMPLETION_ARCHIVE.md');

  it('confirms public SaaS launch default sync and real training upload remain blocked', () => {
    const content = archive();

    for (const expected of [
      'Phase 14 does not equal public SaaS launch.',
      'Phase 14 does not enable default cloud sync.',
      'Phase 14 does not auto-upload real training data.',
      'No production deployment auto-start.',
      'No external monitoring upload.',
      'No SaaS/multi-user runtime.',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('confirms local storage cloud pull cloud push and conflict boundaries remain', () => {
    const content = archive();

    for (const expected of [
      '`localStorage` remains default, fallback, migration source, and emergency backup.',
      'Backend/cloud candidate remains explicit opt-in and reversible.',
      'Cloud pull does not auto-apply.',
      'Cloud push requires manual confirmation.',
      'Conflict resolution remains manual.',
      'Rollback / kill switch remains available.',
      'Emergency local mode remains available.',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('keeps browser mutation routes exactly seven and blocked route families blocked', () => {
    expect(API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES).toEqual([
      '/data-health/issues/:issueId/dismiss',
      '/history/:id/data-flag',
      '/history/:id/edit',
      '/sessions/start',
      '/sessions/active/patches',
      '/sessions/active/complete',
      '/sessions/active/discard',
    ]);

    const content = archive();
    expect(content).toContain('Accepted browser mutation routes remain exactly seven.');
    expect(content).toContain('`POST /data-health/repair/apply` remains blocked.');
    expect(content).toContain('Backup/import/export over HTTP remains blocked.');
    expect(content).toContain('Reset/recovery over HTTP remains blocked.');
  });

  it('confirms schema data and package drift stay blocked', () => {
    const content = archive();

    for (const expected of [
      'No normalized training tables.',
      'No destructive migration.',
      'No real personal training data in automated tests.',
      '`@supabase/supabase-js` remains the only authorized dependency drift from Phase 12.',
      'No new Phase 14 dependencies, scripts, or lockfile drift.',
    ]) {
      expect(content).toContain(expected);
    }
  });
});
