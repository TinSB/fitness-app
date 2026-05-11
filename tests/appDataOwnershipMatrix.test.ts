import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readSource, repoRoot } from './runtimeBoundaryTestHelpers';

const docPath = 'docs/APPDATA_OWNERSHIP_MATRIX.md';

describe('AppData ownership matrix', () => {
  it('exists and contains required sections', () => {
    expect(existsSync(resolve(repoRoot(), docPath))).toBe(true);
    const doc = readSource(docPath);

    for (const section of [
      '## Scope / Non-goals',
      '## Current Baseline',
      '## Ownership Categories',
      '## AppData Ownership Matrix',
      '## Source-of-truth Rules',
      '## Implementation Gates',
      '## Decision',
      '## Decision Record',
      '## Final Recommendation',
    ]) {
      expect(doc).toContain(section);
    }
  });

  it('defines all required ownership categories', () => {
    const doc = readSource(docPath);

    for (const category of [
      'API-owned',
      'local-only',
      'derived',
      'migration-only',
      'fallback-only',
      'blocked',
    ]) {
      expect(doc).toContain(category);
    }
  });

  it('classifies required AppData areas', () => {
    const doc = readSource(docPath);

    for (const area of [
      'training history',
      'active session',
      'program templates',
      'settings',
      'screening profile',
      'DataHealth',
      'backup metadata',
      'readMirror summaries',
      'derived analytics',
      'migration-only state',
      'fallback-only state',
    ]) {
      expect(doc).toContain(area);
    }
  });

  it('keeps source-of-truth and route boundaries explicit', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'localStorage remains the App runtime source of truth',
      'API results never overwrite AppData or localStorage',
      'POST /data-health/issues/:issueId/dismiss',
      'POST /history/:id/data-flag',
      'POST /history/:id/edit',
      'POST /sessions/start',
      'No API-backed runtime is implemented.',
      'No source-of-truth migration is implemented.',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('recommends Task 5.3 as docs/static tests only', () => {
    const doc = readSource(docPath);

    expect(doc).toContain('Task 5.3 API Client Runtime Strategy V1');
    expect(doc).toContain('Task 5.3 must be docs/static tests only.');
    expect(doc).not.toMatch(/switch source of truth now/i);
    expect(doc).not.toMatch(/replace localStorage now/i);
  });
});

