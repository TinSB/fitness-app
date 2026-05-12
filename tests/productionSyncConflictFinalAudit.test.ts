import { describe, expect, it } from 'vitest';
import { detectSyncConflict, type SyncSnapshotMetadata } from '../src/sync/syncConflictDetector';
import { readSource } from './runtimeBoundaryTestHelpers';

const docPath = 'docs/PRODUCTION_SYNC_CONFLICT_FINAL_AUDIT.md';

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

describe('production sync conflict final audit', () => {
  it('documents required final audit sections', () => {
    const doc = readSource(docPath);

    for (const section of [
      '# Production Sync Conflict Final Audit',
      '## Scope / Non-goals',
      '## Phase 6 Baseline',
      '## No Sync Runtime',
      '## Sync Scope If Implemented Later',
      '## Conflict Model',
      '## Idempotency',
      '## Duplicate Cloud Write Prevention',
      '## Offline Behavior',
      '## Source-of-truth Rules',
      '## Rollback',
      '## Route Boundary',
      '## Decision',
      '## Decision Record',
      '## Final Recommendation',
    ]) {
      expect(doc).toContain(section);
    }
  });

  it('audits conflict model without enabling auto-apply', () => {
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

  it('states no sync runtime, cloud writes, or source switch', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'No sync runtime is implemented.',
      'No cloud provider is configured.',
      'No background sync worker is registered.',
      'No remote write queue is created.',
      'Task 6.34 adds no duplicate cloud write prevention runtime',
      'Production source-of-truth switching is not approved.',
      'Task 6.35 Production Deployment & Environment Final Audit V1',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
