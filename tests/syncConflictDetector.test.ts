import { describe, expect, it } from 'vitest';
import { detectSyncConflict, type SyncSnapshotMetadata } from '../src/sync/syncConflictDetector';
import { readSource } from './runtimeBoundaryTestHelpers';

const metadata = (overrides: Partial<SyncSnapshotMetadata> = {}): SyncSnapshotMetadata => ({
  snapshotId: 'snapshot-a',
  deviceId: 'device-a',
  accountId: 'account-a',
  clientRevision: 4,
  serverRevision: 4,
  operationId: 'operation-a',
  idempotencyKey: 'idem-a',
  deleted: false,
  ...overrides,
});

describe('sync conflict detector prototype', () => {
  it('classifies aligned synthetic metadata without auto-apply', () => {
    expect(detectSyncConflict({
      local: metadata(),
      remote: metadata({ deviceId: 'device-b' }),
    })).toEqual({
      ok: true,
      status: 'no_conflict',
      canAutoApply: false,
      requiresUserResolution: false,
      reasons: ['metadata is aligned'],
      idempotency: {
        operationId: 'operation-a',
        idempotencyKey: 'idem-a',
        duplicateOperation: false,
      },
    });
  });

  it('detects stale, divergent, deletion, duplicate, account, and invalid metadata cases', () => {
    expect(detectSyncConflict({
      local: metadata({ clientRevision: 2 }),
      remote: metadata({ serverRevision: 4 }),
    })).toMatchObject({ ok: false, status: 'stale_client', requiresUserResolution: true });

    expect(detectSyncConflict({
      local: metadata({ serverRevision: 5 }),
      remote: metadata({ serverRevision: 4 }),
    })).toMatchObject({ ok: false, status: 'stale_server', requiresUserResolution: true });

    expect(detectSyncConflict({
      local: metadata({ snapshotId: 'snapshot-a' }),
      remote: metadata({ snapshotId: 'snapshot-b' }),
    })).toMatchObject({ ok: false, status: 'divergent_edits', requiresUserResolution: true });

    expect(detectSyncConflict({
      local: metadata({ deleted: true }),
      remote: metadata({ deleted: false }),
    })).toMatchObject({ ok: false, status: 'deletion_conflict', requiresUserResolution: true });

    expect(detectSyncConflict({
      local: metadata({ operationId: 'operation-a' }),
      remote: metadata(),
      previouslyAppliedOperationIds: ['operation-a'],
    })).toMatchObject({
      ok: true,
      status: 'duplicate_operation',
      requiresUserResolution: false,
      idempotency: { duplicateOperation: true },
    });

    expect(detectSyncConflict({
      local: metadata({ accountId: 'account-a' }),
      remote: metadata({ accountId: 'account-b' }),
    })).toMatchObject({ ok: false, status: 'account_mismatch', requiresUserResolution: true });

    expect(detectSyncConflict({
      local: metadata({ snapshotId: '' }),
      remote: metadata(),
    })).toMatchObject({ ok: false, status: 'invalid_metadata', requiresUserResolution: true });
  });

  it('keeps the prototype pure and free of runtime integration', () => {
    const source = readSource('src/sync/syncConflictDetector.ts');

    for (const forbidden of [
      'fetch(',
      'XMLHttpRequest',
      'localStorage',
      'sessionStorage',
      'indexedDB',
      'navigator.serviceWorker',
      'setInterval',
      'setTimeout',
      'node:http',
      'node:sqlite',
      'sqliteRepository',
      'writeFile',
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });
});
