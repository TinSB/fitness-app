import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readSource, repoRoot } from './runtimeBoundaryTestHelpers';

const docPath = 'docs/ACTIVE_SESSION_WRITE_COVERAGE_GAP_AUDIT.md';

describe('active session write coverage gap audit', () => {
  it('exists and contains required sections', () => {
    expect(existsSync(resolve(repoRoot(), docPath))).toBe(true);
    const doc = readSource(docPath);

    for (const section of [
      '## Scope / Non-goals',
      '## Current Baseline',
      '## Gap Inventory',
      '## Session Patch Gap',
      '## Session Complete Gap',
      '## Session Discard Gap',
      '## Shared Requirements Before Each Prototype',
      '## Route Boundary',
      '## Source-of-truth Boundary',
      '## Decision',
      '## Decision Record',
      '## Final Recommendation',
    ]) {
      expect(doc).toContain(section);
    }
  });

  it('audits the three remaining active-session write routes without implementation approval', () => {
    const doc = readSource(docPath);

    for (const expected of [
      '`POST /sessions/active/patches`',
      '`POST /sessions/active/complete`',
      '`POST /sessions/active/discard`',
      'Blocked from browser runtime',
      'Task 5.13 Session Patch Mutation Prototype Plan V1',
      'Task 5.16 Session Complete Mutation Prototype Plan V1',
      'Task 5.19 Session Discard Mutation Prototype Plan V1',
      'Task 5.13 must be planning-only',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('keeps source-of-truth and no-fake-success requirements explicit', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'localStorage remains source of truth',
      'API results never overwrite AppData or localStorage',
      'strict success shape',
      'snapshot metadata required for success',
      'visible failure states',
      'no automatic retry',
      'no optimistic local mutation',
      'no localStorage write',
      'no AppData overwrite from API result',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
