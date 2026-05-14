import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('RLS ownership manual verification', () => {
  const doc = () => readSource('docs/RLS_OWNERSHIP_MANUAL_VERIFICATION.md');

  it('documents required ownership fields', () => {
    const content = doc();

    for (const expected of [
      'owner user id',
      'account id',
      'device owner id',
      'local owner id',
      'cloud account owner',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('requires own-data policies owner mismatch rejection and anonymous local safety', () => {
    const content = doc();

    for (const expected of [
      'read policy allows the user to read own data only',
      'write policy allows the user to write own data only',
      'owner mismatch rejection is documented',
      'anonymous local data is not auto-uploaded',
      'delete policy remains blocked until a later explicit phase',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('blocks SQL schema migration real project data and package drift', () => {
    const content = doc();

    for (const expected of [
      'No SQL application.',
      'No table creation.',
      'No normalized training tables.',
      'No destructive migration.',
      'No cloud sync implementation.',
      'No package or lockfile change.',
      'No production deployment config.',
    ]) {
      expect(content).toContain(expected);
    }
  });
});
