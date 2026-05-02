import { describe, expect, it } from 'vitest';
import { dismissCoachActionToday } from '../src/engines/coachActionDismissEngine';
import type { CoachAction } from '../src/engines/coachActionEngine';
import { buildEnginePipeline } from '../src/engines/enginePipeline';
import { buildE1RMProfile } from '../src/engines/e1rmEngine';
import { buildEffectiveVolumeSummary } from '../src/engines/effectiveSetEngine';
import { isIncompleteSet, sessionCompletedSets, sessionVolume } from '../src/engines/engineUtils';
import { getCurrentFocusStep, switchFocusExercise } from '../src/engines/focusModeStateEngine';
import type { DailyTrainingAdjustment } from '../src/engines/dailyTrainingAdjustmentEngine';
import { applySessionPatches, buildSessionPatchesFromDailyAdjustment, revertSessionPatches } from '../src/engines/sessionPatchEngine';
import { buildSessionQualityResult } from '../src/engines/sessionQualityEngine';
import { buildIncompleteMainWorkGuard, finalizeTrainingSession } from '../src/engines/trainingCompletionEngine';
import { dispatchWorkoutExecutionEvent } from '../src/engines/workoutExecutionStateMachine';
import { makeAppData } from './fixtures';
import { makeExercise, makeFocusSession } from './focusModeFixtures';

const makeAction = (overrides: Partial<CoachAction> = {}): CoachAction => ({
  id: overrides.id || 'action-review-volume',
  title: overrides.title || '查看训练量建议',
  description: overrides.description || '打开对应建议位置，不会自动修改数据。',
  source: overrides.source || 'volumeAdaptation',
  actionType: overrides.actionType || 'review_volume',
  priority: overrides.priority || 'medium',
  status: overrides.status || 'pending',
  requiresConfirmation: overrides.requiresConfirmation ?? false,
  reversible: overrides.reversible ?? false,
  createdAt: overrides.createdAt || '2026-05-01T10:00:00.000Z',
  targetId: overrides.targetId || 'back',
  targetType: overrides.targetType || 'muscle',
  reason: overrides.reason || '训练量建议需要查看。',
  sourceFingerprint: overrides.sourceFingerprint,
});

const conservativeAdjustment: DailyTrainingAdjustment = {
  type: 'conservative',
  title: '本次保守训练',
  summary: '只影响本次训练。',
  reasons: ['今天状态一般，建议降低强度。'],
  suggestedChanges: [{ type: 'reduce_volume', reason: '减少本次训练量，不改原计划。' }],
  confidence: 'medium',
  requiresUserConfirmation: true,
};

describe('operation state link regression', () => {
  it('hides a dismissed CoachAction today without deleting the original action source', () => {
    const first = makeAction({ id: 'action-one', targetId: 'back' });
    const second = makeAction({ id: 'action-two', targetId: 'legs' });
    const sourceActions = [first, second];
    const data = makeAppData({
      dismissedCoachActions: [dismissCoachActionToday(first.id, '2026-05-01T12:00:00.000Z')],
    });

    const todayPipeline = buildEnginePipeline(data, '2026-05-01', { coachActions: sourceActions });
    const tomorrowPipeline = buildEnginePipeline(data, '2026-05-02', { coachActions: sourceActions });

    expect(sourceActions).toHaveLength(2);
    expect(todayPipeline.visibleCoachActions.map((action) => action.id)).toEqual([second.id]);
    expect(tomorrowPipeline.visibleCoachActions.map((action) => action.id)).toEqual([first.id, second.id]);
    expect(JSON.stringify(todayPipeline.visibleCoachActions)).not.toMatch(/\b(undefined|null)\b/);
  });

  it('applies a temporary session patch as real session state and reverts from its snapshot', () => {
    const session = makeFocusSession([makeExercise('lat-pulldown', 2), makeExercise('seated-row', 2)]);
    const patches = buildSessionPatchesFromDailyAdjustment(conservativeAdjustment);

    const applied = applySessionPatches(session, patches);
    const appliedAgain = applySessionPatches(applied.session, patches);
    const reverted = revertSessionPatches(applied.session, patches.map((patch) => patch.id));

    expect(patches.length).toBeGreaterThan(0);
    expect(applied.appliedPatches).toHaveLength(patches.length);
    expect(applied.session.appliedCoachActions?.map((patch) => patch.id)).toEqual(patches.map((patch) => patch.id));
    expect(applied.session.adjustmentType).toBe('temporary_session_patch');
    expect(applied.session.adjustmentNotes?.length).toBeGreaterThan(0);
    expect(appliedAgain.appliedPatches).toHaveLength(0);
    expect(appliedAgain.warnings.join(' ')).toMatch(/重复|重複|duplicate/i);
    expect(reverted.session.appliedCoachActions || []).toEqual([]);
    expect(reverted.session.adjustmentType).toBeUndefined();
  });

  it('completes the manually selected Focus step instead of jumping back to the first incomplete exercise', () => {
    const switched = switchFocusExercise(
      makeFocusSession([
        makeExercise('bench-press', 2),
        makeExercise('incline-db-press', 2),
        makeExercise('shoulder-press', 1),
      ]),
      1,
    );
    const current = getCurrentFocusStep(switched);

    const result = dispatchWorkoutExecutionEvent(switched, {
      type: 'COMPLETE_STEP',
      exerciseIndex: 1,
      expectedStepId: current.id,
      completedAt: '2026-05-01T10:00:00.000Z',
      nowMs: Date.parse('2026-05-01T10:00:00.000Z'),
    });

    expect(current.exerciseId).toBe('incline-db-press');
    expect(result.updatedSession.exercises[0].sets[0].done).toBe(false);
    expect(result.updatedSession.exercises[1].sets[0].done).toBe(true);
    expect(getCurrentFocusStep(result.updatedSession).exerciseId).toBe('incline-db-press');
    expect(getCurrentFocusStep(result.updatedSession).setIndex).toBe(1);
  });

  it('keeps done=false draft sets visible but out of completion, volume, e1RM, effective set, and quality metrics', () => {
    const session = makeFocusSession([makeExercise('assisted-pull-up', 2, 2), makeExercise('face-pull', 2, 0)]);
    const guard = buildIncompleteMainWorkGuard(session);
    const finished = finalizeTrainingSession(session, '2026-05-01T11:00:00.000Z', { endedEarly: true });
    const unfinishedExercise = finished.exercises.find((exercise) => exercise.id === 'face-pull');
    const effective = buildEffectiveVolumeSummary([finished]);
    const quality = buildSessionQualityResult({ session: finished, effectiveSetSummary: effective });

    expect(guard.hasIncompleteMainWork).toBe(true);
    expect(finished.completed).toBe(true);
    expect(finished.earlyEndReason).toBe('incomplete_main_work');
    expect(unfinishedExercise?.completionStatus).toBe('not_started');
    expect((unfinishedExercise?.sets || []).every((set) => isIncompleteSet(set))).toBe(true);
    expect(sessionCompletedSets(finished)).toBe(2);
    expect(sessionVolume(finished)).toBe(800);
    expect(effective.completedSets).toBe(2);
    expect(buildE1RMProfile([finished], 'face-pull').best).toBeUndefined();
    expect(quality.summary).toMatch(/未完成|完成率|正式/);
    expect(JSON.stringify({ finished, effective, quality })).not.toMatch(/\bundefined|null\b/);
  });
});
