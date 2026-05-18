import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('phase 15 stabilization archive', () => {
  const doc = () => readSource('docs/PHASE15_STABILIZATION_ARCHIVE.md');

  it('records Task 15D identity and Phase 15 baseline', () => {
    const content = doc();

    for (const expected of [
      'Task 15D',
      'Phase 15 Stabilization Archive',
      'Docs/static tests only',
      'Phase 15 completion archive',
      'Phase 14 was already complete.',
      'Phase 15 includes Tasks 15A, 15B, and 15C.',
      'Task 15D archives Phase 15 and does not start Phase 16.',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('records Task 15A evidence and deliverables', () => {
    const content = doc();

    for (const expected of [
      'Task 15A — First Week Personal Production Usage Runbook',
      'PR #252',
      '975d6ee80fe7e6cea115d5af4ab8f674372fc639',
      '1049 files / 4193 tests',
      'dist token scan clean',
      'docs/FIRST_WEEK_PERSONAL_PRODUCTION_USAGE_RUNBOOK.md',
      'tests/firstWeekPersonalProductionUsageRunbook.test.ts',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('records Task 15B evidence helper and deliverables', () => {
    const content = doc();

    for (const expected of [
      'Task 15B — Real-World Failure / Recovery Hardening',
      'PR #253',
      'bdbed6b1d8f80a15e4b8e9ed4e0c3aa9b109c9cb',
      '1051 files / 4214 tests',
      'docs/REAL_WORLD_FAILURE_RECOVERY_HARDENING.md',
      'src/cloudProduction/realWorldFailureRecoveryHardening.ts',
      'tests/realWorldFailureRecoveryHardening.test.ts',
      'tests/realWorldFailureRecoveryHardeningDocs.test.ts',
      'The recovery helper is pure and only recommends recovery actions.',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('records Task 15C evidence panel and deliverables', () => {
    const content = doc();

    for (const expected of [
      'Task 15C — UX Cleanup for Production Candidate Controls',
      'PR #254',
      '103b11c2cbcc31da75b73f197ad276cd68438ae1',
      '1054 files / 4232 tests',
      'docs/PRODUCTION_CANDIDATE_CONTROLS_UX_CLEANUP.md',
      'src/cloudProduction/productionCandidateControlCopy.ts',
      'src/cloudProduction/ProductionCandidateControlPanel.tsx',
      'tests/productionCandidateControlCopy.test.ts',
      'tests/productionCandidateControlPanel.test.ts',
      'tests/productionCandidateControlsUxCleanupDocs.test.ts',
      'The control panel is presentational and does not change source-of-truth behavior.',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('confirms Phase 15 completion results and personal production candidate readiness', () => {
    const content = doc();

    for (const expected of [
      'First-week personal production usage runbook exists.',
      'Real-world failure/recovery hardening exists.',
      'Pure recovery recommendation helper exists.',
      'Production candidate control copy/helper exists.',
      'Presentational production candidate control panel exists.',
      'Personal production candidate controls are clearer.',
      'Phase 15 stabilization is complete after Task 15D merge.',
      'Owner-only personal production candidate usage.',
      'Manual Supabase project verification.',
      'Manual auth callback verification.',
      'Manual cloud pull rehearsal.',
      'Manual cloud push rehearsal.',
      'Manual rollback / kill switch rehearsal.',
      'Emergency local restore rehearsal.',
      'localStorage-primary daily use.',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('preserves safety boundaries', () => {
    const content = doc();

    for (const expected of [
      'localStorage remains default / fallback / migration / emergency.',
      'backend/cloud candidate remains explicit opt-in and reversible.',
      'cloud pull does not auto-apply.',
      'cloud push requires manual confirmation.',
      'conflict resolution remains manual.',
      'rollback / kill switch remains available.',
      'emergency local mode remains available.',
      'api-primary-dev remains dev/local only and not production-ready.',
      'devApiRunner is not production backend.',
      'service role key must never enter browser.',
      'accepted browser mutation routes remain exactly seven.',
      'no new package/dependency/script/lockfile drift beyond Phase 12 authorized `@supabase/supabase-js`.',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('documents accepted browser mutation routes and blocked route families', () => {
    const content = doc();

    for (const expected of [
      '1. `POST /data-health/issues/:issueId/dismiss`',
      '2. `POST /history/:id/data-flag`',
      '3. `POST /history/:id/edit`',
      '4. `POST /sessions/start`',
      '5. `POST /sessions/active/patches`',
      '6. `POST /sessions/active/complete`',
      '7. `POST /sessions/active/discard`',
      'No eighth browser mutation route was added.',
      '`POST /data-health/repair/apply` remains blocked.',
      'backup/import/export over HTTP remains blocked.',
      'reset/recovery over HTTP remains blocked.',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('records remaining risks and Phase 16 recommendation', () => {
    const content = doc();

    for (const expected of [
      'Real Supabase project has not been connected by automated tests.',
      'Real auth callback has not been verified by automated tests.',
      'Real personal training data is not used in automated tests.',
      'Cloud pull/push are still manual candidate flows.',
      'Production deployment is not live.',
      'External monitoring upload is not active.',
      'SaaS/multi-user commercial readiness is not complete.',
      'User still needs manual first-week usage discipline.',
      'Recommended next phase: Phase 16 — Productization Decision.',
      'Recommended next task: Task 16A — Personal-Only vs SaaS Product Decision.',
      'Phase 16 is not started.',
    ]) {
      expect(content).toContain(expected);
    }
  });
});
