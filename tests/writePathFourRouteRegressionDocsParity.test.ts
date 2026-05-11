import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const allDocs = () => [
  'API_CONTRACT.md',
  'FULL_STACK_REFACTOR_PLAN.md',
  'docs/WRITE_PATH_FOUR_ROUTE_REGRESSION_LOCK.md',
  'docs/WRITE_PATH_FOUR_ROUTE_MANUAL_REGRESSION.md',
  'docs/WRITE_PATH_FOUR_ROUTE_CHECKPOINT.md',
  'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
].map(readSource).join('\n');

describe('write-path four-route regression lock docs parity', () => {
  it('records Task 4.68 in API, refactor, lock, and manual docs', () => {
    const docs = allDocs();

    expect(readSource('API_CONTRACT.md')).toContain('Task 4.68 Write-path Four-route Regression Lock V1');
    expect(readSource('FULL_STACK_REFACTOR_PLAN.md')).toContain('### Task 4.68: Write-path Four-route Regression Lock V1');
    expect(readSource('docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md')).toContain('Task 4.68 Write-path Four-route Regression Lock');
    expect(docs).toContain('Task 4.69 Phase 4 Source-of-truth Migration Readiness Audit V1');
  });

  it('keeps exact four-route allowlist and source-of-truth migration blocked', () => {
    const docs = allDocs();

    for (const expected of [
      'POST /data-health/issues/:issueId/dismiss',
      'POST /history/:id/data-flag',
      'POST /history/:id/edit',
      'POST /sessions/start',
      'No other browser mutation route is accepted.',
      'localStorage remains current source of truth',
      'API results never overwrite AppData or localStorage',
      'Task 4.69 must be audit-only',
    ]) {
      expect(docs).toContain(expected);
    }

    expect(docs).not.toMatch(/switch source of truth now/i);
    expect(docs).not.toMatch(/replace localStorage now/i);
    expect(docs).not.toMatch(/enable active patch now/i);
    expect(docs).not.toMatch(/enable active complete now/i);
    expect(docs).not.toMatch(/enable active discard now/i);
  });
});
