import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const docPath = 'docs/UI_OS_R2_FOCUS_MODE_INTERACTION_STATE_MACHINE_REWRITE.md';
const doc = readFileSync(docPath, 'utf8');

describe('UI-OS R2 Focus Mode interaction state machine docs', () => {
  it('exists and records R0/R1 baseline evidence', () => {
    expect(existsSync(docPath)).toBe(true);
    for (const expected of [
      'UI-OS R2',
      'Focus Mode Interaction State Machine Rewrite V1',
      'implementation task',
      'UI-OS R0 complete',
      'PR #281',
      '567391baa0dde17aa6bc901e6d3bed871b5d5e58',
      '1116 files / 4558 tests',
      'dist token scan clean',
      'R0 extracted production-safe v0 design system components',
      'UI-OS R1 complete',
      'PR #280',
      '5136de81f417d19804a80ff579dd31787e69c085',
      'R1 converted user answers into the corrective Interaction OS product spec',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('documents the problem R2 fixes and what was added', () => {
    for (const expected of [
      'partial reskin problem',
      'Old logic allowed inappropriate primary actions',
      'Correction / skip states must not show `完成一组`',
      'Bottom nav must not compete with Focus Mode',
      'Actual record input should be controlled through bottom sheet/modal flow',
      'one dominant primary action',
      'Focus Mode interaction state model',
      'deterministic primary action resolver',
      'Focus action bar',
      'Actual record bottom sheet',
      'R8.6 supersedes this by applying feasible equipment-aware weight plus planned reps',
      'End-workout second confirmation',
      'Production UI-OS components from R0',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('documents all required state model groups and primary actions', () => {
    for (const expected of [
      'Session states',
      '`no_session`',
      '`planned_session_ready`',
      '`active_session`',
      '`unfinished_session`',
      '`session_complete`',
      '`session_end_requested`',
      '`recovery_required`',
      'Exercise states',
      '`exercise_ready`',
      '`active_exercise`',
      '`substituted_exercise`',
      '`correction_exercise`',
      '`mobility_exercise`',
      '`skipped_exercise`',
      '`discomfort_flagged`',
      'Set states',
      '`warmup_set`',
      '`working_set`',
      '`correction_set`',
      '`mobility_task`',
      '`pending_actual_input`',
      '`suggestion_applied`',
      '`ready_to_complete`',
      '`completed`',
      '`skipped`',
      '`blocked`',
      'Recommendation states',
      '`feasible_load_ready`',
      '`theoretical_only`',
      '`equipment_unknown`',
      '`manual_confirmation_required`',
      '`not_applicable`',
      'Safety states',
      '`local_ok`',
      '`backup_recommended`',
      '`source_unclear`',
      '`emergency_local_available`',
      '`cloud_candidate_paused`',
      '`no_session` | 开始今天训练',
      '`planned_session_ready` | 开始训练',
      '`unfinished_session` | 继续训练',
      '`correction_set` | 完成纠偏',
      '`mobility_task` | 完成动作',
      '`skipped_exercise` | 确认跳过',
      '`source_unclear` | 回到本地模式',
      '`session_end_requested` | 确认结束训练',
      '`完成一组` must not be primary in skip/correction/mobility states',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('documents Focus behavior and next task boundaries', () => {
    for (const expected of [
      'Focus Mode hides bottom nav',
      'Normal pages keep bottom nav',
      'Secondary actions remain available but visually secondary',
      'Actual record input opens through bottom sheet / modal flow',
      '`套用建议` fills weight only in R2; R8.6 later fills actionable weight plus planned reps',
      '`套用建议` uses feasible equipment-aware load when available',
      '`套用建议` does not auto-fill reps in R2; R8.6 explicitly authorizes planned reps for the active draft',
      '`套用建议` does not auto-fill RIR',
      'Equipment-aware prescription remains primary',
      'Bench Press theoretical 17 lb still resolves to empty Olympic bar / feasible 45 lb',
      'UI-OS R3 — Today Decision Surface Rewrite V1 is recommended next',
      'UI-OS R3 is not started by R2',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
