import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const docPath = 'docs/API_PRIMARY_RUNTIME_MANUAL_ACCEPTANCE.md';

const allDocs = () => [
  docPath,
  'docs/API_PRIMARY_RUNTIME_ACCEPTANCE.md',
  'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
  'API_CONTRACT.md',
  'FULL_STACK_REFACTOR_PLAN.md',
].map(readSource).join('\n');

describe('API primary runtime manual acceptance docs parity', () => {
  it('keeps accepted runtime mode and route inventory consistent', () => {
    const docs = allDocs();

    expect(docs).toContain('api-primary-dev');
    for (const route of [
      'POST /data-health/issues/:issueId/dismiss',
      'POST /history/:id/data-flag',
      'POST /history/:id/edit',
      'POST /sessions/start',
      'POST /sessions/active/patches',
      'POST /sessions/active/complete',
      'POST /sessions/active/discard',
    ]) {
      expect(docs).toContain(route);
    }
  });

  it('mentions required manual safety, fallback, and pass/fail topics', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'Dev API runner',
      'App dev server',
      'API unavailable',
      'localStorage remains available as fallback',
      'dedicated test browser profile',
      'dedicated dev DB',
      'Do not use real personal training data.',
      'Manual Pass / Fail Template',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('does not instruct production readiness, default source switch, or forbidden routes', () => {
    const docs = allDocs();

    for (const pattern of [
      /production ready/i,
      /enable production backend now/i,
      /enable auth now/i,
      /enable sync now/i,
      /enable cloud/i,
      /make API primary the default now/i,
      /delete localStorage now/i,
      /enable DataHealth repair/i,
      /enable backup\/import\/export over HTTP/i,
      /enable reset\/recovery over HTTP/i,
      /enable eighth browser mutation route/i,
    ]) {
      expect(docs).not.toMatch(pattern);
    }
  });

  it('records Task 5.29 and points to Task 5.30 next', () => {
    const docs = allDocs();
    expect(docs).toContain('Task 5.29');
    expect(docs).toContain('Task 5.30 API Primary Runtime Hardening V1');
  });
});
