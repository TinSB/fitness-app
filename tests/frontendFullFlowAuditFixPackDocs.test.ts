import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('frontend full flow audit fix pack docs', () => {
  const doc = () => readSource('docs/FRONTEND_FULL_FLOW_AUDIT_FIX_PACK_V1.md');

  it('documents the blocker fixes and validation stack', () => {
    const content = doc();

    for (const expected of [
      'Dev API recovery accepts safe macOS temp artifacts',
      'full Training page `完成这组` button completes the visible edited row',
      'node scripts/scan-production-dist-safety.mjs',
      'test ! -e pnpm-lock.yaml',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('documents a safe disposable auth and sync audit fixture', () => {
    const content = doc();

    for (const expected of [
      'throwaway email/password account',
      'Export a local JSON backup before any sync candidate action.',
      'Confirm dry run output before enabling any upload candidate.',
      'Enable sync only through explicit user action after backup and dry run pass.',
      'Reload and verify the local fallback data remains visible.',
      'Sign out at the end of the run.',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('keeps the fixture explicit about hard stop conditions', () => {
    const content = doc();

    for (const expected of [
      'Any automatic sync behavior before explicit enablement.',
      'Any silent overwrite or local data deletion.',
      'Any browser-visible credential, secret, raw environment value, or token-like value.',
      'Any package or lockfile drift.',
      'Any schema change to `AppData` or `TrainingSession`.',
    ]) {
      expect(content).toContain(expected);
    }
  });
});
