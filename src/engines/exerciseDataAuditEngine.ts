import {
  EXERCISE_DISPLAY_NAMES,
  EXERCISE_EQUIVALENCE_CHAINS,
  EXERCISE_KNOWLEDGE_OVERRIDES,
  INITIAL_TEMPLATES,
  mapLegacyAlternativeLabelsToIds,
  resolveExerciseReferenceToId,
} from '../data/trainingData';
import type { ExerciseTemplate, TrainingTemplate } from '../models/training-model';
import { buildExerciseMetadata, hydrateTemplates, number } from './engineUtils';

export type ExerciseDataAuditReport = {
  errors: string[];
  warnings: string[];
  suggestions: string[];
};

const unique = (items: string[]) => Array.from(new Set(items));

const defaultExercises = () => {
  const byId = new Map<string, ExerciseTemplate>();
  hydrateTemplates(INITIAL_TEMPLATES as TrainingTemplate[])
    .flatMap((template) => template.exercises)
    .forEach((exercise) => {
      if (!byId.has(exercise.id)) byId.set(exercise.id, exercise);
    });
  return Array.from(byId.values());
};

const knownExerciseIds = (exercises: ExerciseTemplate[]) =>
  new Set<string>([
    ...Object.keys(EXERCISE_DISPLAY_NAMES),
    ...Object.keys(EXERCISE_KNOWLEDGE_OVERRIDES),
    ...exercises.map((exercise) => exercise.id),
  ]);

const chainIds = () => new Set(Object.values(EXERCISE_EQUIVALENCE_CHAINS).map((chain) => chain.id).filter(Boolean) as string[]);

const pushMissingRelation = (
  report: ExerciseDataAuditReport,
  exerciseId: string,
  field: string,
  relationIds: string[] | undefined,
  knownIds: Set<string>
) => {
  unique(relationIds || []).forEach((id) => {
    if (!knownIds.has(id)) report.errors.push(`${exerciseId} 的 ${field} 引用了不存在的动作 ID：${id}`);
  });
};

const hasPrimaryMuscleContribution = (exercise: ExerciseTemplate) => {
  const metadata = buildExerciseMetadata(exercise);
  const contribution = metadata.muscleContribution || {};
  const primaryMuscles = metadata.primaryMuscles?.length ? metadata.primaryMuscles : [exercise.muscle];
  return primaryMuscles.every((muscle) => number(contribution[muscle]) > 0);
};

export const auditExerciseLibrary = (exercisesInput?: ExerciseTemplate[]): ExerciseDataAuditReport => {
  const exercises = exercisesInput?.length ? exercisesInput : defaultExercises();
  const report: ExerciseDataAuditReport = { errors: [], warnings: [], suggestions: [] };
  const seenIds = new Set<string>();
  const knownIds = knownExerciseIds(exercises);
  const validChainIds = chainIds();

  exercises.forEach((exercise) => {
    if (!exercise.id) report.errors.push('发现缺少 id 的动作。');
    if (seenIds.has(exercise.id)) report.errors.push(`动作 ID 重复：${exercise.id}`);
    seenIds.add(exercise.id);

    const metadata = buildExerciseMetadata(exercise);
    if (!EXERCISE_DISPLAY_NAMES[exercise.id]) report.errors.push(`动作缺少中文名：${exercise.id}`);
    if (!exercise.kind) report.errors.push(`动作缺少 kind：${exercise.id}`);
    if (!metadata.movementPattern) report.errors.push(`动作缺少 movementPattern：${exercise.id}`);
    if (!metadata.primaryMuscles?.length) report.errors.push(`动作缺少 primaryMuscles：${exercise.id}`);
    if (!metadata.recommendedRepRange) report.errors.push(`动作缺少 recommendedRepRange：${exercise.id}`);
    if (!metadata.targetRir) report.errors.push(`动作缺少 targetRir：${exercise.id}`);
    if (exercise.kind === 'isolation' && metadata.warmupPreference === 'always') {
      report.errors.push(`孤立动作不应默认强制热身：${exercise.id}`);
    }
    if (!number(metadata.progressionUnitKg)) {
      report.warnings.push(`动作缺少 progressionUnitKg：${exercise.id}`);
    }
    if (!hasPrimaryMuscleContribution(exercise)) {
      report.errors.push(`动作 muscleContribution 未覆盖主肌群：${exercise.id}`);
    }

    pushMissingRelation(report, exercise.id, 'alternativeIds', metadata.alternativeIds, knownIds);
    pushMissingRelation(report, exercise.id, 'regressionIds', metadata.regressionIds, knownIds);
    pushMissingRelation(report, exercise.id, 'progressionIds', metadata.progressionIds, knownIds);

    if (metadata.canonicalExerciseId && !knownIds.has(metadata.canonicalExerciseId)) {
      report.errors.push(`${exercise.id} 的 canonicalExerciseId 不存在：${metadata.canonicalExerciseId}`);
    }
    if (metadata.equivalenceChainId && !validChainIds.has(metadata.equivalenceChainId) && !knownIds.has(metadata.equivalenceChainId)) {
      report.warnings.push(`${exercise.id} 的 equivalenceChainId 未匹配到已知动作链：${metadata.equivalenceChainId}`);
    }

    const legacyAlternativeIds = mapLegacyAlternativeLabelsToIds(exercise.alternatives || []);
    report.warnings.push(...legacyAlternativeIds.warnings.map((warning) => `${exercise.id}: ${warning}`));
    legacyAlternativeIds.ids.forEach((id) => {
      if (!knownIds.has(id)) report.errors.push(`${exercise.id} 的 legacy alternatives 映射到不存在的动作 ID：${id}`);
    });
  });

  Object.values(EXERCISE_EQUIVALENCE_CHAINS).forEach((chain) => {
    unique(chain.members || []).forEach((id) => {
      if (!knownIds.has(id)) report.errors.push(`动作链 ${chain.id || chain.label} 的 member 不存在：${id}`);
    });
  });

  Object.entries(EXERCISE_KNOWLEDGE_OVERRIDES).forEach(([id, override]) => {
    if (!knownIds.has(id)) report.warnings.push(`metadata 存在但默认模板未直接使用：${id}`);
    const ids = [
      ...(((override.alternativeIds as string[] | undefined) || [])),
      ...(((override.regressionIds as string[] | undefined) || [])),
      ...(((override.progressionIds as string[] | undefined) || [])),
    ];
    unique(ids).forEach((relationId) => {
      if (!resolveExerciseReferenceToId(relationId)) report.errors.push(`${id} 的关系字段引用无效 ID：${relationId}`);
    });
  });

  return {
    errors: unique(report.errors),
    warnings: unique(report.warnings),
    suggestions: unique(report.suggestions),
  };
};
