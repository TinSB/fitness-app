import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const allDocs = () => [
  'docs/API_CLIENT_RUNTIME_STRATEGY.md',
  'docs/APPDATA_OWNERSHIP_MATRIX.md',
  'docs/SOURCE_OF_TRUTH_MIGRATION_ARCHITECTURE_GATE.md',
  'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
  'API_CONTRACT.md',
  'FULL_STACK_REFACTOR_PLAN.md',
].map(readSource).join('\n');

describe('API client runtime docs parity', () => {
  it('records Task 5.3 across docs and keeps Task 5.4 next', () => {
    expect(readSource('API_CONTRACT.md')).toContain('Task 5.3 API Client Runtime Strategy V1');
    expect(readSource('FULL_STACK_REFACTOR_PLAN.md')).toContain('### Task 5.3: API Client Runtime Strategy V1');
    expect(readSource('docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md')).toContain('Task 5.3 API Client Runtime Strategy');

    const docs = allDocs();
    expect(docs).toContain('docs/API_CLIENT_RUNTIME_STRATEGY.md');
    expect(docs).toContain('Task 5.4 Runtime Source Switch Feature Flag Plan V1');
  });

  it('keeps strategy topics aligned', () => {
    const docs = allDocs();

    for (const expected of [
      'typed route clients',
      'Read clients',
      'Mutation clients',
      'no broad mutation client',
      'Error Shape',
      'timeout',
      'abort',
      'retry',
      'requestFingerprint',
      'snapshot metadata',
      'source snapshot',
    ]) {
      expect(docs).toContain(expected);
    }
  });

  it('keeps source-of-truth and implementation boundaries aligned', () => {
    const docs = allDocs();

    for (const expected of [
      'localStorage remains source of truth',
      'API results never overwrite AppData',
      'No API client implementation is added.',
      'No API-backed runtime is implemented.',
      'No broad mutation client is added.',
    ]) {
      expect(docs).toContain(expected);
    }

    expect(docs).not.toMatch(/switch source of truth now/i);
    expect(docs).not.toMatch(/replace localStorage now/i);
  });
});

