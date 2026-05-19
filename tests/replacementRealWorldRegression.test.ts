import { describe, expect, it } from 'vitest';
import { EXERCISE_KNOWLEDGE_OVERRIDES, formatExerciseDisplayName, type ExerciseEquipmentTag } from '../src/data/exerciseLibrary';
import { buildPrs } from '../src/engines/analytics';
import { buildEffectiveVolumeSummary, getMuscleContribution } from '../src/engines/effectiveSetEngine';
import { buildE1RMProfile, getExerciseRecordPoolId } from '../src/engines/e1rmEngine';
import {
  adjustFocusSetValue,
  applySuggestedFocusStep,
  completeFocusSet,
  endFocusRest,
  getActualSetDraft,
  getCurrentFocusStep,
  updateFocusActualDraft,
} from '../src/engines/focusModeStateEngine';
import { applyExerciseReplacement, buildReplacementOptions, validateReplacementExerciseId } from '../src/engines/replacementEngine';
import { buildSessionDetailSummary } from '../src/engines/sessionDetailSummaryEngine';
import { buildSmartReplacementRecommendations } from '../src/engines/smartReplacementEngine';
import { finalizeTrainingSession } from '../src/engines/trainingCompletionEngine';
import type { AppData, ExercisePrescription, TrainingSession, TrainingSetLog } from '../src/models/training-model';
import { emptyData } from '../src/storage/persistence';

const nowIso = '2026-05-04T10:00:00-04:00';
const finishedIso = '2026-05-04T10:30:00-04:00';

const exercise = (id: string, setCount = 2): ExercisePrescription => {
  const metadata = (EXERCISE_KNOWLEDGE_OVERRIDES[id] || {}) as Partial<ExercisePrescription>;
  return {
    ...metadata,
    id,
    baseId: id,
    canonicalExerciseId: id,
    actualExerciseId: id,
    name: formatExerciseDisplayName(id),
    muscle: metadata.muscle || metadata.primaryMuscles?.[0] || '综合',
    kind: metadata.kind || 'compound',
    repMin: metadata.repMin || 8,
    repMax: metadata.repMax || 12,
    rest: metadata.rest || 120,
    startWeight: metadata.startWeight || 40,
    sets: Array.from({ length: setCount }, (_, index): TrainingSetLog => ({
      id: `${id}-${index + 1}`,
      type: 'working',
      weight: 40,
      reps: 10,
      rir: 2,
      rpe: '',
      techniqueQuality: 'good',
      painFlag: false,
      done: false,
    })),
  } as ExercisePrescription;
};

const sessionWith = (exerciseId: string, templateId = 'push-a'): TrainingSession => ({
  id: `${exerciseId}-real-world-session`,
  date: '2026-05-04',
  startedAt: nowIso,
  templateId,
  templateName: templateId,
  programTemplateId: templateId,
  programTemplateName: templateId,
  trainingMode: 'hybrid',
  focus: '综合',
  dataFlag: 'normal',
  completed: false,
  exercises: [exercise(exerciseId)],
  currentExerciseId: exerciseId,
  currentSetIndex: 0,
  currentFocusStepId: `main:${exerciseId}:working:0`,
  currentFocusStepType: 'working',
  focusSessionComplete: false,
  focusActualSetDrafts: [],
  focusCompletedStepIds: [],
});

const visibleRecommendations = (id: string, unavailableEquipment?: ExerciseEquipmentTag[]) =>
  buildSmartReplacementRecommendations({
    currentExercise: exercise(id),
    exerciseLibrary: [],
    unavailableEquipment,
  }).filter((option) => option.priority !== 'avoid');

const visibleRecommendationIds = (id: string, unavailableEquipment?: ExerciseEquipmentTag[]) =>
  visibleRecommendations(id, unavailableEquipment).map((option) => option.exerciseId);

const replacementOptions = (id: string, unavailableEquipment?: ExerciseEquipmentTag[]) =>
  buildReplacementOptions(exercise(id), { unavailableEquipment });

