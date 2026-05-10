import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readSource, repoRoot } from './runtimeBoundaryTestHelpers';

const runbookPath = 'docs/DATAHEALTH_DISMISS_MANUAL_APP_ACCEPTANCE.md';

describe('DataHealth dismiss manual App acceptance docs', () => {
  it('exists and uses checkbox runbook format with all required sections', () => {
    expect(existsSync(`${repoRoot()}/${runbookPath}`)).toBe(true);
    const doc = readSource(runbookPath);

    for (const section of [
      '## Scope / Non-goals',
      '## Safety Before Testing',
      '## Prerequisites',
      '## Start Dev API Runner',
      '## Start App With Required Flags',
      '## Flag Matrix Manual Checks',
      '## Confirmation Manual Check',
      '## Pending / Duplicate-submit Manual Check',
      '## Successful Dismiss Manual Check',
      '## Failure Manual Checks',
      '## LocalStorage Integrity Manual Check',
      '## Network Route Boundary Manual Check',
      '## Forbidden UI Controls Manual Check',
      '## Cleanup',
      '## Browser Build Safety',
      '## Manual Pass / Fail Template',
    ]) {
      expect(doc).toContain(section);
    }

    expect(doc).toMatch(/- \[ \]/);
    expect(doc).toContain('Failure criteria:');
    expect(doc).toContain('Expected results:');
  });

  it('contains required commands, flags, ready line, and cleanup commands', () => {
    const doc = readSource(runbookPath);

    expect(doc).toContain('npm run api:dev -- --port 8787 --seed-empty --db .ironpath/manual-datahealth-dismiss-acceptance.sqlite');
    expect(doc).toContain('npm run api:dev:build');
    expect(doc).toContain('npm run typecheck');
    expect(doc).toContain('npm test');
    expect(doc).toContain('npm run build');
    expect(doc).toContain('IronPath dev API ready: <url>');
    expect(doc).toContain('$env:VITE_IRONPATH_DEV_API_COMPARE="1"');
    expect(doc).toContain('$env:VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT="datahealth-dismiss"');
    expect(doc).toContain('$env:VITE_IRONPATH_DEV_API_BASE_URL="http://127.0.0.1:8787"');
    expect(doc).toContain('VITE_IRONPATH_DEV_API_COMPARE=1 VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT=datahealth-dismiss');
    expect(doc).toContain('Remove-Item Env:VITE_IRONPATH_DEV_API_COMPARE -ErrorAction SilentlyContinue');
    expect(doc).toContain('Remove-Item Env:VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT -ErrorAction SilentlyContinue');
    expect(doc).toContain('Remove-Item Env:VITE_IRONPATH_DEV_API_BASE_URL -ErrorAction SilentlyContinue');
    expect(doc).toContain('unset VITE_IRONPATH_DEV_API_COMPARE');
    expect(doc).toContain('unset VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT');
    expect(doc).toContain('unset VITE_IRONPATH_DEV_API_BASE_URL');
  });

  it('documents route allowlists, forbidden routes, source-of-truth, and safety warnings', () => {
    const doc = readSource(runbookPath);

    for (const route of [
      'GET /health',
      'GET /app-data/summary',
      'GET /sessions/summary',
      'GET /history',
      'GET /history/:id',
      'GET /data-health/summary',
      'POST /data-health/issues/:issueId/dismiss',
    ]) {
      expect(doc).toContain(route);
    }

    for (const route of [
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
      expect(doc).toContain(route);
    }

    expect(doc).toContain('localStorage remains source of truth');
    expect(doc).toContain('API result never overwrites AppData or localStorage');
    expect(doc).toContain('Do not use real personal training data');
    expect(doc).toContain('Use a dedicated test browser profile');
    expect(doc).toContain('no fake success');
    expect(doc).toContain('Pass / Fail');
  });
});
