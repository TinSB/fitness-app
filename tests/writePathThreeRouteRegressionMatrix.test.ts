import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEV_API_DATA_HEALTH_DISMISS_ROUTE } from '../src/devApi/devApiDataHealthDismissClient';
import { DEV_API_HISTORY_DATA_FLAG_ROUTE } from '../src/devApi/devApiHistoryDataFlagClient';
import { DEV_API_HISTORY_SET_EDIT_ROUTE } from '../src/devApi/devApiHistorySetEditClient';
import { readSource, repoRoot } from './runtimeBoundaryTestHelpers';

const exists = (path: string) => existsSync(resolve(repoRoot(), path));

describe('write-path three-route regression matrix', () => {
  it('keeps required three-route checkpoint, manual regression, and regression lock docs present', () => {
    for (const path of [
      'docs/WRITE_PATH_THREE_ROUTE_CHECKPOINT.md',
      'docs/WRITE_PATH_THREE_ROUTE_MANUAL_REGRESSION.md',
      'docs/WRITE_PATH_THREE_ROUTE_REGRESSION_LOCK.md',
      'docs/DATAHEALTH_DISMISS_MANUAL_APP_ACCEPTANCE.md',
      'docs/HISTORY_DATA_FLAG_MANUAL_APP_ACCEPTANCE.md',
      'docs/LIMITED_HISTORY_EDIT_MANUAL_APP_ACCEPTANCE.md',
    ]) {
      expect(exists(path), `${path} should exist`).toBe(true);
    }
  });

  it('keeps the three accepted routes consistent across current docs', () => {
    for (const path of [
      'docs/WRITE_PATH_THREE_ROUTE_CHECKPOINT.md',
      'docs/WRITE_PATH_THREE_ROUTE_MANUAL_REGRESSION.md',
      'docs/WRITE_PATH_THREE_ROUTE_REGRESSION_LOCK.md',
      'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
      'API_CONTRACT.md',
      'FULL_STACK_REFACTOR_PLAN.md',
    ]) {
      const doc = readSource(path);
      expect(doc, path).toContain(`POST ${DEV_API_DATA_HEALTH_DISMISS_ROUTE}`);
      expect(doc, path).toContain(`POST ${DEV_API_HISTORY_DATA_FLAG_ROUTE}`);
      expect(doc, path).toContain(`POST ${DEV_API_HISTORY_SET_EDIT_ROUTE}`);
    }
  });

  it('keeps fourth mutation and source-of-truth migration blocked', () => {
    const docs = [
      'docs/WRITE_PATH_THREE_ROUTE_CHECKPOINT.md',
      'docs/WRITE_PATH_THREE_ROUTE_MANUAL_REGRESSION.md',
      'docs/WRITE_PATH_THREE_ROUTE_REGRESSION_LOCK.md',
    ].map(readSource).join('\n');

    expect(docs).toContain('No fourth mutation is approved.');
    expect(docs).toContain('Do not implement a fourth mutation next.');
    expect(docs).toContain('localStorage remains source of truth');
    expect(docs).toContain('API results never overwrite AppData or localStorage');
    expect(docs).not.toMatch(/enable fourth mutation now/i);
    expect(docs).not.toMatch(/replace localStorage now/i);
    expect(docs).not.toMatch(/make API source of truth now/i);
  });
});
