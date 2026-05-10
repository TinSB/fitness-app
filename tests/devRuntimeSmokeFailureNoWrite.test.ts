import { describe, expect, it } from 'vitest';
import { createDevLocalApiLauncher } from '../apps/api/src/node';
import { makeAppData } from './fixtures';
import {
  DEV_RUNTIME_SMOKE_NOW,
  countSnapshotsInFile,
  expectNoSnapshotWrite,
  expectNoRawRuntimeDetails,
  expectStableHttpErrorBody,
  fetchJsonWithTimeout,
  makeTempDevRuntimeDb,
  seedStartableAppDataSnapshot,
} from './devRuntimeSmokeTestHelpers';

describe('dev runtime smoke failure paths do not write snapshots', () => {
  it('does not write for parsing, routing, no-op, invalid, confirmation, or unsafe paths', async () => {
    const temp = makeTempDevRuntimeDb();
    seedStartableAppDataSnapshot(temp.dbFile, makeAppData({ selectedTemplateId: 'push-a' }));
    const launcher = createDevLocalApiLauncher({
      dbFile: temp.dbFile,
      port: 0,
      seedEmpty: false,
      maxBodyBytes: 64,
      clock: () => DEV_RUNTIME_SMOKE_NOW,
    });

    try {
      const started = await launcher.start();

      let before = countSnapshotsInFile(temp.dbFile);
      const malformed = await fetchJsonWithTimeout(`${started.url}/sessions/start`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{bad',
      });
      expect(malformed.status).toBe(400);
      expect(malformed.body).toMatchObject({ error: { code: 'invalid_json' } });
      expectStableHttpErrorBody(malformed.body);
      expectNoSnapshotWrite(temp.dbFile, before);

      const unsupportedType = await fetchJsonWithTimeout(`${started.url}/sessions/start`, {
        method: 'POST',
        headers: { 'content-type': 'text/plain' },
        body: '{}',
      });
      expect(unsupportedType.status).toBe(415);
      expect(unsupportedType.body).toMatchObject({ error: { code: 'unsupported_media_type' } });
      expectStableHttpErrorBody(unsupportedType.body);
      expectNoSnapshotWrite(temp.dbFile, before);

      const tooLarge = await fetchJsonWithTimeout(`${started.url}/sessions/start`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: `{"templateId":"push-a","note":"${'x'.repeat(80)}"}`,
      });
      expect(tooLarge.status).toBe(413);
      expect(tooLarge.body).toMatchObject({ error: { code: 'request_body_too_large' } });
      expectStableHttpErrorBody(tooLarge.body);
      expectNoSnapshotWrite(temp.dbFile, before);

      const missing = await fetchJsonWithTimeout(`${started.url}/not-a-route`);
      expect(missing.status).toBe(404);
      expect(missing.body).toMatchObject({ result: { reasonCode: 'unsupported_route' } });
      expectNoRawRuntimeDetails(missing.body);
      expectNoSnapshotWrite(temp.dbFile, before);

      const wrongMethod = await fetchJsonWithTimeout(`${started.url}/sessions/start`, { method: 'DELETE' });
      expect(wrongMethod.status).toBe(405);
      expect(wrongMethod.body).toMatchObject({ result: { reasonCode: 'unsupported_route' } });
      expectNoRawRuntimeDetails(wrongMethod.body);
      expectNoSnapshotWrite(temp.dbFile, before);

      const start = await fetchJsonWithTimeout(`${started.url}/sessions/start`, { method: 'POST' });
      expect(start.status).toBe(200);
      before = countSnapshotsInFile(temp.dbFile);

      const noOp = await fetchJsonWithTimeout(`${started.url}/sessions/active/patches`, { method: 'POST' });
      expect(noOp.status).toBe(200);
      expect(noOp.body).not.toHaveProperty('snapshot');
      expectNoSnapshotWrite(temp.dbFile, before);

      const requiresConfirmation = await fetchJsonWithTimeout(`${started.url}/sessions/active/complete`, { method: 'POST' });
      expect(requiresConfirmation.status).toBe(409);
      expect(requiresConfirmation.body).not.toHaveProperty('snapshot');
      expectNoSnapshotWrite(temp.dbFile, before);

      const invalidRepair = await fetchJsonWithTimeout(`${started.url}/data-health/repair/apply`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
      expect(invalidRepair.status).toBe(400);
      expect(invalidRepair.body).not.toHaveProperty('snapshot');
      expectNoSnapshotWrite(temp.dbFile, before);

      const unsafeImportLike = await fetchJsonWithTimeout(`${started.url}/data-health/repair/apply`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{"repairType":"legacy_display_weight","rawData":1}',
      });
      expect(unsafeImportLike.status).toBe(400);
      expect(unsafeImportLike.body).not.toHaveProperty('snapshot');
      expectNoSnapshotWrite(temp.dbFile, before);
    } finally {
      await launcher.close();
      temp.cleanup();
    }
  });
});
