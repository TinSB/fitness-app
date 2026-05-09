import { describe, expect, it } from 'vitest';
import { exportAppData, importAppData } from '../src/storage/backup';
import { makeAppData } from './fixtures';
import { makeRepairableWeightData } from './recordDataHealthMutationFixtures';
import { expectNoSnapshotWrite, seedAdapter } from './serverAdapterTestHelpers';
import { snapshotCount } from './sqliteRepositoryTestHelpers';

describe('server adapter backup safety parity', () => {
  it('does not expose backup import or export endpoints', () => {
    const { repository, adapter } = seedAdapter(makeAppData());
    const beforeCount = snapshotCount(repository.database);
    const importResponse = adapter.handleRequest({ method: 'POST', path: '/backup/import', body: exportAppData(makeAppData()) });
    const exportResponse = adapter.handleRequest({ method: 'GET', path: '/backup/export' });

    expect(importResponse).toMatchObject({ status: 404, result: { reasonCode: 'unsupported_route' } });
    expect(exportResponse).toMatchObject({ status: 404, result: { reasonCode: 'unsupported_route' } });
    expectNoSnapshotWrite(repository, beforeCount, importResponse);
    expectNoSnapshotWrite(repository, beforeCount, exportResponse);
    repository.close();
  });

  it('does not allow unsafe import-like mutation payloads to create snapshots', () => {
    const { repository, adapter } = seedAdapter(makeRepairableWeightData());
    const beforeCount = snapshotCount(repository.database);
    const response = adapter.handleRequest({
      method: 'POST',
      path: '/data-health/repair/apply',
      body: {
        repairType: 'legacy_display_weight',
        confirmRepair: true,
        rawData: { source: 'health-json', samples: [] },
      },
    });

    expect(response.result).toMatchObject({ reasonCode: 'unsafe_import_rejected' });
    expectNoSnapshotWrite(repository, beforeCount, response);
    expect(importAppData(JSON.stringify({ source: 'health-json', samples: [] })).ok).toBe(false);
    repository.close();
  });
});
