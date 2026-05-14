import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('phase 14 completion archive', () => {
  const doc = () => readSource('docs/PHASE14_COMPLETION_ARCHIVE.md');

  it('records Packs 14A through 14C with PR and merge evidence', () => {
    const content = doc();

    for (const expected of [
      '| 14A Personal Production Candidate Entry + Environment Setup Plan | #248 | `b77c4887ab42611ed00fb1da6fcb89345574ef47` |',
      '| 14B Supabase Project / Auth Callback Manual Verification | #249 | `365d2ed51593c46113e4bd587f7316e1f7fc624a` |',
      '| 14C Personal Cloud Pull / Push + Rollback Rehearsal | #250 | `b08433821fb2825769b0c58fcf41e5c2dd4cdc6f` |',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('records Pack 14D validation evidence and pre-merge final evidence rule', () => {
    const content = doc();

    for (const expected of [
      'Pack 14D final PR and merge evidence will be reported after merge',
      '`npm run api:dev:build` passed.',
      '`npm run typecheck` passed.',
      '`npm test` passed.',
      '`npm run build` passed.',
      'dist token scan clean.',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('confirms Phase 14 deliverables exist', () => {
    const content = doc();

    for (const expected of [
      'Personal production candidate release path exists.',
      'Personal production candidate entry exists.',
      'Personal production environment setup plan exists.',
      'Supabase project manual verification exists.',
      'Auth callback manual verification exists.',
      'RLS/ownership manual verification exists.',
      'Cloud pull rehearsal exists.',
      'Cloud push rehearsal exists.',
      'Rollback / kill switch rehearsal exists.',
      'Emergency local restore rehearsal exists.',
      'Personal production release candidate acceptance exists.',
      'Personal production regression lock exists.',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('recommends Task 15A only and does not start Phase 15', () => {
    const content = doc();

    expect(content).toContain('Recommended next task only: Task 15A — First Week Personal Production Usage Runbook.');
    expect(content).toContain('Phase 15 is not started.');
  });
});
