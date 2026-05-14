import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('phase 11 completion archive', () => {
  it('records task evidence for Tasks 11.1 through 11.10', () => {
    const doc = readSource('docs/PHASE11_COMPLETION_ARCHIVE.md');

    for (const expected of [
      'Phase 11 Completion Archive V1',
      '#203',
      '#204',
      '#205',
      '#206',
      '#207',
      '#208',
      '#209',
      '#210',
      '#211',
      '#212',
      'e14f47fe14367a2d08484a56ed22d06be5951976',
      'c338cbac889e0e13517fd36fe980a957bb1d6504',
      'aa0a777eab6da5ca7e319c1e64b7b3debc15593a',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('states Task 11.11 final PR and merge evidence is reported after merge', () => {
    const doc = readSource('docs/PHASE11_COMPLETION_ARCHIVE.md');

    expect(doc).toContain('Task 11.11 final PR and merge evidence will be reported after merge');
    expect(doc).toContain('should not be required inside pre-merge static tests');
  });

  it('confirms Phase 11 auth provider candidate boundaries only', () => {
    const doc = readSource('docs/PHASE11_COMPLETION_ARCHIVE.md');

    for (const expected of [
      'Supabase Auth candidate is selected as the preferred provider candidate.',
      'No real provider SDK dependency is installed.',
      'No real cloud sync is implemented.',
      'No production deployment runtime is implemented.',
      'No external monitoring upload is implemented.',
      'No SaaS or multi-user production runtime is implemented.',
      'Auth provider candidate does not equal SaaS or multi-user runtime.',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('records localStorage backend-primary api-primary-dev and route boundaries', () => {
    const doc = readSource('docs/PHASE11_COMPLETION_ARCHIVE.md');

    for (const expected of [
      'Backend-primary candidate remains explicit opt-in and reversible.',
      '`localStorage` remains default, fallback, migration source, and emergency backup.',
      'Fallback, rollback, and emergency restore remain available.',
      '`api-primary-dev` remains explicit dev/local only and not production-ready.',
      'Accepted browser mutation routes remain exactly seven.',
      'POST /data-health/repair/apply',
      'backup/import/export over HTTP',
      'reset/recovery over HTTP',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('recommends Task 12.1 only and keeps Phase 12 unstarted', () => {
    const doc = readSource('docs/PHASE11_COMPLETION_ARCHIVE.md');

    expect(doc).toContain('Recommended next task only: Task 12.1 — Cloud Database / Sync Integration Entry Gate V1.');
    expect(doc).toContain('Phase 12 is not started.');
    expect(doc).toContain('No cloud database, cloud sync, production deployment runtime, monitoring runtime, or SaaS/multi-user runtime is performed in Phase 11.');
  });
});
