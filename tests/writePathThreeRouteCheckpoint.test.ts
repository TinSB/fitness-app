import { describe, expect, it } from 'vitest';
import { DEV_API_DATA_HEALTH_DISMISS_ROUTE } from '../src/devApi/devApiDataHealthDismissClient';
import { DEV_API_HISTORY_DATA_FLAG_ROUTE } from '../src/devApi/devApiHistoryDataFlagClient';
import { DEV_API_HISTORY_SET_EDIT_ROUTE } from '../src/devApi/devApiHistorySetEditClient';
import { readSource } from './runtimeBoundaryTestHelpers';

const checkpointPath = 'docs/WRITE_PATH_THREE_ROUTE_CHECKPOINT.md';

describe('write-path three-route checkpoint doc', () => {
  it('exists and contains every required checkpoint section', () => {
    const doc = readSource(checkpointPath);

    for (const section of [
      '## Scope / Non-goals',
      '## Current Browser Mutation Allowlist',
      '## DataHealth Dismiss Status',
      '## History Data-flag Status',
      '## Limited History Edit Status',
      '## Shared Mutation Safety Rules',
      '## Route Boundary Matrix',
      '## Source-of-truth Checkpoint',
      '## Data Semantics Checkpoint',
      '## Manual Acceptance Inventory',
      '## Regression Test Inventory',
      '## Risk Register Before Any Fourth Mutation',
      '## Decision',
      '## Required Gates Before Fourth Mutation Audit',
      '## Decision Record',
      '## Final Recommendation',
    ]) {
      expect(doc).toContain(section);
    }
  });

  it('lists exactly the three accepted browser mutation routes and no fourth mutation approval', () => {
    const doc = readSource(checkpointPath);

    expect(DEV_API_DATA_HEALTH_DISMISS_ROUTE).toBe('/data-health/issues/:issueId/dismiss');
    expect(DEV_API_HISTORY_DATA_FLAG_ROUTE).toBe('/history/:id/data-flag');
    expect(DEV_API_HISTORY_SET_EDIT_ROUTE).toBe('/history/:id/edit');
    expect(doc).toContain('`POST /data-health/issues/:issueId/dismiss`');
    expect(doc).toContain('`POST /history/:id/data-flag`');
    expect(doc).toContain('`POST /history/:id/edit`');
    expect(doc).toContain('No other browser mutation route is accepted.');
    expect(doc).toContain('No fourth mutation is approved.');
    expect(doc).toContain('Do not implement a fourth mutation next.');
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
      'History data-flag is implemented',
      'Limited History Edit is implemented',
      'Observability and recovery notes exist',
      'Regression locked',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('includes route, data semantics, manual, regression, and risk inventories', () => {
    const doc = readSource(checkpointPath);

    for (const expected of [
      'Session start',
      'DataHealth repair',
      'Backup/import/export',
      'Reset/recovery',
      'Limited History Edit can affect recorded set values only through constrained one-set patch fields',
      '`actualWeightKg` remains the trusted calculation source',
      '`displayWeight` and `displayUnit` remain display-only unless paired with `weightKg`',
      'Read-only App manual acceptance',
      'DataHealth dismiss manual App acceptance',
      'History data-flag manual App acceptance',
      'Limited History Edit manual App acceptance',
      'Limited History Edit config, client, prototype, readiness gate, acceptance, manual acceptance, hardening, observability, regression lock, server parity, and semantics tests',
      'Route surface expansion risk',
      'Source-of-truth divergence risk',
      'Browser Node-only pollution risk',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('recommends Task 4.53 manual regression as the next task', () => {
    const doc = readSource(checkpointPath);

    expect(doc).toContain('Task 4.53 Write-path Three-route Manual Regression V1');
    expect(doc).toContain('manually verify all three in one local App and Dev API session');
    expect(doc).toContain('Task 4.52 result: checkpoint only.');
  });
});
