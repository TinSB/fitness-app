import { describe, expect, it } from 'vitest';
import { buildPrs } from '../src/engines/analytics';
import { buildEffectiveVolumeSummary } from '../src/engines/effectiveSetEngine';
import { buildE1RMProfile } from '../src/engines/e1rmEngine';
import {
  adjustFocusSetValue,
  applySuggestedFocusStep,
  completeFocusSet,
  completeFocusSupportStep,
  copyPreviousFocusActualDraft,
  getActualSetDraft,
  getCurrentFocusStep,
  isFocusSessionComplete,
  updateFocusActualDraft,
} from '../src/engines/focusModeStateEngine';
import { applyExerciseReplacement } from '../src/engines/replacementEngine';
import { getRestTimerRemainingSec } from '../src/engines/restTimerEngine';
import { deleteTrainingSession, markSessionDataFlag } from '../src/engines/sessionHistoryEngine';
import { buildTrainingCalendar } from '../src/engines/trainingCalendarEngine';
import { completeTrainingSessionIntoHistory } from '../src/engines/trainingCompletionEngine';
import { parseDisplayWeightToKg } from '../src/engines/unitConversionEngine';
import type { AppData, TrainingSession, TrainingSetLog } from '../src/models/training-model';
import { emptyData, sanitizeData } from '../src/storage/persistence';
import { attachSupportBlocks, makeExercise, makeFocusSession } from './focusModeFixtures';

const setsOf = (session: TrainingSession, exerciseIndex = 0) => session.exercises[exerciseIndex].sets as TrainingSetLog[];

const completeCurrentSupport = (session: TrainingSession, iso: string, ms: number) => {
  const step = getCurrentFocusStep(session);
  const result = completeFocusSupportStep(session, iso, ms, step.id);
  expect(result).not.toBeNull();
  return result?.session as TrainingSession;
};

const completeCurrentMainSet = (session: TrainingSession, exerciseIndex: number, iso: string, ms: number) => {
  const step = getCurrentFocusStep(session);
  const result = completeFocusSet(session, exerciseIndex, iso, ms, step.id);
  expect(result).not.toBeNull();
  return result?.session as TrainingSession;
};

