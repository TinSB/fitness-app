import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const runbookPath = 'docs/WRITE_PATH_THREE_ROUTE_MANUAL_REGRESSION.md';

describe('write-path three-route manual regression docs', () => {
  it('exists, uses checkboxes, and contains every required section', () => {
    const doc = readSource(runbookPath);

    expect(doc).toContain('- [ ]');
    for (const section of [
      '## Scope / Non-goals',
      '## Safety Before Testing',
      '## Prerequisites',
      '## Start Dev API Runner',
      '## Prepare Test Data',
      '## Start App With Read-only Compare Flag',
      '## DataHealth Dismiss Flag Regression',
      '## History Data-flag Flag Regression',
      '## Limited History Edit Flag Regression',
      '## Mutation Experiment Isolation Matrix',
      '## DevTools Network Route Boundary',
      '## No-fake-success Regression',
      '## LocalStorage Integrity Regression',
      '## Forbidden UI Controls Regression',
      '## Failure Scenario Regression',
      '## Cleanup',
      '## Browser Build Safety',
      '## Manual Pass / Fail Template',
      '## Task 4.54 Regression Lock Follow-up',
    ]) {
      expect(doc).toContain(section);
    }
  });

  it('contains required commands, env setup, cleanup, and ready-line checks', () => {
    const doc = readSource(runbookPath);

    for (const expected of [
      'npm run api:dev -- --port 8787 --seed-empty --db .ironpath/manual-three-route-regression.sqlite',
      '$env:VITE_IRONPATH_DEV_API_COMPARE="1"',
      '$env:VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT="datahealth-dismiss"',
      '$env:VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT="history-data-flag"',
      '$env:VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT="limited-history-edit"',
      '$env:VITE_IRONPATH_DEV_API_BASE_URL="http://127.0.0.1:8787"',
      'VITE_IRONPATH_DEV_API_COMPARE=1 VITE_IRONPATH_DEV_API_BASE_URL=http://127.0.0.1:8787 npm run dev',
      'VITE_IRONPATH_DEV_API_COMPARE=1 VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT=datahealth-dismiss',
      'VITE_IRONPATH_DEV_API_COMPARE=1 VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT=history-data-flag',
      'VITE_IRONPATH_DEV_API_COMPARE=1 VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT=limited-history-edit',
      'Remove-Item Env:VITE_IRONPATH_DEV_API_COMPARE -ErrorAction SilentlyContinue',
      'Remove-Item Env:VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT -ErrorAction SilentlyContinue',
      'Remove-Item Env:VITE_IRONPATH_DEV_API_BASE_URL -ErrorAction SilentlyContinue',
      'unset VITE_IRONPATH_DEV_API_COMPARE',
      'unset VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT',
      'unset VITE_IRONPATH_DEV_API_BASE_URL',
      'IronPath dev API ready: <url>',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('documents three flows, isolation matrix, allowed routes, and forbidden routes', () => {
    const doc = readSource(runbookPath);

    for (const expected of [
      'DataHealth dismiss prototype may appear',
      'History data-flag prototype may appear',
      'Limited History Edit prototype may appear',
      'DataHealth dismiss flag enables only its own prototype',
      'History data-flag flag enables only its own prototype',
      'Limited History Edit flag enables only its own prototype',
      'Read-only compare flag alone: read-only diagnostics only',
      '`GET /health`',
      '`GET /app-data/summary`',
      '`GET /sessions/summary`',
      '`GET /history`',
      '`GET /history/:id`',
      '`GET /data-health/summary`',
      '`POST /data-health/issues/:issueId/dismiss`',
      '`POST /history/:id/data-flag`',
      '`POST /history/:id/edit`',
      '`POST /sessions/start`',
      '`POST /sessions/active/patches`',
      '`POST /sessions/active/complete`',
      '`POST /sessions/active/discard`',
      '`POST /data-health/repair/apply`',
      'backup/import/export/reset/recovery HTTP routes',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('documents no-fake-success, localStorage, safety warnings, cleanup, and pass/fail fields', () => {
    const doc = readSource(runbookPath);

    for (const expected of [
      'no fake success',
      'No-fake-success Regression',
      'Success requires snapshot metadata',
      'Missing snapshot metadata does not show success',
      'API result never overwrites AppData or localStorage',
      'localStorage remains source of truth',
      'Do not use real personal training data',
      'Use a dedicated test browser profile',
      '.ironpath/manual-three-route-regression.sqlite',
      'Do not commit `.sqlite`, `.sqlite-wal`, `.sqlite-shm`, or `.sqlite-journal` files',
      'Do not treat this as production backend validation',
      'DataHealth dismiss flow result',
      'History data-flag flow result',
      'Limited History Edit flow result',
      'Mutation experiment isolation result',
      'Network route boundary result',
      'LocalStorage integrity result',
      'Pass / Fail',
      'Task 4.54 should add `docs/WRITE_PATH_THREE_ROUTE_REGRESSION_LOCK.md`',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
