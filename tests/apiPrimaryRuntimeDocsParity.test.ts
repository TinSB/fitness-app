import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const lockDoc = 'docs/API_PRIMARY_RUNTIME_REGRESSION_LOCK.md';

const docs = () => [
  lockDoc,
  'docs/API_PRIMARY_RUNTIME_ACCEPTANCE.md',
  'docs/API_PRIMARY_RUNTIME_MANUAL_ACCEPTANCE.md',
  'docs/API_PRIMARY_RUNTIME_HARDENING.md',
  'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
  'API_CONTRACT.md',
  'FULL_STACK_REFACTOR_PLAN.md',
].map(readSource).join('\n');

describe('API primary runtime docs parity', () => {
  it('documents required regression lock sections', () => {
    const doc = readSource(lockDoc);

    for (const section of [
      '# API Primary Runtime Regression Lock',
      '## Scope / Non-goals',
      '## Locked Runtime Modes',
      '## Source Selector Lock',
      '## Boot Lock',
      '## Read Lock',
      '## Write Lock',
      '## Accepted Browser Mutation Routes',
      '## Blocked Routes And Capabilities',
      '## LocalStorage Fallback Lock',
      '## Browser Build Isolation',
      '## Coverage Inventory',
      '## Manual Inventory',
      '## Future Work Gate',
      '## Decision',
      '## Final Recommendation',
    ]) {
      expect(doc).toContain(section);
    }
  });

  it('keeps docs aligned on runtime modes, routes, and source-of-truth', () => {
    const all = docs();

    for (const expected of [
      'localStorage',
      'api-readonly',
      'api-primary-dev',
      'POST /data-health/issues/:issueId/dismiss',
      'POST /history/:id/data-flag',
      'POST /history/:id/edit',
      'POST /sessions/start',
      'POST /sessions/active/patches',
      'POST /sessions/active/complete',
      'POST /sessions/active/discard',
      'localStorage remains',
      'Task 5.32 LocalStorage to SQLite Migration Dry-run V1',
    ]) {
      expect(all).toContain(expected);
    }
  });

  it('does not instruct production readiness, localStorage deletion, or blocked route enablement', () => {
    const all = docs();

    for (const pattern of [
      /production ready/i,
      /enable production backend now/i,
      /enable auth now/i,
      /enable sync now/i,
      /enable cloud/i,
      /delete localStorage now/i,
      /replace localStorage now/i,
      /enable DataHealth repair/i,
      /enable backup\/import\/export over HTTP/i,
      /enable reset\/recovery over HTTP/i,
      /enable eighth browser mutation route/i,
    ]) {
      expect(all).not.toMatch(pattern);
    }
  });
});
