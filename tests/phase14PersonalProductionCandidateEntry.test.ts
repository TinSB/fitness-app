import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('phase 14 personal production candidate entry', () => {
  const doc = () => readSource('docs/PHASE14_PERSONAL_PRODUCTION_CANDIDATE_ENTRY.md');

  it('verifies Phase 13 completion evidence', () => {
    const content = doc();

    for (const expected of [
      'Final Phase 13 PR: #247.',
      'Final Phase 13 merge commit: `e50729ac4e6a844c6d874c936acc66b80199ee6d`.',
      '`npm test`: 1034 files / 4135 tests passed.',
      'dist token scan clean',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('defines personal production candidate scope', () => {
    const content = doc();

    for (const expected of [
      'single-user / owner-only',
      'manual verification',
      'not public SaaS',
      'not default cloud sync',
      'not background sync',
      'not production auto-deployment',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('allows only manual external setup and blocks secrets in repo', () => {
    const content = doc();

    for (const expected of [
      'A real Supabase project may be manually configured by the user outside the repo.',
      'Auth callback behavior may be manually verified.',
      'Supabase anon key classification may be manually verified.',
      'Service role must never enter browser.',
      'No `.env` file may be committed.',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('preserves Phase 13 runtime boundaries', () => {
    const content = doc();

    for (const expected of [
      '`localStorage` remains default, fallback, migration source, and emergency backup.',
      'Backend/cloud candidate remains explicit opt-in and reversible.',
      'Cloud pull does not auto-apply.',
      'Cloud push requires manual confirmation.',
      'Conflict resolution remains manual.',
      'Rollback / kill switch remains available.',
      'Emergency local mode remains available.',
      'Accepted browser mutation routes remain exactly seven.',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('recommends Pack 14B only', () => {
    expect(doc()).toContain('Recommended next pack after merge: Pack 14B — Supabase Project / Auth Callback Manual Verification.');
  });
});
