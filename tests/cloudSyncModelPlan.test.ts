import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readSource, repoRoot } from './runtimeBoundaryTestHelpers';

const docPath = 'docs/CLOUD_SYNC_MODEL_PLAN.md';

describe('cloud sync model plan', () => {
  it('exists and contains required sections', () => {
    expect(existsSync(resolve(repoRoot(), docPath))).toBe(true);
    const doc = readSource(docPath);

    for (const section of [
      '# Cloud Sync Model Plan',
      '## Scope / Non-goals',
      '## Phase 6 Baseline',
      '## Sync Model',
      '## Device Identity',
      '## Conflict Policy',
      '## Idempotency',
      '## No Sync Runtime',
      '## Decision',
      '## Decision Record',
      '## Final Recommendation',
    ]) {
      expect(doc).toContain(section);
    }
  });

  it('covers sync model, device identity, conflict policy, and idempotency', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'local snapshot id',
      'device id',
      'server revision',
      'client revision',
      'operation id',
      'idempotency key',
      'conflict policy',
      'duplicate cloud writes',
      'no sync runtime',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('states no sync runtime implementation', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'This is not sync runtime implementation.',
      'This is not network write implementation.',
      'This is not cloud write implementation.',
      'This is not background sync implementation.',
      'Task 6.18 adds no sync runtime',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('preserves route and source-of-truth baseline and recommends Task 6.19', () => {
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
      'Task 6.19 Sync Metadata & Conflict Detector Prototype V1',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
