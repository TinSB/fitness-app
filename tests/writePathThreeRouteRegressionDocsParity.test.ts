import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const allDocs = () => [
  'API_CONTRACT.md',
  'FULL_STACK_REFACTOR_PLAN.md',
  'docs/WRITE_PATH_THREE_ROUTE_REGRESSION_LOCK.md',
  'docs/WRITE_PATH_THREE_ROUTE_MANUAL_REGRESSION.md',
  'docs/WRITE_PATH_THREE_ROUTE_CHECKPOINT.md',
  'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
].map(readSource).join('\n');

describe('write-path three-route regression lock docs parity', () => {
  it('records Task 4.54 in API, refactor, lock, and manual docs', () => {
    const docs = allDocs();

    expect(readSource('API_CONTRACT.md')).toContain('Task 4.54 Write-path Three-route Regression Lock V1');
    expect(readSource('FULL_STACK_REFACTOR_PLAN.md')).toContain('### Task 4.54: Write-path Three-route Regression Lock V1');
    expect(readSource('docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md')).toContain('Task 4.54 Write-path Three-route Regression Lock');
    expect(docs).toContain('Task 4.55 Fourth Mutation Candidate Readiness Audit V1');
  });

  it('keeps final three-route state and stop condition aligned', () => {
    const docs = allDocs();

    for (const expected of [
      'POST /data-health/issues/:issueId/dismiss',
      'POST /history/:id/data-flag',
      'POST /history/:id/edit',
      'No other browser mutation route is accepted.',
      'No fourth mutation is approved.',
      'Task 4.55 must be audit/planning only. It must not implement a fourth mutation.',
      'localStorage remains current source of truth',
      'API results never overwrite AppData or localStorage',
    ]) {
      expect(docs).toContain(expected);
    }
  });
});
