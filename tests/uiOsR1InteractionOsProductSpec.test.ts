import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const docPath = 'docs/UI_OS_R1_INTERACTION_OS_PRODUCT_SPEC.md';
const doc = readFileSync(docPath, 'utf8');

describe('UI-OS R1 Interaction OS product spec', () => {
  it('exists and records identity baseline and failed product acceptance', () => {
    expect(existsSync(docPath)).toBe(true);
    for (const expected of [
      'Task UI-OS R1',
      'Interaction OS Product Spec',
      'docs/static tests only',
      'product specification only',
      'PR #279',
      '79cddfc05efa67861712efcf982dcdb817a29949',
      '1112 files / 4540 tests',
      'dist token scan clean',
      'product acceptance failed',
      'partial visual reskin',
      'corrective UI-OS R phase',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('captures the user answers as product requirements', () => {
    for (const expected of [
      'what to train today first',
      'whether to train today, what to train, and recovery/fatigue status',
      'start today training',
      'current exercise, current set',
      'ABG',
      'Correction / mobility / corrective tasks may be skipped',
      'formal working set count',
      'should not show `完成一组`',
      'one dominant primary action',
      '`复制上组`, `标记不适`, `替代动作`',
      'End workout requires second confirmation',
      '45 lb × 10',
      'Theoretical weight should not be primary',
      'collapsed by default',
      'R8.6 later explicitly authorized filling actionable weight plus planned reps',
      'bottom sheet / modal flow',
      'calendar training frequency',
      'which days were trained and not trained',
      'PR/e1RM access',
      'Data Health should not frequently interrupt training',
      'Whoop / Athlytic',
      'Apple Health',
      'light and dark theme',
      'system theme',
      'full component system + operation state machine + all pages',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('defines all required interaction state groups', () => {
    for (const expected of [
      'Session states',
      '`no_session`',
      '`planned_session_ready`',
      '`active_session`',
      '`unfinished_session`',
      '`session_complete`',
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
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('defines the primary action map and completion constraints', () => {
    for (const expected of [
      '`no_session` | 开始今天训练',
      '`planned_session_ready` | 开始训练',
      '`unfinished_session` | 继续训练',
      '`correction_set` | 完成纠偏',
      '`mobility_task` | 完成动作',
      '`skipped_exercise` | 确认跳过',
      '`skip_pending` | 确认跳过 / 继续训练',
      '`discomfort_flagged` | 选择处理方式',
      '`source_unclear` | 回到本地模式',
      '`session_complete` | 完成训练',
      '`session_end_requested` | 二次确认结束训练',
      '`完成一组` must not be primary in skip/correction/mobility states',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('documents page requirements theme surface safe area and roadmap', () => {
    for (const expected of [
      'Focus Mode hides bottom nav',
      'Actual record input opens through bottom sheet / modal',
      'Today decision surface',
      'History must prioritize',
      'calendar training frequency',
      'Progress should follow',
      'Settings owns',
      'High-risk features should not crowd training flow',
      'Light theme',
      'Dark theme',
      'System theme',
      '`dark_glass_card`',
      '`light_health_card`',
      '`training_hero_card`',
      '`bottom_sheet`',
      '`modal_confirmation`',
      '`safety_strip`',
      'Scroll container uses bottom scroll-padding only; visible filler must not create a dark footer block',
      'Bottom nav may auto-hide near page bottom so final rows stay tappable',
      'Data Health should not frequently interrupt training',
      'UI-OS R2 — Focus Mode Interaction State Machine Rewrite V1',
      'UI-OS R3 — Today Decision Surface Rewrite V1',
      'UI-OS R4 — History Calendar & PR/e1RM Rewrite V1',
      'UI-OS R5 — Progress / Data Health Clarity Rewrite V1',
      'UI-OS R6 — Settings / Safety / Theme / Equipment Profile Rewrite V1',
      'UI-OS R7 — Mobile Safe Area / Component State Regression Lock V1',
      'UI-OS R8 — Interaction OS Remediation Archive V1',
      'UI-OS R2 is recommended next',
      'UI-OS R2 is not started by R1',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
