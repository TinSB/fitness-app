import { describe, expect, it } from 'vitest';
import { DEV_API_DATA_HEALTH_DISMISS_ROUTE } from '../src/devApi/devApiDataHealthDismissClient';
import { DEV_API_HISTORY_DATA_FLAG_ROUTE } from '../src/devApi/devApiHistoryDataFlagClient';
import {
  DEV_API_HISTORY_SET_EDIT_ALLOWED_PATCH_FIELDS,
  DEV_API_HISTORY_SET_EDIT_ROUTE,
} from '../src/devApi/devApiHistorySetEditClient';
import { readSource } from './runtimeBoundaryTestHelpers';

const lockPath = 'docs/LIMITED_HISTORY_EDIT_REGRESSION_LOCK.md';

describe('limited history edit regression lock doc', () => {
  it('exists and contains every required section', () => {
    const doc = readSource(lockPath);

    for (const section of [
      '## Scope / Non-goals',
      '## Current Accepted Browser Mutation Routes',
      '## Explicitly Blocked Routes',
      '## Limited History Edit Regression State',
      '## Three Prototype Regression Rules',
      '## Limited History Edit Field Lock',
      '## Three-route Allowlist Matrix',
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

  it('lists exactly the three accepted browser mutation routes and no fourth approval', () => {
    const doc = readSource(lockPath);

    expect(DEV_API_DATA_HEALTH_DISMISS_ROUTE).toBe('/data-health/issues/:issueId/dismiss');
    expect(DEV_API_HISTORY_DATA_FLAG_ROUTE).toBe('/history/:id/data-flag');
    expect(DEV_API_HISTORY_SET_EDIT_ROUTE).toBe('/history/:id/edit');
    expect(doc).toContain('`POST /data-health/issues/:issueId/dismiss`');
    expect(doc).toContain('`POST /history/:id/data-flag`');
    expect(doc).toContain('`POST /history/:id/edit`');
    expect(doc).toContain('No other browser mutation route is accepted.');
    expect(doc).toContain('Do not implement a fourth mutation next.');
  });

  it('locks source-of-truth, prototype state, and shared regression rules', () => {
    const doc = readSource(lockPath);

    for (const expected of [
      'Limited History Edit is locked as the third dev-only browser mutation prototype',
      'Explicitly user-approved.',
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

  it('locks allowed fields, rejected fields, data semantics, and next checkpoint', () => {
    const doc = readSource(lockPath);

    for (const field of DEV_API_HISTORY_SET_EDIT_ALLOWED_PATCH_FIELDS) {
      expect(doc).toContain(`- \`${field}\``);
    }

    for (const expected of [
      '`dataFlag`',
      'add/remove/reorder operations',
      'direct `editHistory` writes',
      'whole-session JSON patch',
      '`actualWeightKg` remains the trusted calculation source',
      '`displayWeight` and `displayUnit` remain display-only unless paired with `weightKg`',
      'PR, e1RM, effectiveSet, and weighted effectiveSet rules are unchanged',
      'Task 4.52 Write-path Three-route Checkpoint V1',
      'Task 4.52 must be checkpoint/audit documentation and static/regression coverage only.',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
