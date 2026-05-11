import { describe, expect, it } from 'vitest';
import { DEV_API_DATA_HEALTH_DISMISS_ROUTE } from '../src/devApi/devApiDataHealthDismissClient';
import { DEV_API_HISTORY_DATA_FLAG_ROUTE } from '../src/devApi/devApiHistoryDataFlagClient';
import { DEV_API_HISTORY_SET_EDIT_ROUTE } from '../src/devApi/devApiHistorySetEditClient';
import { DEV_API_SESSION_START_ROUTE } from '../src/devApi/devApiSessionStartClient';
import { readSource } from './runtimeBoundaryTestHelpers';

const lockPath = 'docs/SESSION_START_REGRESSION_LOCK.md';

describe('session start regression lock doc', () => {
  it('exists and contains every required section', () => {
    const doc = readSource(lockPath);

    for (const section of [
      '## Scope / Non-goals',
      '## Current Accepted Browser Mutation Routes',
      '## Explicitly Blocked Routes',
      '## Session Start Regression State',
      '## Four Prototype Regression Rules',
      '## Session Start Request Lock',
      '## Four-route Allowlist Matrix',
      '## Source-of-truth Regression Lock',
      '## Active Session Safety Lock',
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
    expect(doc).toContain('Do not implement a fifth mutation next.');
  });

  it('locks source-of-truth, prototype state, and shared regression rules', () => {
    const doc = readSource(lockPath);

    for (const expected of [
      'Session Start is locked as the fourth dev-only browser mutation prototype',
      'Source snapshot and idempotency planned.',
      'Manually accepted.',
      'Observability/recovery documented.',
      'Regression locked.',
      'localStorage remains current source of truth',
      'API results do not overwrite localStorage',
      'API results do not overwrite AppData',
      'Route-specific mutation experiment flag',
      'Snapshot metadata required for success',
      'Duplicate submit blocked',
      'Confirmation required where the prototype mutates data',
      'No raw stack, raw response, AppData dump, or localStorage dump',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('locks active session safety, data semantics, and next checkpoint', () => {
    const doc = readSource(lockPath);

    for (const expected of [
      'Requires source snapshot metadata.',
      'Requires mutation id and idempotency key.',
      'Requires request fingerprint.',
      'Does not start active patch, complete, or discard.',
      'The browser prototype must not mutate local activeSession.',
      'Active patches remain blocked.',
      'Active complete remains blocked.',
      'Active discard remains blocked.',
      'Session Start does not change training algorithms',
      'Backup import/export safety is unchanged',
      'Task 4.66 Write-path Four-route Checkpoint V1',
      'Task 4.66 must be checkpoint/audit documentation and static/regression coverage only.',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
