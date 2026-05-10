import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const allDocs = () => [
  'API_CONTRACT.md',
  'FULL_STACK_REFACTOR_PLAN.md',
  'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
  'docs/DATAHEALTH_DISMISS_MANUAL_APP_ACCEPTANCE.md',
  'docs/DATAHEALTH_DISMISS_PROTOTYPE_ACCEPTANCE.md',
].map(readSource).join('\n');

describe('DataHealth dismiss observability docs parity', () => {
  it('records Task 4.32 in API, refactor, and manual docs', () => {
    const docs = allDocs();

    expect(readSource('API_CONTRACT.md')).toContain('Task 4.32 adds DataHealth Dismiss Prototype Observability & Recovery Notes V1');
    expect(readSource('FULL_STACK_REFACTOR_PLAN.md')).toContain('### Task 4.32: DataHealth Dismiss Prototype Observability & Recovery Notes V1');
    expect(readSource('docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md')).toContain('Task 4.32 adds safe observability and manual recovery notes');
    expect(docs).toContain('dev-only diagnostics');
    expect(docs).toContain('manual recovery guidance');
    expect(docs).toContain('no HTTP reset endpoint');
    expect(docs).toContain('no browser reset/recovery action');
  });

  it('keeps one-route scope, source-of-truth, and next task aligned', () => {
    const docs = allDocs();

    expect(docs).toContain('POST /data-health/issues/:issueId/dismiss');
    expect(docs).toContain('localStorage remains the App source of truth');
    expect(docs).toContain('API results never overwrite AppData or localStorage');
    expect(docs).toContain('Task 4.33 DataHealth Dismiss Regression Lock V1');
    expect(docs).not.toMatch(/enable session mutation now/i);
    expect(docs).not.toMatch(/enable history mutation now/i);
    expect(docs).not.toMatch(/enable repair mutation now/i);
    expect(docs).not.toMatch(/replace localStorage now/i);
    expect(docs).not.toMatch(/use HTTP reset to recover/i);
  });

  it('does not imply production readiness or broader write-path migration', () => {
    const docs = allDocs();

    for (const pattern of [
      /production ready/i,
      /enable production backend/i,
      /make API source of truth now/i,
      /enable auth/i,
      /enable sync/i,
      /add session mutation/i,
      /add history mutation/i,
      /add repair mutation/i,
      /add a new HTTP endpoint now/i,
    ]) {
      expect(docs).not.toMatch(pattern);
    }
  });
});
