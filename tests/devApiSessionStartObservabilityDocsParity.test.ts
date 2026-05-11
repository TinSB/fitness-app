import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const allDocs = () => [
  'API_CONTRACT.md',
  'FULL_STACK_REFACTOR_PLAN.md',
  'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
  'docs/SESSION_START_OBSERVABILITY_RECOVERY_NOTES.md',
  'docs/SESSION_START_PROTOTYPE_HARDENING.md',
  'docs/SESSION_START_MANUAL_APP_ACCEPTANCE.md',
].map(readSource).join('\n');

describe('session start observability docs parity', () => {
  it('records Task 4.64 in API, refactor, and manual docs', () => {
    const docs = allDocs();

    expect(readSource('API_CONTRACT.md')).toContain('Task 4.64 Session Start Observability & Recovery Notes V1');
    expect(readSource('FULL_STACK_REFACTOR_PLAN.md')).toContain('### Task 4.64: Session Start Observability & Recovery Notes V1');
    expect(readSource('docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md')).toContain('Task 4.64 Session Start Observability & Recovery Notes');
    expect(docs).toContain('safe observability and manual recovery guidance');
    expect(docs).toContain('Do not add a browser reset/recovery action.');
    expect(docs).toContain('Task 4.65 Session Start Regression Lock V1');
  });

  it('keeps four-route scope and source-of-truth aligned', () => {
    const docs = allDocs();

    expect(docs).toContain('POST /data-health/issues/:issueId/dismiss');
    expect(docs).toContain('POST /history/:id/data-flag');
    expect(docs).toContain('POST /history/:id/edit');
    expect(docs).toContain('POST /sessions/start');
    expect(docs).toContain('localStorage remains the active App source of truth');
    expect(docs).toContain('API results never overwrite AppData or localStorage');
    expect(docs).not.toMatch(/enable active patch now/i);
    expect(docs).not.toMatch(/enable active complete now/i);
    expect(docs).not.toMatch(/enable active discard now/i);
    expect(docs).not.toMatch(/replace localStorage now/i);
    expect(docs).not.toMatch(/use HTTP reset to recover/i);
  });

  it('does not imply production readiness or broader write-path migration', () => {
    const docs = [
      'docs/SESSION_START_OBSERVABILITY_RECOVERY_NOTES.md',
      'docs/SESSION_START_PROTOTYPE_HARDENING.md',
      'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
    ].map(readSource).join('\n');

    for (const pattern of [
      /production ready/i,
      /enable production backend/i,
      /make API source of truth now/i,
      /enable auth/i,
      /enable sync/i,
      /enable active patch now/i,
      /enable active complete now/i,
      /enable active discard now/i,
      /enable repair mutation now/i,
      /add a fifth mutation/i,
    ]) {
      expect(docs).not.toMatch(pattern);
    }
  });
});
