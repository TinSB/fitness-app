import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const docs = [
  'docs/WRITE_PATH_TWO_ROUTE_REGRESSION_LOCK.md',
  'docs/WRITE_PATH_TWO_ROUTE_CHECKPOINT.md',
  'docs/WRITE_PATH_TWO_ROUTE_MANUAL_REGRESSION.md',
  'docs/DATAHEALTH_DISMISS_PROTOTYPE_ACCEPTANCE.md',
  'docs/DATAHEALTH_DISMISS_MANUAL_APP_ACCEPTANCE.md',
  'docs/HISTORY_DATA_FLAG_PROTOTYPE_ACCEPTANCE.md',
  'docs/HISTORY_DATA_FLAG_MANUAL_APP_ACCEPTANCE.md',
  'docs/HISTORY_DATA_FLAG_MUTATION_PROTOTYPE_PLAN.md',
  'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
  'API_CONTRACT.md',
  'FULL_STACK_REFACTOR_PLAN.md',
];

describe('write-path two-route docs lock', () => {
  it('records Task 4.42 in contract, refactor, and lock docs', () => {
    for (const path of [
      'docs/WRITE_PATH_TWO_ROUTE_REGRESSION_LOCK.md',
      'API_CONTRACT.md',
      'FULL_STACK_REFACTOR_PLAN.md',
      'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
    ]) {
      const doc = readSource(path);
      expect(doc, path).toContain('Task 4.42');
      expect(doc, path).toContain('POST /data-health/issues/:issueId/dismiss');
      expect(doc, path).toContain('POST /history/:id/data-flag');
    }
  });

  it('keeps DataHealth and History docs scoped to their own one-route flows', () => {
    const dataHealthDocs = [
      readSource('docs/DATAHEALTH_DISMISS_PROTOTYPE_ACCEPTANCE.md'),
      readSource('docs/DATAHEALTH_DISMISS_MANUAL_APP_ACCEPTANCE.md'),
    ].join('\n');
    const historyDocs = [
      readSource('docs/HISTORY_DATA_FLAG_PROTOTYPE_ACCEPTANCE.md'),
      readSource('docs/HISTORY_DATA_FLAG_MANUAL_APP_ACCEPTANCE.md'),
      readSource('docs/HISTORY_DATA_FLAG_MUTATION_PROTOTYPE_PLAN.md'),
    ].join('\n');

    expect(dataHealthDocs).toMatch(/DataHealth dismiss prototype remains one-route-only|DataHealth dismiss flow/i);
    expect(historyDocs).toMatch(/History data-flag prototype remains one-route-only|History data-flag flow/i);
    expect(dataHealthDocs).toContain('POST /data-health/issues/:issueId/dismiss');
    expect(historyDocs).toContain('POST /history/:id/data-flag');
  });

  it('keeps manual acceptance docs aligned to the exact two-route allowlist', () => {
    for (const path of [
      'docs/DATAHEALTH_DISMISS_MANUAL_APP_ACCEPTANCE.md',
      'docs/HISTORY_DATA_FLAG_MANUAL_APP_ACCEPTANCE.md',
      'docs/WRITE_PATH_TWO_ROUTE_MANUAL_REGRESSION.md',
      'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
    ]) {
      const doc = readSource(path);
      expect(doc, path).toContain('POST /data-health/issues/:issueId/dismiss');
      expect(doc, path).toContain('POST /history/:id/data-flag');
      expect(doc, path).toMatch(/localStorage remains (the active App )?source of truth/i);
    }
  });

  it('does not instruct forbidden write-path expansion or production readiness', () => {
    const combined = docs.map(readSource).join('\n');

    for (const pattern of [
      /enable session mutation/i,
      /enable history edit/i,
      /enable DataHealth repair/i,
      /enable backup\/import/i,
      /enable reset/i,
      /replace localStorage now/i,
      /make API source of truth/i,
      /deploy production backend/i,
      /enable auth/i,
      /enable sync/i,
      /Task 4\.42[^.\n]*(production ready|production-ready)/i,
    ]) {
      expect(combined).not.toMatch(pattern);
    }
  });
});
