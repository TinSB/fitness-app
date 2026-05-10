import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readSource, repoRoot } from './runtimeBoundaryTestHelpers';

const runbookPath = 'docs/HISTORY_DATA_FLAG_PROTOTYPE_ACCEPTANCE.md';

const requiredSections = [
  'Scope / Non-goals',
  'Safety before testing',
  'Prerequisites',
  'Start Dev API runner',
  'Start App with required flags',
  'Flag matrix manual check',
  'Target record manual check',
  'Confirmation manual check',
  'Pending / duplicate-submit manual check',
  'Successful dataFlag change manual check',
  'Failure / no-fake-success manual checks',
  'normal / test / excluded semantics manual check',
  'localStorage integrity manual check',
  'Network route boundary manual check',
  'Forbidden UI controls manual check',
  'Cleanup / env reset',
  'Browser build safety',
  'Manual Pass / Fail template',
];

const forbiddenRoutes = [
  'POST /sessions/start',
  'POST /sessions/active/patches',
  'POST /sessions/active/complete',
  'POST /sessions/active/discard',
  'POST /history/:id/edit',
  'POST /data-health/repair/apply',
  'backup/import/export/reset/recovery HTTP routes',
];

describe('History data-flag manual acceptance docs', () => {
  it('exists, is checkbox-based, and contains every required section', () => {
    expect(existsSync(`${repoRoot()}/${runbookPath}`)).toBe(true);
    const doc = readSource(runbookPath);

    expect(doc).toContain('- [ ]');
    for (const section of requiredSections) {
      expect(doc, `missing section: ${section}`).toContain(`## ${section}`);
    }
  });

  it('contains commands, flags, env setup, cleanup, and safety warnings', () => {
    const doc = readSource(runbookPath);

    for (const expected of [
      'npm run api:dev:build',
      'npm run api:dev -- --seed-empty',
      '$env:VITE_IRONPATH_DEV_API_COMPARE',
      "$env:VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT='history-data-flag'",
      "$env:VITE_IRONPATH_DEV_API_BASE_URL='http://127.0.0.1:8787'",
      'export VITE_IRONPATH_DEV_API_COMPARE=1',
      'export VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT=history-data-flag',
      'export VITE_IRONPATH_DEV_API_BASE_URL=http://127.0.0.1:8787',
      'Remove-Item Env:VITE_IRONPATH_DEV_API_COMPARE',
      'Remove-Item Env:VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT',
      'Remove-Item Env:VITE_IRONPATH_DEV_API_BASE_URL',
      'unset VITE_IRONPATH_DEV_API_COMPARE',
      'unset VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT',
      'unset VITE_IRONPATH_DEV_API_BASE_URL',
      'dedicated test browser profile',
      'Do not use real personal training data',
      'Do not clear real browser profile localStorage',
      'not production readiness',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('locks allowed and forbidden route wording', () => {
    const doc = readSource(runbookPath);

    expect(doc).toContain('POST /data-health/issues/:issueId/dismiss');
    expect(doc).toContain('POST /history/:id/data-flag');
    for (const route of forbiddenRoutes) {
      expect(doc).toContain(route);
    }
  });

  it('locks no-fake-success, source-of-truth, semantics, and pass/fail template wording', () => {
    const doc = readSource(runbookPath);

    expect(doc).toContain('no-fake-success');
    expect(doc).toContain('Missing snapshot metadata is failure');
    expect(doc).toContain('localStorage remains source of truth');
    expect(doc).toContain('API results never overwrite AppData or localStorage');
    expect(doc).toContain('normal');
    expect(doc).toContain('test');
    expect(doc).toContain('excluded');
    for (const templateField of [
      'Flag matrix result:',
      'Target record result:',
      'Confirmation result:',
      'Pending / duplicate-submit result:',
      'Success result:',
      'Failure / no-fake-success result:',
      'localStorage integrity result:',
      'Network route boundary result:',
      'Pass / Fail:',
    ]) {
      expect(doc).toContain(templateField);
    }
  });

  it('does not tell a developer to enable production or other mutation routes', () => {
    const doc = readSource(runbookPath);

    for (const forbiddenInstruction of [
      'production-ready',
      'production readiness accepted',
      'Enable session mutation',
      'Enable history edit',
      'Enable repair mutation',
      'Enable backup import',
      'Enable reset route',
      'Enable recovery route',
      'Replace localStorage',
      'Make API source of truth',
      'Deploy production backend',
      'Enable auth',
      'Enable sync',
    ]) {
      expect(doc).not.toContain(forbiddenInstruction);
    }
  });
});
