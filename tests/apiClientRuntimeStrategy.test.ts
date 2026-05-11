import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readSource, repoRoot } from './runtimeBoundaryTestHelpers';

const docPath = 'docs/API_CLIENT_RUNTIME_STRATEGY.md';

describe('API client runtime strategy', () => {
  it('exists and contains required sections', () => {
    expect(existsSync(resolve(repoRoot(), docPath))).toBe(true);
    const doc = readSource(docPath);

    for (const section of [
      '## Scope / Non-goals',
      '## Current Baseline',
      '## Typed Route Client Strategy',
      '## Read Client Strategy',
      '## Mutation Client Boundaries',
      '## Error Shape',
      '## Timeout / Abort / Retry Policy',
      '## Request Fingerprint Strategy',
      '## Snapshot Metadata Handling',
      '## Source Snapshot Strategy',
      '## Decision',
      '## Decision Record',
      '## Final Recommendation',
    ]) {
      expect(doc).toContain(section);
    }
  });

  it('covers typed route clients, read clients, and mutation boundaries', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'typed and route-specific',
      'read clients expose named GET functions',
      'mutation clients expose one named function per accepted route',
      'no generic browser `request(method, path)` mutation helper is approved',
      'GET /health',
      'GET /app-data/summary',
      'GET /sessions/summary',
      'GET /history',
      'GET /history/:id',
      'GET /data-health/summary',
      'POST /data-health/issues/:issueId/dismiss',
      'POST /history/:id/data-flag',
      'POST /history/:id/edit',
      'POST /sessions/start',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('covers error shape, timeout, abort, retry, fingerprint, and snapshot metadata', () => {
    const doc = readSource(docPath);

    for (const expected of [
      '`code`: stable short failure code.',
      '`message`: short safe message.',
      '`httpStatus`: optional HTTP status.',
      '`retryable`: boolean.',
      'Every client request must support timeout.',
      'Every UI-owned request must support abort',
      'No automatic write retry is approved.',
      'mutationId',
      'idempotencyKey',
      'requestFingerprint',
      'sourceSnapshotHash',
      'sourceSnapshotVersion',
      'Mutation success must require snapshot metadata',
      'Snapshot metadata must not be stored in localStorage by a client.',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('states no implementation and recommends Task 5.4', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'This does not implement API clients.',
      'This does not implement API-backed runtime.',
      'This does not add a broad frontend mutation client.',
      'Task 5.4 Runtime Source Switch Feature Flag Plan V1',
      'Task 5.4 must be docs/static tests only.',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});

