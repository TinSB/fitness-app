import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('cloud database provider architecture decision', () => {
  it('selects Supabase Postgres and backend-boundary first', () => {
    const doc = readSource('docs/CLOUD_DATABASE_PROVIDER_ARCHITECTURE_DECISION.md');

    for (const expected of [
      'Preferred cloud database candidate: Supabase Postgres.',
      'Access pattern: backend-boundary first.',
      'Frontend direct AppData cloud writes: blocked.',
      'Initial data model: document-first AppData snapshot model.',
      'Normalized training tables: blocked.',
      'Dev SQLite snapshot repository: not a cloud database.',
      'Firebase/custom DB: not the first path.',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('documents rationale tied to Phase 11 Supabase Auth candidate and RLS', () => {
    const doc = readSource('docs/CLOUD_DATABASE_PROVIDER_ARCHITECTURE_DECISION.md');

    expect(doc).toContain('aligns with the Phase 11 Supabase Auth candidate');
    expect(doc).toContain('user-scoped data and RLS');
    expect(doc).toContain('owner checks, rollback, validation, and conflict handling');
  });

  it('rejects normalized training tables destructive migration and default cloud sync', () => {
    const doc = readSource('docs/CLOUD_DATABASE_PROVIDER_ARCHITECTURE_DECISION.md');

    for (const expected of [
      'Normalized exercise/session/history/set tables.',
      'Destructive migration.',
      'Partial cloud table migration.',
      'Default cloud sync.',
      'Background or automatic sync.',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('does not add Supabase dependency or implementation in Task 12.2', () => {
    const doc = readSource('docs/CLOUD_DATABASE_PROVIDER_ARCHITECTURE_DECISION.md');
    const packageJson = JSON.parse(readSource('package.json')) as { dependencies: Record<string, string> };

    expect(packageJson.dependencies).toHaveProperty('@supabase/supabase-js');
    expect(doc).toContain('No Supabase dependency is added in this task.');
    expect(doc).toContain('No database schema, SQL migration, cloud client, cloud read, cloud write, default sync, background sync, or source-of-truth switch is implemented.');
  });

  it('recommends Task 12.3 only', () => {
    const doc = readSource('docs/CLOUD_DATABASE_PROVIDER_ARCHITECTURE_DECISION.md');

    expect(doc).toContain('Recommended next task: Task 12.3 Supabase Environment / Project Guard V1.');
  });
});
