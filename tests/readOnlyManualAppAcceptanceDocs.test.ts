import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readSource, repoRoot } from './runtimeBoundaryTestHelpers';

const runbookPath = 'docs/READONLY_APP_MANUAL_ACCEPTANCE.md';

const requiredSections = [
  '## Scope / Non-goals',
  '## Safety Before Testing',
  '## Prerequisites',
  '## Start Dev API Runner',
  '## Start App With Flag Off',
  '## Start App With Read-only Compare Flag On',
  '## Health / Read-only Route Manual Check',
  '## Matching Scenario',
  '## Mismatch Scenario',
  '## API Unavailable Scenario',
  '## Misconfigured Base URL Scenario',
  '## LocalStorage Integrity Check',
  '## Shutdown / Cleanup',
  '## Browser Build Safety',
  '## Manual Pass / Fail Template',
];

describe('read-only App manual acceptance docs', () => {
  it('exists and contains the required checklist sections', () => {
    expect(existsSync(resolve(repoRoot(), runbookPath))).toBe(true);
    const doc = readSource(runbookPath);

    requiredSections.forEach((section) => expect(doc).toContain(section));
    expect((doc.match(/^- \[ \]/gm) || []).length).toBeGreaterThan(50);
  });

  it('contains the manual commands, env setup, and env cleanup steps', () => {
    const doc = readSource(runbookPath);

    expect(doc).toContain('npm run api:dev -- --seed-empty --db .ironpath/manual-readonly-acceptance.sqlite');
    expect(doc).toContain('npm run api:dev -- --port 8787 --seed-empty --db .ironpath/manual-readonly-acceptance.sqlite');
    expect(doc).toContain('IronPath dev API ready: <url>');
    expect(doc).toContain('$env:VITE_IRONPATH_DEV_API_COMPARE="1"');
    expect(doc).toContain('$env:VITE_IRONPATH_DEV_API_BASE_URL="http://127.0.0.1:8787"');
    expect(doc).toContain('Remove-Item Env:VITE_IRONPATH_DEV_API_COMPARE');
    expect(doc).toContain('Remove-Item Env:VITE_IRONPATH_DEV_API_BASE_URL');
    expect(doc).toContain('VITE_IRONPATH_DEV_API_COMPARE=1 VITE_IRONPATH_DEV_API_BASE_URL=http://127.0.0.1:8787 npm run dev');
    expect(doc).toContain('unset VITE_IRONPATH_DEV_API_COMPARE');
    expect(doc).toContain('unset VITE_IRONPATH_DEV_API_BASE_URL');
  });

  it('documents the read-only acceptance scenarios and boundaries', () => {
    const doc = readSource(runbookPath);

    [
      'dedicated test browser profile',
      'Do not use or clear the real daily-use browser profile',
      'Do not use real personal training data',
      'App runtime still uses localStorage',
      'localStorage remains source of truth',
      'No data was changed',
      'no UI writes to API',
      'no mutation routes are called from App',
      'no production backend',
      'auth, sync, or deployment',
      'repair/sync/overwrite/import/export/reset/apply/fix controls',
      'LocalStorage Integrity Check',
      'API Unavailable Scenario',
      'Misconfigured Base URL Scenario',
      'Browser Build Safety',
      'Manual Pass / Fail Template',
    ].forEach((text) => expect(doc).toContain(text));
  });

  it('documents GET-only routes and forbidden mutation routes', () => {
    const doc = readSource(runbookPath);

    [
      'GET /health',
      'GET /app-data/summary',
      'GET /sessions/summary',
      'GET /history',
      'GET /history/:id',
      'GET /data-health/summary',
      '/sessions/start',
      '/sessions/active/patches',
      '/sessions/active/complete',
      '/sessions/active/discard',
      '/history/:id/edit',
      '/history/:id/data-flag',
      '/data-health/issues/:issueId/dismiss',
      '/data-health/repair/apply',
      'backup/import/reset/recovery HTTP route',
    ].forEach((route) => expect(doc).toContain(route));
  });
});
