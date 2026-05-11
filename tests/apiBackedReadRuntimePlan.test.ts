import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readSource, repoRoot } from './runtimeBoundaryTestHelpers';

const docPath = 'docs/API_BACKED_READ_RUNTIME_PLAN.md';

describe('API-backed read runtime plan', () => {
  it('exists and contains required sections', () => {
    expect(existsSync(resolve(repoRoot(), docPath))).toBe(true);
    const doc = readSource(docPath);

    for (const section of [
      '## Scope / Non-goals',
      '## Current Baseline',
      '## Boot Data from API Snapshot',
      '## localStorage Fallback',
      '## API Unavailable UI',
      '## Snapshot Metadata Display',
      '## readMirror Parity',
      '## GET-only Boundary',
      '## Source Switch Boundary',
      '## Decision',
      '## Decision Record',
      '## Final Recommendation',
    ]) {
      expect(doc).toContain(section);
    }
  });

  it('covers boot data from API snapshot and allowed GET routes', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'Future API-backed read runtime may fetch boot diagnostics from the Dev API.',
      'GET /health',
      'GET /app-data/summary',
      'GET /sessions/summary',
      'GET /history',
      'GET /history/:id',
      'GET /data-health/summary',
      'Boot reads must validate response shape and snapshot metadata before display.',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('covers fallback, unavailable UI, snapshot metadata, and readMirror parity', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'localStorage remains fallback',
      'App remains usable from localStorage if API is unavailable.',
      'API unavailable.',
      'malformed response.',
      'missing snapshot metadata.',
      'Safe snapshot metadata may be displayed',
      'Snapshot metadata must not become source of truth by itself.',
      'compare localStorage-derived summary with API summary.',
      'classify mismatches as diagnostics.',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('states no writes, no source switch implementation, and recommends Task 5.8', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'No POST writes are added by this plan.',
      'No runtime source switch is implemented by Task 5.7.',
      'API results must not overwrite AppData or localStorage.',
      'Task 5.8 API-backed Read Client Prototype V1',
      'Task 5.8 may implement a dev/local GET-only read client prototype.',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});