const optionFor = (id: string, replacementId: string, unavailableEquipment?: ExerciseEquipmentTag[]) => {
  const option = replacementOptions(id, unavailableEquipment).find((item) => item.id === replacementId);
  expect(option).toBeDefined();
  return option!;
};

const expectVisibleTextSafe = (text: string) => {
  expect(text).toMatch(/[\u3400-\u9fff]/);
  expect(text).not.toMatch(/undefined|null|__auto_alt|__alt_|actualExerciseId|replacementExerciseId|not_recommended|avoid|equipment_fallback|compound_fallback/);
};

const expectEquipmentContextNotPersisted = (data: unknown) => {
  const serialized = JSON.stringify(data);
  expect(serialized).not.toMatch(/unavailableEquipment|selectedUnavailableEquipment|replacementEquipmentChips|器械被占用/);
};

const metadataContribution = (id: string) =>
  getMuscleContribution({
    id,
    ...(EXERCISE_KNOWLEDGE_OVERRIDES[id] || {}),
  } as ExercisePrescription);

const expectContributionFromActualExercise = (session: TrainingSession, actualExerciseId: string) => {
  const expected = metadataContribution(actualExerciseId);
  const actual = getMuscleContribution(session.exercises[0]);
  expect(actual).toEqual(expected);

  const summary = buildEffectiveVolumeSummary([session]);
  Object.entries(expected).forEach(([muscle, contribution]) => {
    expect(summary.byMuscle[muscle]?.weightedEffectiveSets || 0).toBeGreaterThanOrEqual(contribution * 0.75);
  });
};

const replaceAndCompleteFirstSet = (
  sourceId: string,
  replacementId: string,
  unavailableEquipment?: ExerciseEquipmentTag[],
  templateId = 'push-a',
) => {
  const smartIds = visibleRecommendationIds(sourceId, unavailableEquipment);
  expect(smartIds).toContain(replacementId);

  const sourceOptions = replacementOptions(sourceId, unavailableEquipment);
  expect(sourceOptions.map((option) => option.id)).toContain(replacementId);
  sourceOptions.forEach((option) => {
    expect(option.id).not.toBe(sourceId);
    expect(option.name).not.toBe(option.id);
    expectVisibleTextSafe(`${option.name} ${option.rankLabel} ${option.reason}`);
  });

  let session = applyExerciseReplacement(sessionWith(sourceId, templateId), 0, replacementId);
  expect(session.exercises[0]).toMatchObject({
    originalExerciseId: sourceId,
    actualExerciseId: replacementId,
    replacementExerciseId: replacementId,
  });
  expect(getCurrentFocusStep(session)).toMatchObject({
    exerciseId: replacementId,
    exerciseIndex: 0,
    setIndex: 0,
  });

  session = adjustFocusSetValue(session, 0, 'weight', 5);
  expect(getCurrentFocusStep(session).exerciseId).toBe(replacementId);
  expect(getActualSetDraft(session, getCurrentFocusStep(session))?.actualWeightKg).toBe(5);

  session = applySuggestedFocusStep(session, 0);
  expect(getCurrentFocusStep(session).exerciseId).toBe(replacementId);
  expect(getActualSetDraft(session, getCurrentFocusStep(session))?.actualReps).toBe(getCurrentFocusStep(session).plannedReps);
  session = updateFocusActualDraft(session, 0, { actualReps: 10, source: 'manual' });

  const step = getCurrentFocusStep(session);
  const completed = completeFocusSet(session, 0, nowIso, Date.parse(nowIso), step.id);
  expect(completed).not.toBeNull();
  expect(completed?.completedStep).toMatchObject({
    exerciseId: replacementId,
    exerciseIndex: 0,
    setIndex: 0,
  });
  session = completed!.session;
  expect(session.exercises[0].sets[0]).toMatchObject({
    done: true,
    completedAt: nowIso,
  });
  expect(getCurrentFocusStep(session)).toMatchObject({
    exerciseId: replacementId,
    exerciseIndex: 0,
    setIndex: 1,
  });

  const afterRest = endFocusRest(session);
  session = afterRest.session;
  expect(session.restTimerState).toBeNull();
  expect(afterRest.nextStep).toMatchObject({
    exerciseId: replacementId,
    exerciseIndex: 0,
    setIndex: 1,
  });
  expect(getCurrentFocusStep(session).exerciseId).toBe(replacementId);

  const finalized = finalizeTrainingSession(session, finishedIso, { endedEarly: true });
  expect(finalized.exercises[0]).toMatchObject({
    originalExerciseId: sourceId,
    actualExerciseId: replacementId,
    replacementExerciseId: replacementId,
  });
  expect(finalized.exercises[0].sets[0].done).toBe(true);
  expect(finalized.exercises[0].sets[1].done).toBe(false);
  expectEquipmentContextNotPersisted(session);
  expectEquipmentContextNotPersisted(finalized);
  expectEquipmentContextNotPersisted({
    ...emptyData(),
    activeSession: session,
    history: [finalized],
    settings: {},
  } as AppData);

  return finalized;
};

