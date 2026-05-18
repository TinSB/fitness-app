import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('mobile PWA personal use polish docs', () => {
  const doc = () => readSource('docs/MOBILE_PWA_PERSONAL_USE_POLISH_PACK.md');

  it('records Task 16F identity and Task 16E baseline evidence', () => {
    const content = doc();

    for (const expected of [
      'Task 16F',
      'Mobile / PWA Personal Use Polish Pack V1',
      'Task 16E complete',
      'PR #260',
      'dd3da4fe0db698c7b003e63b005b85cee82749f4',
      '1072 files / 4333 tests',
      'dist token scan clean',
      'SaaS remains deferred',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('documents non-goals and safety baseline', () => {
    const content = doc();

    for (const expected of [
      'add service-worker sync.',
      'add background sync.',
      'add automatic upload.',
      'add push notification.',
      'change source-of-truth behavior.',
      'localStorage remains default / fallback / migration / emergency.',
      'backend/cloud candidate remains explicit opt-in and reversible.',
      'cloud pull does not auto-apply.',
      'cloud push requires manual confirmation.',
      'accepted browser mutation routes remain exactly seven.',
      'personal-only direction remains active.',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('documents mobile checklist guidance areas and Task 16G recommendation', () => {
    const content = doc();

    for (const expected of [
      'phone training use remains local-first.',
      'PWA install guidance does not imply cloud sync.',
      'offline/local availability wording says no background sync.',
      'emergency local mode on phone remains visible.',
      'backup/recovery reminder appears before risky candidate work.',
      'cloud candidate remains optional/manual.',
      'tap target and mobile readability guidance remains UI-only.',
      'history review on small screen confirms local history.',
      'diagnostics on small screen remind redaction.',
      'Task 16G — Phase 16 Personal-Only Roadmap Archive V1',
      'Task 16G is recommended but not started by Task 16F.',
      'Task 16F does not start Task 16G.',
    ]) {
      expect(content).toContain(expected);
    }
  });
});
