import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const docPath = 'docs/AUTH_PROVIDER_FINAL_DECISION.md';

describe('auth provider final decision', () => {
  it('selects Supabase Auth as candidate and keeps other providers scoped', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'Task 11.2 Auth Provider Final Decision V1',
      'Preferred provider candidate: Supabase Auth.',
      'Backup provider candidate: Clerk.',
      'Not preferred now: Auth.js and custom auth.',
      'candidate architecture decision only',
      'Phase 11 must not install provider SDKs',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('documents why Supabase Auth is preferred', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'future Phase 12 cloud database',
      'row-level security',
      'user-scoped data planning',
      'future cloud database and sync work',
      'account-scoped AppData',
      'backend-primary candidate ownership',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('documents why Clerk is backup and Auth.js/custom auth are not preferred', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'Clerk remains a strong backup provider candidate because it has strong login UX.',
      'still requires separate database integration',
      'Auth.js and custom auth are not preferred now',
      'maintenance burden',
      'AI-assisted solo development',
      'password handling',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('allows only candidate work and blocks SDK/package/cloud expansion', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'adapter candidate',
      'config guard',
      'fake/mock provider behavior',
      'session boundary',
      'account linking dry run',
      'real provider SDK dependency',
      'Supabase SDK dependency',
      'Clerk dependency',
      'Auth.js dependency',
      'real cloud sync',
      'package dependency, package script, or lockfile changes',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('preserves runtime safety and recommends Task 11.3 only', () => {
    const doc = readSource(docPath);

    for (const expected of [
      '`localStorage` remains default, fallback, migration source, and emergency backup.',
      'Backend-primary candidate remains explicit opt-in and reversible.',
      'Login candidate must not automatically upload local training data.',
      'Logout candidate must not delete local emergency backup.',
      'Recommended next task: Task 11.3 Auth Environment & Callback Guard V1.',
      'Task 11.3 is not part of Task 11.2.',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
