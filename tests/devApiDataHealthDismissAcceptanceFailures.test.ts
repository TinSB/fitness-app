import { describe, expect, it } from 'vitest';
import {
  dismissDataHealthIssueViaDevApi,
  type DevApiDataHealthDismissFetch,
  type DevApiDataHealthDismissMetadata,
} from '../src/devApi/devApiDataHealthDismissClient';
import type { DevApiDataHealthDismissEnabledConfig } from '../src/devApi/devApiDataHealthDismissConfig';
import { expectNoRawStack } from './runtimeBoundaryTestHelpers';

const config: DevApiDataHealthDismissEnabledConfig = {
  enabled: true,
  status: 'enabled',
  experiment: 'datahealth-dismiss',
  baseUrl: 'http://127.0.0.1:8787',
  timeoutMs: 20,
};

const metadata: DevApiDataHealthDismissMetadata = {
  issueId: 'issue-acceptance',
  mutationId: 'mutation-acceptance',
  idempotencyKey: 'key-acceptance',
  requestFingerprint: 'request-acceptance',
  sourceFingerprint: 'source-acceptance',
  confirmed: true,
};

const successResult = {
  ok: true,
  changed: true,
  status: 'success',
  reasonCode: 'data_health_issue_dismissed',
  message: 'dismissed',
};

const snapshot = {
  snapshotId: 'snapshot-acceptance',
  schemaVersion: 1,
  createdAt: '2026-05-10T00:00:00.000Z',
};

const runDismiss = (fetchImpl: DevApiDataHealthDismissFetch, timeoutMs = 20) =>
  dismissDataHealthIssueViaDevApi({
    issueId: 'issue-acceptance',
    config: { ...config, timeoutMs },
    metadata,
    fetchImpl,
  });

const response = (body: unknown, status = 200) =>
  new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });

describe('DataHealth dismiss acceptance failure and no-fake-success behavior', () => {
  it('shows unavailable and timeout as failures, not success', async () => {
    const unavailable = await runDismiss(async () => {
      throw new Error('network unavailable with hidden stack');
    });
    const timeout = await runDismiss(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
        }),
      1,
    );

    expect(unavailable).toMatchObject({ ok: false, error: { code: 'dev_mutation_unavailable' } });
    expect(timeout).toMatchObject({ ok: false, error: { code: 'dev_mutation_timeout' } });
    expectNoRawStack(unavailable);
    expectNoRawStack(timeout);
  });

  it('shows malformed and server error responses as failures, not success', async () => {
    const malformedJson = await runDismiss(async () => response('not-json'));
    const malformedShape = await runDismiss(async () => response({ unexpected: true }));
    const serverError = await runDismiss(async () =>
      response({ error: { code: 'database_closed', message: 'SQLite repository is closed.' } }, 503),
    );

    expect(malformedJson).toMatchObject({ ok: false, error: { code: 'dev_mutation_invalid_response' } });
    expect(malformedShape).toMatchObject({ ok: false, error: { code: 'dev_mutation_invalid_response' } });
    expect(serverError).toMatchObject({
      ok: false,
      status: 503,
      error: { code: 'dev_mutation_error_response', serverCode: 'database_closed' },
    });
    expectNoRawStack(serverError);
  });

  it.each([
    ['ok false', { ok: false, changed: false, status: 'failure', reasonCode: 'write_failed', message: 'write failed' }, 500],
    ['changed false', { ok: true, changed: false, status: 'no_change', reasonCode: 'no_change', message: 'no change' }, 200],
    ['issue not found', { ok: false, changed: false, status: 'not_found', reasonCode: 'issue_not_found', message: 'issue not found' }, 404],
    ['requires confirmation', { ok: false, changed: false, status: 'requires_confirmation', reasonCode: 'requiresConfirmation', message: 'confirmation required', requiresConfirmation: true }, 409],
    ['write failed', { ok: false, changed: false, status: 'write_failed', reasonCode: 'write_failed', message: 'write failed' }, 500],
    ['transaction failed', { ok: false, changed: false, status: 'transaction_failed', reasonCode: 'transaction_failed', message: 'transaction failed' }, 500],
    ['database closed', { ok: false, changed: false, status: 'database_closed', reasonCode: 'database_closed', message: 'database closed' }, 503],
    ['unsupported route', { ok: false, changed: false, status: 'unsupported_route', reasonCode: 'unsupported_route', message: 'unsupported route' }, 404],
  ])('%s is not treated as success', async (_name, result, status) => {
    const value = await runDismiss(async () => response({ result, snapshot }, status));

    expect(value).toMatchObject({
      ok: false,
      error: { code: 'dev_mutation_not_successful', serverCode: result.reasonCode },
    });
    expectNoRawStack(value);
  });

  it('requires HTTP success, mutation success, changed=true, status=success, and snapshot metadata', async () => {
    const nonOkHttp = await runDismiss(async () => response({ result: successResult, snapshot }, 500));
    const missingSnapshot = await runDismiss(async () => response({ result: successResult }));
    const missingSnapshotId = await runDismiss(async () => response({
      result: successResult,
      snapshot: { schemaVersion: 1, createdAt: '2026-05-10T00:00:00.000Z' },
    }));
    const success = await runDismiss(async () => response({ result: successResult, snapshot }, 200));

    expect(nonOkHttp).toMatchObject({ ok: false, error: { code: 'dev_mutation_not_successful' } });
    expect(missingSnapshot).toMatchObject({ ok: false, error: { code: 'dev_mutation_missing_snapshot' } });
    expect(missingSnapshotId).toMatchObject({ ok: false, error: { code: 'dev_mutation_missing_snapshot' } });
    expect(success).toMatchObject({
      ok: true,
      status: 200,
      result: successResult,
      snapshot,
    });
  });
});
