import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('personal cloud pull rehearsal', () => {
  const doc = () => readSource('docs/PERSONAL_CLOUD_PULL_REHEARSAL.md');

  it('requires dry run owner check schema validation and manual confirmation', () => {
    const content = doc();

    for (const expected of [
      'Run the local-to-cloud dry run first.',
      'owner check required',
      'schema validation required',
      'cloud pull does not auto-apply',
      'manual confirmation required before any future apply',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('keeps local storage and source of truth unchanged', () => {
    const content = doc();

    for (const expected of [
      '`localStorage` unchanged after the pull candidate read',
      'Source-of-truth changed is false',
      'Emergency backup is available',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('blocks automatic apply routes package drift and default sync', () => {
    const content = doc();

    for (const expected of [
      'No automatic cloud apply.',
      'No silent overwrite of local data.',
      'No real cloud write from automated tests.',
      'No default cloud sync.',
      'No background sync.',
      'No new route.',
      'No package or lockfile change.',
    ]) {
      expect(content).toContain(expected);
    }
  });
});
