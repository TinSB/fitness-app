import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const planPath = 'docs/API_BACKED_PERSISTENCE_FACADE_PLAN.md';

describe('API-backed persistence facade plan', () => {
  it('exists and documents planning-only scope', () => {
    const doc = readSource(planPath);

    for (const expected of [
      'Task 5.23',
      'planning-only',
      'does not implement `src/storage/apiStorageAdapter.ts`',
      'does not add a runtime source selector',
      'does not modify App.tsx',
      'does not switch source of truth',
      'does not replace localStorage',
      'does not add API primary runtime',
      'does not add a browser mutation route',
      'localStorage remains source of truth',
      'API results never overwrite AppData or localStorage',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('defines the facade shape and future adapter boundary', () => {
    const doc = readSource(planPath);

    for (const expected of [
      'App.tsx -> persistence facade -> localStorageAdapter or apiStorageAdapter -> AppData',
      'load AppData',
      'save AppData',
      'report source metadata',
      'report failure state',
      'support localStorage fallback',
      'The existing localStorage adapter remains the default implementation.',
      'The future `apiStorageAdapter` may be added only in Task 5.24',
      'require an explicit dev/local flag',
      'typed read/write facade methods',
      'Default must remain `localStorage`',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('locks source-of-truth safety, rollback, and next task gates', () => {
    const doc = readSource(planPath);

    for (const expected of [
      'No dual-write is active in Task 5.23.',
      'No offline mutation queue is active in Task 5.23.',
      'No destructive migration is active in Task 5.23.',
      'API unavailable fallback',
      'rollback to localStorage mode',
      'backup-first migration path',
      'No real personal training data',
      'Accepted browser mutation routes remain exactly seven.',
      'No broad mutation client exists.',
      'Task 5.24 API-backed Persistence Adapter Prototype V1',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
