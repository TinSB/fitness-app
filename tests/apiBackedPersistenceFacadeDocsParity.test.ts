import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const allDocs = () => [
  'docs/API_BACKED_PERSISTENCE_FACADE_PLAN.md',
  'docs/ACTIVE_SESSION_FULL_WRITE_PATH_REGRESSION_LOCK.md',
  'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
  'API_CONTRACT.md',
  'FULL_STACK_REFACTOR_PLAN.md',
].map(readSource).join('\n');

describe('API-backed persistence facade docs parity', () => {
  it('records Task 5.23 and points to Task 5.24 only as the next adapter prototype', () => {
    const docs = allDocs();

    expect(readSource('API_CONTRACT.md')).toContain('Task 5.23 API-backed Persistence Facade Plan V1');
    expect(readSource('FULL_STACK_REFACTOR_PLAN.md')).toContain('### Task 5.23: API-backed Persistence Facade Plan V1');
    expect(readSource('docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md')).toContain('Task 5.23 API-backed Persistence Facade Plan');
    expect(docs).toContain('Task 5.24 API-backed Persistence Adapter Prototype V1');
  });

  it('keeps source-of-truth, accepted routes, and blocked routes aligned', () => {
    const docs = allDocs();

    for (const expected of [
      'App.tsx -> persistence facade -> localStorageAdapter or apiStorageAdapter -> AppData',
      'POST /data-health/issues/:issueId/dismiss',
      'POST /history/:id/data-flag',
      'POST /history/:id/edit',
      'POST /sessions/start',
      'POST /sessions/active/patches',
      'POST /sessions/active/complete',
      'POST /sessions/active/discard',
      'POST /data-health/repair/apply',
      'backup/import/export over HTTP',
      'reset/recovery over HTTP',
      'localStorage remains source of truth',
      'API results never overwrite AppData or localStorage',
    ]) {
      expect(docs).toContain(expected);
    }
  });

  it('does not instruct implementation or production source switch now', () => {
    const docs = allDocs();

    for (const pattern of [
      /implement apiStorageAdapter now/i,
      /wire App\.tsx to API storage now/i,
      /switch source of truth now/i,
      /replace localStorage now/i,
      /enable production backend now/i,
      /enable auth now/i,
      /enable sync now/i,
      /enable cloud/i,
      /enable backup\/import\/export over HTTP now/i,
      /enable reset\/recovery over HTTP now/i,
      /add an eighth mutation route now/i,
    ]) {
      expect(docs).not.toMatch(pattern);
    }
  });
});
