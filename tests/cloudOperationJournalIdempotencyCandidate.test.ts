import { describe, expect, it } from 'vitest';
import {
  buildCloudIdempotencyKey,
  checkDuplicateManualCloudOperationCandidate,
  createCloudOperationJournalEntry,
  validateCloudIdempotencyKey,
  type CloudOperationJournalInput,
} from '../src/cloudProduction/cloudOperationJournal';
import { readSource } from './runtimeBoundaryTestHelpers';

const input = (operationId = 'operation-synthetic-1'): CloudOperationJournalInput => ({
  operationId,
  operationType: 'manual_push_candidate',
  ownerScope: {
    scope: 'cloud-account-candidate',
    ownerId: 'acct-synthetic-1',
    accountId: 'acct-synthetic-1',
  },
  requestFingerprint: 'request-synthetic-1',
  sourceSnapshotHash: 'hash-source',
  targetSnapshotHash: 'hash-target',
  status: 'pending_manual_review',
  createdAt: '2026-01-01T00:00:00.000Z',
  completedAt: null,
  errorCode: null,
});

describe('cloud operation journal and idempotency candidate', () => {
  it('creates a journal entry with required operation fields', () => {
    expect(createCloudOperationJournalEntry(input())).toMatchObject({
      operationId: 'operation-synthetic-1',
      operationType: 'manual_push_candidate',
      ownerScope: {
        scope: 'cloud-account-candidate',
        ownerId: 'acct-synthetic-1',
        accountId: 'acct-synthetic-1',
      },
      requestFingerprint: 'request-synthetic-1',
      sourceSnapshotHash: 'hash-source',
      targetSnapshotHash: 'hash-target',
      status: 'pending_manual_review',
      createdAt: '2026-01-01T00:00:00.000Z',
      completedAt: null,
      errorCode: null,
    });
  });

  it('builds and validates stable idempotency keys', () => {
    const key = buildCloudIdempotencyKey(
      'manual_pull_review',
      { scope: 'device-local', ownerId: 'Device-1' },
      'Request-1',
      'Hash-A',
      'Hash-B',
    );

    expect(key).toBe('manual_pull_review:device-local:device-1:no-account:request-1:hash-a:hash-b');
    expect(validateCloudIdempotencyKey(key)).toEqual({
      ok: true,
      reason: 'Idempotency key is valid.',
    });
    expect(validateCloudIdempotencyKey('invalid')).toMatchObject({ ok: false });
    expect(validateCloudIdempotencyKey('a:b:c:d:e:f:g h')).toMatchObject({ ok: false });
  });

  it('prevents duplicate manual apply candidates without processing anything', () => {
    const existing = createCloudOperationJournalEntry(input('operation-existing'));
    const duplicate = createCloudOperationJournalEntry(input('operation-new'));

    expect(checkDuplicateManualCloudOperationCandidate([existing], duplicate)).toEqual({
      duplicate: true,
      existingOperationId: 'operation-existing',
      preventDuplicateManualApplyCandidate: true,
    });

    const different = createCloudOperationJournalEntry({
      ...input('operation-other'),
      targetSnapshotHash: 'hash-other',
    });
    expect(checkDuplicateManualCloudOperationCandidate([existing], different)).toEqual({
      duplicate: false,
      existingOperationId: null,
      preventDuplicateManualApplyCandidate: false,
    });
  });

  it('documents journal boundaries and next task', () => {
    const doc = readSource('docs/CLOUD_OPERATION_JOURNAL_IDEMPOTENCY_CANDIDATE.md');

    for (const expected of [
      'Task 12.14 Cloud Operation Journal & Idempotency Candidate V1',
      'This is not a background sync queue.',
      'operationId',
      'operationType',
      'ownerScope',
      'requestFingerprint',
      'sourceSnapshotHash',
      'targetSnapshotHash',
      'No background worker.',
      'No polling.',
      'No timer.',
      'Recommended next task: Task 12.15 Cloud Fallback / Rollback / Emergency Local Mode V1.',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('keeps runtime source free of automatic processing and route behavior', () => {
    const source = readSource('src/cloudProduction/cloudOperationJournal.ts');

    for (const forbidden of [
      '/auth',
      '/account',
      '/sync',
      '/cloud',
      'localStorage.setItem',
      'fetch(',
      'backgroundSync',
      'serviceWorker',
      'syncQueue',
      'backgroundWorker',
      'automaticUpload',
      'automaticDownload',
      'polling',
      'interval',
      'timer',
      'automaticWorker',
      'cloudWrite',
      'node:http',
      'node:sqlite',
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });
});
