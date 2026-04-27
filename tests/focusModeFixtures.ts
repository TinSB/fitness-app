import type { CorrectionModule, ExercisePrescription, FunctionalAddon, SupportExerciseLog, TrainingSession, TrainingSetLog } from '../src/models/training-model';

export const makeSets = (exerciseId: string, count: number, doneCount = 0): TrainingSetLog[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `${exerciseId}-${index + 1}`,
    weight: 50,
    reps: 8,
    rpe: '',
    rir: 2,
    done: index < doneCount,
    painFlag: false,
  }));

export const makeExercise = (id: string, setCount: number, doneCount = 0, warmupCount = 0): ExercisePrescription =>
  ({
    id,
    baseId: id,
    name: id,
    muscle: '胸',
    kind: 'compound',
    repMin: 6,
    repMax: 8,
    rest: 120,
    startWeight: 50,
    warmupSets: Array.from({ length: warmupCount }, (_, index) => ({ weight: 20 + index * 10, reps: 8 - index })),
    sets: makeSets(id, setCount, doneCount),
  }) as ExercisePrescription;

export const makeFocusSession = (exercises: ExercisePrescription[]): TrainingSession => ({
  id: 'session-focus',
  date: '2026-04-27',
  templateId: 'push-a',
  templateName: 'Push A',
  trainingMode: 'hybrid',
  exercises,
  completed: false,
  currentExerciseId: exercises[0]?.id,
  currentSetIndex: 0,
  currentFocusStepId: exercises[0]?.warmupSets?.length ? `main:${exercises[0].id}:warmup:0` : `main:${exercises[0]?.id}:working:0`,
  currentFocusStepType: exercises[0]?.warmupSets?.length ? 'warmup' : 'working',
  focusSessionComplete: false,
  focusActualSetDrafts: [],
  focusCompletedStepIds: [],
});

export const makeCorrectionModule = (id = 'corr-shoulder'): CorrectionModule => ({
  id,
  name: 'Shoulder control',
  targetIssue: 'scapular_control',
  stage: 'warmup',
  durationMin: 5,
  exercises: [{ exerciseId: 'wall-slide', name: 'Wall slide', sets: 2, repMin: 8, repMax: 10, restSec: 30 }],
});

export const makeFunctionalAddon = (id = 'func-carry'): FunctionalAddon => ({
  id,
  name: 'Carry finisher',
  targetAbility: 'carry_capacity',
  insertionRule: 'finisher',
  durationMin: 6,
  exercises: [{ exerciseId: 'farmer-carry', name: 'Farmer carry', sets: 2, distanceM: 20, restSec: 45 }],
});

export const attachSupportBlocks = (
  session: TrainingSession,
  correctionBlock: CorrectionModule[] = [makeCorrectionModule()],
  functionalBlock: FunctionalAddon[] = [makeFunctionalAddon()]
): TrainingSession => {
  const supportExerciseLogs: SupportExerciseLog[] = [
    ...correctionBlock.flatMap((block) =>
      block.exercises.map((exercise) => ({
        moduleId: block.id,
        exerciseId: exercise.exerciseId,
        exerciseName: exercise.name,
        blockType: 'correction' as const,
        plannedSets: exercise.sets,
        completedSets: 0,
      }))
    ),
    ...functionalBlock.flatMap((block) =>
      block.exercises.map((exercise) => ({
        moduleId: block.id,
        exerciseId: exercise.exerciseId,
        exerciseName: exercise.name,
        blockType: 'functional' as const,
        plannedSets: exercise.sets,
        completedSets: 0,
      }))
    ),
  ];

  return {
    ...session,
    correctionBlock,
    functionalBlock,
    supportExerciseLogs,
  };
};
