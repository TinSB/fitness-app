import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('personal cloud push rehearsal', () => {
  const doc = () => readSource('docs/PERSONAL_CLOUD_PUSH_REHEARSAL.md');

  it('requires dry run owner backup schema and manual confirmation gates', () => {
    const content = doc();

    for (const expected of [
      'Run the local-to-cloud dry run first.',
      'owner check required',
      'backup check required',
      'schema validation required',
      'manual confirmation required',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('requires no fake success rollback and unchanged source of truth', () => {
    const content = doc();

    for (const expected of [
      'no fake success',
      'rollback available',
      'local data changed remains false',
      'source-of-truth unchanged',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('blocks unconfirmed push default sync routes and package drift', () => {
    const content = doc();

    for (const expected of [
      'No unconfirmed cloud push.',
      'No automatic upload of real training data.',
      'No default cloud sync.',
      'No background sync.',
      'No new route.',
      'No package or lockfile change.',
    ]) {
      expect(content).toContain(expected);
    }
  });
});
