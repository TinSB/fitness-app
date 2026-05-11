import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readSource, repoRoot } from './runtimeBoundaryTestHelpers';

const docPath = 'docs/SOURCE_OF_TRUTH_MIGRATION_ARCHITECTURE_GATE.md';

describe('source-of-truth migration architecture gate', () => {
  it('exists and contains required sections', () => {
    expect(existsSync(resolve(repoRoot(), docPath))).toBe(true);
    const doc = readSource(docPath);

    for (const section of [
      '## Scope / Non-goals',
      '## Current Phase 4 Exit State',
      '## localStorage Source-of-truth Baseline',
      '## API / SQLite Candidate Ownership',
      '## Migration Risks',
      '## Fallback Strategy',
      '## Rollback Strategy',
      '## Required Gates Before Implementation',
      '## Decision',
      '## Decision Record',
      '## Final Recommendation',
    ]) {
      expect(doc).toContain(section);
    }
  });

  it('records Phase 4 exit state and localStorage baseline', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'Phase 4 is complete.',
      'POST /data-health/issues/:issueId/dismiss',
      'POST /history/:id/data-flag',
      'POST /history/:id/edit',
      'POST /sessions/start',
      'localStorage remains App runtime source of truth at Phase 5 entry.',
      'API results do not silently overwrite localStorage.',
      'API results do not silently overwrite AppData',
      'No destructive real user data migration is approved by this gate.',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('covers API/SQLite ownership candidates, risks, fallback, and rollback', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'API/SQLite is a candidate future owner',
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
      'Silent AppData overwrite',
      'localStorage/API divergence',
      'backup-first',
      'rollback',
      'Default runtime source remains localStorage.',
      'Failed migration must leave localStorage intact.',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('states no implementation and recommends Task 5.2', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'This is not source-of-truth migration implementation.',
      'This does not modify `App.tsx`.',
      'This does not replace localStorage.',
      'This does not implement API-backed runtime.',
      'This does not add production backend, auth, sync, cloud, deployment, or monitoring.',
      'Task 5.2 AppData Ownership Matrix V1',
      'Task 5.2 must be docs/static tests only.',
    ]) {
      expect(doc).toContain(expected);
    }

    expect(doc).not.toMatch(/replace localStorage now/i);
    expect(doc).not.toMatch(/make API source of truth now/i);
  });
});

