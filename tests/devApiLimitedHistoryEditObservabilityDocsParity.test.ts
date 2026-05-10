import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const allDocs = () => [
  'API_CONTRACT.md',
  'FULL_STACK_REFACTOR_PLAN.md',
  'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
  'docs/LIMITED_HISTORY_EDIT_OBSERVABILITY_RECOVERY_NOTES.md',
  'docs/LIMITED_HISTORY_EDIT_PROTOTYPE_HARDENING.md',
  'docs/LIMITED_HISTORY_EDIT_PROTOTYPE_ACCEPTANCE.md',
].map(readSource).join('\n');

describe('limited history edit observability docs parity', () => {
  it('records Task 4.50 in API, refactor, and manual docs', () => {
    const docs = allDocs();

    expect(readSource('API_CONTRACT.md')).toContain('Task 4.50 Limited History Edit Observability & Recovery Notes V1');
    expect(readSource('FULL_STACK_REFACTOR_PLAN.md')).toContain('### Task 4.50: Limited History Edit Observability & Recovery Notes V1');
    expect(readSource('docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md')).toContain('Task 4.50 Limited History Edit Observability & Recovery Notes');
    expect(docs).toContain('safe observability and manual recovery guidance');
    expect(docs).toContain('Do not add a browser reset/recovery action.');
    expect(docs).toContain('Task 4.51 Limited History Edit Regression Lock V1');
  });

  it('keeps three-route scope and source-of-truth aligned', () => {
    const docs = allDocs();

    expect(docs).toContain('POST /data-health/issues/:issueId/dismiss');
    expect(docs).toContain('POST /history/:id/data-flag');
    expect(docs).toContain('POST /history/:id/edit');
    expect(docs).toContain('localStorage remains the active App source of truth');
    expect(docs).toContain('API results never overwrite AppData or localStorage');
    expect(docs).not.toMatch(/enable session mutation now/i);
    expect(docs).not.toMatch(/enable DataHealth repair now/i);
    expect(docs).not.toMatch(/replace localStorage now/i);
    expect(docs).not.toMatch(/use HTTP reset to recover/i);
  });

  it('does not imply production readiness or broader write-path migration', () => {
    const docs = [
      'docs/LIMITED_HISTORY_EDIT_OBSERVABILITY_RECOVERY_NOTES.md',
      'docs/LIMITED_HISTORY_EDIT_PROTOTYPE_HARDENING.md',
      'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
    ].map(readSource).join('\n');

    for (const pattern of [
      /production ready/i,
      /enable production backend/i,
      /make API source of truth now/i,
      /enable auth/i,
      /enable sync/i,
      /enable session mutation now/i,
      /enable repair mutation now/i,
      /add a new HTTP endpoint now/i,
      /add a fourth mutation/i,
    ]) {
      expect(docs).not.toMatch(pattern);
    }
  });
});
