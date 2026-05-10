import { describe, expect, it } from 'vitest';
import { DEV_API_DATA_HEALTH_DISMISS_ROUTE } from '../src/devApi/devApiDataHealthDismissClient';
import { DEV_API_HISTORY_DATA_FLAG_ROUTE } from '../src/devApi/devApiHistoryDataFlagClient';
import { readSource } from './runtimeBoundaryTestHelpers';

const checkpointPath = 'docs/WRITE_PATH_TWO_ROUTE_CHECKPOINT.md';

describe('write-path two-route checkpoint doc', () => {
  it('exists and contains every required checkpoint section', () => {
    const doc = readSource(checkpointPath);

    for (const section of [
      '## Scope / Non-goals',
      '## Current Browser Mutation Allowlist',
      '## DataHealth Dismiss Status',
      '## History Data-flag Status',
      '## Shared Mutation Safety Rules',
      '## Route Boundary Matrix',
      '## Source-of-truth Checkpoint',
      '## Data Semantics Checkpoint',
      '## Manual Acceptance Inventory',
      '## Regression Test Inventory',
      '## Risk Register Before Any Third Mutation',
      '## Decision',
      '## Required Gates Before Third Mutation Audit',
      '## Decision Record',
      '## Final Recommendation',
    ]) {
      expect(doc).toContain(section);
    }
  });

  it('lists exactly the two accepted browser mutation routes and no third mutation approval', () => {
    const doc = readSource(checkpointPath);

    expect(DEV_API_DATA_HEALTH_DISMISS_ROUTE).toBe('/data-health/issues/:issueId/dismiss');
    expect(DEV_API_HISTORY_DATA_FLAG_ROUTE).toBe('/history/:id/data-flag');
    expect(doc).toContain('`POST /data-health/issues/:issueId/dismiss`');
    expect(doc).toContain('`POST /history/:id/data-flag`');
    expect(doc).toContain('No other browser mutation route is accepted.');
    expect(doc).toContain('No third mutation is approved.');
    expect(doc).toContain('Do not implement a third mutation next.');
  });

  it('locks source-of-truth and prototype status content', () => {
    const doc = readSource(checkpointPath);

    for (const expected of [
      'localStorage remains current source of truth',
      'API results do not overwrite localStorage',
      'API results do not overwrite AppData',
      'No API-backed persistence adapter exists',
      'No dual-write strategy is active',
      'No offline mutation queue exists',
      'No source-of-truth switch is approved',
      'DataHealth dismiss is implemented',
      'Observability and recovery notes exist',
      'Regression locked',
      'History data-flag is implemented',
      '`normal`, `test`, and `excluded` semantics are locked',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('includes route, data semantics, manual, regression, and risk inventories', () => {
    const doc = readSource(checkpointPath);

    for (const expected of [
      'Session start',
      'History edit',
      'DataHealth repair',
      'Backup/import/export',
      'Reset/recovery',
      'DataHealth dismiss does not change training set logs',
      'History data-flag can affect default statistics',
      '`test` and `excluded` remain visible but excluded from default stats',
      '`actualWeightKg` remains the trusted calculation source',
      '`identityInvalid` semantics remain unchanged',
      'Read-only App manual acceptance',
      'DataHealth dismiss manual App acceptance',
      'History data-flag manual App acceptance',
      'Dev API runner manual acceptance',
      'Recovery/reset runbook',
      'DataHealth dismiss config, client, prototype, acceptance, manual acceptance, hardening, observability, recovery, and regression lock tests',
      'History data-flag config, client, prototype, acceptance, manual acceptance, hardening, server parity, and semantics tests',
      'Route surface expansion risk',
      'Source-of-truth divergence risk',
      'Browser Node-only pollution risk',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('recommends Task 4.41 manual regression as the next task', () => {
    const doc = readSource(checkpointPath);

    expect(doc).toContain('Task 4.41 Write-path Two-route Manual Regression V1');
    expect(doc).toContain('before evaluating a third mutation, both existing mutation prototypes should be manually verified together');
    expect(doc).toContain('Task 4.40 result: checkpoint only.');
  });
});
