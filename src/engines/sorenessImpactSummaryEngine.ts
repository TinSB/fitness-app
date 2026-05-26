import type { ExerciseTemplate, TodayStatus, TrainingTemplate } from '../models/training-model';
import { actionableSorenessAreas, getPrimaryMuscles } from './engineUtils';

export type SorenessImpactAction = 'reduce_sets' | 'progress_lock' | 'prefer_alternative' | 'watch';

export interface SorenessImpactedExercise {
  exerciseId: string;
  exerciseName: string;
  muscle: string;
  action: SorenessImpactAction;
  rationale: string;
}

export interface SorenessImpactSummary {
  hasSoreness: boolean;
  sorenessAreas: string[];
  impactedExercises: SorenessImpactedExercise[];
  headline: string;
}

const actionForKind = (kind: string | undefined): SorenessImpactAction => {
  if (kind === 'isolation') return 'reduce_sets';
  if (kind === 'compound') return 'progress_lock';
  if (kind === 'machine') return 'reduce_sets';
  return 'watch';
};

const rationaleFor = (muscle: string, action: SorenessImpactAction): string => {
  switch (action) {
    case 'reduce_sets':
      return `${muscle} 酸痛，本动作默认少做 1 组。`;
    case 'progress_lock':
      return `${muscle} 酸痛，主动作不加重，先以质量和恢复为先。`;
    case 'prefer_alternative':
      return `${muscle} 酸痛，建议替换为更轻或更稳定的版本。`;
    default:
      return `${muscle} 酸痛，注意训练中观察。`;
  }
};

const matchesSoreness = (exercise: ExerciseTemplate, sorenessAreas: Set<string>) => {
  const muscles = getPrimaryMuscles(exercise);
  return muscles.find((muscle) => sorenessAreas.has(muscle));
};

export const buildSorenessImpactSummary = (
  status: TodayStatus | null | undefined,
  template: TrainingTemplate | null | undefined,
): SorenessImpactSummary => {
  const sorenessAreas = actionableSorenessAreas(status?.soreness);
  if (!sorenessAreas.length || !template?.exercises?.length) {
    return {
      hasSoreness: sorenessAreas.length > 0,
      sorenessAreas,
      impactedExercises: [],
      headline: sorenessAreas.length
        ? `今天标记了${sorenessAreas.join(' / ')}酸痛，但当前模板没有命中相关动作。`
        : '今天没有酸痛标记，按计划推进即可。',
    };
  }

  const sorenessSet = new Set(sorenessAreas);
  const impacted: SorenessImpactedExercise[] = [];
  for (const exercise of template.exercises) {
    const matchedMuscle = matchesSoreness(exercise as ExerciseTemplate, sorenessSet);
    if (!matchedMuscle) continue;
    const action = actionForKind(exercise.kind);
    impacted.push({
      exerciseId: exercise.id,
      exerciseName: exercise.name || exercise.id,
      muscle: matchedMuscle,
      action,
      rationale: rationaleFor(matchedMuscle, action),
    });
  }

  const headline = impacted.length
    ? `${sorenessAreas.join(' / ')} 酸痛影响 ${impacted.length} 个动作，会自动减组或保守推进。`
    : `今天标记了${sorenessAreas.join(' / ')}酸痛，但当前模板没有命中相关动作。`;

  return {
    hasSoreness: true,
    sorenessAreas,
    impactedExercises: impacted,
    headline,
  };
};
