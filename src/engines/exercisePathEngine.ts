import { EXERCISE_DISPLAY_NAMES } from '../data/exerciseLibrary';
import { SUPPORT_EXERCISE_MAP } from '../data/supportExerciseLibrary';
import type { ExercisePrescription, ExerciseTemplate } from '../models/training-model';

export interface ExerciseLearningPathStep {
  id: string;
  name: string;
  stage: 'regression' | 'current' | 'progression';
}

export interface ExerciseLearningPath {
  currentId: string;
  currentName: string;
  steps: ExerciseLearningPathStep[];
  nextStepName?: string;
}

type ExerciseLike = Pick<ExerciseTemplate, 'id' | 'name' | 'alias'> & {
  baseId?: string;
  regressionIds?: string[];
  progressionIds?: string[];
};

const unique = (values: string[]) => [...new Set(values.filter(Boolean))];

const resolveExerciseName = (id: string, fallback?: string) => fallback || EXERCISE_DISPLAY_NAMES[id] || SUPPORT_EXERCISE_MAP[id]?.name || id;

export const buildExerciseLearningPath = (exercise: ExerciseLike | ExercisePrescription): ExerciseLearningPath | null => {
  const currentId = exercise.baseId || exercise.id;
  const regressionIds = unique(exercise.regressionIds || []);
  const progressionIds = unique(exercise.progressionIds || []);

  if (!regressionIds.length && !progressionIds.length) return null;

  const steps: ExerciseLearningPathStep[] = [
    ...regressionIds.map((id) => ({ id, name: resolveExerciseName(id), stage: 'regression' as const })),
    {
      id: currentId,
      name: resolveExerciseName(currentId, exercise.alias || exercise.name),
      stage: 'current' as const,
    },
    ...progressionIds.map((id) => ({ id, name: resolveExerciseName(id), stage: 'progression' as const })),
  ];

  return {
    currentId,
    currentName: resolveExerciseName(currentId, exercise.alias || exercise.name),
    steps,
    nextStepName: progressionIds[0] ? resolveExerciseName(progressionIds[0]) : undefined,
  };
};
