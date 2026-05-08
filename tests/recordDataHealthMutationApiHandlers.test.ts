import { describe, expect, it } from 'vitest';
import {
  handleRecordDataHealthMutationRequest,
  RECORD_DATA_HEALTH_MUTATION_ROUTES,
} from '../apps/api/src';
import { makeRecordData } from './recordDataHealthMutationFixtures';

describe('record/DataHealth mutation API handlers', () => {
  it('declares only the supported record and DataHealth mutation routes', () => {
    expect(RECORD_DATA_HEALTH_MUTATION_ROUTES.map((route) => `${route.method} ${route.path}`)).toEqual([
      'POST /history/:id/edit',
      'POST /history/:id/data-flag',
      'POST /data-health/issues/:issueId/dismiss',
      'POST /data-health/repair/apply',
    ]);
  });

  it('dispatches method and path boundaries without returning nextData for unsupported routes', () => {
    const data = makeRecordData();

    const wrongMethod = handleRecordDataHealthMutationRequest(data, {
      method: 'GET',
      path: '/history/record-mutation-session/edit',
    });
    expect(wrongMethod.status).toBe(405);
    expect(wrongMethod.result.reasonCode).toBe('unsupported_route');
    expect(wrongMethod.nextData).toBeUndefined();

    const unknownRoute = handleRecordDataHealthMutationRequest(data, {
      method: 'POST',
      path: '/history/record-mutation-session/unknown',
    });
    expect(unknownRoute.status).toBe(404);
    expect(unknownRoute.result.reasonCode).toBe('unsupported_route');
    expect(unknownRoute.nextData).toBeUndefined();

    const deleteRoute = handleRecordDataHealthMutationRequest(data, {
      method: 'DELETE',
      path: '/history/record-mutation-session/data-flag',
    });
    expect(deleteRoute.status).toBe(405);
    expect(deleteRoute.result.reasonCode).toBe('unsupported_route');
    expect(deleteRoute.nextData).toBeUndefined();
  });
});
