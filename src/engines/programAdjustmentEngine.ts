import {
  CORRECTION_MODULES,
  DEFAULT_PROGRAM_TEMPLATE,
  DEFAULT_SCREENING_PROFILE,
  EXERCISE_DISPLAY_NAMES,
  EXERCISE_KNOWLEDGE_OVERRIDES,
  FUNCTIONAL_ADDONS,
  INITIAL_TEMPLATES,
} from '../data/trainingData';
import {
  formatAdjustmentChangeLabel,
  formatDayTemplateName,
  formatExerciseName,
  formatProgramTemplateName,
} from '../i18n/formatters';
import type {
  AdjustmentChange,
  AdjustmentChangeType,
  DayTemplate,
  EstimateConfidence,
  ExerciseTemplate,
  PainPattern,
  ProgramAdjustmentDiff,
  ProgramAdjustmentDraft,
  ProgramAdjustmentHistoryItem,
  ProgramTemplate,
  ScreeningProfile,
  TrainingTemplate,
  WeeklyActionRecommendation,
} from '../models/training-model';
import { clone, enrichExercise, number } from './engineUtils';

export interface AdjustmentDraftContext {
  programTemplate?: ProgramTemplate | null;
  templates?: TrainingTemplate[];
  screeningProfile?: ScreeningProfile | null;
  painPatterns?: PainPattern[];
}

export interface DaySelectionResult {
  dayTemplateId?: string;
  dayTemplateName?: string;
  confidence: EstimateConfidence;
  note?: string;
  insertAfterExerciseId?: string;
  insertPositionLabel?: string;
}

export interface NewExerciseSelectionContext extends AdjustmentDraftContext {
  sourceTemplateId?: string;
}

export interface ApplyAdjustmentDraftResult {
  ok: boolean;
  message?: string;
  draft: ProgramAdjustmentDraft;
  experimentalTemplate?: TrainingTemplate;
  updatedProgramTemplate?: ProgramTemplate;
  historyItem?: ProgramAdjustmentHistoryItem;
}

const confidenceRank: Record<EstimateConfidence, number> = { low: 0, medium: 1, high: 2 };
const changeTypeLabel: Record<AdjustmentChangeType, string> = {
  add_sets: '增加组数',
  remove_sets: '减少组数',
  add_new_exercise: '新增动作',
  swap_exercise: '替代动作',
  reduce_support: '减少 support',
  increase_support: '增加 support',
  keep: '保持当前结构',
};

const correctionStrategyOrder = ['light', 'moderate', 'aggressive'] as const;
const functionalStrategyOrder = ['minimal', 'standard', 'enhanced'] as const;

