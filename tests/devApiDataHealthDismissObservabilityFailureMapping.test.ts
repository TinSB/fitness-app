import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  createDataHealthDismissMetadata,
  createDataHealthDismissSourceContext,
  DevApiDataHealthDismissPrototypePanel,
  getDataHealthDismissRecoveryNote,
} from '../src/devApi/DevApiDataHealthDismissPrototype';
import type { DevApiDataHealthDismissError } from '../src/devApi/devApiDataHealthDismissClient';
import type { DevApiDataHealthDismissEnabledConfig } from '../src/devApi/devApiDataHealthDismissConfig';
import { makeRepairableWeightData } from './recordDataHealthMutationFixtures';

const config: DevApiDataHealthDismissEnabledConfig = {
  enabled: true,
  status: 'enabled',
  experiment: 'datahealth-dismiss',
  baseUrl: 'http://127.0.0.1:8787',
  timeoutMs: 1500,
};

const sourceContext = createDataHealthDismissSourceContext(makeRepairableWeightData())!;
const metadata = createDataHealthDismissMetadata({
  issueId: sourceContext.issueId,
  sourceFingerprint: sourceContext.sourceFingerprint,
  nowIso: '2026-05-10T00:00:00.000Z',
});

const expectedNotes: Array<[string, DevApiDataHealthDismissError, string]> = [
  ['unavailable', { code: 'dev_mutation_unavailable', message: 'network unavailable' }, 'Dev API runner is running'],
  ['timeout', { code: 'dev_mutation_timeout', message: 'timeout' }, 'Dev API is responsive'],
  ['invalid response', { code: 'dev_mutation_invalid_response', message: 'not json' }, 'response shape'],
  ['issue_not_found', { code: 'dev_mutation_not_successful', serverCode: 'issue_not_found', message: 'not found' }, 'verify the issue still exists'],
  ['no_change', { code: 'dev_mutation_not_successful', serverCode: 'no_change', message: 'already dismissed' }, 'already be dismissed'],
  ['requiresConfirmation', { code: 'dev_mutation_not_successful', serverCode: 'requiresConfirmation', message: 'confirm' }, 'Confirm the one-route dev request again'],
  ['write_failed', { code: 'dev_mutation_error_response', serverCode: 'write_failed', message: 'write failed' }, 'back up the dev DB'],
  ['transaction_failed', { code: 'dev_mutation_error_response', serverCode: 'transaction_failed', message: 'transaction failed' }, 'back up the dev DB'],
  ['database_closed', { code: 'dev_mutation_error_response', serverCode: 'database_closed', message: 'closed' }, 'Restart the Dev API runner'],
  ['snapshot_validation_failed', { code: 'dev_mutation_not_successful', serverCode: 'snapshot_validation_failed', message: 'snapshot failed' }, 'inspect schema notes'],
  ['repository_schema_mismatch', { code: 'dev_mutation_not_successful', serverCode: 'repository_schema_mismatch', message: 'schema mismatch' }, 'inspect schema notes'],
  ['unsupported_route', { code: 'dev_mutation_not_successful', serverCode: 'unsupported_route', message: 'unsupported route' }, 'only POST /data-health/issues/:issueId/dismiss'],
  ['missing snapshot metadata', { code: 'dev_mutation_missing_snapshot', message: 'missing snapshot metadata' }, 'failed persistence'],
  ['aborted request', { code: 'dev_mutation_aborted', message: 'request canceled' }, 'canceled or the component unmounted'],
];

const forbiddenControlWords = [
  'repair',
  'sync',
  'overwrite',
  'import',
  'export',
  'reset',
  'apply',
  'fix',
];

describe('DataHealth dismiss observability failure mapping', () => {
  it.each(expectedNotes)('maps %s to safe developer guidance', (_label, error, expected) => {
    const note = getDataHealthDismissRecoveryNote(error);

    expect(note).toContain(expected);
    expect(note).not.toContain('localStorage was changed');
    for (const word of forbiddenControlWords) {
      expect(note.toLowerCase()).not.toMatch(new RegExp(`\\b${word}\\b`));
    }
  });

  it.each(expectedNotes)('renders %s as failure diagnostics, not success', (_label, error) => {
    const markup = renderToStaticMarkup(createElement(DevApiDataHealthDismissPrototypePanel, {
      config,
      sourceContext,
      selectedIssueId: sourceContext.issueId,
      confirmed: false,
      pending: false,
      state: {
        status: 'failure',
        issueId: sourceContext.issueId,
        metadata,
        error,
      },
    }));

    expect(markup).toContain('Failure');
    expect(markup).toContain(error.serverCode || error.code);
    expect(markup).toContain('Safe recovery note');
    expect(markup).not.toContain('Snapshot recorded');
    expect(markup).not.toContain('Success</dd>');
    expect(markup).not.toMatch(/raw stack|SqliteRepositoryError|Error:/i);
    expect(markup).not.toMatch(/localStorage (was|is) changed/i);
  });
});
