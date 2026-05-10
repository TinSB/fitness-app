import { describe, expect, it } from 'vitest';
import {
  DEV_API_HISTORY_SET_EDIT_ALLOWED_PATCH_FIELDS,
  DEV_API_HISTORY_SET_EDIT_METHOD,
  DEV_API_HISTORY_SET_EDIT_ROUTE,
  updateHistorySetEditViaDevApi,
  validateHistorySetEditPatch,
  type DevApiHistorySetEditFetch,
  type DevApiHistorySetEditMetadata,
} from '../src/devApi/devApiHistorySetEditClient';
import type { DevApiHistorySetEditEnabledConfig } from '../src/devApi/devApiHistorySetEditConfig';
import { expectNoRawStack, readSource } from './runtimeBoundaryTestHelpers';

const config: DevApiHistorySetEditEnabledConfig = {
  enabled: true,
  status: 'enabled',
  experiment: 'limited-history-edit',
  baseUrl: 'http://127.0.0.1:8787',
  timeoutMs: 20,
};

const metadata: DevApiHistorySetEditMetadata = {
  sessionId: 'session-1',
  exerciseId: 'exercise-1',
  setId: 'set-1',
  changedFields: ['note'],
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
    reasonCode: 'record_updated',
    message: 'updated',
  },
  snapshot: {
    snapshotId: 'snapshot-1',
    schemaVersion: 1,
    createdAt: '2026-05-10T00:00:00.000Z',
  },
};

