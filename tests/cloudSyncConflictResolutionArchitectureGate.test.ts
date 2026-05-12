import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readSource, repoRoot } from './runtimeBoundaryTestHelpers';

const docPath = 'docs/CLOUD_SYNC_CONFLICT_RESOLUTION_ARCHITECTURE_GATE.md';

describe('cloud sync conflict resolution architecture gate', () => {
  it('exists and contains required sections', () => {
    expect(existsSync(resolve(repoRoot(), docPath))).toBe(true);
    const doc = readSource(docPath);

    for (const section of [
      '# Cloud Sync Conflict Resolution Architecture Gate',
      '## Scope / Non-goals',
      '## Phase 6 Baseline',
      '## Sync Architecture Options',
      '## Conflict Detection',
      '## Conflict Merge Policy',
      '## Remote Write Duplication',
      '## Offline Queue Risk',
      '## Source-of-truth Boundary',
      '## Decision',
      '## Decision Record',
      '## Final Recommendation',
    ]) {
      expect(doc).toContain(section);
    }
  });

  it('evaluates required sync and conflict options without implementation', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'no sync',
      'manual backup sync',
      'single-device cloud backup',
      'multi-device bidirectional sync',
      'conflict detection',
      'conflict merge policy',
      'remote write duplication',
      'offline queue',
      'no remote write queue',
      'no background sync worker',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('states no cloud sync runtime implementation', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'This is not cloud sync implementation.',
      'This is not a remote write queue implementation.',
      'This is not a background sync worker implementation.',
      'Automatic merge is not approved.',
      'Task 6.5 adds no remote write queue and no cloud write runtime.',
      'Task 6.5 adds no offline queue and no background sync worker.',
      'do not implement cloud sync',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('preserves route and source-of-truth baseline and recommends Task 6.6', () => {
    const doc = readSource(docPath);

    for (const expected of [
      '`localStorage` remains default runtime source',
      '`api-primary-dev` remains explicit dev/local only',
      'POST /data-health/issues/:issueId/dismiss',
      'POST /history/:id/data-flag',
      'POST /history/:id/edit',
      'POST /sessions/start',
      'POST /sessions/active/patches',
      'POST /sessions/active/complete',
      'POST /sessions/active/discard',
      'Task 6.6 Deployment, Environment & Secrets Strategy V1',
      'Task 6.6 must be docs/static tests only.',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
