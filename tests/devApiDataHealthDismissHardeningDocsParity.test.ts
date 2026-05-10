import { describe, expect, it } from 'vitest';
import { DEV_API_DATA_HEALTH_DISMISS_ROUTE } from '../src/devApi/devApiDataHealthDismissClient';
import { readSource } from './runtimeBoundaryTestHelpers';

const docs = () => [
  'docs/DATAHEALTH_DISMISS_MANUAL_APP_ACCEPTANCE.md',
  'docs/DATAHEALTH_DISMISS_PROTOTYPE_ACCEPTANCE.md',
  'API_CONTRACT.md',
  'FULL_STACK_REFACTOR_PLAN.md',
  'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
].map(readSource).join('\n');

describe('DataHealth dismiss hardening docs parity', () => {
  it('documents hardening edge cases in manual acceptance', () => {
    const runbook = readSource('docs/DATAHEALTH_DISMISS_MANUAL_APP_ACCEPTANCE.md');

    for (const phrase of [
      'no_change',
      'already dismissed',
      'missing snapshot metadata',
      'duplicate-submit hardening',
      'abort',
      'navigation-away',
      'localStorage remains the only active App source of truth',
      'no fake success',
    ]) {
      expect(runbook).toContain(phrase);
    }
  });

  it('keeps the only allowed route aligned with the client constant', () => {
    const allDocs = docs();

    expect(DEV_API_DATA_HEALTH_DISMISS_ROUTE).toBe('/data-health/issues/:issueId/dismiss');
    expect(allDocs).toContain(`POST ${DEV_API_DATA_HEALTH_DISMISS_ROUTE}`);
    expect(allDocs).not.toMatch(/enable session mutation now/i);
    expect(allDocs).not.toMatch(/enable history mutation now/i);
    expect(allDocs).not.toMatch(/enable repair mutation now/i);
  });

  it('does not imply production readiness or broader write-path migration', () => {
    const allDocs = docs();

    for (const pattern of [
      /production ready/i,
      /enable production backend/i,
      /replace localStorage now/i,
      /make API source of truth now/i,
      /enable auth/i,
      /enable sync/i,
      /add session mutation/i,
      /add history mutation/i,
      /add repair mutation/i,
    ]) {
      expect(allDocs).not.toMatch(pattern);
    }
  });
});
