import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const allDocs = () => [
  'docs/API_BACKED_READ_RUNTIME_PLAN.md',
  'docs/API_BACKED_READ_RUNTIME_ACCEPTANCE.md',
  'docs/API_BACKED_READ_MANUAL_APP_ACCEPTANCE.md',
  'docs/API_BACKED_READ_RUNTIME_REGRESSION_LOCK.md',
  'docs/OFFLINE_PWA_CONFLICT_STRATEGY.md',
  'docs/RUNTIME_SOURCE_SWITCH_FEATURE_FLAG_PLAN.md',
  'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
  'API_CONTRACT.md',
  'FULL_STACK_REFACTOR_PLAN.md',
].map(readSource).join('\n');

describe('API-backed read runtime docs parity', () => {
  it('records the API-backed read runtime chain across docs and keeps Task 5.12 next', () => {
    expect(readSource('API_CONTRACT.md')).toContain('Task 5.7 API-backed Read Runtime Plan V1');
    expect(readSource('API_CONTRACT.md')).toContain('Task 5.8: API-backed Read Client Prototype V1');
    expect(readSource('API_CONTRACT.md')).toContain('Task 5.9: API-backed Read Runtime Acceptance V1');
    expect(readSource('API_CONTRACT.md')).toContain('Task 5.10: API-backed Read Manual App Acceptance V1');
    expect(readSource('FULL_STACK_REFACTOR_PLAN.md')).toContain('### Task 5.7: API-backed Read Runtime Plan V1');
    expect(readSource('docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md')).toContain('Task 5.7 API-backed Read Runtime Plan');

    const docs = allDocs();
    expect(docs).toContain('docs/API_BACKED_READ_RUNTIME_PLAN.md');
    expect(docs).toContain('docs/API_BACKED_READ_RUNTIME_ACCEPTANCE.md');
    expect(docs).toContain('docs/API_BACKED_READ_MANUAL_APP_ACCEPTANCE.md');
    expect(docs).toContain('Task 5.11');
    expect(docs).toContain('Task 5.12 Active Session Write Coverage Gap Audit V1');
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
      'manual App acceptance',
      'regression lock',
    ]) {
      expect(docs).toContain(expected);
    }
  });

  it('keeps source-of-truth and no-write boundaries aligned', () => {
    const docs = allDocs();

    for (const expected of [
      'localStorage remains source of truth',
      'API results never overwrite AppData',
      'No POST write is added.',
      'no runtime source selector',
      'GET-only',
    ]) {
      expect(docs).toContain(expected);
    }

    expect(docs).not.toMatch(/switch source of truth now/i);
    expect(docs).not.toMatch(/replace localStorage now/i);
  });
});

