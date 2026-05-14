import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('auth callback manual verification', () => {
  const doc = () => readSource('docs/AUTH_CALLBACK_MANUAL_VERIFICATION.md');

  it('covers local preview production-candidate and emergency local callback checks', () => {
    const content = doc();

    for (const expected of [
      'Verify local callback behavior',
      'Verify preview callback behavior',
      'Verify production-candidate callback behavior',
      'Verify emergency local behavior',
      'localhost is not treated as production',
      'preview URL is not treated as production',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('keeps auth success and failure from changing local data boundaries', () => {
    const content = doc();

    for (const expected of [
      'Auth success does not change source of truth.',
      'Auth failure keeps localStorage fallback available.',
      'No cloud pull applies automatically after login.',
      'No cloud push starts automatically after login.',
      'logout does not delete emergency backup',
      'login does not upload local training data automatically',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('blocks provider routes secrets dependencies and sync', () => {
    const content = doc();

    for (const expected of [
      'No real OAuth route is added.',
      'No provider SDK dependency is added.',
      'No auth secret is committed.',
      'No real callback secret is read in tests.',
      'No production deployment is started.',
      'No cloud sync is enabled.',
    ]) {
      expect(content).toContain(expected);
    }
  });
});
