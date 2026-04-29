import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { CoachActionType } from '../src/engines/coachActionEngine';

const source = () => readFileSync('src/App.tsx', 'utf8');

const actionTypes: CoachActionType[] = [
  'apply_temporary_session_adjustment',
  'create_plan_adjustment_preview',
  'open_record_detail',
  'open_data_health',
  'open_replacement_sheet',
  'review_volume',
  'review_exercise',
  'review_session',
  'open_next_workout',
  'dismiss',
  'keep_observing',
];

describe('coach action execution', () => {
  it('defines explicit execution result handling for CoachAction clicks', () => {
    const app = source();

    expect(app).toContain('CoachActionExecutionResult');
    expect(app).toContain('showCoachActionResult');
    expect(app).toContain('toastToneForCoachActionResult');
    expect(app).toContain("status: 'success'");
    expect(app).toContain("status: 'needs_more_data'");
    expect(app).toContain("status: 'failed'");
  });

  it('creates a real adjustment draft instead of only opening Plan', () => {
    const app = source();

    expect(app).toContain('createPlanAdjustmentDraftFromCoachAction');
    expect(app).toContain('createAdjustmentDraftFromRecommendations');
    expect(app).toContain("programAdjustmentDrafts: [draft");
    expect(app).toContain("section: 'adjustment_drafts'");
    expect(app).toContain('已生成调整草案，应用前请确认。');
    expect(app).not.toContain('已打开计划页；这里只引导生成草案');
  });

  it('routes review_volume to the visible volume adaptation target', () => {
    const app = source();

    expect(app).toContain("action.actionType === 'review_volume'");
    expect(app).toContain("section: 'volume_adaptation'");
    expect(app).toContain("muscleId: action.targetType === 'muscle' ? action.targetId : undefined");
    expect(app).toContain('已打开训练量建议');
  });

  it('keeps every CoachAction type on an observable path', () => {
    const app = source();

    actionTypes.forEach((actionType) => {
      expect(app).toContain(actionType);
    });
    expect(app).not.toContain('console.log(action');
  });
});
