import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const allDocs = () => [
  'API_CONTRACT.md',
  'FULL_STACK_REFACTOR_PLAN.md',
  'docs/SESSION_START_REGRESSION_LOCK.md',
  'docs/SESSION_START_OBSERVABILITY_RECOVERY_NOTES.md',
  'docs/SESSION_START_PROTOTYPE_HARDENING.md',
  'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
].map(readSource).join('\n');

describe('session start regression lock docs parity', () => {
  it('records Task 4.65 in API, refactor, and manual docs', () => {
    const docs = allDocs();

    expect(readSource('API_CONTRACT.md')).toContain('Task 4.65 Session Start Regression Lock V1');
    expect(readSource('FULL_STACK_REFACTOR_PLAN.md')).toContain('### Task 4.65: Session Start Regression Lock V1');
    expect(readSource('docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md')).toContain('Task 4.65 Session Start Regression Lock');
    expect(docs).toContain('Task 4.66 Write-path Four-route Checkpoint V1');
  });

  it('keeps exact four-route scope and blocked fifth-route language aligned', () => {
    const docs = allDocs();

    for (const expected of [
      'POST /data-health/issues/:issueId/dismiss',
      'POST /history/:id/data-flag',
      'POST /history/:id/edit',
      'POST /sessions/start',
      'No other browser mutation route is accepted.',
      'Do not implement a fifth mutation next.',
      'localStorage remains current source of truth',
      'API results never overwrite AppData or localStorage',
    ]) {
      expect(docs).toContain(expected);
    }

    expect(docs).not.toMatch(/enable fifth mutation now/i);
    expect(docs).not.toMatch(/enable active patch now/i);
    expect(docs).not.toMatch(/enable active complete now/i);
    expect(docs).not.toMatch(/enable active discard now/i);
    expect(docs).not.toMatch(/enable DataHealth repair now/i);
    expect(docs).not.toMatch(/replace localStorage now/i);
  });
});
