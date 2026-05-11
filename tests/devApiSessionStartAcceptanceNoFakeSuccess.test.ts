import { describe, expect, it } from 'vitest';
import { startSessionViaDevApi, type DevApiSessionStartMetadata } from '../src/devApi/devApiSessionStartClient';
import type { DevApiSessionStartEnabledConfig } from '../src/devApi/devApiSessionStartConfig';
import { makeAppData } from './fixtures';

const config: DevApiSessionStartEnabledConfig = {
  enabled: true,
  status: 'enabled',
  experiment: 'session-start',
  baseUrl: 'http://127.0.0.1:8787',
  timeoutMs: 20,
};

const metadata: DevApiSessionStartMetadata = {
  templateId: 'push-a',
  sourceSnapshotHash: 'source',
  sourceSnapshotVersion: 'phase4-active-session-v1',
  mutationId: 'mutation',
  idempotencyKey: 'key',
  requestFingerprint: 'request',
  confirmed: true,
};

const successResult = {
  ok: true,
  changed: true,
  status: 'success',
  reasonCode: 'session_started',
  message: 'started',
};

const snapshot = {
  snapshotId: 'snapshot-1',
  schemaVersion: 1,
  createdAt: '2026-05-11T00:00:00.000Z',
};

describe('Session Start acceptance no-fake-success', () => {
  it('requires full success shape and snapshot metadata', async () => {
    await expect(startSessionViaDevApi({
      templateId: 'push-a',
      config,
      metadata,
      fetchImpl: async () => new Response(JSON.stringify({ result: successResult, snapshot }), { status: 200 }),
    })).resolves.toMatchObject({ ok: true, snapshot });

    for (const body of [
      { result: successResult },
      { result: { ...successResult, ok: false }, snapshot },
      { result: { ...successResult, changed: false }, snapshot },
      { result: { ...successResult, status: 'no_change' }, snapshot },
    ]) {
      await expect(startSessionViaDevApi({
        templateId: 'push-a',
        config,
        metadata,
        fetchImpl: async () => new Response(JSON.stringify(body), { status: 200 }),
      })).resolves.toMatchObject({ ok: false });
    }
  });

  it('treats known failure states as failures and does not mutate AppData', async () => {
    const data = makeAppData();
    const before = JSON.stringify(data);
    const cases = [
      'active_session_exists',
      'template_not_found',
      'source_mismatch',
      'requiresConfirmation',
      'write_failed',
      'transaction_failed',
      'database_closed',
      'unsupported_route',
    ];

    for (const reasonCode of cases) {
      await expect(startSessionViaDevApi({
        templateId: 'push-a',
        config,
        metadata,
        fetchImpl: async () => new Response(JSON.stringify({
          result: {
            ok: false,
            changed: false,
            status: reasonCode === 'template_not_found' ? 'not_found' : 'failed',
            reasonCode,
            message: reasonCode,
          },
          snapshot,
        }), { status: reasonCode === 'template_not_found' ? 404 : 409 }),
      })).resolves.toMatchObject({ ok: false, error: { serverCode: reasonCode } });
    }

    expect(JSON.stringify(data)).toBe(before);
  });
});
