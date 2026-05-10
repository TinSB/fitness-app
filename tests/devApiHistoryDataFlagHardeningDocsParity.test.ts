import { describe, expect, it } from 'vitest';
import { DEV_API_DATA_HEALTH_DISMISS_ROUTE } from '../src/devApi/devApiDataHealthDismissClient';
import { DEV_API_HISTORY_DATA_FLAG_ROUTE } from '../src/devApi/devApiHistoryDataFlagClient';
import { readSource } from './runtimeBoundaryTestHelpers';

const manualRunbook = 'docs/HISTORY_DATA_FLAG_MANUAL_APP_ACCEPTANCE.md';

describe('History data-flag hardening docs parity', () => {
  it('records Task 4.39 in the manual runbook with the required hardening checks', () => {
    const doc = readSource(manualRunbook);

    for (const expected of [
      'Task 4.39 Hardening Checks',
      'already-current dataFlag',
      'normal -> normal',
      'test -> test',
      'excluded -> excluded',
      'invalid dataFlag',
      'missing snapshot metadata',
      'API unavailable',
      'duplicate-submit',
      'navigation away',
      'Success requires HTTP 2xx, result.ok === true, result.changed === true, result.status === "success", and snapshot metadata',
      'No-fake-success',
      'localStorage remains source of truth',
      '`normal` participates in default statistics',
      '`test` remains visible but excluded from default production-like statistics',
      '`excluded` remains visible but excluded from default production-like statistics',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('keeps docs aligned to the exact two-route browser mutation allowlist', () => {
    expect(DEV_API_DATA_HEALTH_DISMISS_ROUTE).toBe('/data-health/issues/:issueId/dismiss');
    expect(DEV_API_HISTORY_DATA_FLAG_ROUTE).toBe('/history/:id/data-flag');

    for (const path of [
      manualRunbook,
      'docs/HISTORY_DATA_FLAG_PROTOTYPE_ACCEPTANCE.md',
      'docs/HISTORY_DATA_FLAG_MUTATION_PROTOTYPE_PLAN.md',
      'API_CONTRACT.md',
      'FULL_STACK_REFACTOR_PLAN.md',
      'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
    ]) {
      const doc = readSource(path);
      expect(doc, path).toContain('POST /data-health/issues/:issueId/dismiss');
      expect(doc, path).toContain('POST /history/:id/data-flag');
      expect(doc, path).toMatch(/localStorage remains (the active App )?source of truth/i);
    }
  });

  it('does not instruct production readiness or enabling any other mutation route', () => {
    for (const path of [
      manualRunbook,
      'docs/HISTORY_DATA_FLAG_PROTOTYPE_ACCEPTANCE.md',
      'docs/HISTORY_DATA_FLAG_MUTATION_PROTOTYPE_PLAN.md',
      'API_CONTRACT.md',
      'FULL_STACK_REFACTOR_PLAN.md',
      'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
    ]) {
      const doc = readSource(path);
      for (const pattern of [
        /Task 4\.39[^.\n]*(production ready|production-ready)/i,
        /History data-flag prototype is production/i,
        /enable session mutation/i,
        /enable history edit/i,
        /enable repair mutation/i,
        /enable backup mutation/i,
        /enable reset/i,
        /replace localStorage now/i,
        /make API source of truth now/i,
        /enable auth/i,
        /enable sync/i,
      ]) {
        expect(doc, `${path} should not match ${pattern}`).not.toMatch(pattern);
      }
    }
  });
});
