import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readSource, repoRoot } from './runtimeBoundaryTestHelpers';

const docPath = 'docs/OFFLINE_PWA_CONFLICT_STRATEGY.md';

describe('offline/PWA conflict strategy', () => {
  it('exists and contains required sections', () => {
    expect(existsSync(resolve(repoRoot(), docPath))).toBe(true);
    const doc = readSource(docPath);

    for (const section of [
      '## Scope / Non-goals',
      '## Current Baseline',
      '## API Unavailable Strategy',
      '## Offline Training Strategy',
      '## Active Session Persistence Strategy',
      '## Offline Mutation Queue Decision',
      '## Visible Failure State',
      '## Conflict Diagnostics',
      '## Source-of-truth Boundary',
      '## Decision',
      '## Decision Record',
      '## Final Recommendation',
    ]) {
      expect(doc).toContain(section);
    }
  });

  it('covers API unavailable, offline training, and active session persistence', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'When the Dev API is unavailable:',
      '`localStorage` mode remains usable.',
      'future `api-readonly` mode must show visible diagnostics',
      'future `api-primary-dev` mode must show visible failure',
      'Offline training must preserve local safety:',
      'offline active session work must not be silently replayed to API.',
      'Active session state is high risk',
      'duplicate or stale active-session operations must be visible conflict states.',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('covers queue decision, visible failures, and conflict diagnostics', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'No full offline mutation queue is approved in Phase 5 unless a later task explicitly approves it.',
      'Task 5.6 does not add queue storage, replay, retry, or background sync.',
      'Failures must be visible and safe:',
      'API unavailable.',
      'stale source snapshot.',
      'source-of-truth mismatch.',
      'Conflict diagnostics should be safe and redacted:',
      'recommended manual recovery path.',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('states no source-of-truth switch and recommends Task 5.7', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'No source-of-truth switch is implemented by Task 5.6.',
      'localStorage remains source of truth.',
      'No offline mutation queue is implemented.',
      'Task 5.7 API-backed Read Runtime Plan V1',
      'Task 5.7 must be docs/static tests only.',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});

