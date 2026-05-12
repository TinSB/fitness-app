import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const allDocs = () => [
  'API_CONTRACT.md',
  'FULL_STACK_REFACTOR_PLAN.md',
  'docs/ACTIVE_SESSION_FULL_WRITE_PATH_REGRESSION_LOCK.md',
  'docs/SESSION_DISCARD_ACCEPTANCE_HARDENING.md',
  'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
].map(readSource).join('\n');

describe('active session full write-path docs parity', () => {
  it('records Task 5.22 in API, refactor, lock, and manual docs', () => {
    const docs = allDocs();

    expect(readSource('API_CONTRACT.md')).toContain('Task 5.22 Active Session Full Write-path Regression Lock V1');
    expect(readSource('FULL_STACK_REFACTOR_PLAN.md')).toContain('### Task 5.22: Active Session Full Write-path Regression Lock V1');
    expect(readSource('docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md')).toContain('Task 5.22 Active Session Full Write-path Regression Lock');
    expect(docs).toContain('Task 5.23 API-backed Persistence Facade Plan V1');
  });

  it('keeps exact seven-route allowlist and eighth-route block aligned', () => {
    const docs = allDocs();

    for (const expected of [
      'POST /data-health/issues/:issueId/dismiss',
      'POST /history/:id/data-flag',
      'POST /history/:id/edit',
      'POST /sessions/start',
      'POST /sessions/active/patches',
      'POST /sessions/active/complete',
      'POST /sessions/active/discard',
      'No other browser mutation route is accepted.',
      'No eighth mutation is approved.',
      'localStorage remains default App runtime source of truth',
      'API results never overwrite AppData or localStorage',
    ]) {
      expect(docs).toContain(expected);
    }

    for (const pattern of [
      /enable eighth mutation now/i,
      /enable DataHealth repair now/i,
      /enable backup\/import\/export over HTTP now/i,
      /enable reset\/recovery over HTTP now/i,
      /replace localStorage now/i,
      /make API source of truth now/i,
      /deploy production backend now/i,
      /enable auth now/i,
      /enable sync now/i,
    ]) {
      expect(docs).not.toMatch(pattern);
    }
  });
});
