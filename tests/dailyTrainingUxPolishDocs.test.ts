import { describe, expect, it } from 'vitest';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('daily training UX polish docs', () => {
  const doc = () => readSource('docs/DAILY_TRAINING_UX_POLISH_PACK.md');

  it('records Task 16D identity and Task 16C baseline evidence', () => {
    const content = doc();

    for (const expected of [
      'Task 16D',
      'Daily Training UX Polish Pack V1',
      'Task 16C complete',
      'PR #258',
      '99343a165e21ca12512664eb71161adfcd38f338',
      '1064 files / 4300 tests',
      'dist token scan clean',
      'SaaS remains deferred',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('documents non-goals and safety baseline', () => {
    const content = doc();

    for (const expected of [
      'change source-of-truth behavior.',
      'change training algorithms.',
      'modify PR/e1RM/effective-set logic.',
      'enable default cloud sync.',
      'enable background sync.',
      'add routes.',
      'add POST /data-health/repair/apply.',
      'localStorage remains default / fallback / migration / emergency.',
      'backend/cloud candidate remains explicit opt-in and reversible.',
      'cloud pull does not auto-apply.',
      'cloud push requires manual confirmation.',
      'accepted browser mutation routes remain exactly seven.',
      'personal-only direction remains active.',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('documents the daily state copy table and owner checklist', () => {
    const content = doc();

    for (const expected of [
      'local_first_ready',
      'no_active_session',
      'active_session_in_progress',
      'session_ready_to_complete',
      'session_completed',
      'session_discarded',
      'interrupted_unfinished_session',
      'recent_history_available',
      'empty_history',
      'local_data_unavailable',
      'backup_recommended_before_risky_action',
      'emergency_local_available',
      'cloud_candidate_paused',
      'source_of_truth_unclear',
      'owner_action_required',
      'recovery_action_recommended',
      'confirm app opens in local-first mode.',
      'before completion, review sets, weights, notes, and pain flags.',
      'after completion, confirm the session appears in local history.',
    ]) {
      expect(content).toContain(expected);
    }
  });

  it('documents error empty state policy and Task 16E recommendation without starting it', () => {
    const content = doc();

    for (const expected of [
      'Empty history should say whether this might be a new install, missing local data, or source-of-truth uncertainty.',
      'Local data unavailable should tell the owner to stop risky operations and inspect recovery.',
      'No error copy should imply public SaaS launch, automatic cloud behavior, or background sync.',
      'Task 16E — Data Health & Diagnostics Clarity Pack V1',
      'Task 16E is recommended but not started by Task 16D.',
      'Task 16D does not start Task 16E.',
    ]) {
      expect(content).toContain(expected);
    }
  });
});
