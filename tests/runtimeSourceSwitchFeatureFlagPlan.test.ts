import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readSource, repoRoot } from './runtimeBoundaryTestHelpers';

const docPath = 'docs/RUNTIME_SOURCE_SWITCH_FEATURE_FLAG_PLAN.md';

describe('runtime source switch feature flag plan', () => {
  it('exists and contains required sections', () => {
    expect(existsSync(resolve(repoRoot(), docPath))).toBe(true);
    const doc = readSource(docPath);

    for (const section of [
      '## Scope / Non-goals',
      '## Current Baseline',
      '## Planned Runtime Source Modes',
      '## localStorage Mode',
      '## api-readonly Mode',
      '## api-primary-dev Mode',
      '## Flag Semantics',
      '## Explicit Dev / Local Opt-in',
      '## Fallback Behavior',
      '## Decision',
      '## Decision Record',
      '## Final Recommendation',
    ]) {
      expect(doc).toContain(section);
    }
  });

  it('defines runtime source modes, default behavior, and flag semantics', () => {
    const doc = readSource(docPath);

    for (const expected of [
      '`localStorage` remains the default mode.',
      '`api-readonly` is a future dev/local diagnostics mode.',
      '`api-primary-dev` is a future explicit dev/local runtime source mode.',
      'VITE_IRONPATH_RUNTIME_SOURCE',
      'Missing, empty, invalid, or production-like values must resolve to `localStorage`.',
      'No production API primary mode is approved in Phase 5.',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('covers explicit dev/local opt-in and fallback behavior', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'import.meta.env.DEV === true',
      'localhost or `127.0.0.1` Dev API base URL',
      'explicit runtime source flag value',
      'Default fallback is localStorage.',
      'API unavailable in `api-readonly` must leave App usable from localStorage.',
      'Fallback must not silently merge API data into localStorage.',
      'Fallback must not silently overwrite AppData.',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('states no implementation and recommends Task 5.5', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'This does not implement a runtime source selector.',
      'This does not implement API-backed runtime.',
      'This does not switch source of truth.',
      'Task 5.5 Migration Backup & Rollback Strategy V1',
      'Task 5.5 must be docs/static tests only.',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});

