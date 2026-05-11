import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

const plan = () => readSource('docs/ACTIVE_SESSION_MUTATION_READINESS_RECOVERY_PLAN.md');

const requiredRisks = [
  'active session data loss',
  'duplicate active sessions',
  'duplicate history completion',
  'stale patch corruption',
  'unsaved discard',
  'offline ambiguity',
  'source-of-truth divergence',
  'training metric drift',
  'route expansion',
  'production exposure',
  'user confusion',
];

const requiredGates = [
  'Active-session source snapshot strategy completed.',
  'Duplicate start, patch, complete, and discard behavior documented.',
  'Patch sequencing and idempotency documented.',
  'Unsaved session failure and recovery documented.',
  'Offline/PWA behavior documented.',
  'Confirmation UX planned.',
  'Rollback and recovery UX planned.',
  'Manual acceptance runbook planned.',
  'Browser route allowlist updated only in an explicit future prototype with user approval.',
  'Browser build clean.',
];

describe('active-session mutation recovery gates', () => {
  it('documents the required future gates before any active-session prototype', () => {
    const doc = plan();

    for (const gate of requiredGates) {
      expect(doc).toContain(gate);
    }
  });

  it('records the required risks in the decision record', () => {
    const doc = plan();

    for (const risk of requiredRisks) {
      expect(doc).toContain(risk);
    }
  });

  it('keeps no-fake-success and localStorage integrity strict', () => {
    const doc = plan();

    for (const expected of [
      'HTTP success is required.',
      '`result.ok === true` is required.',
      '`result.changed === true` is required.',
      '`result.status === "success"` is required.',
      'Snapshot metadata is required.',
      'Failure must not write localStorage.',
      'Failure must not mutate AppData.',
      'localStorage remains the active App source of truth during offline or failed API states.',
      'API results never overwrite AppData or localStorage.',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('keeps destructive recovery, reset, import/export, and repair controls blocked', () => {
    const doc = plan();

    for (const expected of [
      'Recovery must not expose browser reset/recovery/import/export/apply/fix controls.',
      'Recovery must not dump raw AppData or localStorage.',
      'No DataHealth repair, backup/import/export, reset/recovery, production backend, auth, sync, or source-of-truth migration.',
      'No automatic next task is approved by Task 4.56.',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
