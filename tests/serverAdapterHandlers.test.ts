import { describe, expect, it } from 'vitest';
import {
  SERVER_ADAPTER_READ_ROUTES,
  SERVER_ADAPTER_RECORD_DATA_HEALTH_MUTATION_ROUTES,
  SERVER_ADAPTER_ROUTES,
  SERVER_ADAPTER_SESSION_MUTATION_ROUTES,
} from '../apps/api/src/node';
import { handleReadMirrorRequest, READ_MIRROR_ROUTES } from '../apps/api/src';
import {
  RECORD_DATA_HEALTH_MUTATION_ROUTES,
  SESSION_MUTATION_ROUTES,
} from '../apps/api/src';
import { makeAppData } from './fixtures';
import { makeRecordData } from './recordDataHealthMutationFixtures';
import { expectNoSnapshotWrite, seedAdapter } from './serverAdapterTestHelpers';
import { snapshotCount } from './sqliteRepositoryTestHelpers';

describe('server adapter route handling', () => {
  it('publishes exactly the read and mutation skeleton routes', () => {
    expect(SERVER_ADAPTER_READ_ROUTES).toEqual(READ_MIRROR_ROUTES.map(({ method, path }) => ({ method, path })));
    expect(SERVER_ADAPTER_SESSION_MUTATION_ROUTES).toEqual(SESSION_MUTATION_ROUTES.map(({ method, path }) => ({ method, path })));
    expect(SERVER_ADAPTER_RECORD_DATA_HEALTH_MUTATION_ROUTES).toEqual(
      RECORD_DATA_HEALTH_MUTATION_ROUTES.map(({ method, path }) => ({ method, path })),
    );
    expect(SERVER_ADAPTER_ROUTES).toHaveLength(
      READ_MIRROR_ROUTES.length + SESSION_MUTATION_ROUTES.length + RECORD_DATA_HEALTH_MUTATION_ROUTES.length,
    );
  });

  it('delegates GET routes to readMirror without writing snapshots', () => {
    const data = makeRecordData();
    const { repository, adapter } = seedAdapter(data);
    const beforeCount = snapshotCount(repository.database);
    const response = adapter.handleRequest({ method: 'GET', path: '/history' });
    const direct = handleReadMirrorRequest(data, { method: 'GET', path: '/history' });

    expect(response).toMatchObject({ status: direct.status, result: direct.body });
    expectNoSnapshotWrite(repository, beforeCount, response);
    repository.close();
  });

  it('delegates POST session routes to session mutation', () => {
    const { repository, adapter } = seedAdapter(makeAppData({ selectedTemplateId: 'push-a' }));
    const beforeCount = snapshotCount(repository.database);
    const response = adapter.handleRequest({ method: 'POST', path: '/sessions/start' });

    expect(response.result).toMatchObject({ ok: true, changed: true, reasonCode: 'session_started' });
    expect(snapshotCount(repository.database)).toBe(beforeCount + 1);
    repository.close();
  });

  it('delegates POST Record/DataHealth routes to recordDataHealthMutation', () => {
    const { repository, adapter } = seedAdapter(makeRecordData());
    const beforeCount = snapshotCount(repository.database);
    const response = adapter.handleRequest({
      method: 'POST',
      path: '/history/record-mutation-session/data-flag',
      body: { dataFlag: 'excluded' },
    });

    expect(response.result).toMatchObject({ ok: true, changed: true, reasonCode: 'record_updated' });
    expect(snapshotCount(repository.database)).toBe(beforeCount + 1);
    repository.close();
  });

  it('distinguishes wrong method from unknown path without writing snapshots', () => {
    const { repository, adapter } = seedAdapter();
    const beforeCount = snapshotCount(repository.database);
    const wrongMethod = adapter.handleRequest({ method: 'POST', path: '/history' });
    const unknown = adapter.handleRequest({ method: 'GET', path: '/not-a-route' });

    expect(wrongMethod).toMatchObject({ status: 405, result: { reasonCode: 'unsupported_route' } });
    expect(unknown).toMatchObject({ status: 404, result: { reasonCode: 'unsupported_route' } });
    expectNoSnapshotWrite(repository, beforeCount, wrongMethod);
    expectNoSnapshotWrite(repository, beforeCount, unknown);
    repository.close();
  });
});
