import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('phase 12 completion archive', () => {
  const archive = () => readSource('docs/PHASE12_COMPLETION_ARCHIVE.md');

  it('summarizes Tasks 12.1 through 12.17 with PRs and merge commits', () => {
    const content = archive();

    for (const expected of [
      '| 12.1 |',
      '| 12.7 | Supabase client adapter candidate',
      '| 12.17 | Cloud database / sync regression lock.',
      '#214',
      '#230',
      '627c37b767d9fd9a45091347dce8f9c0ab508c73',
      'fae5dc3bc59ded7212e82fc4e79092f332794846',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('records Task 12.18 validation evidence and final PR evidence rule', () => {
    const content = archive();

    for (const expected of [
      'Task 12.18 local validation evidence recorded before PR creation',
      '`npm run api:dev:build`',
      '`npm run typecheck`',
      '`npm test`',
      '`npm run build`',
      'Dist token scan',
      'Task 12.18 final PR and merge evidence will be reported after merge',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('confirms Phase 12 cloud database and manual sync candidate boundaries', () => {
    const content = archive();

    for (const expected of [
      'Supabase DB candidate established: Supabase Postgres candidate.',
      'Backend-boundary-first access model documented and preserved.',
      'Supabase client adapter candidate exists and is disabled by default.',
      'Cloud pull candidate exists and does not auto-apply.',
      'Cloud push candidate exists and requires manual confirmation.',
      'Conflict detection and manual resolution exist and do not auto-resolve.',
      'No default cloud sync.',
      'No background sync.',
      'No production deployment runtime.',
      'No external monitoring upload.',
      'No SaaS or multi-user runtime.',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('confirms storage route data safety and package status', () => {
    const content = archive();

    for (const expected of [
      'localStorage remains default, fallback, migration source, and emergency backup.',
      'Accepted browser mutation routes remain exactly seven.',
      'Blocked routes remain blocked.',
      'No normalized training tables or destructive migration.',
      'Real personal training data remains excluded.',
      'Task 12.7 added `@supabase/supabase-js` as the only authorized dependency drift',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('recommends Task 13.1 only and does not start Phase 13', () => {
    const content = archive();

    expect(content).toContain('Task 13.1 — Production Deployment / Monitoring / Release Hardening Entry Gate V1 is recommended only.');
    expect(content).toContain('Phase 13 is not started.');
    expect(content).toContain('Cloud DB candidate does not equal SaaS/multi-user runtime.');
    expect(content).toContain('Cloud sync candidate does not equal default/background sync.');
  });
});
