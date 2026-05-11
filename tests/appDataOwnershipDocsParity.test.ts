import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const allDocs = () => [
  'docs/APPDATA_OWNERSHIP_MATRIX.md',
  'docs/SOURCE_OF_TRUTH_MIGRATION_ARCHITECTURE_GATE.md',
  'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
  'API_CONTRACT.md',
  'FULL_STACK_REFACTOR_PLAN.md',
].map(readSource).join('\n');

describe('AppData ownership docs parity', () => {
  it('records Task 5.2 across docs and keeps Task 5.3 next', () => {
    expect(readSource('API_CONTRACT.md')).toContain('Task 5.2 AppData Ownership Matrix V1');
    expect(readSource('FULL_STACK_REFACTOR_PLAN.md')).toContain('### Task 5.2: AppData Ownership Matrix V1');
    expect(readSource('docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md')).toContain('Task 5.2 AppData Ownership Matrix');

    const docs = allDocs();
    expect(docs).toContain('docs/APPDATA_OWNERSHIP_MATRIX.md');
    expect(docs).toContain('Task 5.3 API Client Runtime Strategy V1');
  });

  it('keeps ownership categories and required AppData areas aligned', () => {
    const docs = allDocs();

    for (const expected of [
      'API-owned',
      'local-only',
      'derived',
      'migration-only',
      'fallback-only',
      'blocked',
      'training history',
      'active session',
      'program templates',
      'settings',
      'screening profile',
      'DataHealth',
      'backup metadata',
      'readMirror summaries',
      'derived analytics',
    ]) {
      expect(docs).toContain(expected);
    }
  });

  it('keeps source-of-truth and production boundaries aligned', () => {
    const docs = allDocs();

    for (const expected of [
      'localStorage remains source of truth',
      'API results never overwrite AppData',
      'No API-backed runtime is implemented.',
      'No source-of-truth migration is implemented.',
      'production backend',
      'auth',
      'sync',
    ]) {
      expect(docs).toContain(expected);
    }

    expect(docs).not.toMatch(/switch source of truth now/i);
    expect(docs).not.toMatch(/replace localStorage now/i);
  });
});

