import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readSource, repoRoot } from './runtimeBoundaryTestHelpers';

const planPath = 'docs/ACTIVE_SESSION_MUTATION_READINESS_RECOVERY_PLAN.md';

const readPlan = () => readSource(planPath);

const requiredSections = [
  '## Scope / Non-goals',
  '## Current Three-route Baseline',
  '## Candidate Session Routes',
  '## Active Session Risk Model',
  '## Source Snapshot Strategy',
  '## Idempotency And Duplicate-submit Strategy',
  '## Patch Sequencing And Conflict Strategy',
  '## Offline / PWA Failure Strategy',
  '## Recovery / Rollback Strategy',
  '## Confirmation UX Requirements',
  '## No-fake-success Requirements',
  '## ReadMirror / Data Semantics Impact',
  '## Manual Acceptance Plan Requirements',
  '## Required Gates Before Any Active-session Prototype',
  '## Decision',
  '## Decision Record',
  '## Final Recommendation',
];

describe('active-session mutation readiness and recovery plan', () => {
  it('exists and contains all required sections', () => {
    expect(existsSync(resolve(repoRoot(), planPath))).toBe(true);
    const plan = readPlan();

    for (const section of requiredSections) {
      expect(plan).toContain(section);
    }
  });

  it('states planning-only and runtime boundaries', () => {
    const plan = readPlan();

    for (const expected of [
      'This is planning-only.',
      'This is not an active-session mutation implementation.',
      'This does not implement `POST /sessions/start`.',
      'This does not implement `POST /sessions/active/patches`.',
      'This does not implement `POST /sessions/active/complete`.',
      'This does not implement `POST /sessions/active/discard`.',
      'This does not add a fourth browser mutation route.',
      'This does not modify App.tsx.',
      'This does not modify src/devApi runtime behavior.',
      'This does not add App.tsx mutation integration.',
      'This does not add a frontend mutation client.',
      'This does not replace localStorage.',
      'This does not switch source of truth.',
      'This does not add offline mutation queue.',
      'This does not add production backend, auth, sync, or deployment.',
      'This does not add a dependency, lockfile change, package script, normalized table, storage adapter, schema change, or training algorithm change.',
    ]) {
      expect(plan).toContain(expected);
    }
  });

  it('keeps the three-route baseline and session routes blocked', () => {
    const plan = readPlan();

    for (const expected of [
      '`POST /data-health/issues/:issueId/dismiss`',
      '`POST /history/:id/data-flag`',
      '`POST /history/:id/edit`',
      'No other browser mutation route is accepted.',
      'No session mutation route is exposed from browser code.',
      'No DataHealth repair, backup/import/export, reset/recovery, source-of-truth migration, or broad mutation client is exposed from browser code.',
      '| Session start | `POST /sessions/start` | Planning-only, blocked from browser runtime |',
      '| Session patch | `POST /sessions/active/patches` | Planning-only, blocked from browser runtime |',
      '| Session complete | `POST /sessions/active/complete` | Planning-only, blocked from browser runtime |',
      '| Session discard | `POST /sessions/active/discard` | Planning-only, blocked from browser runtime |',
    ]) {
      expect(plan).toContain(expected);
    }
  });

  it('defines recovery, idempotency, offline, source snapshot, and discard/complete safety requirements', () => {
    const plan = readPlan();

    for (const expected of [
      'Capture a local AppData source fingerprint before a request is sent.',
      'Reject mutation success when the source fingerprint is missing.',
      'Treat source snapshot mismatch as visible failure, not success.',
      'Never merge API snapshot data into AppData.',
      'Never store API snapshot metadata in localStorage.',
      'Session start needs an idempotency key',
      'Session complete needs an idempotency key',
      'Session discard needs a discard operation id',
      'Pending state must disable duplicate submit.',
      'No automatic retry is allowed.',
      'Patch order must be explicit.',
      'Patch application must reject stale sequence numbers.',
      'No offline mutation queue exists.',
      'API unavailable must show failure, not success.',
      'Session complete failure must define how to verify whether history was written.',
      'Session discard failure must define how to preserve or inspect unsaved local state.',
    ]) {
      expect(plan).toContain(expected);
    }
  });

  it('locks no-fake-success, data semantics, manual acceptance, and no automatic next task', () => {
    const plan = readPlan();

    for (const expected of [
      'HTTP success is required.',
      '`result.ok === true` is required.',
      '`result.changed === true` is required.',
      '`result.status === "success"` is required.',
      'Snapshot metadata is required.',
      'Missing snapshot metadata is failure.',
      'PR, e1RM, effectiveSet, and weighted effectiveSet rules remain unchanged by Task 4.56.',
      '`actualWeightKg` remains the trusted calculation source.',
      'localStorage integrity',
      'AppData non-overwrite behavior',
      'No automatic next task is approved by Task 4.56.',
      'No active-session mutation is implemented.',
      'No fourth mutation route is implemented.',
    ]) {
      expect(plan).toContain(expected);
    }
  });
});
