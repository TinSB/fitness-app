import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const docPath = 'docs/API_BACKED_READ_MANUAL_APP_ACCEPTANCE.md';

const allDocs = () => [
  docPath,
  'docs/API_BACKED_READ_RUNTIME_ACCEPTANCE.md',
  'docs/API_BACKED_READ_RUNTIME_PLAN.md',
  'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
  'API_CONTRACT.md',
  'FULL_STACK_REFACTOR_PLAN.md',
].map(readSource).join('\n');

describe('API-backed read manual App acceptance docs parity', () => {
  it('keeps allowed GET routes consistent across manual and acceptance docs', () => {
    const docs = allDocs();

    for (const expected of [
      'GET /health',
      'GET /app-data/summary',
      'GET /sessions/summary',
      'GET /history',
      'GET /history/:id',
      'GET /data-health/summary',
    ]) {
      expect(docs).toContain(expected);
    }
  });

  it('mentions required manual safety and fallback topics', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'Dev API runner',
      'App dev server',
      'Network panel shows GET-only traffic',
      'API unavailable',
      'App remains usable from localStorage',
      'dedicated test browser profile',
      'dedicated dev DB',
      'Do not use real personal training data.',
      'localStorage remains source of truth',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('does not instruct production readiness, source migration, or forbidden writes', () => {
    const docs = allDocs();

    for (const pattern of [
      /production ready/i,
      /enable production backend now/i,
      /enable auth now/i,
      /enable sync now/i,
      /enable cloud/i,
      /switch source of truth now/i,
      /make API source of truth now/i,
      /replace localStorage now/i,
      /enable POST writes now/i,
      /enable session patch now/i,
      /enable session complete now/i,
      /enable session discard now/i,
      /enable DataHealth repair/i,
      /enable backup\/import\/export over HTTP/i,
      /enable reset\/recovery over HTTP/i,
    ]) {
      expect(docs).not.toMatch(pattern);
    }
  });

  it('records Task 5.10 and points to Task 5.11 next', () => {
    const docs = allDocs();
    expect(docs).toContain('Task 5.10');
    expect(docs).toContain('Task 5.11 API-backed Read Runtime Regression Lock V1');
  });
});
