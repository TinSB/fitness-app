import { describe, expect, it } from 'vitest';
import {
  DEV_API_DATA_HEALTH_DISMISS_ROUTE,
  dismissDataHealthIssueViaDevApi,
  type DevApiDataHealthDismissFetch,
  type DevApiDataHealthDismissMetadata,
} from '../src/devApi/devApiDataHealthDismissClient';
import type { DevApiDataHealthDismissEnabledConfig } from '../src/devApi/devApiDataHealthDismissConfig';
import { readSource } from './runtimeBoundaryTestHelpers';

const config: DevApiDataHealthDismissEnabledConfig = {
  enabled: true,
  status: 'enabled',
  experiment: 'datahealth-dismiss',
  baseUrl: 'http://127.0.0.1:8787',
  timeoutMs: 20,
};

const metadata: DevApiDataHealthDismissMetadata = {
  issueId: 'issue-1',
  mutationId: 'mutation-1',
  idempotencyKey: 'key-1',
  requestFingerprint: 'request-1',
  sourceFingerprint: 'source-1',
  confirmed: true,
};

const successBody = {
  result: {
    ok: true,
    changed: true,
    status: 'success',
    reasonCode: 'data_health_issue_dismissed',
    message: 'dismissed',
  },
  snapshot: {
    snapshotId: 'snapshot-1',
    schemaVersion: 1,
    createdAt: '2026-05-10T00:00:00.000Z',
  },
};

describe('Dev API DataHealth dismiss client', () => {
  it('declares only the approved DataHealth dismiss route', () => {
    expect(DEV_API_DATA_HEALTH_DISMISS_ROUTE).toBe('/data-health/issues/:issueId/dismiss');

    const source = readSource('src/devApi/devApiDataHealthDismissClient.ts');
    expect(source).toContain('/data-health/issues/');
    expect(source).not.toMatch(/\/sessions\/|\/history\/|\/data-health\/repair\/apply|\/backup|\/reset|\/recovery/i);
    expect(source).not.toMatch(/\bPUT\b|\bPATCH\b|\bDELETE\b/);
    expect(source.match(/\bPOST\b/g)?.length).toBe(1);
    expect(source).not.toMatch(/saveData|loadData|localStorageAdapter|node:http|node:sqlite|serverAdapter|sqliteRepository/);
  });

  it('uses POST only for the approved issue dismiss path', async () => {
    const calls: Array<{ url: string; method?: string }> = [];
    const fetchImpl: DevApiDataHealthDismissFetch = async (input, init) => {
      calls.push({ url: String(input), method: init?.method });
      return new Response(JSON.stringify(successBody), { status: 200 });
    };

    const result = await dismissDataHealthIssueViaDevApi({
      issueId: 'issue/one',
      config,
      metadata,
      fetchImpl,
    });

    expect(result.ok).toBe(true);
    expect(calls).toEqual([{
      url: 'http://127.0.0.1:8787/data-health/issues/issue%2Fone/dismiss',
      method: 'POST',
    }]);
  });

  it('requires snapshot metadata for success', async () => {
    const fetchImpl: DevApiDataHealthDismissFetch = async () =>
      new Response(JSON.stringify({ result: successBody.result }), { status: 200 });

    await expect(dismissDataHealthIssueViaDevApi({
      issueId: 'issue-1',
      config,
      metadata,
      fetchImpl,
    })).resolves.toMatchObject({
      ok: false,
      error: { code: 'dev_mutation_missing_snapshot' },
    });
  });

  it('does not fake success for no-change or not-found results', async () => {
    const noChangeFetch: DevApiDataHealthDismissFetch = async () =>
      new Response(JSON.stringify({
        result: {
          ok: true,
          changed: false,
          status: 'no_change',
          reasonCode: 'data_health_no_change',
          message: 'already hidden',
        },
      }), { status: 200 });
    const notFoundFetch: DevApiDataHealthDismissFetch = async () =>
      new Response(JSON.stringify({
        result: {
          ok: false,
          changed: false,
          status: 'not_found',
          reasonCode: 'data_health_issue_not_found',
          message: 'missing',
        },
      }), { status: 404 });

    await expect(dismissDataHealthIssueViaDevApi({
      issueId: 'issue-1',
      config,
      metadata,
      fetchImpl: noChangeFetch,
    })).resolves.toMatchObject({
      ok: false,
      error: { code: 'dev_mutation_not_successful', serverCode: 'data_health_no_change' },
    });
    await expect(dismissDataHealthIssueViaDevApi({
      issueId: 'missing',
      config,
      metadata,
      fetchImpl: notFoundFetch,
    })).resolves.toMatchObject({
      ok: false,
      error: { code: 'dev_mutation_not_successful', serverCode: 'data_health_issue_not_found' },
    });
  });

  it('normalizes unavailable, timeout, malformed, and server errors', async () => {
    await expect(dismissDataHealthIssueViaDevApi({
      issueId: 'issue-1',
      config,
      metadata,
      fetchImpl: async () => {
        throw new Error('offline');
      },
    })).resolves.toMatchObject({ ok: false, error: { code: 'dev_mutation_unavailable' } });

    await expect(dismissDataHealthIssueViaDevApi({
      issueId: 'issue-1',
      config: { ...config, timeoutMs: 1 },
      metadata,
      fetchImpl: (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
        }),
    })).resolves.toMatchObject({ ok: false, error: { code: 'dev_mutation_timeout' } });

    await expect(dismissDataHealthIssueViaDevApi({
      issueId: 'issue-1',
      config,
      metadata,
      fetchImpl: async () => new Response('not json', { status: 200 }),
    })).resolves.toMatchObject({ ok: false, error: { code: 'dev_mutation_invalid_response' } });

    await expect(dismissDataHealthIssueViaDevApi({
      issueId: 'issue-1',
      config,
      metadata,
      fetchImpl: async () => new Response(JSON.stringify({
        error: { code: 'database_closed', message: 'SQLite repository is closed.' },
      }), { status: 503 }),
    })).resolves.toMatchObject({
      ok: false,
      error: { code: 'dev_mutation_error_response', serverCode: 'database_closed' },
    });
  });

  it('blocks when source fingerprint is missing', async () => {
    const result = await dismissDataHealthIssueViaDevApi({
      issueId: 'issue-1',
      config,
      metadata: { ...metadata, sourceFingerprint: '' },
      fetchImpl: async () => new Response(JSON.stringify(successBody), { status: 200 }),
    });

    expect(result).toMatchObject({
      ok: false,
      error: { code: 'dev_mutation_source_fingerprint_missing' },
    });
  });
});
