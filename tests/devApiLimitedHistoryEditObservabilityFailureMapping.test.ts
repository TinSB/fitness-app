import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  createDefaultHistorySetEditPatchDraft,
  createHistorySetEditMetadata,
  createHistorySetEditSourceContext,
  DevApiHistorySetEditExperimentPanel,
  getHistorySetEditRecoveryNote,
} from '../src/devApi/DevApiHistorySetEditExperiment';
import type { DevApiHistorySetEditError } from '../src/devApi/devApiHistorySetEditClient';
import type { DevApiHistorySetEditEnabledConfig } from '../src/devApi/devApiHistorySetEditConfig';
import { makeRecordData } from './recordDataHealthMutationFixtures';

const config: DevApiHistorySetEditEnabledConfig = {
  enabled: true,
  status: 'enabled',
  experiment: 'limited-history-edit',
  baseUrl: 'http://127.0.0.1:8787',
  timeoutMs: 1500,
};

const sourceContext = createHistorySetEditSourceContext(makeRecordData())!;
const metadata = createHistorySetEditMetadata({
  sessionId: sourceContext.sessionId,
  exerciseId: sourceContext.exerciseId,
  setId: sourceContext.setId,
  changedFields: sourceContext.changedFields,
  sourceFingerprint: sourceContext.sourceFingerprint,
  nowIso: '2026-05-10T00:00:00.000Z',
});

const expectedNotes: Array<[string, DevApiHistorySetEditError, string]> = [
  ['fetch unavailable', { code: 'dev_mutation_fetch_unavailable', message: 'fetch missing' }, 'Fetch is unavailable'],
  ['unavailable', { code: 'dev_mutation_unavailable', message: 'network unavailable' }, 'Dev API runner is running'],
  ['timeout', { code: 'dev_mutation_timeout', message: 'timeout' }, 'Dev API is responsive'],
  ['invalid response', { code: 'dev_mutation_invalid_response', message: 'not json' }, 'response shape'],
  ['missing snapshot metadata', { code: 'dev_mutation_missing_snapshot', message: 'missing snapshot metadata' }, 'failed persistence'],
  ['aborted request', { code: 'dev_mutation_aborted', message: 'request canceled' }, 'canceled or the component unmounted'],
  ['invalid patch', { code: 'dev_mutation_invalid_patch', message: 'invalid patch' }, 'constrained set fields'],
  ['record edit invalid', { code: 'dev_mutation_not_successful', serverCode: 'record_edit_invalid', message: 'invalid' }, 'constrained set fields'],
  ['record_not_found', { code: 'dev_mutation_not_successful', serverCode: 'record_not_found', message: 'not found' }, 'history record still exists'],
  ['record_no_change', { code: 'dev_mutation_not_successful', serverCode: 'record_no_change', message: 'no change' }, 'already match the patch'],
  ['write_failed', { code: 'dev_mutation_error_response', serverCode: 'write_failed', message: 'write failed' }, 'dev DB copy'],
  ['transaction_failed', { code: 'dev_mutation_error_response', serverCode: 'transaction_failed', message: 'transaction failed' }, 'dev DB copy'],
  ['database_closed', { code: 'dev_mutation_error_response', serverCode: 'database_closed', message: 'closed' }, 'Restart the Dev API runner'],
  ['snapshot_validation_failed', { code: 'dev_mutation_not_successful', serverCode: 'snapshot_validation_failed', message: 'snapshot failed' }, 'schema notes'],
  ['repository_schema_mismatch', { code: 'dev_mutation_not_successful', serverCode: 'repository_schema_mismatch', message: 'schema mismatch' }, 'schema notes'],
  ['unsupported_route', { code: 'dev_mutation_not_successful', serverCode: 'unsupported_route', message: 'unsupported route' }, 'approved history set edit route'],
  ['source fingerprint missing', { code: 'dev_mutation_source_fingerprint_missing', message: 'source missing' }, 'source context'],
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

describe('limited history edit observability failure mapping', () => {
  it.each(expectedNotes)('maps %s to safe developer guidance', (_label, error, expected) => {
    const note = getHistorySetEditRecoveryNote(error);

    expect(note).toContain(expected);
    expect(note).not.toContain('localStorage was changed');
    for (const word of forbiddenControlWords) {
      expect(note.toLowerCase()).not.toMatch(new RegExp(`\\b${word}\\b`));
    }
  });

  it.each(expectedNotes)('renders %s as failure diagnostics, not success', (_label, error) => {
    const markup = renderToStaticMarkup(createElement(DevApiHistorySetEditExperimentPanel, {
      config,
      sourceContext,
      patchDraft: createDefaultHistorySetEditPatchDraft(sourceContext.selectedSet),
      confirmed: false,
      pending: false,
      state: {
        status: 'failure',
        sessionId: sourceContext.sessionId,
        exerciseId: sourceContext.exerciseId,
        setId: sourceContext.setId,
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
