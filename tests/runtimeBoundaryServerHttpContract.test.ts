import { describe, expect, it } from 'vitest';
import { createHttpTestServer, fetchJson } from './httpRuntimeAdapterTestHelpers';
import { makeAppData } from './fixtures';
import { makeExercise, makeFocusSession } from './focusModeFixtures';
import { makeRecordData } from './recordDataHealthMutationFixtures';
import { snapshotCount } from './sqliteRepositoryTestHelpers';
import { expectNoRawStack, expectSourceNotToContain, repoRoot } from './runtimeBoundaryTestHelpers';
import { resolve } from 'node:path';

describe('runtime boundary server and HTTP adapter contract acceptance', () => {
  it('keeps serverAdapter and httpRuntimeAdapter inside their narrow composition/parsing boundaries', () => {
    expectSourceNotToContain(resolve(repoRoot(), 'apps/api/src/node/serverAdapter.ts'), [
      'node:http',
      'saveData',
      'loadData',
      'localStorageAdapter',
      '.listen(',
      'createServer(',
    ]);
    expectSourceNotToContain(resolve(repoRoot(), 'apps/api/src/node/httpRuntimeAdapter.ts'), [
      '../readMirror',
      '../sessionMutation',
      '../recordDataHealthMutation',
      '../sqliteRepository',
      'saveData',
      'loadData',
      'localStorageAdapter',
      '.listen(',
    ]);
  });

  it('keeps GET routes read-only and no-op/confirmation mutations from writing snapshots', async () => {
    const activeSession = makeFocusSession([makeExercise('bench-press', 2, 1)]);
    const server = await createHttpTestServer({ data: makeAppData({ activeSession }) });
    try {
      const beforeRead = snapshotCount(server.repository.database);
      const read = await fetchJson(`${server.url}/app-data/summary`);
      expect(read.status).toBe(200);
      expect(snapshotCount(server.repository.database)).toBe(beforeRead);

      const beforeConfirmation = snapshotCount(server.repository.database);
      const confirmation = await fetchJson(`${server.url}/sessions/active/complete`, { method: 'POST' });
      expect(confirmation.status).toBe(409);
      expect((confirmation.body as { snapshot?: unknown }).snapshot).toBeUndefined();
      expect(snapshotCount(server.repository.database)).toBe(beforeConfirmation);
    } finally {
      await server.close();
    }
  });

  it('does not write snapshots for HTTP parsing errors and does not expose raw stacks', async () => {
    const server = await createHttpTestServer({ data: makeRecordData(), maxBodyBytes: 4 });
    try {
      const beforeCount = snapshotCount(server.repository.database);
      const malformed = await fetchJson(`${server.url}/sessions/start`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{bad',
      });
      const tooLarge = await fetchJson(`${server.url}/sessions/start`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{"too":"large"}',
      });
      const unsupported = await fetchJson(`${server.url}/sessions/start`, {
        method: 'POST',
        headers: { 'content-type': 'text/plain' },
        body: 'hi',
      });

      expect(malformed).toMatchObject({ status: 400, body: { error: { code: 'invalid_json' } } });
      expect(tooLarge).toMatchObject({ status: 413, body: { error: { code: 'request_body_too_large' } } });
      expect(unsupported).toMatchObject({ status: 415, body: { error: { code: 'unsupported_media_type' } } });
      [malformed, tooLarge, unsupported].forEach((response) => expectNoRawStack(response.body));
      expect(snapshotCount(server.repository.database)).toBe(beforeCount);
    } finally {
      await server.close();
    }
  });

  it('keeps unsupported routes and wrong methods from writing snapshots or returning snapshot metadata', async () => {
    const server = await createHttpTestServer({ data: makeRecordData() });
    try {
      const beforeCount = snapshotCount(server.repository.database);
      const unknown = await fetchJson(`${server.url}/unknown-route`);
      const wrongMethod = await fetchJson(`${server.url}/sessions/start`, { method: 'DELETE' });

      expect(unknown.status).toBe(404);
      expect(wrongMethod.status).toBe(405);
      expect((unknown.body as { snapshot?: unknown }).snapshot).toBeUndefined();
      expect((wrongMethod.body as { snapshot?: unknown }).snapshot).toBeUndefined();
      expect(snapshotCount(server.repository.database)).toBe(beforeCount);
    } finally {
      await server.close();
    }
  });
});
