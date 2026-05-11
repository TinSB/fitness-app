import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  createSessionStartMetadata,
  createSessionStartSourceContext,
  DevApiSessionStartPrototypePanel,
  getSessionStartRecoveryNote,
} from '../src/devApi/DevApiSessionStartPrototype';
import type { DevApiSessionStartError } from '../src/devApi/devApiSessionStartClient';
import type { DevApiSessionStartEnabledConfig } from '../src/devApi/devApiSessionStartConfig';
import { makeAppData } from './fixtures';

const config: DevApiSessionStartEnabledConfig = {
  enabled: true,
  status: 'enabled',
  experiment: 'session-start',
  baseUrl: 'http://127.0.0.1:8787',
  timeoutMs: 1500,
};

const sourceContext = createSessionStartSourceContext(makeAppData())!;
const metadata = createSessionStartMetadata({
  sourceContext,
  nowIso: '2026-05-11T00:00:00.000Z',
});

const expectedNotes: Array<[string, DevApiSessionStartError, string]> = [
  ['fetch unavailable', { code: 'dev_mutation_fetch_unavailable', message: 'fetch missing' }, 'Fetch is unavailable'],
  ['unavailable', { code: 'dev_mutation_unavailable', message: 'network unavailable' }, 'Dev API runner is running'],
  ['timeout', { code: 'dev_mutation_timeout', message: 'timeout' }, 'Dev API is responsive'],
  ['invalid response', { code: 'dev_mutation_invalid_response', message: 'not json' }, 'response shape'],
  ['missing snapshot metadata', { code: 'dev_mutation_missing_snapshot', message: 'missing snapshot metadata' }, 'failed persistence'],
  ['aborted request', { code: 'dev_mutation_aborted', message: 'request canceled' }, 'canceled or the component unmounted'],
  ['invalid target', { code: 'dev_mutation_invalid_target', message: 'invalid target' }, 'target template still exists'],
  ['template_not_found', { code: 'dev_mutation_not_successful', serverCode: 'template_not_found', message: 'not found' }, 'target template still exists'],
  ['active_session_exists', { code: 'dev_mutation_not_successful', serverCode: 'active_session_exists', message: 'exists' }, 'session already exists'],
  ['source snapshot missing', { code: 'dev_mutation_source_snapshot_missing', message: 'source missing' }, 'source snapshot'],
  ['idempotency missing', { code: 'dev_mutation_idempotency_missing', message: 'idempotency missing' }, 'source snapshot'],
  ['write_failed', { code: 'dev_mutation_error_response', serverCode: 'write_failed', message: 'write failed' }, 'dev DB copy'],
  ['transaction_failed', { code: 'dev_mutation_error_response', serverCode: 'transaction_failed', message: 'transaction failed' }, 'dev DB copy'],
  ['database_closed', { code: 'dev_mutation_error_response', serverCode: 'database_closed', message: 'closed' }, 'Restart the Dev API runner'],
  ['unsupported_route', { code: 'dev_mutation_not_successful', serverCode: 'unsupported_route', message: 'unsupported route' }, 'approved session start experiment'],
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

describe('session start observability failure mapping', () => {
  it.each(expectedNotes)('maps %s to safe developer guidance', (_label, error, expected) => {
    const note = getSessionStartRecoveryNote(error);

    expect(note).toContain(expected);
    expect(note).not.toContain('localStorage was changed');
    for (const word of forbiddenControlWords) {
      expect(note.toLowerCase()).not.toMatch(new RegExp(`\\b${word}\\b`));
    }
  });

  it.each(expectedNotes)('renders %s as failure diagnostics, not success', (_label, error) => {
    const markup = renderToStaticMarkup(createElement(DevApiSessionStartPrototypePanel, {
      config,
      sourceContext,
      confirmed: false,
      pending: false,
      state: {
        status: 'failure',
        templateId: sourceContext.templateId,
        metadata,
        error,
      },
    }));

    expect(markup).toContain('Failure');
    expect(markup).toContain(error.serverCode || error.code);
    expect(markup).not.toContain('Snapshot recorded');
    expect(markup).not.toMatch(/raw stack|SqliteRepositoryError|Error:/i);
    expect(markup).not.toMatch(/localStorage (was|is) changed/i);
  });
});