describe('replacement real-world regression', () => {
  it('handles incline dumbbell press replaced by smith incline press without cursor or record-pool regression', () => {
    expect(visibleRecommendationIds('incline-db-press', ['dumbbell']).slice(0, 3)).toEqual([
      'smith-incline-press',
      'machine-incline-chest-press',
      'machine-chest-press',
    ]);

    const finalized = replaceAndCompleteFirstSet('incline-db-press', 'smith-incline-press', ['dumbbell']);
    const summary = buildSessionDetailSummary(finalized);

    expect(summary.groupedSets.exerciseGroups[0].exercise).toMatchObject({
      originalExerciseId: 'incline-db-press',
      actualExerciseId: 'smith-incline-press',
      replacementExerciseId: 'smith-incline-press',
    });
    expect(getExerciseRecordPoolId(finalized.exercises[0])).toBe('smith-incline-press');
    expect(buildPrs([finalized]).map((item) => item.exerciseId)).toContain('smith-incline-press');
    expect(buildPrs([finalized]).map((item) => item.exerciseId)).not.toContain('incline-db-press');
    expect(buildE1RMProfile([finalized], 'smith-incline-press').best?.exerciseId).toBe('smith-incline-press');
    expect(buildE1RMProfile([finalized], 'incline-db-press').best).toBeUndefined();
  });

  it('handles cable fly replaced by pec deck fly without polluting cable fly record pools', () => {
    expect(visibleRecommendationIds('cable-fly', ['cable']).slice(0, 2)).toEqual(['pec-deck-fly', 'db-fly']);

    const finalized = replaceAndCompleteFirstSet('cable-fly', 'pec-deck-fly', ['cable']);

    expect(getExerciseRecordPoolId(finalized.exercises[0])).toBe('pec-deck-fly');
    expect(buildPrs([finalized]).map((item) => item.exerciseId)).toContain('pec-deck-fly');
    expect(buildPrs([finalized]).map((item) => item.exerciseId)).not.toContain('cable-fly');
    expect(buildE1RMProfile([finalized], 'pec-deck-fly').best?.exerciseId).toBe('pec-deck-fly');
    expect(buildE1RMProfile([finalized], 'cable-fly').best).toBeUndefined();
    expectContributionFromActualExercise(finalized, 'pec-deck-fly');
  });

  it('handles cable fly replaced by assisted dip as compound fallback with actual-exercise contribution', () => {
    const assistedDip = optionFor('cable-fly', 'assisted-dip', ['cable']);
    expect(assistedDip.rank).toBe('compound_fallback');
    expect(assistedDip.reason).toContain('复合动作替代');
    expect(assistedDip.reason).toContain('不是完全等价替代');

    const finalized = replaceAndCompleteFirstSet('cable-fly', 'assisted-dip', ['cable']);

    expect(getExerciseRecordPoolId(finalized.exercises[0])).toBe('assisted-dip');
    expect(buildPrs([finalized]).map((item) => item.exerciseId)).toContain('assisted-dip');
    expect(buildPrs([finalized]).map((item) => item.exerciseId)).not.toContain('cable-fly');
    expect(getMuscleContribution(finalized.exercises[0])).toEqual(metadataContribution('assisted-dip'));
    expect(getMuscleContribution(finalized.exercises[0])).not.toEqual(metadataContribution('cable-fly'));
    expectContributionFromActualExercise(finalized, 'assisted-dip');
  });

  it('handles lat pulldown replaced by assisted pull-up as a valid vertical-pull record pool', () => {
    expect(validateReplacementExerciseId('assisted-pull-up')).toBe(true);
    expect(replacementOptions('lat-pulldown').map((option) => option.id)).toContain('assisted-pull-up');

    const finalized = replaceAndCompleteFirstSet('lat-pulldown', 'assisted-pull-up', undefined, 'pull-a');

    expect(getExerciseRecordPoolId(finalized.exercises[0])).toBe('assisted-pull-up');
    expect(buildPrs([finalized]).map((item) => item.exerciseId)).toContain('assisted-pull-up');
    expect(buildPrs([finalized]).map((item) => item.exerciseId)).not.toContain('lat-pulldown');
    expect(buildE1RMProfile([finalized], 'assisted-pull-up').best?.exerciseId).toBe('assisted-pull-up');
    expect(buildE1RMProfile([finalized], 'lat-pulldown').best).toBeUndefined();
    expectContributionFromActualExercise(finalized, 'assisted-pull-up');
  });

  it('handles squat replacements when rack and barbell are unavailable without polluting squat records', () => {
    expect(visibleRecommendationIds('squat', ['rack', 'barbell']).slice(0, 3)).toEqual(['hack-squat', 'smith-squat', 'leg-press']);

    const smith = replaceAndCompleteFirstSet('squat', 'smith-squat', ['rack', 'barbell'], 'legs-a');
    expect(getExerciseRecordPoolId(smith.exercises[0])).toBe('smith-squat');
    expect(buildPrs([smith]).map((item) => item.exerciseId)).toContain('smith-squat');
    expect(buildPrs([smith]).map((item) => item.exerciseId)).not.toContain('squat');
    expect(buildE1RMProfile([smith], 'smith-squat').best?.exerciseId).toBe('smith-squat');
    expect(buildE1RMProfile([smith], 'squat').best).toBeUndefined();

    const hack = replaceAndCompleteFirstSet('squat', 'hack-squat', ['rack', 'barbell'], 'legs-a');
    expect(getExerciseRecordPoolId(hack.exercises[0])).toBe('hack-squat');
    expect(buildPrs([hack]).map((item) => item.exerciseId)).toContain('hack-squat');
    expect(buildPrs([hack]).map((item) => item.exerciseId)).not.toContain('squat');
  });

  it('keeps avoid and not-recommended replacements hidden from real-world replacement lists', () => {
    const latPulldownIds = replacementOptions('lat-pulldown').map((option) => option.id);
    const cableFlyIds = replacementOptions('cable-fly', ['cable']).map((option) => option.id);

    expect(latPulldownIds).not.toEqual(expect.arrayContaining(['triceps-pushdown', 'cable-fly', 'shoulder-press']));
    expect(cableFlyIds).not.toEqual(expect.arrayContaining(['bench-press', 'shoulder-press']));
    replacementOptions('triceps-pushdown', ['cable']).forEach((option) => {
      expect(option.rank).not.toBe('not_recommended');
      expect(option.rank).not.toBe('avoid');
      expectVisibleTextSafe(`${option.name} ${option.rankLabel} ${option.reason}`);
    });
  });
});
