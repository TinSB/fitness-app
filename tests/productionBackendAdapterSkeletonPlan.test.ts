import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readSource, repoRoot } from './runtimeBoundaryTestHelpers';

const docPath = 'docs/PRODUCTION_BACKEND_ADAPTER_SKELETON_PLAN.md';

describe('production backend adapter skeleton plan', () => {
  it('exists and contains required sections', () => {
    expect(existsSync(resolve(repoRoot(), docPath))).toBe(true);
    const doc = readSource(docPath);

    for (const section of [
      '# Production Backend Adapter Skeleton Plan',
      '## Scope / Non-goals',
      '## Phase 6 Baseline',
      '## Backend Adapter Boundary',
      '## Request / Response Shape',
      '## Environment Boundary',
      '## Route Boundary',
      '## Data and Source-of-truth Boundary',
      '## Acceptance Expectations for Task 6.10',
      '## Decision',
      '## Decision Record',
      '## Final Recommendation',
    ]) {
      expect(doc).toContain(section);
    }
  });

  it('defines adapter, request response, and environment boundaries', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'backend adapter boundary',
      'request handling',
      'safe response envelopes',
      'method',
      'path',
      'headers metadata',
      'request id',
      'environment label',
      'source snapshot metadata',
      'inert by default',
      'Node-only',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('states no hosted deployment, auth, database migration, or runtime activation', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'This is not production backend runtime implementation.',
      'This is not hosted deployment.',
      'This is not auth implementation.',
      'This is not database migration implementation.',
      'This is not production runtime activation.',
      'No production environment activation',
      'do not implement the skeleton in Task 6.9',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('preserves route and source-of-truth baseline and recommends Task 6.10', () => {
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
      'Task 6.10 Production Backend Adapter Skeleton V1',
      'limited to an inert Node-only skeleton if safe',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
