import { describe, expect, it } from 'vitest';
import { DEV_API_DATA_HEALTH_DISMISS_ROUTE } from '../src/devApi/devApiDataHealthDismissClient';
import { DEV_API_HISTORY_DATA_FLAG_ROUTE } from '../src/devApi/devApiHistoryDataFlagClient';
import { readSource } from './runtimeBoundaryTestHelpers';

const lockPath = 'docs/WRITE_PATH_TWO_ROUTE_REGRESSION_LOCK.md';

describe('write-path two-route regression lock doc', () => {
  it('exists and contains every required section', () => {
    const doc = readSource(lockPath);

    for (const section of [
      '## Scope / Non-goals',
      '## Current Accepted Browser Mutation Routes',
      '## Explicitly Blocked Routes',
      '## DataHealth Dismiss Regression State',
      '## History Data-flag Regression State',
      '## Shared Two-route Regression Rules',
      '## Two-route Allowlist Matrix',
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

  it('lists exactly the two accepted browser mutation routes and no third approval', () => {
    const doc = readSource(lockPath);

    expect(DEV_API_DATA_HEALTH_DISMISS_ROUTE).toBe('/data-health/issues/:issueId/dismiss');
    expect(DEV_API_HISTORY_DATA_FLAG_ROUTE).toBe('/history/:id/data-flag');
    expect(doc).toContain('`POST /data-health/issues/:issueId/dismiss`');
    expect(doc).toContain('`POST /history/:id/data-flag`');
    expect(doc).toContain('No other browser mutation route is accepted.');
    expect(doc).toContain('No third mutation is approved.');
    expect(doc).toContain('Do not implement a third mutation next.');
  });

  it('locks source-of-truth, prototype states, and shared regression rules', () => {
    const doc = readSource(lockPath);

    for (const expected of [
      'localStorage remains current source of truth',
      'API results do not overwrite localStorage',
      'API results do not overwrite AppData',
      'DataHealth dismiss is locked as the first dev-only browser mutation prototype',
      'Implemented.',
      'Manually accepted.',
      'Observability/recovery documented.',
      'Regression locked.',
      'History data-flag is locked as the second dev-only browser mutation prototype',
      'Planned.',
      '`normal`, `test`, and `excluded` semantics locked',
      'No-fake-success locked.',
      'Route-specific mutation experiment flag',
      'Snapshot metadata required for success',
      'Duplicate submit blocked',
      'Confirmation required',
      'No raw stack, raw response, AppData dump, or localStorage dump',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('includes allowlist matrix, semantics lock, and inventories', () => {
    const doc = readSource(lockPath);

    for (const expected of [
      'Session start',
      'Session patches',
      'History edit',
      'DataHealth repair',
      'Backup/import/export over HTTP',
      'Reset/recovery over HTTP',
      'DataHealth dismiss does not change training set logs',
      'History data-flag can affect default statistics',
      '`test` and `excluded` remain visible but excluded from default production-like stats',
      '`actualWeightKg` remains the trusted calculation source',
      '`identityInvalid` semantics are unchanged',
      'DataHealth dismiss config/client/prototype',
      'DataHealth dismiss acceptance/manual/hardening/observability/regression',
      'History data-flag config/client/prototype',
      'History data-flag acceptance/manual/hardening',
      'Two-route checkpoint/manual regression',
      'Read-only runtime parity',
      'Runtime boundary tests',
      'Server/http/sqlite tests',
      'Dev API runner manual acceptance',
      'Two-route manual regression',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('recommends Task 4.43 as audit-only', () => {
    const doc = readSource(lockPath);

    expect(doc).toContain('Task 4.43 Third Mutation Candidate Readiness Audit V1');
    expect(doc).toContain('Task 4.43 must be audit/planning only. It must not implement a third mutation.');
    expect(doc).toContain('Task 4.42 result: regression lock only.');
  });
});
