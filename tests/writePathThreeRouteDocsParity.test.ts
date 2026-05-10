import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const allDocs = () => [
  'API_CONTRACT.md',
  'FULL_STACK_REFACTOR_PLAN.md',
  'docs/WRITE_PATH_THREE_ROUTE_CHECKPOINT.md',
  'docs/LIMITED_HISTORY_EDIT_REGRESSION_LOCK.md',
  'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
].map(readSource).join('\n');

describe('write-path three-route checkpoint docs parity', () => {
  it('records Task 4.52 in API, refactor, checkpoint, and manual docs', () => {
    const docs = allDocs();

    expect(readSource('API_CONTRACT.md')).toContain('Task 4.52 Write-path Three-route Checkpoint V1');
    expect(readSource('FULL_STACK_REFACTOR_PLAN.md')).toContain('### Task 4.52: Write-path Three-route Checkpoint V1');
    expect(readSource('docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md')).toContain('Task 4.52 Write-path Three-route Checkpoint');
    expect(docs).toContain('Task 4.53 Write-path Three-route Manual Regression V1');
  });

  it('keeps exact three-route allowlist and fourth-route block aligned', () => {
    const docs = allDocs();

    for (const expected of [
      'POST /data-health/issues/:issueId/dismiss',
      'POST /history/:id/data-flag',
      'POST /history/:id/edit',
      'No other browser mutation route is accepted.',
      'Do not implement a fourth mutation next.',
      'localStorage remains current source of truth',
      'API results never overwrite AppData or localStorage',
    ]) {
      expect(docs).toContain(expected);
    }

    expect(docs).not.toMatch(/enable fourth mutation now/i);
    expect(docs).not.toMatch(/enable session mutation now/i);
    expect(docs).not.toMatch(/enable DataHealth repair now/i);
    expect(docs).not.toMatch(/replace localStorage now/i);
  });
});
