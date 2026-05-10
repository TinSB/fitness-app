import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readSource, repoRoot } from './runtimeBoundaryTestHelpers';

const runbookPath = 'docs/HISTORY_DATA_FLAG_MANUAL_APP_ACCEPTANCE.md';

const requiredSections = [
  '## Scope / Non-goals',
  '## Safety Before Testing',
  '## Prerequisites',
  '## Start Dev API Runner',
  '## Prepare Test Data',
  '## Start App With Required Flags',
  '## Flag Matrix Manual Checks',
  '## Target Record Manual Check',
  '## Confirmation Manual Check',
  '## Pending / Duplicate-submit Manual Check',
  '## Successful Data-flag Change Manual Check',
  '## Failure / No-fake-success Manual Checks',
  '## normal / test / excluded Semantics Manual Check',
  '## LocalStorage Integrity Manual Check',
  '## Network Route Boundary Manual Check',
  '## Forbidden UI Controls Manual Check',
  '## Cleanup',
  '## Browser Build Safety',
  '## Manual Pass / Fail Template',
];

describe('History data-flag manual App acceptance docs', () => {
  it('exists and uses checkbox runbook format with all required sections', () => {
    expect(existsSync(`${repoRoot()}/${runbookPath}`)).toBe(true);
    const doc = readSource(runbookPath);

    for (const section of requiredSections) {
      expect(doc).toContain(section);
    }

    expect(doc).toMatch(/- \[ \]/);
    expect(doc).toContain('Expected results:');
    expect(doc).toContain('Failure criteria:');
  });

  it('contains required commands, flags, ready line, and cleanup commands', () => {
    const doc = readSource(runbookPath);

    for (const expected of [
      'npm run api:dev -- --port 8787 --seed-empty --db .ironpath/manual-history-data-flag-acceptance.sqlite',
      'npm run api:dev:build',
      'npm run typecheck',
      'npm test',
      'npm run build',
      'IronPath dev API ready: <url>',
      '$env:VITE_IRONPATH_DEV_API_COMPARE="1"',
      '$env:VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT="history-data-flag"',
      '$env:VITE_IRONPATH_DEV_API_BASE_URL="http://127.0.0.1:8787"',
      'VITE_IRONPATH_DEV_API_COMPARE=1 VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT=history-data-flag VITE_IRONPATH_DEV_API_BASE_URL=http://127.0.0.1:8787 npm run dev',
      'Remove-Item Env:VITE_IRONPATH_DEV_API_COMPARE -ErrorAction SilentlyContinue',
      'Remove-Item Env:VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT -ErrorAction SilentlyContinue',
      'Remove-Item Env:VITE_IRONPATH_DEV_API_BASE_URL -ErrorAction SilentlyContinue',
      'unset VITE_IRONPATH_DEV_API_COMPARE',
      'unset VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT',
      'unset VITE_IRONPATH_DEV_API_BASE_URL',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('documents test-data preparation, route allowlists, forbidden routes, and safety warnings', () => {
    const doc = readSource(runbookPath);

    for (const expected of [
      'seedEmpty may not contain a meaningful history record',
      'existing stable history record in local AppData and the Dev API snapshot',
      'visible stable history record',
      'GET /health',
      'GET /app-data/summary',
      'GET /sessions/summary',
      'GET /history',
      'GET /history/:id',
      'GET /data-health/summary',
      'POST /data-health/issues/:issueId/dismiss',
      'POST /history/:id/data-flag',
      'POST /sessions/start',
      'POST /sessions/active/patches',
      'POST /sessions/active/complete',
      'POST /sessions/active/discard',
      'POST /history/:id/edit',
      'POST /data-health/repair/apply',
      'backup/import/export/reset/recovery HTTP routes',
      'localStorage remains source of truth',
      'API result never overwrites AppData or localStorage',
      'Do not use real personal training data',
      'Use a dedicated test browser profile',
      'No-fake-success',
      'Pass / Fail',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('documents normal/test/excluded semantics and pass/fail template fields', () => {
    const doc = readSource(runbookPath);

    for (const expected of [
      '`normal` participates in default statistics',
      '`test` remains visible but excluded from default production-like statistics',
      '`excluded` remains visible but excluded from default production-like statistics',
      'Target record used:',
      'Current dataFlag:',
      'Target dataFlag:',
      'Flag matrix result:',
      'Target record result:',
      'Confirmation result:',
      'Duplicate-submit result:',
      'Success result:',
      'Failure result:',
      'Data semantics result:',
      'LocalStorage integrity result:',
      'Network route boundary result:',
      'Forbidden controls result:',
      'Cleanup result:',
      'Browser build result:',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
