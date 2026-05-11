import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const doc = () => readFileSync(resolve(process.cwd(), 'docs/SESSION_START_MANUAL_APP_ACCEPTANCE.md'), 'utf8');

describe('Session Start manual App acceptance docs', () => {
  it('exists as a checkbox runbook with required sections', () => {
    const text = doc();
    expect(text).toContain('- [ ]');
    [
      '## Scope / Non-goals',
      '## Safety Before Testing',
      '## Prerequisites',
      '## Start Dev API Runner',
      '## Prepare Test Data',
      '## Start App With Session Start Flag',
      '## Flag Matrix Manual Check',
      '## Confirmation Manual Check',
      '## Duplicate Start Manual Check',
      '## Success Manual Check',
      '## Failure / No-fake-success Manual Check',
      '## LocalStorage Integrity Manual Check',
      '## DevTools Network Route Boundary',
      '## Cleanup',
      '## Browser Build Safety',
      '## Manual Pass / Fail Template',
    ].forEach((section) => expect(text).toContain(section));
  });

  it('contains commands, flags, route boundaries, warnings, cleanup, and template', () => {
    const text = doc();
    [
      'npm run api:dev -- --port 8787 --seed-empty --db .ironpath/manual-session-start-acceptance.sqlite',
      'IronPath dev API ready: <url>',
      '$env:VITE_IRONPATH_DEV_API_COMPARE="1"',
      '$env:VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT="session-start"',
      'VITE_IRONPATH_DEV_API_COMPARE=1 VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT=session-start',
      'Remove-Item Env:VITE_IRONPATH_DEV_API_COMPARE',
      'unset VITE_IRONPATH_DEV_API_COMPARE',
      'POST /sessions/start',
      'POST /sessions/active/patches',
      'POST /sessions/active/complete',
      'POST /sessions/active/discard',
      'localStorage remains source of truth',
      'API results never overwrite AppData/localStorage',
      'Do not use real personal training data',
      'dedicated test browser profile',
      'Pass / Fail',
    ].forEach((term) => expect(text).toContain(term));
  });
});
