import { describe, expect, it } from 'vitest';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('personal production candidate safety matrix', () => {
  const doc = () => readSource('docs/PERSONAL_PRODUCTION_CANDIDATE_SAFETY_MATRIX.md');

  it('locks personal production candidate safety statuses', () => {
    const content = doc();

    for (const expected of [
      '| Single-user / owner-only use | allowed after manual verification |',
      '| Service role in browser | blocked |',
      '| `.env` committed | blocked |',
      '| localStorage default/fallback/migration/emergency | preserved |',
      '| Backend/cloud candidate | explicit opt-in and reversible |',
      '| Cloud pull | manual dry run, no auto-apply |',
      '| Cloud push | manual confirmation required |',
      '| Conflict resolution | manual |',
      '| Default cloud sync | blocked |',
      '| Background sync | blocked |',
      '| Public SaaS runtime | blocked |',
      '| Production deployment auto-start | blocked |',
      '| External monitoring upload | blocked |',
      '| Real personal training data in automated tests | blocked |',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('keeps accepted browser mutation routes exactly seven', () => {
    expect(API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES).toEqual([
      '/data-health/issues/:issueId/dismiss',
      '/history/:id/data-flag',
      '/history/:id/edit',
      '/sessions/start',
      '/sessions/active/patches',
      '/sessions/active/complete',
      '/sessions/active/discard',
    ]);
  });

  it('documents blocked route families', () => {
    const content = doc();

    for (const expected of [
      '`POST /data-health/repair/apply`',
      'backup/import/export over HTTP',
      'reset/recovery over HTTP',
    ]) {
      expect(content).toContain(expected);
    }
  });
});
