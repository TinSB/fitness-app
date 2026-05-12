import { describe, expect, it } from 'vitest';
import { detectSyncConflict, type SyncSnapshotMetadata } from '../src/sync/syncConflictDetector';
import { readSource } from './runtimeBoundaryTestHelpers';

const docPath = 'docs/SYNC_CONFLICT_ACCEPTANCE.md';

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

describe('sync conflict acceptance', () => {
  it('documents required sections and acceptance boundaries', () => {
    const doc = readSource(docPath);

    for (const section of [
      '# Sync Conflict Acceptance',
      '## Scope / Non-goals',
      '## Phase 6 Baseline',
      '## Accepted Conflict Cases',
      '## No Auto-merge',
      '## No Remote Writes',
      '## User-visible Conflict Policy',
      '## Route and Source-of-truth Boundary',
      '## Decision',
      '## Decision Record',
      '## Final Recommendation',
    ]) {
      expect(doc).toContain(section);
    }
  });

  it('accepts every detector conflict status while keeping auto-apply disabled', () => {
    const scenarios = [
      detectSyncConflict({ local: metadata(), remote: metadata({ deviceId: 'device-b' }) }),
      detectSyncConflict({ local: metadata({ clientRevision: 2 }), remote: metadata({ serverRevision: 4 }) }),
      detectSyncConflict({ local: metadata({ serverRevision: 5 }), remote: metadata({ serverRevision: 4 }) }),
      detectSyncConflict({ local: metadata({ snapshotId: 'snapshot-a' }), remote: metadata({ snapshotId: 'snapshot-b' }) }),
      detectSyncConflict({ local: metadata({ deleted: true }), remote: metadata({ deleted: false }) }),
      detectSyncConflict({ local: metadata({ operationId: 'operation-a' }), remote: metadata(), previouslyAppliedOperationIds: ['operation-a'] }),
      detectSyncConflict({ local: metadata({ accountId: 'account-a' }), remote: metadata({ accountId: 'account-b' }) }),
      detectSyncConflict({ local: metadata({ snapshotId: '' }), remote: metadata() }),
    ];

    expect(scenarios.map((scenario) => scenario.status)).toEqual([
      'no_conflict',
      'stale_client',
      'stale_server',
      'divergent_edits',
      'deletion_conflict',
      'duplicate_operation',
      'account_mismatch',
      'invalid_metadata',
    ]);
    expect(scenarios.every((scenario) => scenario.canAutoApply === false)).toBe(true);
  });

  it('states no sync runtime, remote writes, or automatic merge', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'This is not sync runtime implementation.',
      'This is not remote write implementation.',
      'This is not automatic merge implementation.',
      'Task 6.20 adds no remote writes',
      'No user-visible conflict UI is implemented in Task 6.20.',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
