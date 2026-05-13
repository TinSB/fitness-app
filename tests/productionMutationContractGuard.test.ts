import { describe, expect, it } from 'vitest';
import { createRuntimeSourceSelector } from '../src/storage/runtimeSourceSelector';
import { readSource } from './runtimeBoundaryTestHelpers';

const docPath = 'docs/PRODUCTION_MUTATION_CONTRACT_GUARD.md';

describe('production mutation contract guard', () => {
  it('documents contract guard non-implementation scope', () => {
    const doc = readSource(docPath);

    for (const expected of [
      '# Production Mutation Contract Guard',
      'docs/static tests only',
      'does not add mutation endpoints',
      'Production write path is not source-of-truth.',
      'Mutation failures must not overwrite localStorage.',
      'Mutation results must not silently replace AppData.',
      'Task 8.10 may begin only after Task 8.9 is fully merged.',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('keeps source-of-truth boundaries documented and unchanged', () => {
    const doc = readSource(docPath);

    expect(createRuntimeSourceSelector({ DEV: true })).toMatchObject({
      mode: 'localStorage',
      sourceOfTruth: 'localStorage',
      apiWriteEnabled: false,
    });
    for (const expected of [
      '`localStorage` remains default runtime source',
      '`api-primary-dev` remains explicit dev/local only and not production-ready.',
      'Production source-of-truth switch remains blocked.',
      'No real personal training data',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
