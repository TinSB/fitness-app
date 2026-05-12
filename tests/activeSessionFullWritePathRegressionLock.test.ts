import { describe, expect, it } from 'vitest';
import { DEV_API_DATA_HEALTH_DISMISS_ROUTE } from '../src/devApi/devApiDataHealthDismissClient';
import { DEV_API_HISTORY_DATA_FLAG_ROUTE } from '../src/devApi/devApiHistoryDataFlagClient';
import { DEV_API_HISTORY_SET_EDIT_ROUTE } from '../src/devApi/devApiHistorySetEditClient';
import { DEV_API_SESSION_COMPLETE_ROUTE } from '../src/devApi/devApiSessionCompleteClient';
import { DEV_API_SESSION_DISCARD_ROUTE } from '../src/devApi/devApiSessionDiscardClient';
import { DEV_API_SESSION_PATCH_ROUTE } from '../src/devApi/devApiSessionPatchClient';
import { DEV_API_SESSION_START_ROUTE } from '../src/devApi/devApiSessionStartClient';
import { readSource } from './runtimeBoundaryTestHelpers';

const lockPath = 'docs/ACTIVE_SESSION_FULL_WRITE_PATH_REGRESSION_LOCK.md';

describe('active session full write-path regression lock doc', () => {
  it('exists and contains every required lock section', () => {
    const doc = readSource(lockPath);

    for (const section of [
      '## Scope / Non-goals',
      '## Current Accepted Browser Mutation Routes',
      '## Explicitly Blocked Routes',
      '## Active Session Regression State',
      '## Shared Active-session Regression Rules',
      '## Seven-route Allowlist Matrix',
      '## Source-of-truth Regression Lock',
      '## Active Session Data Safety Lock',
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

  it('lists exactly the seven accepted browser mutation routes and no eighth approval', () => {
    const doc = readSource(lockPath);

    expect(DEV_API_DATA_HEALTH_DISMISS_ROUTE).toBe('/data-health/issues/:issueId/dismiss');
    expect(DEV_API_HISTORY_DATA_FLAG_ROUTE).toBe('/history/:id/data-flag');
    expect(DEV_API_HISTORY_SET_EDIT_ROUTE).toBe('/history/:id/edit');
    expect(DEV_API_SESSION_START_ROUTE).toBe('/sessions/start');
    expect(DEV_API_SESSION_PATCH_ROUTE).toBe('/sessions/active/patches');
    expect(DEV_API_SESSION_COMPLETE_ROUTE).toBe('/sessions/active/complete');
    expect(DEV_API_SESSION_DISCARD_ROUTE).toBe('/sessions/active/discard');

    for (const route of [
      '`POST /data-health/issues/:issueId/dismiss`',
      '`POST /history/:id/data-flag`',
      '`POST /history/:id/edit`',
      '`POST /sessions/start`',
      '`POST /sessions/active/patches`',
      '`POST /sessions/active/complete`',
      '`POST /sessions/active/discard`',
    ]) {
      expect(doc).toContain(route);
    }
    expect(doc).toContain('No other browser mutation route is accepted.');
    expect(doc).toContain('No eighth mutation is approved.');
  });

  it('locks source-of-truth, data safety, coverage, and next planning-only task', () => {
    const doc = readSource(lockPath);

    for (const expected of [
      'localStorage remains default App runtime source of truth',
      'API results do not silently overwrite localStorage',
      'API results do not silently overwrite AppData',
      'API-backed persistence adapter is not active yet',
      'No source-of-truth switch is approved before the explicit Phase 5 runtime-source tasks',
      'Browser prototypes must not mutate local activeSession from API results',
      'Session Discard does not write history',
      'Session Patch config/client/prototype/acceptance/hardening/boundary',
      'Session Complete config/client/prototype/acceptance/hardening/boundary',
      'Session Discard config/client/prototype/acceptance/hardening/boundary',
      'Task 5.23 API-backed Persistence Facade Plan V1',
      'Task 5.23 must be planning-only',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
