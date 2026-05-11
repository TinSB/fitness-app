import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const allDocs = () => [
  'API_CONTRACT.md',
  'FULL_STACK_REFACTOR_PLAN.md',
  'docs/WRITE_PATH_FOUR_ROUTE_CHECKPOINT.md',
  'docs/WRITE_PATH_FOUR_ROUTE_MANUAL_REGRESSION.md',
  'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
].map(readSource).join('\n');

describe('write-path four-route manual regression docs parity', () => {
  it('records Task 4.67 in API, refactor, runbook, and manual docs', () => {
    const docs = allDocs();

    expect(readSource('API_CONTRACT.md')).toContain('Task 4.67 Write-path Four-route Manual Regression V1');
    expect(readSource('FULL_STACK_REFACTOR_PLAN.md')).toContain('### Task 4.67: Write-path Four-route Manual Regression V1');
    expect(readSource('docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md')).toContain('Task 4.67 Write-path Four-route Manual Regression');
    expect(docs).toContain('Task 4.68 Write-path Four-route Regression Lock V1');
  });

  it('keeps exact four-route allowlist and fifth-route block aligned', () => {
    const docs = allDocs();

    for (const expected of [
      'POST /data-health/issues/:issueId/dismiss',
      'POST /history/:id/data-flag',
      'POST /history/:id/edit',
      'POST /sessions/start',
      'No flag combination enables a fifth mutation route.',
      'localStorage remains source of truth',
      'API result never overwrites AppData or localStorage',
    ]) {
      expect(docs).toContain(expected);
    }

    expect(docs).not.toMatch(/enable fifth mutation now/i);
    expect(docs).not.toMatch(/enable active patch now/i);
    expect(docs).not.toMatch(/enable active complete now/i);
    expect(docs).not.toMatch(/enable active discard now/i);
    expect(docs).not.toMatch(/replace localStorage now/i);
  });
});
