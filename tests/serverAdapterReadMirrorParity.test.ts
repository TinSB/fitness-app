import { describe, expect, it } from 'vitest';
import { handleReadMirrorRequest } from '../apps/api/src';
import { makeRecordData } from './recordDataHealthMutationFixtures';
import { expectNoSnapshotWrite, seedAdapter } from './serverAdapterTestHelpers';
import { snapshotCount } from './sqliteRepositoryTestHelpers';

describe('server adapter read mirror parity', () => {
  it('matches direct readMirror responses for supported GET routes and does not write snapshots', () => {
    const data = makeRecordData();
    const { repository, adapter } = seedAdapter(data);
    const routes = [
      '/app-data/summary',
      '/sessions/summary',
      '/history',
      '/history/record-mutation-session',
      '/data-health/summary',
    ];

    routes.forEach((path) => {
      const beforeCount = snapshotCount(repository.database);
      const response = adapter.handleRequest({ method: 'GET', path });
      const direct = handleReadMirrorRequest(repository.readSnapshot(), { method: 'GET', path });

      expect(response.status).toBe(direct.status);
      expect(response.result).toEqual(direct.body);
      expectNoSnapshotWrite(repository, beforeCount, response);
    });
    repository.close();
  });
});
