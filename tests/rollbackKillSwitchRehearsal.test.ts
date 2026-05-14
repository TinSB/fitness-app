import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('rollback kill switch rehearsal', () => {
  const doc = () => readSource('docs/ROLLBACK_KILL_SWITCH_REHEARSAL.md');

  it('requires disabling all cloud and backend candidates', () => {
    const content = doc();

    for (const expected of [
      'Disable cloud pull.',
      'Disable cloud push.',
      'Disable Supabase adapter.',
      'Disable backend-primary candidate.',
      'Return to localStorage-primary.',
      'Force emergency-local mode.',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('preserves local data cloud data and manual conflicts', () => {
    const content = doc();

    for (const expected of [
      'local data deleted remains false',
      'cloud data overwritten remains false',
      'manual conflict resolution remains manual',
      'local app remains usable after cloud candidate failure',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('blocks reset recovery export routes public runtime and package drift', () => {
    const content = doc();

    for (const expected of [
      'No reset/recovery HTTP route.',
      'No backup/import/export HTTP route.',
      'No local data deletion.',
      'No cloud overwrite.',
      'No public SaaS runtime.',
      'No package or lockfile change.',
    ]) {
      expect(content).toContain(expected);
    }
  });
});
