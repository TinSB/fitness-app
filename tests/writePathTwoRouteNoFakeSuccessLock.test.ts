import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readSource, repoRoot } from './runtimeBoundaryTestHelpers';

const exists = (path: string) => existsSync(resolve(repoRoot(), path));

describe('write-path two-route no-fake-success lock', () => {
  it('keeps DataHealth dismiss strict success and no-fake-success coverage present', () => {
    for (const path of [
      'tests/devApiDataHealthDismissHardeningNoFakeSuccess.test.ts',
      'tests/devApiDataHealthDismissHardeningFailureStates.test.ts',
      'tests/devApiDataHealthDismissHardeningConcurrency.test.ts',
      'tests/devApiDataHealthDismissAcceptanceFailures.test.ts',
      'tests/dataHealthDismissRegressionSuccessContract.test.ts',
      'tests/dataHealthDismissRegressionFailureMapping.test.ts',
    ]) {
      expect(exists(path), `${path} should exist`).toBe(true);
    }

    const combined = [
      readSource('tests/devApiDataHealthDismissHardeningNoFakeSuccess.test.ts'),
      readSource('tests/devApiDataHealthDismissHardeningFailureStates.test.ts'),
      readSource('tests/dataHealthDismissRegressionSuccessContract.test.ts'),
      readSource('tests/devApiDataHealthDismissHardeningConcurrency.test.ts'),
    ].join('\n');

    for (const expected of ['snapshot', 'changed', 'status', 'success', 'no_change', 'issue_not_found', 'database_closed', 'lock']) {
      expect(combined).toMatch(new RegExp(expected, 'i'));
    }
  });

  it('keeps History data-flag strict success and no-fake-success coverage present', () => {
    for (const path of [
      'tests/devApiHistoryDataFlagHardeningNoFakeSuccess.test.ts',
      'tests/devApiHistoryDataFlagHardeningFailureStates.test.ts',
      'tests/devApiHistoryDataFlagHardeningConcurrencyRuntime.test.ts',
      'tests/devApiHistoryDataFlagAcceptanceNoFakeSuccess.test.ts',
      'tests/devApiHistoryDataFlagAcceptanceFailureStates.test.ts',
      'tests/devApiHistoryDataFlagHardeningBoundary.test.ts',
    ]) {
      expect(exists(path), `${path} should exist`).toBe(true);
    }

    const combined = [
      readSource('tests/devApiHistoryDataFlagHardeningNoFakeSuccess.test.ts'),
      readSource('tests/devApiHistoryDataFlagHardeningFailureStates.test.ts'),
      readSource('tests/devApiHistoryDataFlagAcceptanceNoFakeSuccess.test.ts'),
      readSource('tests/devApiHistoryDataFlagHardeningConcurrency.test.tsx'),
    ].join('\n');

    for (const expected of ['snapshot', 'changed', 'status', 'success', 'no_change', 'record_not_found', 'database_closed', 'duplicate']) {
      expect(combined).toMatch(new RegExp(expected, 'i'));
    }
  });

  it('locks docs to snapshot metadata and failure-state no-fake-success for both routes', () => {
    const docs = [
      'docs/WRITE_PATH_TWO_ROUTE_REGRESSION_LOCK.md',
      'docs/WRITE_PATH_TWO_ROUTE_CHECKPOINT.md',
      'docs/WRITE_PATH_TWO_ROUTE_MANUAL_REGRESSION.md',
      'API_CONTRACT.md',
      'FULL_STACK_REFACTOR_PLAN.md',
    ].map(readSource).join('\n');

    for (const expected of [
      'No fake success',
      'Snapshot metadata required for success',
      'Duplicate submit',
      'No automatic retry',
      'No localStorage write',
      'No AppData overwrite',
      'POST /data-health/issues/:issueId/dismiss',
      'POST /history/:id/data-flag',
    ]) {
      expect(docs).toContain(expected);
    }
  });
});
