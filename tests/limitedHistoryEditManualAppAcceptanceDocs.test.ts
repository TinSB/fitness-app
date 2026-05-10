import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readSource, repoRoot } from './runtimeBoundaryTestHelpers';

const runbookPath = 'docs/LIMITED_HISTORY_EDIT_MANUAL_APP_ACCEPTANCE.md';

const requiredSections = [
  '## Scope / Non-goals',
  '## Safety Before Testing',
  '## Prerequisites',
  '## Start Dev API Runner',
  '## Prepare Test Data',
  '## Start App With Required Flags',
  '## Flag Matrix Manual Checks',
  '## Target Session / Exercise / Set Manual Check',
  '## Confirmation Manual Check',
  '## Pending / Duplicate-submit Manual Check',
  '## Successful Limited Edit Manual Check',
  '## Failure / No-fake-success Manual Checks',
  '## Field Constraint Manual Check',
  '## Data Semantics Manual Check',
  '## LocalStorage Integrity Manual Check',
  '## Network Route Boundary Manual Check',
  '## Forbidden UI Controls Manual Check',
  '## Cleanup',
  '## Browser Build Safety',
  '## Manual Pass / Fail Template',
];

describe('Limited History Edit manual App acceptance docs', () => {
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
      'npm run api:dev -- --port 8787 --seed-empty --db .ironpath/manual-limited-history-edit-acceptance.sqlite',
      'npm run api:dev:build',
      'npm run typecheck',
      'npm test',
      'npm run build',
      'IronPath dev API ready: <url>',
      '$env:VITE_IRONPATH_DEV_API_COMPARE="1"',
      '$env:VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT="limited-history-edit"',
      '$env:VITE_IRONPATH_DEV_API_BASE_URL="http://127.0.0.1:8787"',
      'VITE_IRONPATH_DEV_API_COMPARE=1 VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT=limited-history-edit VITE_IRONPATH_DEV_API_BASE_URL=http://127.0.0.1:8787 npm run dev',
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

  it('documents route allowlists, forbidden routes, and safety warnings', () => {
    const doc = readSource(runbookPath);

    for (const expected of [
      'POST /data-health/issues/:issueId/dismiss',
      'POST /history/:id/data-flag',
      'POST /history/:id/edit',
      'POST /sessions/start',
      'POST /sessions/active/patches',
      'POST /sessions/active/complete',
      'POST /sessions/active/discard',
      'POST /data-health/repair/apply',
      'backup/import/export/reset/recovery HTTP route',
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

  it('documents target, field, data semantics, and pass/fail template fields', () => {
    const doc = readSource(runbookPath);

    for (const expected of [
      'Target session:',
      'Target exercise:',
      'Target set:',
      'Changed fields:',
      'Allowed patch fields are exactly',
      '`actualWeightKg` remains trusted for calculation',
      '`displayWeight` and `displayUnit` remain display-only unless paired with `weightKg`',
      'PR rules remain unchanged',
      'e1RM rules remain unchanged',
      'effective-set rules remain unchanged',
      'LocalStorage integrity result:',
      'Network route boundary result:',
      'Forbidden controls result:',
      'Browser build result:',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
