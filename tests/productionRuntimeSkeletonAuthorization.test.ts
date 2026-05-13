import { describe, expect, it } from 'vitest';
import { createRuntimeSourceSelector } from '../src/storage/runtimeSourceSelector';
import { readSource } from './runtimeBoundaryTestHelpers';

const docPath = 'docs/PRODUCTION_RUNTIME_SKELETON_AUTHORIZATION.md';

describe('production runtime skeleton authorization', () => {
  it('documents skeleton meaning and scope', () => {
    const doc = readSource(docPath);

    for (const expected of [
      '# Production Runtime Skeleton Authorization',
      'disabled-by-default planning or compile-time boundary',
      'placeholder contract interfaces',
      'disabled configuration boundary',
      'docs-only or compile-time-only stubs',
      'no network writes',
      'no production data writes',
      'no user data migration',
      'no real data',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('does not authorize live runtime capabilities', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'live production backend',
      'auth runtime',
      'cloud sync',
      'deployment runtime',
      'monitoring runtime',
      'source-of-truth switch',
      'route expansion',
      'normalized tables',
      'destructive migration',
      'Task 7.8 is not started by Task 7.7.',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('keeps current runtime source default unchanged', () => {
    expect(createRuntimeSourceSelector({ DEV: true })).toMatchObject({
      mode: 'localStorage',
      sourceOfTruth: 'localStorage',
      apiWriteEnabled: false,
    });
  });
});
