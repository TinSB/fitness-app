import { describe, expect, it } from 'vitest';
import { makeAppData } from './fixtures';
import { makeExercise, makeFocusSession } from './focusModeFixtures';
import { createHttpTestServer, fetchJson } from './httpRuntimeAdapterTestHelpers';
import { makeRecordData } from './recordDataHealthMutationFixtures';
import { snapshotCount } from './sqliteRepositoryTestHelpers';

const expectNoWrite = async (
  request: { path: string; init?: RequestInit },
  data = makeAppData(),
  maxBodyBytes?: number,
) => {
  const server = await createHttpTestServer({ data, maxBodyBytes });
  try {
    const beforeCount = snapshotCount(server.repository.database);
    const response = await fetchJson(`${server.url}${request.path}`, request.init);
    expect(snapshotCount(server.repository.database)).toBe(beforeCount);
    expect((response.body as { snapshot?: unknown }).snapshot).toBeUndefined();
    return response;
  } finally {
    await server.close();
  }
};

describe('HTTP runtime adapter no-write failures', () => {
  it('does not write snapshots for parsing errors', async () => {
    await expectNoWrite(
      {
        path: '/sessions/start',
        init: { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{bad' },
      },
      makeAppData(),
    );
    await expectNoWrite(
      {
        path: '/sessions/start',
        init: { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"too":"large"}' },
      },
      makeAppData(),
      4,
    );
    await expectNoWrite(
      {
        path: '/sessions/start',
        init: { method: 'POST', headers: { 'content-type': 'text/plain' }, body: 'plain' },
      },
      makeAppData(),
    );
  });

  it('does not write snapshots for unsupported, no-op, invalid, or requires-confirmation adapter responses', async () => {
    const activeSession = makeFocusSession([makeExercise('bench-press', 2, 1)]);
    const unknown = await expectNoWrite({ path: '/unknown-route' }, makeAppData());
    const noOp = await expectNoWrite(
      {
        path: '/history/record-mutation-session/data-flag',
        init: { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"dataFlag":"normal"}' },
      },
      makeRecordData(),
    );
    const requiresConfirmation = await expectNoWrite(
      { path: '/sessions/active/complete', init: { method: 'POST' } },
      makeAppData({ activeSession }),
    );

    expect(unknown).toMatchObject({ status: 404 });
    expect(noOp.body).not.toHaveProperty('snapshot');
    expect(requiresConfirmation.body).not.toHaveProperty('snapshot');
  });
});