const makeId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entry]) => entry !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`);
  return `{${entries.join(',')}}`;
};

export const hashProgramTemplate = (programTemplate: TrainingTemplate | ProgramTemplate): string => {
  const serialized = stableStringify(programTemplate);
  let hash = 2166136261;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `tpl-${(hash >>> 0).toString(16)}`;
};

const cloneTemplate = (template: TrainingTemplate): TrainingTemplate => clone(template);
const cloneProgram = (program: ProgramTemplate): ProgramTemplate => clone(program);

const highestConfidence = (recommendations: WeeklyActionRecommendation[]): EstimateConfidence =>
  recommendations.reduce<EstimateConfidence>(
    (best, item) => (confidenceRank[item.confidence] > confidenceRank[best] ? item.confidence : best),
    'low',
  );

const dayTemplateFromTrainingTemplate = (template: TrainingTemplate): DayTemplate => ({
  id: template.id,
  name: template.name,
  focusMuscles: [...new Set(template.exercises.map((exercise) => exercise.muscle).filter(Boolean))] as DayTemplate['focusMuscles'],
  correctionBlockIds: [],
  mainExerciseIds: template.exercises.map((exercise) => exercise.id),
  functionalBlockIds: [],
  estimatedDurationMin: template.duration,
});

const buildProgramDayTemplates = (programTemplate: ProgramTemplate, templates: TrainingTemplate[]) =>
  programTemplate.dayTemplates.length ? programTemplate.dayTemplates : templates.map(dayTemplateFromTrainingTemplate);

const exerciseMatchesId = (exercise: ExerciseTemplate, exerciseId?: string) =>
  Boolean(
    exerciseId &&
      [exercise.id, exercise.baseId, exercise.canonicalExerciseId]
        .filter(Boolean)
        .includes(exerciseId),
  );

const matchesMuscle = (exercise: ExerciseTemplate, muscleId?: string) =>
  Boolean(
    muscleId &&
      (exercise.muscle === muscleId ||
        exercise.primaryMuscles?.includes(muscleId) ||
        exercise.secondaryMuscles?.includes(muscleId) ||
        exercise.muscleContribution?.[muscleId]),
  );

const findExerciseIndex = (template: TrainingTemplate, change: Pick<AdjustmentChange, 'exerciseId' | 'muscleId'>) => {
  const exact = change.exerciseId
    ? template.exercises.findIndex((exercise) => exerciseMatchesId(exercise, change.exerciseId))
    : -1;
  if (exact >= 0) return exact;
  return template.exercises.findIndex((exercise) => matchesMuscle(exercise, change.muscleId));
};

const findTemplateById = (templates: TrainingTemplate[], id?: string) => templates.find((template) => template.id === id);

const exerciseKindFromId = (exerciseId: string): ExerciseTemplate['kind'] => {
  if (/(row|pulldown|press|squat|deadlift|rdl|hack|leg-press)/i.test(exerciseId)) return 'compound';
  if (/(machine|smith)/i.test(exerciseId)) return 'machine';
  return 'isolation';
};

const findExerciseSeed = (exerciseId: string) =>
  INITIAL_TEMPLATES.flatMap((template) => template.exercises).find((exercise) => exercise.id === exerciseId);

const buildExerciseSeed = (exerciseId: string, muscleId?: string): ExerciseTemplate => {
  const fromTemplate = findExerciseSeed(exerciseId);
  if (fromTemplate) return enrichExercise(clone(fromTemplate));

  const override = EXERCISE_KNOWLEDGE_OVERRIDES[exerciseId] || {};
  return enrichExercise({
    id: exerciseId,
    name: EXERCISE_DISPLAY_NAMES[exerciseId] || formatExerciseName(exerciseId),
    alias: EXERCISE_DISPLAY_NAMES[exerciseId] || formatExerciseName(exerciseId),
    muscle: muscleId || (Array.isArray(override.primaryMuscles) ? override.primaryMuscles[0] : '') || 'back',
    kind: exerciseKindFromId(exerciseId),
    sets: 2,
    repMin: 8,
    repMax: 12,
    rest: 90,
    startWeight: 0,
    alternatives: [],
  });
};

const resolveSourceTemplateForRecommendation = (
  recommendation: WeeklyActionRecommendation,
  templates: TrainingTemplate[],
  fallbackTemplate: TrainingTemplate,
) => {
  const exerciseId = recommendation.suggestedChange?.exerciseIds?.[0];
  if (exerciseId) {
    const exact = templates.find((template) => template.exercises.some((exercise) => exerciseMatchesId(exercise, exerciseId)));
    if (exact) return exact;
  }
  const muscleId = recommendation.suggestedChange?.muscleId;
  if (muscleId) {
    const sameMuscle = templates.find((template) => template.exercises.some((exercise) => matchesMuscle(exercise, muscleId)));
    if (sameMuscle) return sameMuscle;
  }
  return fallbackTemplate;
};

const muscleDayKeywords = (muscleId?: string) => {
  if (!muscleId) return [];
  if (muscleId === 'back') return ['pull', 'upper', 'back'];
  if (muscleId === 'chest') return ['push', 'upper', 'chest'];
  if (['quads', 'hamstrings', 'glutes', 'calves'].includes(muscleId)) return ['legs', 'lower'];
  if (['shoulders', 'triceps'].includes(muscleId)) return ['push', 'upper'];
  if (muscleId === 'biceps') return ['pull', 'upper'];
  return [];
};

const hasPainRestriction = (
  exerciseId: string,
  screeningProfile?: ScreeningProfile | null,
  painPatterns: PainPattern[] = [],
) =>
  (screeningProfile?.restrictedExercises || []).includes(exerciseId) ||
  painPatterns.some((pattern) => pattern.exerciseId === exerciseId && pattern.suggestedAction !== 'watch');

const chooseInsertAnchor = (template?: TrainingTemplate) => {
  const exercises = template?.exercises || [];
  if (!exercises.length) return { insertAfterExerciseId: undefined, insertPositionLabel: '辅助动作区末尾' };
  const reversed = [...exercises].reverse();
  const anchor =
    reversed.find((exercise) => exercise.kind !== 'compound') ||
    reversed[0];
  return {
    insertAfterExerciseId: anchor?.id,
    insertPositionLabel: anchor ? `辅助动作区，位于 ${formatExerciseName(anchor)} 之后` : '辅助动作区末尾',
  };
};

export const selectBestDayForNewExercise = (
  exercise: string | ExerciseTemplate,
  programTemplate: ProgramTemplate,
  targetMuscleId?: string,
  context: NewExerciseSelectionContext = {},
): DaySelectionResult => {
  const seeded = typeof exercise === 'string' ? buildExerciseSeed(exercise, targetMuscleId) : enrichExercise(clone(exercise));
  const templates = context.templates?.length ? context.templates : INITIAL_TEMPLATES;
  const dayTemplates = buildProgramDayTemplates(programTemplate, templates);

  if (hasPainRestriction(seeded.id, context.screeningProfile || DEFAULT_SCREENING_PROFILE, context.painPatterns || [])) {
    return {
      confidence: 'low',
      note: `${formatExerciseName(seeded)} 近期受到 pain 或 restricted 信号影响，系统不会自动插入。`,
    };
  }

  const keywords = muscleDayKeywords(targetMuscleId);
  const ranked = dayTemplates
    .map((day) => {
      const template = findTemplateById(templates, day.id);
      const haystack = `${day.id} ${day.name}`.toLowerCase();
      const trainsTarget = (day.focusMuscles || []).includes(targetMuscleId as never);
      const longDay = number(day.estimatedDurationMin || template?.duration) >= 85;
      const highFatigue = seeded.fatigueCost === 'high' || seeded.kind === 'compound';
      const score =
        (trainsTarget ? 4 : 0) +
        (keywords.some((keyword) => haystack.includes(keyword)) ? 3 : 0) +
        (day.id === context.sourceTemplateId ? 1 : 0) -
        (longDay && highFatigue ? 3 : 0);
      return {
        day,
        template,
        score,
        longDay,
        ...chooseInsertAnchor(template),
      };
    })
    .sort((left, right) => right.score - left.score);

  const best = ranked[0];
  if (!best) {
    return {
      confidence: 'low',
      note: '没有找到可安全插入新动作的训练日，请手动选择训练日。',
    };
  }

  if (best.score < 2) {
    return {
      dayTemplateId: best.day.id,
      dayTemplateName: best.day.name,
      confidence: 'low',
      note: '系统可以给出候选训练日，但当前把握不高，建议你手动确认。',
      insertAfterExerciseId: best.insertAfterExerciseId,
      insertPositionLabel: best.insertPositionLabel,
    };
  }

  return {
    dayTemplateId: best.day.id,
    dayTemplateName: best.day.name,
    confidence: best.longDay ? 'medium' : 'high',
    note: best.longDay ? '该训练日已经偏长，系统会把新动作尽量放在辅助动作区。' : undefined,
    insertAfterExerciseId: best.insertAfterExerciseId,
    insertPositionLabel: best.insertPositionLabel,
  };
};

const changeFromRecommendation = (
  recommendation: WeeklyActionRecommendation,
  sourceTemplate: TrainingTemplate,
  context: AdjustmentDraftContext = {},
): AdjustmentChange[] => {
  const change = recommendation.suggestedChange;
  if (!change) return [];

  const base = {
    id: `${recommendation.id}-${Math.random().toString(36).slice(2, 7)}`,
    muscleId: change.muscleId,
    reason: recommendation.recommendation,
    sourceRecommendationId: recommendation.id,
  };

  if (number(change.setsDelta) > 0) {
    const exerciseId = change.exerciseIds?.[0];
    const existingExercise = sourceTemplate.exercises.find((exercise) => exerciseMatchesId(exercise, exerciseId));
    if (existingExercise) {
      return [
        {
          ...base,
          type: 'add_sets',
          dayTemplateId: sourceTemplate.id,
          dayTemplateName: sourceTemplate.name,
          exerciseId: existingExercise.id,
          exerciseName: existingExercise.name,
          setsDelta: Math.max(1, Math.round(number(change.setsDelta))),
        },
      ];
    }

    if (exerciseId) {
      const selection = selectBestDayForNewExercise(exerciseId, context.programTemplate || DEFAULT_PROGRAM_TEMPLATE, change.muscleId, {
        ...context,
        sourceTemplateId: sourceTemplate.id,
      });
      const seed = buildExerciseSeed(exerciseId, change.muscleId);
      return [
        {
          ...base,
          type: 'add_new_exercise',
          dayTemplateId: selection.dayTemplateId,
          dayTemplateName: selection.dayTemplateName,
          exerciseId,
          exerciseName: seed.name,
          sets: Math.max(1, Math.round(number(change.setsDelta))),
          repMin: seed.repMin,
          repMax: seed.repMax,
          restSec: seed.rest,
          insertAfterExerciseId: selection.insertAfterExerciseId,
          insertPositionLabel: selection.insertPositionLabel,
          previewNote: selection.note,
        },
      ];
    }
  }

  if (number(change.setsDelta) < 0) {
    const exerciseId = change.exerciseIds?.[0];
    const existingExercise = sourceTemplate.exercises.find((exercise) => exerciseMatchesId(exercise, exerciseId));
    return [
      {
        ...base,
        type: 'remove_sets',
        dayTemplateId: sourceTemplate.id,
        dayTemplateName: sourceTemplate.name,
        exerciseId: existingExercise?.id || exerciseId,
        exerciseName: existingExercise?.name || formatExerciseName(exerciseId),
        setsDelta: Math.min(-1, Math.round(number(change.setsDelta))),
      },
    ];
  }

  if (change.removeExerciseIds?.length) {
    return change.removeExerciseIds.map((exerciseId, index) => ({
      ...base,
      id: `${recommendation.id}-swap-${index + 1}`,
      type: 'swap_exercise' as const,
      dayTemplateId: sourceTemplate.id,
      dayTemplateName: sourceTemplate.name,
      exerciseId,
      exerciseName: formatExerciseName(exerciseId),
    }));
  }

  if (change.supportDoseAdjustment === 'reduce' || change.supportDoseAdjustment === 'minimal') {
    return [
      {
        ...base,
        type: 'reduce_support',
        dayTemplateId: sourceTemplate.id,
        dayTemplateName: sourceTemplate.name,
      },
    ];
  }

  if (change.supportDoseAdjustment === 'increase' || change.supportDoseAdjustment === 'boost') {
    return [
      {
        ...base,
        type: 'increase_support',
        dayTemplateId: sourceTemplate.id,
        dayTemplateName: sourceTemplate.name,
      },
    ];
  }

  return [
    {
      ...base,
      type: 'keep',
      dayTemplateId: sourceTemplate.id,
      dayTemplateName: sourceTemplate.name,
    },
  ];
};

const resolvePrimarySourceTemplateId = (changes: AdjustmentChange[], fallbackId: string) => {
  const counts = changes.reduce<Record<string, number>>((result, change) => {
    const dayId = change.dayTemplateId;
    if (!dayId) return result;
    result[dayId] = (result[dayId] || 0) + 1;
    return result;
  }, {});
  const ranked = Object.entries(counts).sort((left, right) => right[1] - left[1]);
  return ranked[0]?.[0] || fallbackId;
};

export const createAdjustmentDraftFromRecommendations = (
  recommendations: WeeklyActionRecommendation[],
  sourceProgramTemplate: TrainingTemplate,
  context: AdjustmentDraftContext = {},
): ProgramAdjustmentDraft => {
  const actionable = recommendations.filter((item) => item.suggestedChange);
  const availableTemplates = context.templates?.length ? context.templates : [sourceProgramTemplate];
  const changes = actionable.flatMap((recommendation) => {
    const template = resolveSourceTemplateForRecommendation(recommendation, availableTemplates, sourceProgramTemplate);
    return changeFromRecommendation(recommendation, template, context);
  });
  const sourceProgramTemplateId = resolvePrimarySourceTemplateId(changes, sourceProgramTemplate.id);
  const resolvedSourceTemplate = findTemplateById(availableTemplates, sourceProgramTemplateId) || sourceProgramTemplate;
  const notes = changes.flatMap((change) => (change.previewNote ? [change.previewNote] : []));

  return {
    id: makeId('adjustment-draft'),
    createdAt: new Date().toISOString(),
    status: 'previewed',
    sourceProgramTemplateId: resolvedSourceTemplate.id,
    sourceTemplateSnapshotHash: hashProgramTemplate(resolvedSourceTemplate),
    sourceTemplateUpdatedAt: resolvedSourceTemplate.updatedAt || new Date().toISOString(),
    title: `${formatProgramTemplateName(resolvedSourceTemplate)} 下周实验调整`,
    summary: changes.length
      ? `基于 ${actionable.length} 条建议生成实验调整预览，应用前会校验原模板版本。`
      : '当前没有可安全自动应用的训练计划调整。',
    selectedRecommendationIds: recommendations.map((item) => item.id),
    changes,
    confidence: changes.some((change) => change.type === 'add_new_exercise' && !change.dayTemplateId)
      ? 'low'
      : notes.length
        ? 'medium'
        : highestConfidence(recommendations),
    notes: notes.length ? notes : actionable.length ? [] : ['当前建议更适合作为人工参考，暂不生成自动调整。'],
  };
};

const summarizeSupportState = (programTemplate: ProgramTemplate, dayTemplateId?: string, fallbackName?: string) => {
  const day = programTemplate.dayTemplates.find((item) => item.id === dayTemplateId);
  const dayLabel = formatDayTemplateName(day?.name || fallbackName || dayTemplateId);
  return `${dayLabel}：纠偏 ${programTemplate.correctionStrategy} / 功能 ${programTemplate.functionalStrategy} / 纠偏模块 ${day?.correctionBlockIds.length || 0} 项 / 功能补丁 ${day?.functionalBlockIds.length || 0} 项`;
};

const stepStrategy = <T extends readonly string[]>(sequence: T, current: string, direction: -1 | 1) => {
  const index = Math.max(0, sequence.indexOf(current as T[number]));
  const nextIndex = Math.max(0, Math.min(sequence.length - 1, index + direction));
  return sequence[nextIndex];
};

const ensureProgramDayTemplate = (
  programTemplate: ProgramTemplate,
  sourceTemplate: TrainingTemplate,
  experimentalTemplate: TrainingTemplate,
) => {
  const index = programTemplate.dayTemplates.findIndex((day) => day.id === sourceTemplate.id || day.id === experimentalTemplate.id);
  const nextDay: DayTemplate = {
    ...(index >= 0 ? programTemplate.dayTemplates[index] : dayTemplateFromTrainingTemplate(sourceTemplate)),
    id: experimentalTemplate.id,
    name: experimentalTemplate.name,
    mainExerciseIds: experimentalTemplate.exercises.map((exercise) => exercise.baseId || exercise.id),
    estimatedDurationMin: experimentalTemplate.duration,
  };
  if (index >= 0) programTemplate.dayTemplates[index] = nextDay;
  else programTemplate.dayTemplates.push(nextDay);
  return nextDay;
};

const pickSupportModuleForDay = (template: TrainingTemplate, muscleId?: string) => {
  const focus = `${template.id} ${template.name} ${template.focus}`.toLowerCase();
  if (['quads', 'hamstrings', 'glutes', 'calves'].includes(muscleId || '') || /leg|lower/.test(focus)) return 'corr_ankle_mobility_01';
  if (muscleId === 'back' || /pull|back/.test(focus)) return 'corr_thoracic_rotation_01';
  if (muscleId === 'chest' || muscleId === 'shoulders' || /push|upper/.test(focus)) return 'corr_scapular_control_01';
  return 'corr_core_control_01';
};

const pickFunctionalAddonForDay = (template: TrainingTemplate, muscleId?: string) => {
  const focus = `${template.id} ${template.name} ${template.focus}`.toLowerCase();
  if (['quads', 'hamstrings', 'glutes', 'calves'].includes(muscleId || '') || /leg|lower/.test(focus)) return 'func_single_leg_01';
  if (muscleId === 'shoulders' || /push|upper/.test(focus)) return 'func_overhead_stability_01';
  return 'func_core_anti_rotation_01';
};

const applySupportChange = (
  programTemplate: ProgramTemplate,
  experimentalTemplate: TrainingTemplate,
  sourceTemplate: TrainingTemplate,
  change: AdjustmentChange,
) => {
  const day = ensureProgramDayTemplate(programTemplate, sourceTemplate, experimentalTemplate);
  let changed = false;

  if (change.type === 'reduce_support') {
    const nextCorrection = stepStrategy(correctionStrategyOrder, programTemplate.correctionStrategy, -1) as ProgramTemplate['correctionStrategy'];
    const nextFunctional = stepStrategy(functionalStrategyOrder, programTemplate.functionalStrategy, -1) as ProgramTemplate['functionalStrategy'];
    if (nextCorrection !== programTemplate.correctionStrategy) {
      programTemplate.correctionStrategy = nextCorrection;
      changed = true;
    }
    if (nextFunctional !== programTemplate.functionalStrategy) {
      programTemplate.functionalStrategy = nextFunctional;
      changed = true;
    }
    if (day.correctionBlockIds.length > 1) {
      day.correctionBlockIds = day.correctionBlockIds.slice(0, day.correctionBlockIds.length - 1);
      changed = true;
    }
    if (day.functionalBlockIds.length > 1) {
      day.functionalBlockIds = day.functionalBlockIds.slice(0, day.functionalBlockIds.length - 1);
      changed = true;
    }
    if (number(day.estimatedDurationMin) > 35) {
      day.estimatedDurationMin = Math.max(30, number(day.estimatedDurationMin) - 5);
      experimentalTemplate.duration = day.estimatedDurationMin;
      changed = true;
    }
  }

  if (change.type === 'increase_support') {
    const nextCorrection = stepStrategy(correctionStrategyOrder, programTemplate.correctionStrategy, 1) as ProgramTemplate['correctionStrategy'];
    const nextFunctional = stepStrategy(functionalStrategyOrder, programTemplate.functionalStrategy, 1) as ProgramTemplate['functionalStrategy'];
    if (nextCorrection !== programTemplate.correctionStrategy) {
      programTemplate.correctionStrategy = nextCorrection;
      changed = true;
    }
    if (nextFunctional !== programTemplate.functionalStrategy) {
      programTemplate.functionalStrategy = nextFunctional;
      changed = true;
    }
    const correctionId = pickSupportModuleForDay(experimentalTemplate, change.muscleId);
    if (correctionId && !day.correctionBlockIds.includes(correctionId) && CORRECTION_MODULES.some((module) => module.id === correctionId)) {
      day.correctionBlockIds = [...day.correctionBlockIds, correctionId];
      changed = true;
    }
    const functionalId = pickFunctionalAddonForDay(experimentalTemplate, change.muscleId);
    if (functionalId && !day.functionalBlockIds.includes(functionalId) && FUNCTIONAL_ADDONS.some((addon) => addon.id === functionalId)) {
      day.functionalBlockIds = [...day.functionalBlockIds, functionalId];
      changed = true;
    }
    day.estimatedDurationMin = Math.max(number(day.estimatedDurationMin), number(day.estimatedDurationMin) + 5);
    experimentalTemplate.duration = day.estimatedDurationMin;
    changed = true;
  }

  day.name = experimentalTemplate.name;
  day.mainExerciseIds = experimentalTemplate.exercises.map((exercise) => exercise.baseId || exercise.id);
  return changed;
};

const estimateSetDurationMin = (exercise: ExerciseTemplate, setCount: number) => {
  const restMin = Math.max(0.5, number(exercise.rest) / 60);
  const effortMin = exercise.kind === 'compound' ? 0.8 : 0.55;
  return Math.max(1, Math.round((restMin + effortMin) * setCount));
};

const buildNewExerciseTemplate = (change: AdjustmentChange): ExerciseTemplate => {
  const seed = buildExerciseSeed(change.exerciseId || 'unknown', change.muscleId);
  return enrichExercise({
    ...seed,
    id: change.exerciseId || seed.id,
    name: change.exerciseName || seed.name,
    alias: change.exerciseName || seed.alias || seed.name,
    muscle: change.muscleId || seed.muscle,
    sets: Math.max(1, number(change.sets) || seed.sets),
    repMin: Math.max(1, number(change.repMin) || seed.repMin),
    repMax: Math.max(number(change.repMin) || seed.repMin, number(change.repMax) || seed.repMax),
    rest: Math.max(30, number(change.restSec) || seed.rest),
    startWeight: 0,
  });
};

const applyExerciseChange = (template: TrainingTemplate, change: AdjustmentChange) => {
  const index = findExerciseIndex(template, change);

  if ((change.type === 'add_sets' || change.type === 'remove_sets') && index >= 0) {
    const exercise = template.exercises[index];
    const delta = number(change.setsDelta);
    const nextSets = Math.max(1, number(exercise.sets) + delta);
    template.exercises[index] = { ...exercise, sets: nextSets };
    template.duration = Math.max(20, template.duration + estimateSetDurationMin(exercise, Math.abs(delta)));
    return true;
  }

  if (change.type === 'swap_exercise' && index >= 0 && change.replacementExerciseId) {
    const current = template.exercises[index];
    const replacement = buildExerciseSeed(change.replacementExerciseId, change.muscleId || current.muscle);
    template.exercises[index] = {
      ...replacement,
      id: change.replacementExerciseId,
      name: change.replacementExerciseName || replacement.name,
      alias: change.replacementExerciseName || replacement.alias || replacement.name,
      sets: current.sets,
      repMin: current.repMin,
      repMax: current.repMax,
      rest: current.rest,
      startWeight: current.startWeight,
    };
    return true;
  }

  if (change.type === 'add_new_exercise' && change.exerciseId) {
    const nextExercise = buildNewExerciseTemplate(change);
    const insertIndex = change.insertAfterExerciseId
      ? template.exercises.findIndex((exercise) => exercise.id === change.insertAfterExerciseId) + 1
      : template.exercises.length;
    const nextExercises = [...template.exercises];
    nextExercises.splice(Math.max(0, insertIndex), 0, nextExercise);
    template.exercises = nextExercises;
    template.duration = Math.max(20, template.duration + estimateSetDurationMin(nextExercise, nextExercise.sets));
    return true;
  }

  return change.type === 'keep';
};

const riskLevelForChange = (change: AdjustmentChange, applied: boolean, note = ''): 'low' | 'medium' | 'high' => {
  if (!applied || note) return 'high';
  if (change.type === 'swap_exercise') return change.replacementExerciseId ? 'medium' : 'high';
  if (change.type === 'add_new_exercise') return change.dayTemplateId ? 'medium' : 'high';
  if (change.type === 'add_sets' || change.type === 'remove_sets') return Math.abs(number(change.setsDelta)) >= 4 ? 'medium' : 'low';
  return 'low';
};

export const buildAdjustmentDiff = (
  draft: ProgramAdjustmentDraft,
  sourceProgramTemplate: TrainingTemplate,
  programTemplate: ProgramTemplate = DEFAULT_PROGRAM_TEMPLATE,
  templates: TrainingTemplate[] = [sourceProgramTemplate],
): ProgramAdjustmentDiff => {
  const templateMap = new Map(templates.map((template) => [template.id, cloneTemplate(template)]));
  if (!templateMap.has(sourceProgramTemplate.id)) templateMap.set(sourceProgramTemplate.id, cloneTemplate(sourceProgramTemplate));
  const previewProgram = cloneProgram(programTemplate);

  const changes = draft.changes.map((change) => {
    const targetTemplate = templateMap.get(change.dayTemplateId || draft.sourceProgramTemplateId) || cloneTemplate(sourceProgramTemplate);
    let before = '保持当前结构';
    let after = '保持当前结构';
    let note = change.previewNote || '';
    let applied = false;

    if (change.type === 'add_sets' || change.type === 'remove_sets') {
      const index = findExerciseIndex(targetTemplate, change);
      const exercise = index >= 0 ? targetTemplate.exercises[index] : undefined;
      if (exercise) {
        before = `${formatExerciseName(exercise)}：${number(exercise.sets)} 组`;
        const previewTemplate = cloneTemplate(targetTemplate);
        applied = applyExerciseChange(previewTemplate, change);
        const previewExercise = previewTemplate.exercises[index];
        after = `${formatExerciseName(previewExercise)}：${number(previewExercise.sets)} 组`;
      } else {
        before = '当前模板里没有找到可直接调整的动作';
        after = '需要你手动确认具体动作后再调整';
      }
    }

    if (change.type === 'add_new_exercise') {
      const dayName = formatDayTemplateName(change.dayTemplateName || change.dayTemplateId || targetTemplate.name);
      before = `${dayName}：当前没有 ${formatExerciseName(change.exerciseName || change.exerciseId)}`;
      if (change.dayTemplateId) {
        after = `${dayName}：新增 ${formatExerciseName(change.exerciseName || change.exerciseId)} ${number(change.sets)} 组`;
        if (change.repMin && change.repMax) after += `，${change.repMin}-${change.repMax} 次`;
        if (change.restSec) after += `，休息 ${change.restSec} 秒`;
        if (change.insertPositionLabel) after += `，位置：${change.insertPositionLabel}`;
        applied = true;
      } else {
        after = `${dayName}：系统暂时不能安全自动插入，需要手动选择训练日`;
      }
    }

    if (change.type === 'swap_exercise') {
      before = formatExerciseName(change.exerciseName || change.exerciseId);
      after = change.replacementExerciseId
        ? `${formatExerciseName(change.replacementExerciseName || change.replacementExerciseId)}（替代）`
        : '需要人工选择更安全的替代动作';
      applied = Boolean(change.replacementExerciseId);
    }

    if (change.type === 'reduce_support' || change.type === 'increase_support') {
      before = summarizeSupportState(previewProgram, change.dayTemplateId || sourceProgramTemplate.id, change.dayTemplateName || sourceProgramTemplate.name);
      const experimentalTemplate = cloneTemplate(sourceProgramTemplate);
      experimentalTemplate.id = `${sourceProgramTemplate.id}-preview`;
      experimentalTemplate.name = `${formatProgramTemplateName(sourceProgramTemplate)} 实验版`;
      applied = applySupportChange(previewProgram, experimentalTemplate, sourceProgramTemplate, change);
      after = summarizeSupportState(previewProgram, experimentalTemplate.id, experimentalTemplate.name);
      if (!applied) note = note || '当前 support 配置没有足够安全的调整空间。';
    }

    return {
      changeId: change.id,
      type: change.type,
      label: changeTypeLabel[change.type] || formatAdjustmentChangeLabel(change.type),
      before,
      after,
      reason: [change.reason, note].filter(Boolean).join(' '),
      riskLevel: riskLevelForChange(change, applied, note),
    };
  });

  return {
    title: draft.title,
    summary: draft.summary,
    changes,
  };
};

const summarizeMainChanges = (changes: AdjustmentChange[]) =>
  changes
    .filter((change) => !change.skipped)
    .slice(0, 3)
    .map((change) => {
      if (change.type === 'add_new_exercise') {
        return `${formatDayTemplateName(change.dayTemplateName || change.dayTemplateId)} 新增 ${formatExerciseName(change.exerciseName || change.exerciseId)}`;
      }
      if (change.type === 'add_sets' || change.type === 'remove_sets') {
        return `${formatExerciseName(change.exerciseName || change.exerciseId)}：${number(change.setsDelta) > 0 ? '+' : ''}${number(change.setsDelta)} 组`;
      }
      if (change.type === 'swap_exercise') {
        return `${formatExerciseName(change.exerciseName || change.exerciseId)} 改为 ${formatExerciseName(change.replacementExerciseName || change.replacementExerciseId)}`;
      }
      return formatAdjustmentChangeLabel(change.type);
    })
    .join(' / ');

export const applyAdjustmentDraft = (
  draft: ProgramAdjustmentDraft,
  sourceProgramTemplate: TrainingTemplate,
  currentProgramTemplate: ProgramTemplate = DEFAULT_PROGRAM_TEMPLATE,
  templates: TrainingTemplate[] = [sourceProgramTemplate],
): ApplyAdjustmentDraftResult => {
  const currentHash = hashProgramTemplate(sourceProgramTemplate);
  if (draft.sourceTemplateSnapshotHash && draft.sourceTemplateSnapshotHash !== currentHash) {
    return {
      ok: false,
      message: '原模板已变化，请重新生成调整预览。',
      draft: {
        ...draft,
        status: 'stale',
      },
    };
  }

  const experimentalTemplate = cloneTemplate(sourceProgramTemplate);
  const updatedProgramTemplate = cloneProgram(currentProgramTemplate);
  const appliedAt = new Date().toISOString();
  const experimentalId = `${sourceProgramTemplate.id}-experiment-${draft.id.slice(-6)}`;
  const appliedChanges: AdjustmentChange[] = [];
  const skippedNotes: string[] = [];

  experimentalTemplate.id = experimentalId;
  experimentalTemplate.name = `${formatProgramTemplateName(sourceProgramTemplate)} 实验版`;
  experimentalTemplate.note = `${sourceProgramTemplate.note || ''}\n实验调整：${draft.summary}`.trim();
  experimentalTemplate.updatedAt = appliedAt;
  experimentalTemplate.sourceTemplateId = sourceProgramTemplate.id;
  experimentalTemplate.sourceTemplateName = sourceProgramTemplate.name;
  experimentalTemplate.isExperimentalTemplate = true;
  experimentalTemplate.appliedAt = appliedAt;

  draft.changes.forEach((change) => {
    const nextChange: AdjustmentChange = { ...change };

    if (change.type === 'add_new_exercise' && !change.dayTemplateId) {
      nextChange.skipped = true;
      nextChange.skipReason = '系统暂时不能安全决定插入哪个训练日，请手动确认后重新生成预览。';
      appliedChanges.push(nextChange);
      skippedNotes.push(nextChange.skipReason);
      return;
    }

    if (change.type === 'reduce_support' || change.type === 'increase_support') {
      const applied = applySupportChange(updatedProgramTemplate, experimentalTemplate, sourceProgramTemplate, change);
      if (applied) {
        appliedChanges.push(nextChange);
      } else {
        nextChange.skipped = true;
        nextChange.skipReason = '当前 support 配置没有足够安全的调整空间，已跳过。';
        appliedChanges.push(nextChange);
        skippedNotes.push(nextChange.skipReason);
      }
      return;
    }

    const applied = applyExerciseChange(experimentalTemplate, change);
    if (applied) {
      appliedChanges.push(nextChange);
    } else {
      nextChange.skipped = true;
      nextChange.skipReason = `未能安全应用：${change.reason}`;
      appliedChanges.push(nextChange);
      skippedNotes.push(nextChange.skipReason);
    }
  });

  const dayTemplate = ensureProgramDayTemplate(updatedProgramTemplate, sourceProgramTemplate, experimentalTemplate);
  dayTemplate.name = experimentalTemplate.name;
  dayTemplate.mainExerciseIds = experimentalTemplate.exercises.map((exercise) => exercise.baseId || exercise.id);
  dayTemplate.estimatedDurationMin = experimentalTemplate.duration;
  experimentalTemplate.adjustmentSummary = summarizeMainChanges(appliedChanges) || '本次以 support 微调为主';

  if (skippedNotes.length) {
    experimentalTemplate.note = `${experimentalTemplate.note}\n${skippedNotes.join('\n')}`.trim();
  }

  const historyItem: ProgramAdjustmentHistoryItem = {
    id: makeId('adjustment-history'),
    appliedAt,
    sourceProgramTemplateId: sourceProgramTemplate.id,
    experimentalProgramTemplateId: experimentalTemplate.id,
    sourceProgramTemplateName: sourceProgramTemplate.name,
    experimentalProgramTemplateName: experimentalTemplate.name,
    mainChangeSummary: experimentalTemplate.adjustmentSummary,
    selectedRecommendationIds: draft.selectedRecommendationIds,
    changes: appliedChanges,
    rollbackAvailable: true,
    sourceProgramSnapshot: cloneProgram(currentProgramTemplate),
  };

  return {
    ok: true,
    draft: {
      ...draft,
      status: 'applied',
      experimentalProgramTemplateId: experimentalTemplate.id,
    },
    experimentalTemplate,
    updatedProgramTemplate,
    historyItem,
  };
};

export const rollbackAdjustment = (
  historyItem: ProgramAdjustmentHistoryItem,
): {
  restoredTemplateId: string;
  restoredProgramTemplate?: ProgramTemplate;
  updatedHistoryItem: ProgramAdjustmentHistoryItem;
} => ({
  restoredTemplateId: historyItem.sourceProgramTemplateId,
  restoredProgramTemplate: historyItem.sourceProgramSnapshot ? cloneProgram(historyItem.sourceProgramSnapshot) : undefined,
  updatedHistoryItem: {
    ...historyItem,
    rollbackAvailable: false,
    rolledBackAt: new Date().toISOString(),
  },
});
