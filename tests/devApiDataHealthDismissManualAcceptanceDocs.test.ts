import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readSource, repoRoot } from './runtimeBoundaryTestHelpers';

const runbookPath = 'docs/DATAHEALTH_DISMISS_PROTOTYPE_ACCEPTANCE.md';

describe('DataHealth dismiss prototype manual acceptance docs', () => {
  it('exists and is a checkbox runbook with all required sections', () => {
    expect(existsSync(`${repoRoot()}/${runbookPath}`)).toBe(true);
    const doc = readSource(runbookPath);

    for (const section of [
      '## Scope / Non-goals',
      '## Safety Before Testing',
      '## Prerequisites',
      '## Start Dev API Runner',
      '## Start App With Read-only Compare + Mutation Experiment Flags',
      '## Confirm Prototype Appears Only With Required Flags',
      '## Confirm No Mutation Without Confirmation',
      '## Confirm Successful Dismiss',
      '## Confirm Duplicate-submit Prevention',
      '## Confirm API Unavailable Failure',
      '## Confirm Issue-not-found / No-change Failure',
      '## Confirm Write Failure / No-fake-success Behavior',
      '## Confirm LocalStorage Integrity',
      '## Confirm Browser Network Only Shows Allowed POST Route',
      '## Confirm No Session / History / Repair / Backup / Reset Routes',
      '## Shutdown / Cleanup',
      '## Manual Pass / Fail Template',
    ]) {
      expect(doc).toContain(section);
    }

    expect(doc).toMatch(/- \[ \]/);
  });

  it('contains commands, flags, cleanup, and deterministic runner expectations', () => {
    const doc = readSource(runbookPath);

    expect(doc).toContain('npm run api:dev:build');
    expect(doc).toContain('npm run api:dev -- --seed-empty');
    expect(doc).toContain('$env:VITE_IRONPATH_DEV_API_COMPARE="1"');
    expect(doc).toContain('$env:VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT="datahealth-dismiss"');
    expect(doc).toContain('$env:VITE_IRONPATH_DEV_API_BASE_URL="http://127.0.0.1:8787"');
    expect(doc).toContain('VITE_IRONPATH_DEV_API_COMPARE=1 VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT=datahealth-dismiss');
    expect(doc).toContain('Remove-Item Env:VITE_IRONPATH_DEV_API_COMPARE');
    expect(doc).toContain('Remove-Item Env:VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT');
    expect(doc).toContain('Remove-Item Env:VITE_IRONPATH_DEV_API_BASE_URL');
    expect(doc).toContain('unset VITE_IRONPATH_DEV_API_COMPARE');
    expect(doc).toContain('unset VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT');
    expect(doc).toContain('unset VITE_IRONPATH_DEV_API_BASE_URL');
    expect(doc).toContain('IronPath dev API ready: <url>');
  });

  it('documents allowed and forbidden browser routes', () => {
    const doc = readSource(runbookPath);

    expect(doc).toContain('POST /data-health/issues/:issueId/dismiss');
    for (const forbidden of [
      'POST /sessions/start',
      'POST /sessions/active/patches',
      'POST /sessions/active/complete',
      'POST /sessions/active/discard',
      'POST /history/:id/edit',
      'POST /history/:id/data-flag',
      'POST /data-health/repair/apply',
      'backup/import/export HTTP routes',
      'reset/recovery HTTP routes',
    ]) {
      expect(doc).toContain(forbidden);
    }
  });

  it('states source-of-truth, no-fake-success, safety, and pass/fail requirements', () => {
    const doc = readSource(runbookPath);

    expect(doc).toContain('App runtime still uses localStorage as source of truth');
    expect(doc).toContain('localStorage remains source of truth');
    expect(doc).toContain('API results do not overwrite AppData or localStorage');
    expect(doc).toContain('no fake success');
    expect(doc).toContain('Use a dedicated test browser profile');
    expect(doc).toContain('Do not use real personal training data');
    expect(doc).toContain('Do not clear real browser localStorage');
    expect(doc).toContain('Pass / Fail');
  });

  it('does not imply production readiness or expanded mutation routes', () => {
    const doc = readSource(runbookPath);

    for (const pattern of [
      /production ready/i,
      /enable production/i,
      /enable other mutation routes now/i,
      /enable session mutation now/i,
      /enable history mutation now/i,
      /enable DataHealth repair mutation now/i,
      /replace localStorage now/i,
      /make API source of truth now/i,
    ]) {
      expect(doc).not.toMatch(pattern);
    }
  });
});