describe('workout execution flow integration', () => {
  it('runs the gym execution chain from active session through history, calendar, and cleanup', () => {
    let session: TrainingSession = attachSupportBlocks(
      makeFocusSession([
        makeExercise('bench-press', 2, 0, 2),
        makeExercise('seated-row', 1, 0, 0),
      ])
    );
    session = {
      ...session,
      id: 'session-workout-flow',
      date: '2026-04-27',
      startedAt: '2026-04-27T10:00:00-04:00',
      programTemplateId: 'push-a',
      programTemplateName: 'Push A',
      isExperimentalTemplate: false,
      dataFlag: 'normal',
    };

    expect(session.id).toBeTruthy();
    expect(session.startedAt).toBeTruthy();
    expect(session.programTemplateId).toBe('push-a');
    expect(getCurrentFocusStep(session).stepType).toBe('correction');

    session = completeCurrentSupport(session, '2026-04-27T10:01:00-04:00', Date.parse('2026-04-27T10:01:00-04:00'));
    session = completeCurrentSupport(session, '2026-04-27T10:02:00-04:00', Date.parse('2026-04-27T10:02:00-04:00'));
    expect(session.supportExerciseLogs?.find((log) => log.blockType === 'correction')?.completedSets).toBe(2);
    expect(getCurrentFocusStep(session).id).toBe('main:bench-press:warmup:0');

    session = applyExerciseReplacement(session, 0, 'db-bench-press');
    expect(session.exercises[0].originalExerciseId).toBe('bench-press');
    expect(session.exercises[0].actualExerciseId).toBe('db-bench-press');
    expect(session.exercises[0].replacementExerciseId).toBe('db-bench-press');
    expect(session.exercises[0].sameTemplateSlot).toBe(true);
    expect(getCurrentFocusStep(session).id).toBe('main:db-bench-press:warmup:0');

    session = applySuggestedFocusStep(session, 0);
    session = completeCurrentMainSet(session, 0, '2026-04-27T10:03:00-04:00', Date.parse('2026-04-27T10:03:00-04:00'));
    expect(getCurrentFocusStep(session).id).toBe('main:db-bench-press:warmup:1');

    session = applySuggestedFocusStep(session, 0);
    session = completeCurrentMainSet(session, 0, '2026-04-27T10:04:00-04:00', Date.parse('2026-04-27T10:04:00-04:00'));
    expect(getCurrentFocusStep(session).id).toBe('main:db-bench-press:working:0');

    const plannedStep = getCurrentFocusStep(session);
    const plannedWeight = plannedStep.plannedWeight;
    const plannedReps = plannedStep.plannedReps;
    session = adjustFocusSetValue(session, 0, 'weight', 10);
    session = adjustFocusSetValue(session, 0, 'reps', 5);
    expect(getCurrentFocusStep(session).plannedWeight).toBe(plannedWeight);
    expect(getCurrentFocusStep(session).plannedReps).toBe(plannedReps);
    expect(getActualSetDraft(session, getCurrentFocusStep(session))?.actualWeightKg).toBe(10);
    expect(getActualSetDraft(session, getCurrentFocusStep(session))?.actualReps).toBe(5);

    session = updateFocusActualDraft(session, 0, {
      actualWeightKg: parseDisplayWeightToKg(135, 'lb'),
      displayWeight: 135,
      displayUnit: 'lb',
      actualReps: 8,
      actualRir: 2,
      techniqueQuality: 'good',
    });

    const persisted = sanitizeData({ ...emptyData(), activeSession: session });
    session = persisted.activeSession as TrainingSession;
    expect(getActualSetDraft(session, getCurrentFocusStep(session))?.displayUnit).toBe('lb');

    session = completeCurrentMainSet(session, 0, '2026-04-27T10:06:00-04:00', Date.parse('2026-04-27T10:06:00-04:00'));
    expect(setsOf(session, 0)[0].displayUnit).toBe('lb');
    expect(getRestTimerRemainingSec(session.restTimerState, Date.parse('2026-04-27T10:07:00-04:00'))).toBeGreaterThan(0);
    expect(getCurrentFocusStep(session).id).toBe('main:db-bench-press:working:1');

    const firstSetSnapshot = { ...setsOf(session, 0)[0] };
    session = copyPreviousFocusActualDraft(session, 0);
    let copiedDraft = getActualSetDraft(session, getCurrentFocusStep(session));
    expect(copiedDraft?.actualWeightKg).toBeCloseTo(firstSetSnapshot.weight, 1);
    expect(copiedDraft?.actualReps).toBe(firstSetSnapshot.reps);

    session = updateFocusActualDraft(session, 0, {
      actualWeightKg: copiedDraft?.actualWeightKg,
      actualReps: copiedDraft?.actualReps,
      actualRir: copiedDraft?.actualRir,
      painFlag: true,
      techniqueQuality: 'poor',
    });
    session = completeCurrentMainSet(session, 0, '2026-04-27T10:09:00-04:00', Date.parse('2026-04-27T10:09:00-04:00'));
    expect(setsOf(session, 0)[0].painFlag).toBe(false);
    expect(setsOf(session, 0)[1].painFlag).toBe(true);
    expect(setsOf(session, 0)[1].techniqueQuality).toBe('poor');
    expect(getCurrentFocusStep(session).id).toBe('main:seated-row:working:0');

    session = applySuggestedFocusStep(session, 1);
    session = completeCurrentMainSet(session, 1, '2026-04-27T10:12:00-04:00', Date.parse('2026-04-27T10:12:00-04:00'));
    expect(getCurrentFocusStep(session).stepType).toBe('functional');

    session = completeCurrentSupport(session, '2026-04-27T10:14:00-04:00', Date.parse('2026-04-27T10:14:00-04:00'));
    session = completeCurrentSupport(session, '2026-04-27T10:15:00-04:00', Date.parse('2026-04-27T10:15:00-04:00'));
    expect(session.supportExerciseLogs?.find((log) => log.blockType === 'functional')?.completedSets).toBe(2);
    expect(isFocusSessionComplete(session)).toBe(true);
    expect(getCurrentFocusStep(session).stepType).toBe('completed');

    const finished = completeTrainingSessionIntoHistory(
      { ...emptyData(), activeSession: session } as AppData,
      '2026-04-27T10:40:00-04:00'
    );
    expect(finished.session?.completed).toBe(true);
    expect(finished.data.activeSession).toBeNull();
    expect(finished.data.history).toHaveLength(1);

    const history = finished.data.history;
    const calendar = buildTrainingCalendar(history, '2026-04');
    const day = calendar.days.find((item) => item.date === '2026-04-27');
    expect(day?.totalSessions).toBe(1);
    expect(day?.sessions[0].sessionId).toBe('session-workout-flow');

    expect(finished.session?.exercises[0].replacedFromId).toBe('bench-press');
    expect(finished.session?.exercises[0].actualExerciseId).toBe('db-bench-press');
    expect(buildPrs(history).some((item) => item.exerciseId === 'db-bench-press')).toBe(true);
    expect(buildPrs(history).some((item) => item.exerciseId === 'bench-press')).toBe(false);
    expect(buildE1RMProfile(history, 'bench-press').best).toBeUndefined();
    expect(buildE1RMProfile(history, 'db-bench-press').best).toBeTruthy();

    const effective = buildEffectiveVolumeSummary(history);
    expect(effective.completedSets).toBeGreaterThan(0);
    expect(effective.highConfidenceEffectiveSets).toBeLessThan(effective.completedSets);

    const markedTest = markSessionDataFlag(finished.data, 'session-workout-flow', 'test', true);
    expect(markedTest.ok).toBe(true);
    expect(buildPrs(markedTest.data.history)).toHaveLength(0);
    expect(buildTrainingCalendar(markedTest.data.history, '2026-04').days.find((item) => item.date === '2026-04-27')?.totalSessions).toBe(0);
    expect(buildTrainingCalendar(markedTest.data.history, '2026-04', { includeDataFlags: 'all' }).days.find((item) => item.date === '2026-04-27')?.totalSessions).toBe(1);

    const restored = markSessionDataFlag(markedTest.data, 'session-workout-flow', 'normal', true);
    expect(buildPrs(restored.data.history).some((item) => item.exerciseId === 'db-bench-press')).toBe(true);

    const deleteBlocked = deleteTrainingSession(restored.data, 'session-workout-flow', false);
    expect(deleteBlocked.ok).toBe(false);
    expect(deleteBlocked.data.history).toHaveLength(1);

    const deleted = deleteTrainingSession(restored.data, 'session-workout-flow', true);
    expect(deleted.ok).toBe(true);
    expect(deleted.data.history).toHaveLength(0);
    expect(buildTrainingCalendar(deleted.data.history, '2026-04').days.find((item) => item.date === '2026-04-27')?.totalSessions).toBe(0);
  });
});
