import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readSource, repoRoot } from './runtimeBoundaryTestHelpers';

const docPath = 'docs/API_BACKED_READ_RUNTIME_REGRESSION_LOCK.md';

describe('API-backed read runtime regression lock', () => {
  it('exists and contains required sections', () => {
    expect(existsSync(resolve(repoRoot(), docPath))).toBe(true);
    const doc = readSource(docPath);

    for (const section of [
      '## Scope / Non-goals',
      '## Locked GET-only Surface',
      '## Source Switch Lock',
      '## LocalStorage and AppData Lock',
      '## Node-only Browser Boundary',
      '## Failure Lock',
      '## Coverage Inventory',
      '## Manual Acceptance Inventory',
      '## Future Work Gate',
      '## Decision',
      '## Decision Record',
      '## Final Recommendation',
    ]) {
      expect(doc).toContain(section);
    }
  });

  it('locks GET-only routes, source-of-truth, and next task', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'GET /health',
      'GET /app-data/summary',
      'GET /sessions/summary',
      'GET /history',
      'GET /history/:id',
      'GET /data-health/summary',
      'No POST write is accepted',
      'localStorage remains source of truth',
      'API results never overwrite AppData or localStorage',
      'Task 5.12 Active Session Write Coverage Gap Audit V1',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('locks failure and browser-build boundaries', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'API unavailable is visible.',
      'timeout is visible.',
      'malformed response is rejected.',
      'no fake success',
      'node:http',
      'node:sqlite',
      'devLauncher',
      'httpRuntimeAdapter',
      'serverAdapter',
      'sqliteRepository',
      'devApiRunner',
      'devDbRecovery',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
