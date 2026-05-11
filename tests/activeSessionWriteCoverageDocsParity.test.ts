import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const allDocs = () => [
  'docs/ACTIVE_SESSION_WRITE_COVERAGE_GAP_AUDIT.md',
  'docs/API_BACKED_READ_RUNTIME_REGRESSION_LOCK.md',
  'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
  'API_CONTRACT.md',
  'FULL_STACK_REFACTOR_PLAN.md',
].map(readSource).join('\n');

describe('active session write coverage docs parity', () => {
  it('records Task 5.12 and points to Task 5.13 planning', () => {
    const docs = allDocs();

    expect(readSource('API_CONTRACT.md')).toContain('Task 5.12');
    expect(readSource('FULL_STACK_REFACTOR_PLAN.md')).toContain('Task 5.12');
    expect(docs).toContain('Task 5.13 Session Patch Mutation Prototype Plan V1');
  });

  it('keeps the gap routes and accepted routes aligned', () => {
    const docs = allDocs();

    for (const expected of [
      'POST /sessions/active/patches',
      'POST /sessions/active/complete',
      'POST /sessions/active/discard',
      'POST /data-health/issues/:issueId/dismiss',
      'POST /history/:id/data-flag',
      'POST /history/:id/edit',
      'POST /sessions/start',
    ]) {
      expect(docs).toContain(expected);
    }
  });

  it('does not instruct implementation or source-of-truth migration now', () => {
    const docs = allDocs();

    for (const pattern of [
      /implement `?POST \/sessions\/active\/patches`? now/i,
      /implement `?POST \/sessions\/active\/complete`? now/i,
      /implement `?POST \/sessions\/active\/discard`? now/i,
      /enable session patch now/i,
      /enable session complete now/i,
      /enable session discard now/i,
      /switch source of truth now/i,
      /replace localStorage now/i,
      /enable production backend now/i,
      /enable auth now/i,
      /enable sync now/i,
    ]) {
      expect(docs).not.toMatch(pattern);
    }
  });
});
