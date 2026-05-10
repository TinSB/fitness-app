import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEV_API_DATA_HEALTH_DISMISS_ROUTE } from '../src/devApi/devApiDataHealthDismissClient';
import { DEV_API_HISTORY_DATA_FLAG_ROUTE } from '../src/devApi/devApiHistoryDataFlagClient';
import { readSource, repoRoot } from './runtimeBoundaryTestHelpers';

const exists = (path: string) => existsSync(resolve(repoRoot(), path));

describe('write-path two-route manual regression matrix', () => {
  it('keeps required manual and checkpoint docs present', () => {
    for (const path of [
      'docs/DATAHEALTH_DISMISS_MANUAL_APP_ACCEPTANCE.md',
      'docs/HISTORY_DATA_FLAG_MANUAL_APP_ACCEPTANCE.md',
      'docs/WRITE_PATH_TWO_ROUTE_CHECKPOINT.md',
      'docs/WRITE_PATH_TWO_ROUTE_MANUAL_REGRESSION.md',
    ]) {
      expect(exists(path), `${path} should exist`).toBe(true);
    }
  });

  it('lists both accepted routes consistently across current docs', () => {
    expect(DEV_API_DATA_HEALTH_DISMISS_ROUTE).toBe('/data-health/issues/:issueId/dismiss');
    expect(DEV_API_HISTORY_DATA_FLAG_ROUTE).toBe('/history/:id/data-flag');

    for (const path of [
      'docs/WRITE_PATH_TWO_ROUTE_CHECKPOINT.md',
      'docs/WRITE_PATH_TWO_ROUTE_MANUAL_REGRESSION.md',
      'docs/DATAHEALTH_DISMISS_MANUAL_APP_ACCEPTANCE.md',
      'docs/HISTORY_DATA_FLAG_MANUAL_APP_ACCEPTANCE.md',
      'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
      'API_CONTRACT.md',
      'FULL_STACK_REFACTOR_PLAN.md',
    ]) {
      const doc = readSource(path);
      expect(doc, path).toContain(`POST ${DEV_API_DATA_HEALTH_DISMISS_ROUTE}`);
      expect(doc, path).toContain(`POST ${DEV_API_HISTORY_DATA_FLAG_ROUTE}`);
    }
  });

  it('keeps the current accepted mutation allowlist at exactly two entries', () => {
    const runbook = readSource('docs/WRITE_PATH_TWO_ROUTE_MANUAL_REGRESSION.md');
    const checkpoint = readSource('docs/WRITE_PATH_TWO_ROUTE_CHECKPOINT.md');

    expect(runbook).toContain('Browser mutation routes remain exactly');
    expect(checkpoint).toContain('Accepted browser mutation routes are exactly');
    expect(runbook).toContain('No flag combination enables a third mutation route.');
    expect(checkpoint).toContain('No other browser mutation route is accepted.');
  });

  it('keeps read-only diagnostics docs GET-only and write-path migration blocked', () => {
    const readOnlyDoc = readSource('docs/READONLY_APP_MANUAL_ACCEPTANCE.md');
    const runbook = readSource('docs/WRITE_PATH_TWO_ROUTE_MANUAL_REGRESSION.md');
    const checkpoint = readSource('docs/WRITE_PATH_TWO_ROUTE_CHECKPOINT.md');

    for (const route of [
      'GET /health',
      'GET /app-data/summary',
      'GET /sessions/summary',
      'GET /history',
      'GET /data-health/summary',
    ]) {
      expect(runbook).toContain(route);
    }

    expect(readOnlyDoc).toMatch(/GET-only|read-only/i);
    expect(checkpoint).toContain('Write-path migration remains blocked.');
    expect(runbook).toContain('This is not source-of-truth migration.');
  });
});
