import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readSource, repoRoot } from './runtimeBoundaryTestHelpers';

const planPath = 'docs/ACTIVE_SESSION_SOURCE_SNAPSHOT_IDEMPOTENCY_PLAN.md';
const readPlan = () => readSource(planPath);

describe('active-session source snapshot and idempotency plan', () => {
  it('exists and contains the required sections', () => {
    expect(existsSync(resolve(repoRoot(), planPath))).toBe(true);
    const plan = readPlan();

    for (const section of [
      '## Scope / Non-goals',
      '## Current Route Baseline',
      '## Required Metadata Fields',
      '## Source Snapshot Inputs',
      '## Target Identity',
      '## Idempotency Strategy',
      '## Conflict Detection',
      '## No Auto-merge / Source-of-truth Boundary',
      '## No-fake-success Contract',
      '## Duplicate Patch / Complete / Discard Risks',
      '## Required Gates Before Session Start Prototype',
      '## Decision',
      '## Final Recommendation',
    ]) {
      expect(plan).toContain(section);
    }
  });

  it('defines required metadata and target identity fields', () => {
    const plan = readPlan();

    for (const expected of [
      '`sourceSnapshotHash`',
      '`sourceSnapshotVersion`',
      '`mutationId`',
      '`idempotencyKey`',
      '`requestFingerprint`',
      'activeSession presence and activeSession id',
      'activeProgramTemplateId',
      'selectedTemplateId',
      'target template id',
      'pending session patch ids',
      '`templateId` is required',
      '`planTemplateId`',
      '`sessionStartTargetId`',
    ]) {
      expect(plan).toContain(expected);
    }
  });

  it('locks duplicate prevention, conflict detection, no auto-merge, and no-fake-success', () => {
    const plan = readPlan();

    for (const expected of [
      'Duplicate click while pending must send exactly one request.',
      'Retry after failure must require explicit user action and a fresh confirmation.',
      'No automatic retry is allowed.',
      'No optimistic success is allowed.',
      'Missing source snapshot metadata is failure.',
      'Existing local activeSession before session start is conflict.',
      'No auto-merge is allowed.',
      'API snapshots are not merged into AppData.',
      'API result data is not written to localStorage.',
      'localStorage remains source of truth.',
      'HTTP 2xx',
      '`result.ok === true`',
      '`result.changed === true`',
      '`result.status === "success"`',
      'snapshot metadata exists',
    ]) {
      expect(plan).toContain(expected);
    }
  });

  it('keeps active-session routes unimplemented and recommends Task 4.58', () => {
    const plan = readPlan();

    expect(plan).toContain('This does not implement `POST /sessions/start`.');
    expect(plan).toContain('This does not implement `POST /sessions/active/patches`.');
    expect(plan).toContain('This does not implement `POST /sessions/active/complete`.');
    expect(plan).toContain('This does not implement `POST /sessions/active/discard`.');
    expect(plan).toContain('The next recommended task is `Task 4.58 Active Session UX Confirmation & Rollback Plan V1`');
  });
});
