import { describe, expect, it } from 'vitest';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';
import { createRuntimeSourceSelector } from '../src/storage/runtimeSourceSelector';
import { readSource } from './runtimeBoundaryTestHelpers';

const docPath = 'docs/PRODUCTION_RUNTIME_CONTRACT_SCAFFOLD_AUTHORIZATION.md';

describe('production runtime contract scaffold authorization', () => {
  it('documents required sections', () => {
    const doc = readSource(docPath);

    for (const section of [
      '# Production Runtime Contract Scaffold Authorization',
      '## Task Identity',
      '## Phase 7 Context',
      '## Contract Scaffold Purpose',
      '## Candidate Production Contract Areas',
      '## Explicitly Blocked Production Runtime Areas',
      '## Source-of-truth Boundary',
      '## Dev/local API Boundary',
      '## Contract vs Implementation Distinction',
      '## Acceptance Criteria',
      '## Decision',
    ]) {
      expect(doc).toContain(section);
    }
  });

  it('locks candidate contract areas and blocked runtime surfaces', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'read contract',
      'mutation contract',
      'auth/user identity requirement',
      'data ownership',
      'source-of-truth migration conditions',
      'failure/rollback behavior',
      'observability requirements',
      'environment separation',
      'route surface control',
      'production backend runtime',
      'auth/user accounts runtime',
      'cloud sync runtime',
      'Task 7.3 is not started by Task 7.2.',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('keeps route and runtime source boundaries unchanged', () => {
    expect(API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES).toHaveLength(7);
    expect(createRuntimeSourceSelector({ DEV: true })).toMatchObject({
      mode: 'localStorage',
      sourceOfTruth: 'localStorage',
      apiWriteEnabled: false,
    });
  });
});
