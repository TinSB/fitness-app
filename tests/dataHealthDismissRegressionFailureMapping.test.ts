import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  createDataHealthDismissMetadata,
  createDataHealthDismissSourceContext,
  DevApiDataHealthDismissPrototypePanel,
  getDataHealthDismissRecoveryNote,
} from '../src/devApi/DevApiDataHealthDismissPrototype';
import {
  dismissDataHealthIssueViaDevApi,
  type DevApiDataHealthDismissError,
  type DevApiDataHealthDismissFetch,
} from '../src/devApi/devApiDataHealthDismissClient';
import type { DevApiDataHealthDismissEnabledConfig } from '../src/devApi/devApiDataHealthDismissConfig';
import { makeRepairableWeightData } from './recordDataHealthMutationFixtures';
import { expectNoRawStack } from './runtimeBoundaryTestHelpers';

const config: DevApiDataHealthDismissEnabledConfig = {
  enabled: true,
  status: 'enabled',
  experiment: 'datahealth-dismiss',
  baseUrl: 'http://127.0.0.1:8787',
  timeoutMs: 20,
};

const sourceContext = createDataHealthDismissSourceContext(makeRepairableWeightData())!;
const metadata = createDataHealthDismissMetadata({
  issueId: sourceContext.issueId,
  sourceFingerprint: sourceContext.sourceFingerprint,
  nowIso: '2026-05-10T00:00:00.000Z',
});

const snapshot = {
  snapshotId: 'snapshot-failure-regression-lock',
  schemaVersion: 1,
  createdAt: '2026-05-10T00:00:00.000Z',
};

const response = (body: unknown, status = 200) =>
  new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });

const runDismiss = (fetchImpl: DevApiDataHealthDismissFetch, timeoutMs = 20) =>
  dismissDataHealthIssueViaDevApi({
    issueId: sourceContext.issueId,
    config: { ...config, timeoutMs },
    metadata,
    fetchImpl,
  });

const knownFailureErrors: DevApiDataHealthDismissError[] = [
  { code: 'dev_mutation_fetch_unavailable', message: 'fetch unavailable' },
  { code: 'dev_mutation_unavailable', message: 'unavailable' },
  { code: 'dev_mutation_timeout', message: 'timeout' },
  { code: 'dev_mutation_invalid_response', message: 'invalid response' },
  { code: 'dev_mutation_missing_snapshot', message: 'missing snapshot metadata' },
  { code: 'dev_mutation_aborted', message: 'request canceled' },
  { code: 'dev_mutation_not_successful', serverCode: 'issue_not_found', message: 'issue not found' },
  { code: 'dev_mutation_not_successful', serverCode: 'no_change', message: 'already dismissed' },
  { code: 'dev_mutation_not_successful', serverCode: 'requiresConfirmation', message: 'confirmation required' },
  { code: 'dev_mutation_error_response', serverCode: 'write_failed', message: 'write failed' },
  { code: 'dev_mutation_error_response', serverCode: 'transaction_failed', message: 'transaction failed' },
  { code: 'dev_mutation_error_response', serverCode: 'database_closed', message: 'database closed' },
  { code: 'dev_mutation_not_successful', serverCode: 'snapshot_validation_failed', message: 'snapshot validation failed' },
  { code: 'dev_mutation_not_successful', serverCode: 'repository_schema_mismatch', message: 'schema mismatch' },
  { code: 'dev_mutation_not_successful', serverCode: 'unsupported_route', message: 'unsupported route' },
];

describe('DataHealth dismiss regression failure mapping lock', () => {
  it.each([
    ['unavailable', async () => runDismiss(async () => { throw new Error('network stack'); }), 'dev_mutation_unavailable'],
    ['timeout', async () => runDismiss((_input, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('timeout stack')), { once: true });
    }), 1), 'dev_mutation_timeout'],
    ['invalid response', async () => runDismiss(async () => response('not-json')), 'dev_mutation_invalid_response'],
    ['abort/unmount', async () => {
      const controller = new AbortController();
      controller.abort();
      return dismissDataHealthIssueViaDevApi({
        issueId: sourceContext.issueId,
        config,
        metadata,
        signal: controller.signal,
        fetchImpl: (_input, init) => new Promise((_resolve, reject) => {
          if (init?.signal?.aborted) reject(new Error('aborted stack'));
        }),
      });
    }, 'dev_mutation_aborted'],
  ])('%s remains normalized non-success without raw stack', async (_label, run, code) => {
    const result = await run();

    expect(result).toMatchObject({ ok: false, error: { code } });
    expectNoRawStack(result);
  });

  it.each([
    ['issue_not_found', 'issue_not_found', 404],
    ['no_change', 'no_change', 200],
    ['requiresConfirmation', 'requiresConfirmation', 409],
    ['write_failed', 'write_failed', 500],
    ['transaction_failed', 'transaction_failed', 500],
    ['database_closed', 'database_closed', 503],
    ['snapshot_validation_failed', 'snapshot_validation_failed', 500],
    ['repository_schema_mismatch', 'repository_schema_mismatch', 500],
    ['unsupported_route', 'unsupported_route', 404],
  ])('%s server result remains non-success', async (_label, reasonCode, status) => {
    const result = await runDismiss(async () => response({
      result: {
        ok: false,
        changed: false,
        status: reasonCode,
        reasonCode,
        message: `${reasonCode} message`,
      },
      snapshot,
    }, status));

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: 'dev_mutation_not_successful',
        serverCode: reasonCode,
      },
    });
    expectNoRawStack(result);
  });

  it.each(knownFailureErrors)('renders %s/%s as failure with safe recovery copy', (error) => {
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
    expect(markup).not.toMatch(/raw stack|raw response|SqliteRepositoryError|Error:/i);
    expect(getDataHealthDismissRecoveryNote(error)).not.toMatch(/localStorage (was|is) changed/i);
  });
});
