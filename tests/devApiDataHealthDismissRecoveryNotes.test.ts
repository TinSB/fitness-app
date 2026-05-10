import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const manualRunbook = () => readSource('docs/DATAHEALTH_DISMISS_MANUAL_APP_ACCEPTANCE.md');
const prototypeRunbook = () => readSource('docs/DATAHEALTH_DISMISS_PROTOTYPE_ACCEPTANCE.md');

describe('DataHealth dismiss recovery notes docs', () => {
  it('documents safe manual recovery guidance for known failure reasons', () => {
    const docs = `${manualRunbook()}\n${prototypeRunbook()}`;

    for (const phrase of [
      'confirm the Dev API runner is running and the base URL is localhost',
      'restart the Dev API runner',
      'stop the runner, back up the dev DB, inspect the dev DB',
      'existing recovery/reset runbook only if needed',
      'refresh read-only diagnostics or verify the issue still exists',
      'Missing snapshot metadata',
      'treat as failed persistence',
      'localStorage remains source of truth',
      'manually rerun comparison',
      'Never use production data',
      'Never delete real browser profile localStorage',
      'Never use HTTP reset because no browser HTTP reset endpoint exists',
    ]) {
      expect(docs).toContain(phrase);
    }
  });

  it('documents safe observability without raw dumps or production readiness', () => {
    const docs = `${manualRunbook()}\n${prototypeRunbook()}`;

    for (const phrase of [
      'safe mutation diagnostic summary',
      'failure code',
      'whether snapshot metadata is present',
      'request start and finish time',
      'duplicate-submit blocked state',
      'do not show a raw stack trace',
      'do not dump a raw API response',
      'do not dump full AppData',
      'do not dump localStorage contents',
      'do not show SQLite internal objects',
      'do not show environment objects',
    ]) {
      expect(docs).toContain(phrase);
    }

    expect(docs).not.toMatch(/production ready/i);
  });
});
