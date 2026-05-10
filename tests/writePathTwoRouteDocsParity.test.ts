import { describe, expect, it } from 'vitest';
import { DEV_API_DATA_HEALTH_DISMISS_ROUTE } from '../src/devApi/devApiDataHealthDismissClient';
import { DEV_API_HISTORY_DATA_FLAG_ROUTE } from '../src/devApi/devApiHistoryDataFlagClient';
import { readSource } from './runtimeBoundaryTestHelpers';

const checkpointDocs = [
  'docs/WRITE_PATH_TWO_ROUTE_CHECKPOINT.md',
  'API_CONTRACT.md',
  'FULL_STACK_REFACTOR_PLAN.md',
  'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
  'docs/DATAHEALTH_DISMISS_PROTOTYPE_ACCEPTANCE.md',
  'docs/DATAHEALTH_DISMISS_MANUAL_APP_ACCEPTANCE.md',
  'docs/HISTORY_DATA_FLAG_PROTOTYPE_ACCEPTANCE.md',
  'docs/HISTORY_DATA_FLAG_MANUAL_APP_ACCEPTANCE.md',
  'docs/HISTORY_DATA_FLAG_MUTATION_PROTOTYPE_PLAN.md',
];

const docsWithCurrentTwoRouteCheckpoint = [
  'docs/WRITE_PATH_TWO_ROUTE_CHECKPOINT.md',
  'API_CONTRACT.md',
  'FULL_STACK_REFACTOR_PLAN.md',
  'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
  'docs/DATAHEALTH_DISMISS_PROTOTYPE_ACCEPTANCE.md',
  'docs/HISTORY_DATA_FLAG_PROTOTYPE_ACCEPTANCE.md',
];

const forbiddenInstructionPatterns = [
  /Task 4\.40[^.\n]*(production ready|production-ready)/i,
  /two-route checkpoint[^.\n]*(production ready|production-ready)/i,
  /enable session mutation/i,
  /enable history edit/i,
  /enable repair mutation/i,
  /enable DataHealth repair/i,
  /replace localStorage now/i,
  /make API source of truth now/i,
  /switch source of truth now/i,
  /source-of-truth migration is approved/i,
  /enable auth/i,
  /enable sync/i,
  /deploy production backend/i,
];

describe('write-path two-route docs parity', () => {
  it('keeps DataHealth and History docs aligned to the current two-route checkpoint', () => {
    expect(DEV_API_DATA_HEALTH_DISMISS_ROUTE).toBe('/data-health/issues/:issueId/dismiss');
    expect(DEV_API_HISTORY_DATA_FLAG_ROUTE).toBe('/history/:id/data-flag');

    for (const path of docsWithCurrentTwoRouteCheckpoint) {
      const doc = readSource(path);
      expect(doc, path).toContain('Task 4.40');
      expect(doc, path).toContain('POST /data-health/issues/:issueId/dismiss');
      expect(doc, path).toContain('POST /history/:id/data-flag');
      expect(doc, path).toMatch(/browser mutation (allowlist|routes) (remain|remains) exactly/i);
      expect(doc, path).toMatch(/localStorage remains (the active App )?source of truth/i);
    }
  });

  it('keeps manual acceptance docs aware of both accepted routes', () => {
    for (const path of [
      'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
      'docs/DATAHEALTH_DISMISS_MANUAL_APP_ACCEPTANCE.md',
      'docs/HISTORY_DATA_FLAG_MANUAL_APP_ACCEPTANCE.md',
    ]) {
      const doc = readSource(path);
      expect(doc, path).toContain('POST /data-health/issues/:issueId/dismiss');
      expect(doc, path).toContain('POST /history/:id/data-flag');
      expect(doc, path).toMatch(/dedicated test browser profile|manual acceptance/i);
    }
  });

  it('allows historical one-route DataHealth statements only as scoped history', () => {
    const dataHealthDoc = readSource('docs/DATAHEALTH_DISMISS_PROTOTYPE_ACCEPTANCE.md');

    expect(dataHealthDoc).toContain('The DataHealth dismiss prototype remains one-route-only in its own flow');
    expect(dataHealthDoc).toContain('The global browser mutation allowlist remains exactly `POST /data-health/issues/:issueId/dismiss` and `POST /history/:id/data-flag`');
  });

  it('does not instruct production readiness or unapproved write-path expansion', () => {
    for (const path of checkpointDocs) {
      const doc = readSource(path);
      for (const pattern of forbiddenInstructionPatterns) {
        expect(doc, `${path} should not match ${pattern}`).not.toMatch(pattern);
      }
    }
  });
});
