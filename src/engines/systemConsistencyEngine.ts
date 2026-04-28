import {
  EXERCISE_ALIASES,
  EXERCISE_DISPLAY_NAMES,
  EXERCISE_ENGLISH_NAMES,
  INITIAL_TEMPLATES,
} from '../data/trainingData';
import type { AppData, ExercisePrescription, ExerciseTemplate, TrainingSession } from '../models/training-model';
import { buildExerciseMetadata, hydrateTemplates } from './engineUtils';
import { auditGoalModeConsistency } from './goalConsistencyEngine';
import { buildReplacementOptions, isSyntheticReplacementExerciseId, validateReplacementExerciseId } from './replacementEngine';

export type SystemConsistencyReport = {
  warnings: string[];
  errors: string[];
  suggestions: string[];
};

const normalizeName = (value: unknown) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[（(].*?[)）]/g, '')
    .replace(/[\s_\-·,，。:：;；/\\|]+/g, '');

const hydratedTemplates = () => hydrateTemplates(INITIAL_TEMPLATES);

const exerciseCatalog = () => {
  const items = hydratedTemplates().flatMap((template) => template.exercises);
  return new Map(items.map((exercise) => [exercise.id, exercise]));
};

const nameIndex = () => {
  const index = new Map<string, string>();
  for (const [id, name] of Object.entries(EXERCISE_DISPLAY_NAMES)) {
    index.set(normalizeName(id), id);
    index.set(normalizeName(name), id);
  }
  for (const [id, name] of Object.entries(EXERCISE_ENGLISH_NAMES)) {
    index.set(normalizeName(name), id);
  }
  for (const [id, aliases] of Object.entries(EXERCISE_ALIASES)) {
    aliases.forEach((alias) => index.set(normalizeName(alias), id));
  }
  hydratedTemplates()
    .flatMap((template) => template.exercises)
    .forEach((exercise) => {
      index.set(normalizeName(exercise.id), exercise.id);
      index.set(normalizeName(exercise.name), exercise.id);
      index.set(normalizeName(exercise.alias), exercise.id);
    });
  return index;
};

export const resolveTemplateAlternativeToExerciseId = (value: unknown): string | null => {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (EXERCISE_DISPLAY_NAMES[raw]) return raw;
  return nameIndex().get(normalizeName(raw)) || null;
};

const pushExerciseIds = (session: TrainingSession | null | undefined, list: ExercisePrescription[]) => {
  if (!session?.exercises?.length) return;
  list.push(...(session.exercises as ExercisePrescription[]));
};

const collectSessionExercises = (appData: Partial<AppData>) => {
  const exercises: ExercisePrescription[] = [];
  pushExerciseIds(appData.activeSession, exercises);
  (appData.history || []).forEach((session) => pushExerciseIds(session, exercises));
  return exercises;
};

const actualIdFor = (exercise: ExercisePrescription) =>
  exercise.actualExerciseId || exercise.replacementExerciseId || exercise.canonicalExerciseId || exercise.id;

const assertExerciseMetadata = (exercise: ExerciseTemplate, report: SystemConsistencyReport) => {
  const metadata = buildExerciseMetadata(exercise);
  if (!EXERCISE_DISPLAY_NAMES[exercise.id]) report.errors.push(`动作缺少中文名：${exercise.id}`);
  if (!exercise.kind) report.errors.push(`动作缺少类型：${exercise.id}`);
  if (!metadata.movementPattern) report.errors.push(`动作缺少动作模式：${exercise.id}`);
  if (!metadata.primaryMuscles?.length) report.errors.push(`动作缺少主要肌群：${exercise.id}`);
  if (!metadata.recommendedRepRange) report.errors.push(`动作缺少推荐次数范围：${exercise.id}`);
  if (!metadata.targetRir) report.errors.push(`动作缺少目标 RIR：${exercise.id}`);
  if (exercise.kind === 'isolation' && metadata.warmupPreference === 'always') {
    report.errors.push(`孤立动作不应默认强制热身：${exercise.id}`);
  }
};

export const buildSystemConsistencyReport = (appData: Partial<AppData>): SystemConsistencyReport => {
  const report: SystemConsistencyReport = {
    warnings: [],
    errors: [],
    suggestions: [],
  };
  const catalog = exerciseCatalog();
  const goalAudit = auditGoalModeConsistency(appData);
  report.warnings.push(...goalAudit.warnings);

  hydratedTemplates().forEach((template) => {
    template.exercises.forEach((exercise) => {
      assertExerciseMetadata(exercise, report);
      if (!catalog.has(exercise.id)) report.errors.push(`模板引用了不存在的动作：${template.id} / ${exercise.id}`);
      (exercise.alternatives || []).forEach((alternative) => {
        const resolvedId = resolveTemplateAlternativeToExerciseId(alternative);
        if (!resolvedId) {
          report.suggestions.push(`模板 ${template.id} 的替代动作「${alternative}」还没有映射到真实动作 ID。`);
        }
      });
    });
  });

  const bench = hydratedTemplates()
    .flatMap((template) => template.exercises)
    .find((exercise) => exercise.id === 'bench-press') as ExercisePrescription | undefined;
  if (bench) {
    const benchReplacementIds = buildReplacementOptions(bench).map((option) => option.id);
    ['triceps-pushdown', 'shoulder-press', 'machine-shoulder-press', 'cable-fly'].forEach((invalidId) => {
      if (benchReplacementIds.includes(invalidId)) report.errors.push(`卧推替代动作包含不合理动作：${invalidId}`);
    });
  }

  collectSessionExercises(appData).forEach((exercise) => {
    const ids = [exercise.id, exercise.actualExerciseId, exercise.replacementExerciseId].filter(Boolean);
    ids.forEach((id) => {
      if (isSyntheticReplacementExerciseId(id)) report.errors.push(`发现合成替代动作 ID：${id}`);
    });
    const actualId = actualIdFor(exercise);
    if (exercise.replacementExerciseId && !validateReplacementExerciseId(exercise.replacementExerciseId)) {
      report.errors.push(`替代动作不是有效动作库 ID：${exercise.replacementExerciseId}`);
    }
    if (actualId && !validateReplacementExerciseId(actualId)) {
      report.errors.push(`实际执行动作不是有效动作库 ID：${actualId}`);
    }
    if (exercise.replacementExerciseId && exercise.sameTemplateSlot !== true) {
      report.warnings.push(`替代动作未标记 sameTemplateSlot：${exercise.replacementExerciseId}`);
    }
    if (exercise.replacementExerciseId && exercise.prIndependent !== true) {
      report.warnings.push(`替代动作未标记 PR / e1RM 独立统计：${exercise.replacementExerciseId}`);
    }
  });

  if ((appData.history || []).some((session) => session.dataFlag === 'test' || session.dataFlag === 'excluded')) {
    report.suggestions.push('检测到测试或排除训练；统计函数应继续默认排除这些记录。');
  }

  return report;
};
