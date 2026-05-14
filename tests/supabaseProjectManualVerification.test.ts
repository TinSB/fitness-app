import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('supabase project manual verification', () => {
  const doc = () => readSource('docs/SUPABASE_PROJECT_MANUAL_VERIFICATION.md');

  it('requires project url anon key and service role manual verification', () => {
    const content = doc();

    for (const expected of [
      'project URL is manually classified as production-candidate',
      'anon key is manually classified as browser-safe',
      'service role is isolated outside browser-safe config',
      'service role never enters browser',
      'no `.env` file is committed',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('requires synthetic/manual test account before real personal data', () => {
    const content = doc();

    expect(content).toContain('synthetic/manual test account');
    expect(content).toContain('real personal training data is not used until acceptance passes');
  });

  it('blocks real Supabase connections SQL and package drift', () => {
    const content = doc();

    for (const expected of [
      'No real Supabase connection.',
      'No SQL application.',
      'No table creation.',
      'No cloud sync implementation.',
      'No production deployment config.',
      'No package or lockfile change.',
      'No real project URL or real key in tests.',
    ]) {
      expect(content).toContain(expected);
    }
  });
});
