import { describe, expect, it } from 'vitest';
import { DEV_API_DATA_HEALTH_DISMISS_ROUTE } from '../src/devApi/devApiDataHealthDismissClient';
import { DEV_API_HISTORY_DATA_FLAG_ROUTE } from '../src/devApi/devApiHistoryDataFlagClient';
import { DEV_API_HISTORY_SET_EDIT_ROUTE } from '../src/devApi/devApiHistorySetEditClient';
import { DEV_API_SESSION_START_ROUTE } from '../src/devApi/devApiSessionStartClient';
import { readSource } from './runtimeBoundaryTestHelpers';

const lockPath = 'docs/WRITE_PATH_FOUR_ROUTE_REGRESSION_LOCK.md';

describe('write-path four-route regression lock doc', () => {
  it('exists and contains every required lock section', () => {
    const doc = readSource(lockPath);

    for (const section of [
      '## Scope / Non-goals',
      '## Current Accepted Browser Mutation Routes',
      '## Explicitly Blocked Routes',
      '## Four-route Regression State',
      '## Shared Four-route Regression Rules',
      '## Four-route Allowlist Matrix',
      '## Source-of-truth Regression Lock',
      '## Data Semantics Regression Lock',
      '## Test Coverage Inventory',
      '## Manual Acceptance Inventory',
      '## Future Work Gate',
      '## Decision',
      '## Decision Record',
      '## Final Recommendation',
    ]) {
      expect(doc).toContain(section);
    }
  });

  it('lists exactly the four accepted browser mutation routes and no fifth approval', () => {
    const doc = readSource(lockPath);

    expect(DEV_API_DATA_HEALTH_DISMISS_ROUTE).toBe('/data-health/issues/:issueId/dismiss');
    expect(DEV_API_HISTORY_DATA_FLAG_ROUTE).toBe('/history/:id/data-flag');
    expect(DEV_API_HISTORY_SET_EDIT_ROUTE).toBe('/history/:id/edit');
    expect(DEV_API_SESSION_START_ROUTE).toBe('/sessions/start');
    expect(doc).toContain('`POST /data-health/issues/:issueId/dismiss`');
    expect(doc).toContain('`POST /history/:id/data-flag`');
    expect(doc).toContain('`POST /history/:id/edit`');
    expect(doc).toContain('`POST /sessions/start`');
    expect(doc).toContain('No other browser mutation route is accepted.');
    expect(doc).toContain('No fifth mutation is approved.');
  });

  it('locks source-of-truth, data semantics, coverage, and next audit-only task', () => {
    const doc = readSource(lockPath);

    for (const expected of [
      'localStorage remains current source of truth',
      'API results do not overwrite localStorage',
      'API results do not overwrite AppData',
      'No API-backed persistence adapter exists',
      'No source-of-truth switch is approved',
      'Session Start does not mutate local activeSession',
      'PR, e1RM, effectiveSet, and weighted effectiveSet rules are unchanged',
      'Four-route checkpoint and manual regression',
      'Four-route manual regression: `docs/WRITE_PATH_FOUR_ROUTE_MANUAL_REGRESSION.md`',
      'Task 4.69 Phase 4 Source-of-truth Migration Readiness Audit V1',
      'Task 4.69 must be audit-only',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
