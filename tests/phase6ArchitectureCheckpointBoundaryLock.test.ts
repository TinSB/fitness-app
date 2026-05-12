import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';
import { createRuntimeSourceSelector } from '../src/storage/runtimeSourceSelector';
import { collectSrcRuntimeFiles, expectSourceNotToContain, readSource, repoRoot } from './runtimeBoundaryTestHelpers';

const docPath = 'docs/PHASE6_ARCHITECTURE_CHECKPOINT_BOUNDARY_LOCK.md';

describe('phase 6 architecture checkpoint boundary lock', () => {
  it('exists and locks required sections', () => {
    expect(existsSync(resolve(repoRoot(), docPath))).toBe(true);
    const doc = readSource(docPath);

    for (const section of [
      '# Phase 6 Architecture Checkpoint Boundary Lock',
      '## Scope / Non-goals',
      '## Completed Architecture Decisions',
      '## Phase 6 Baseline',
      '## Still-blocked Implementation',
      '## Source-of-truth Boundary',
      '## Checkpoint Coverage Inventory',
      '## CI / Ruleset Boundary',
      '## Decision',
      '## Decision Record',
      '## Final Recommendation',
    ]) {
      expect(doc).toContain(section);
    }
  });

  it('locks architecture decisions and still-blocked implementation', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'Task 6.0',
      'Task 6.1',
      'Task 6.2',
      'Task 6.3',
      'Task 6.4',
      'Task 6.5',
      'Task 6.6',
      'Task 6.7',
      'production backend runtime',
      'auth runtime',
      'sync runtime',
      'deployment runtime',
      'normalized schema',
      'migration runtime',
      'Task 6.9 Production Backend Adapter Skeleton Plan V1',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('keeps exact route and source-of-truth boundaries', () => {
    expect(API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES).toEqual([
      '/data-health/issues/:issueId/dismiss',
      '/history/:id/data-flag',
      '/history/:id/edit',
      '/sessions/start',
      '/sessions/active/patches',
      '/sessions/active/complete',
      '/sessions/active/discard',
    ]);
    expect(createRuntimeSourceSelector({ DEV: true })).toMatchObject({
      mode: 'localStorage',
      sourceOfTruth: 'localStorage',
      apiWriteEnabled: false,
    });
  });

  it('keeps browser runtime free of production-only implementation tokens', () => {
    for (const file of collectSrcRuntimeFiles()) {
      expectSourceNotToContain(file, [
        '/data-health/repair/apply',
        '/backup/import',
        '/backup/export',
        '/reset/',
        '/recovery/',
        '/auth',
        '/login',
        '/signup',
        '/users',
        '/sync',
        '/cloud',
        'node:http',
        'node:sqlite',
        'devLauncher',
        'httpRuntimeAdapter',
        'serverAdapter',
        'sqliteRepository',
        'devApiRunner',
        'devDbRecovery',
      ]);
    }
  });
});
