import { describe, expect, it } from 'vitest';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';
import { readSource } from './runtimeBoundaryTestHelpers';

const docPath = 'docs/PRODUCTION_ROUTE_SURFACE_FREEZE.md';

describe('production route surface freeze', () => {
  it('documents accepted mutation routes exactly', () => {
    const doc = readSource(docPath);
    const accepted = [
      'POST /data-health/issues/:issueId/dismiss',
      'POST /history/:id/data-flag',
      'POST /history/:id/edit',
      'POST /sessions/start',
      'POST /sessions/active/patches',
      'POST /sessions/active/complete',
      'POST /sessions/active/discard',
    ];

    expect(API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES).toEqual([
      '/data-health/issues/:issueId/dismiss',
      '/history/:id/data-flag',
      '/history/:id/edit',
      '/sessions/start',
      '/sessions/active/patches',
      '/sessions/active/complete',
      '/sessions/active/discard',
    ]);
    for (const route of accepted) expect(doc).toContain(route);
    expect(doc).toContain('No eighth browser mutation route is authorized.');
  });

  it('separates read candidates from implemented production routes', () => {
    const doc = readSource(docPath);

    for (const route of [
      'GET /health',
      'GET /app-data/summary',
      'GET /sessions/summary',
      'GET /history',
      'GET /history/:id',
      'GET /data-health/summary',
      'Candidate does not mean implemented.',
      'Candidate does not mean authorized for production source-of-truth.',
    ]) {
      expect(doc).toContain(route);
    }
  });

  it('locks blocked routes and next task boundary', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'POST /data-health/repair/apply',
      'backup/import/export over HTTP',
      'reset/recovery over HTTP',
      'production-only route expansion',
      'Dev/local routes are not automatically production routes.',
      'Task 7.4 is not started by Task 7.3.',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