describe('Dev API limited history edit client', () => {
  it('exposes only the limited history edit mutation route and method', () => {
    expect(DEV_API_HISTORY_SET_EDIT_METHOD).toBe('POST');
    expect(DEV_API_HISTORY_SET_EDIT_ROUTE).toBe('/history/:id/edit');
    expect(DEV_API_HISTORY_SET_EDIT_ALLOWED_PATCH_FIELDS).toEqual([
      'weightKg',
      'displayWeight',
      'displayUnit',
      'reps',
      'rir',
      'techniqueQuality',
      'painFlag',
      'note',
    ]);

    const source = readSource('src/devApi/devApiHistorySetEditClient.ts');
    expect(source).not.toMatch(/\/sessions\/|\/data-health\/repair\/apply|\/backup|\/reset|\/recovery/i);
    expect(source).not.toMatch(/\bPUT\b|\bPATCH\b|\bDELETE\b/);
    expect(source).not.toMatch(/method\s*:\s*['"`](POST|PUT|PATCH|DELETE)['"`]/);
    expect(source).not.toMatch(/saveData|loadData|localStorageAdapter|node:http|node:sqlite|serverAdapter|sqliteRepository/);
  });

  it('uses only POST /history/:id/edit and a constrained server-compatible body', async () => {
    const calls: Array<{ url: string; method?: string; body?: string }> = [];
    const fetchImpl: DevApiHistorySetEditFetch = async (input, init) => {
      calls.push({ url: String(input), method: init?.method, body: String(init?.body) });
      return new Response(JSON.stringify(successBody), { status: 200 });
    };

    const result = await updateHistorySetEditViaDevApi({
      sessionId: 'session/one',
      exerciseId: 'bench-press',
      setId: 'bench-press-1',
      patch: { weightKg: 105, reps: 8, note: 'reviewed' },
      reason: 'dev check',
      config,
      metadata: { ...metadata, sessionId: 'session/one', exerciseId: 'bench-press', setId: 'bench-press-1' },
      fetchImpl,
    });

    expect(result.ok).toBe(true);
    expect(calls).toEqual([{
      url: 'http://127.0.0.1:8787/history/session%2Fone/edit',
      method: 'POST',
      body: JSON.stringify({
        exerciseId: 'bench-press',
        setId: 'bench-press-1',
        patch: { weightKg: 105, reps: 8, note: 'reviewed' },
        reason: 'dev check',
      }),
    }]);
  });

  it('validates allowed patch fields and rejects broad edit payloads before request', async () => {
    expect(validateHistorySetEditPatch({
      weightKg: 100,
      displayWeight: 220,
      displayUnit: 'lb',
      reps: 8,
      rir: '2',
      techniqueQuality: 'good',
      painFlag: false,
      note: 'checked',
    })).toMatchObject({
      ok: true,
      fields: DEV_API_HISTORY_SET_EDIT_ALLOWED_PATCH_FIELDS,
    });

    for (const patch of [
      { dataFlag: 'excluded' },
      { id: 'new-id' },
      { activeSession: {} },
      { editHistory: [] },
      { history: [] },
      { weightKg: -1 },
      { reps: 8.5 },
      { displayUnit: 'stone' },
      { techniqueQuality: 'great' },
      { painFlag: 'yes' },
      { note: 'x'.repeat(241) },
    ]) {
      expect(validateHistorySetEditPatch(patch)).toMatchObject({
        ok: false,
        error: { code: 'dev_mutation_invalid_patch' },
      });
    }

    let calls = 0;
    const result = await updateHistorySetEditViaDevApi({
      sessionId: 'session-1',
      exerciseId: 'exercise-1',
      setId: 'set-1',
      patch: { dataFlag: 'test' },
      config,
      metadata,
      fetchImpl: async () => {
        calls += 1;
        return new Response(JSON.stringify(successBody), { status: 200 });
      },
    });

    expect(result).toMatchObject({ ok: false, error: { code: 'dev_mutation_invalid_patch' } });
    expect(calls).toBe(0);
  });

  it('requires snapshot metadata for success', async () => {
    await expect(updateHistorySetEditViaDevApi({
      sessionId: 'session-1',
      exerciseId: 'exercise-1',
      setId: 'set-1',
      patch: { note: 'checked' },
      config,
      metadata,
      fetchImpl: async () => new Response(JSON.stringify({ result: successBody.result }), { status: 200 }),
    })).resolves.toMatchObject({
      ok: false,
      error: { code: 'dev_mutation_missing_snapshot' },
    });
  });

  it('does not fake success for no-change, not-found, invalid, or write failures', async () => {
    const cases = [
      {
        status: 200,
        result: { ok: true, changed: false, status: 'no_change', reasonCode: 'record_no_change', message: 'already set' },
        serverCode: 'record_no_change',
      },
      {
        status: 404,
        result: { ok: false, changed: false, status: 'not_found', reasonCode: 'record_not_found', message: 'missing' },
        serverCode: 'record_not_found',
      },
      {
        status: 400,
        result: { ok: false, changed: false, status: 'invalid', reasonCode: 'record_edit_invalid', message: 'bad patch' },
        serverCode: 'record_edit_invalid',
      },
      {
        status: 409,
        result: { ok: false, changed: false, status: 'requires_confirmation', reasonCode: 'record_edit_requires_confirmation', message: 'confirm' },
        serverCode: 'record_edit_requires_confirmation',
      },
      {
        status: 500,
        result: { ok: false, changed: false, status: 'failed', reasonCode: 'write_failed', message: 'write failed' },
        serverCode: 'write_failed',
      },
    ];

    for (const testCase of cases) {
      await expect(updateHistorySetEditViaDevApi({
        sessionId: 'session-1',
        exerciseId: 'exercise-1',
        setId: 'set-1',
        patch: { note: 'checked' },
        config,
        metadata,
        fetchImpl: async () => new Response(JSON.stringify({ result: testCase.result }), { status: testCase.status }),
      })).resolves.toMatchObject({
        ok: false,
        error: { code: 'dev_mutation_not_successful', serverCode: testCase.serverCode },
      });
    }
  });

  it('normalizes unavailable, timeout, malformed, aborted, and repository errors', async () => {
    await expect(updateHistorySetEditViaDevApi({
      sessionId: 'session-1',
      exerciseId: 'exercise-1',
      setId: 'set-1',
      patch: { note: 'checked' },
      config,
      metadata,
      fetchImpl: async () => {
        throw new Error('offline');
      },
    })).resolves.toMatchObject({ ok: false, error: { code: 'dev_mutation_unavailable' } });

    await expect(updateHistorySetEditViaDevApi({
      sessionId: 'session-1',
      exerciseId: 'exercise-1',
      setId: 'set-1',
      patch: { note: 'checked' },
      config: { ...config, timeoutMs: 1 },
      metadata,
      fetchImpl: (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
        }),
    })).resolves.toMatchObject({ ok: false, error: { code: 'dev_mutation_timeout' } });

    await expect(updateHistorySetEditViaDevApi({
      sessionId: 'session-1',
      exerciseId: 'exercise-1',
      setId: 'set-1',
      patch: { note: 'checked' },
      config,
      metadata,
      fetchImpl: async () => new Response('not json', { status: 200 }),
    })).resolves.toMatchObject({ ok: false, error: { code: 'dev_mutation_invalid_response' } });

    const abort = new AbortController();
    abort.abort();
    await expect(updateHistorySetEditViaDevApi({
      sessionId: 'session-1',
      exerciseId: 'exercise-1',
      setId: 'set-1',
      patch: { note: 'checked' },
      config,
      metadata,
      signal: abort.signal,
      fetchImpl: async (_input, init) => {
        if (init?.signal?.aborted) throw new Error('aborted');
        return new Response(JSON.stringify(successBody), { status: 200 });
      },
    })).resolves.toMatchObject({ ok: false, error: { code: 'dev_mutation_aborted' } });

    const repositoryError = await updateHistorySetEditViaDevApi({
      sessionId: 'session-1',
      exerciseId: 'exercise-1',
      setId: 'set-1',
      patch: { note: 'checked' },
      config,
      metadata,
      fetchImpl: async () => new Response(JSON.stringify({
        error: { code: 'database_closed', message: 'Error: SQLite repository is closed. stack at repo' },
      }), { status: 503 }),
    });

    expect(repositoryError).toMatchObject({
      ok: false,
      error: { code: 'dev_mutation_error_response', serverCode: 'database_closed' },
    });
    expectNoRawStack(repositoryError);
  });

  it('blocks when source fingerprint is missing', async () => {
    const result = await updateHistorySetEditViaDevApi({
      sessionId: 'session-1',
      exerciseId: 'exercise-1',
      setId: 'set-1',
      patch: { note: 'checked' },
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
