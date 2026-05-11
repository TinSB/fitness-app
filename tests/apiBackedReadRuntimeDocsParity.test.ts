import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const allDocs = () => [
  'docs/API_BACKED_READ_RUNTIME_PLAN.md',
  'docs/OFFLINE_PWA_CONFLICT_STRATEGY.md',
  'docs/RUNTIME_SOURCE_SWITCH_FEATURE_FLAG_PLAN.md',
  'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
  'API_CONTRACT.md',
  'FULL_STACK_REFACTOR_PLAN.md',
].map(readSource).join('\n');

describe('API-backed read runtime docs parity', () => {
  it('records Task 5.7 across docs and keeps Task 5.8 next', () => {
    expect(readSource('API_CONTRACT.md')).toContain('Task 5.7 API-backed Read Runtime Plan V1');
    expect(readSource('FULL_STACK_REFACTOR_PLAN.md')).toContain('### Task 5.7: API-backed Read Runtime Plan V1');
    expect(readSource('docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md')).toContain('Task 5.7 API-backed Read Runtime Plan');

    const docs = allDocs();
    expect(docs).toContain('docs/API_BACKED_READ_RUNTIME_PLAN.md');
    expect(docs).toContain('Task 5.8 API-backed Read Client Prototype V1');
  });

  it('keeps read runtime topics aligned', () => {
    const docs = allDocs();

    for (const expected of [
      'boot diagnostics',
      'GET /health',
      'GET /app-data/summary',
      'GET /sessions/summary',
      'GET /history',
      'GET /history/:id',
      'GET /data-health/summary',
      'localStorage fallback',
      'API unavailable',
      'snapshot metadata',
      'readMirror parity',
      'GET-only',
    ]) {
      expect(docs).toContain(expected);
    }
  });

  it('keeps source-of-truth and no-write boundaries aligned', () => {
    const docs = allDocs();

    for (const expected of [
      'localStorage remains source of truth',
      'API results never overwrite AppData',
      'No API-backed read runtime is implemented.',
      'No POST write is added.',
      'No runtime source switch is implemented.',
    ]) {
      expect(docs).toContain(expected);
    }

    expect(docs).not.toMatch(/switch source of truth now/i);
    expect(docs).not.toMatch(/replace localStorage now/i);
  });
});

