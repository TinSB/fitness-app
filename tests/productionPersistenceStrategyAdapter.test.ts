import { describe, expect, it } from 'vitest';
import { createInMemoryProductionPersistenceAdapter } from '../apps/api/src/node/productionPersistence';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';
import { createRuntimeSourceSelector } from '../src/storage/runtimeSourceSelector';
import { readSource } from './runtimeBoundaryTestHelpers';

const syntheticSeed = {
  appDataSummary: {
    snapshotId: 'synthetic-snapshot-1',
    generatedFrom: 'synthetic-fixture' as const,
    workouts: 2,
    activeSession: false,
  },
  sessionsSummary: {
    activeSession: false,
    completedSessions: 2,
  },
  history: [
    { id: 'synthetic-history-1', completedAt: '2026-01-01T00:00:00.000Z', title: 'Synthetic Session' },
  ],
  dataHealthSummary: {
    issueCount: 0,
    dismissedIssueCount: 0,
  },
};

describe('production persistence strategy adapter', () => {
  it('reads synthetic fixture summaries without source-of-truth status', () => {
    const adapter = createInMemoryProductionPersistenceAdapter(syntheticSeed);

    expect(adapter.kind).toBe('production-persistence-adapter');
    expect(adapter.sourceOfTruth).toBe(false);
    expect(adapter.storage).toBe('in-memory-synthetic-fixture');
    expect(adapter.readAppDataSummary()).toEqual({ ok: true, value: syntheticSeed.appDataSummary });
    expect(adapter.readSessionsSummary()).toEqual({ ok: true, value: syntheticSeed.sessionsSummary });
    expect(adapter.readHistory()).toEqual({ ok: true, value: syntheticSeed.history });
    expect(adapter.readDataHealthSummary()).toEqual({ ok: true, value: syntheticSeed.dataHealthSummary });
  });

  it('returns stable not-found and unsupported results', () => {
    const adapter = createInMemoryProductionPersistenceAdapter(syntheticSeed);

    expect(adapter.readHistoryItem('missing')).toMatchObject({
      ok: false,
      error: { code: 'production_persistence_not_found' },
    });
    expect(adapter.writeShadow()).toMatchObject({
      ok: false,
      error: { code: 'production_persistence_unsupported' },
    });
  });

  it('does not import dev sqlite repository or node sqlite', () => {
    const source = readSource('apps/api/src/node/productionPersistence.ts');

    for (const forbidden of ['node:sqlite', 'sqliteRepository', 'CREATE TABLE', 'migration', 'real personal']) {
      expect(source).not.toContain(forbidden);
    }
  });

  it('preserves runtime source and browser mutation route boundaries', () => {
    expect(createRuntimeSourceSelector({ DEV: true })).toMatchObject({
      mode: 'localStorage',
      sourceOfTruth: 'localStorage',
      apiWriteEnabled: false,
    });
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
});
