import { DEFAULT_PROGRAM_TEMPLATE, DEFAULT_SCREENING_PROFILE, DEFAULT_STATUS } from '../data/trainingData';
import type {
  AppData,
  ExercisePrescription,
  ScreeningProfile,
  SupportExerciseLog,
  TodayStatus,
  TrainingMode,
  TrainingSession,
  TrainingTemplate,
  WeeklyPrescription,
} from '../models/training-model';
import { clone, findTemplate, getPrimaryMuscles, todayKey } from './engineUtils';
import { buildAdaptiveDeloadDecision, reconcileScreeningProfile } from './adaptiveFeedbackEngine';
import { buildSessionExplanations, buildTodayExplanations } from './explainability/trainingExplainability';
import { applyStatusRules, buildSetPrescription, buildWarmupSets, makeSuggestion, shouldUseTopBackoff } from './progressionEngine';
import { buildSupportPlan, buildWeeklyPrescription, getMuscleRemaining } from './supportPlanEngine';
import { buildTrainingLevelAssessment, formatAutoTrainingLevel, type TrainingLevelAssessment } from './trainingLevelEngine';

const TEMPLATE_ROTATION: Record<string, string> = {
  'push-a': 'pull-a',
  'pull-a': 'legs-a',
  'legs-a': 'push-a',
  upper: 'lower',
  lower: 'upper',
  'upper-a': 'lower-a',
  'lower-a': 'upper-b',
  'upper-b': 'lower-b',
  'lower-b': 'upper-a',
};

const slugify = (value: string) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const buildSessionExerciseSetLogs = (
  exercise: ExercisePrescription,
  history: TrainingSession[],
  trainingLevelAssessment?: TrainingLevelAssessment,
): ExercisePrescription => {
  const suggestion = makeSuggestion(exercise, history);
  const setPrescription = buildSetPrescription(exercise, suggestion);
  const replacementName = exercise.replacementSuggested || '';
  const resolvedName = replacementName || exercise.name;
  const resolvedId = replacementName ? `${exercise.id}__auto_alt_${slugify(replacementName) || 'alt'}` : exercise.id;
  const useTopBackoff = shouldUseTopBackoff(exercise) && Boolean(trainingLevelAssessment?.readinessForAdvancedFeatures.topBackoff);

  const sets = Array.from({ length: Number(exercise.sets) }, (_, index) => ({
    id: `${resolvedId}-${index + 1}`,
    type: useTopBackoff ? (index === 0 ? 'top' : 'backoff') : 'straight',
    weight: useTopBackoff ? (index === 0 ? setPrescription.topWeight : setPrescription.backoffWeight) : setPrescription.topWeight,
    reps: useTopBackoff ? (index === 0 ? setPrescription.topReps : setPrescription.backoffReps) : setPrescription.topReps,
    rpe: '',
    rir: Math.min(2, exercise.targetRir?.[1] ?? 2),
    targetRir: exercise.targetRir,
    note: '',
    painFlag: false,
    done: false,
  }));

  return {
    ...exercise,
    id: resolvedId,
    baseId: exercise.id,
    originalName: exercise.name,
    name: resolvedName,
    autoReplaced: Boolean(replacementName),
    targetSummary: suggestion.targetSummary,
    lastSummary: suggestion.lastSummary,
    suggestion: `${suggestion.note} ${setPrescription.summary}`.trim(),
    setPrescription,
    warmupSets: buildWarmupSets(setPrescription.topWeight, exercise),
    alternatives: (exercise.alternatives || []).filter((item) => item !== resolvedName),
    sets,
  };
};

export const createSession = (
  template: TrainingTemplate,
  status: TodayStatus,
  history: TrainingSession[],
  trainingMode: TrainingMode = 'hybrid',
  weeklyPrescription: WeeklyPrescription | null = null,
  supportPlan: ReturnType<typeof buildSupportPlan> | null = null,
  screening: ScreeningProfile = DEFAULT_SCREENING_PROFILE,
  mesocyclePlan?: AppData['mesocyclePlan']
) => {
  const trainingLevelAssessment = buildTrainingLevelAssessment({ history });
  const adjustedPlan = applyStatusRules(template, status, trainingMode, weeklyPrescription, history, screening, mesocyclePlan);
  const resolvedWeeklyPrescription =
    weeklyPrescription ||
    buildWeeklyPrescription({
      history,
      activeSession: null,
      trainingMode,
      todayStatus: status,
      screeningProfile: screening,
      programTemplate: DEFAULT_PROGRAM_TEMPLATE,
    });

  const rawSupportPlan =
    supportPlan ||
    buildSupportPlan(
      {
        history,
        todayStatus: status,
        screeningProfile: screening,
        programTemplate: DEFAULT_PROGRAM_TEMPLATE,
      },
      template
    );
  const shouldMinimizeSupport =
    (trainingLevelAssessment.level === 'unknown' || trainingLevelAssessment.level === 'beginner') &&
    !trainingLevelAssessment.readinessForAdvancedFeatures.advancedExerciseSelection;
  const resolvedSupportPlan = shouldMinimizeSupport
    ? {
        ...rawSupportPlan,
        correctionModules: rawSupportPlan.correctionModules.slice(0, 1),
        functionalAddons: rawSupportPlan.functionalAddons.slice(0, 1),
        totalDurationMin:
          rawSupportPlan.mainline.durationMin +
          rawSupportPlan.correctionModules.slice(0, 1).reduce((sum, module) => sum + Number(module.durationMin || 0), 0) +
          rawSupportPlan.functionalAddons.slice(0, 1).reduce((sum, addon) => sum + Number(addon.durationMin || 0), 0),
      }
    : rawSupportPlan;

  const exercises = adjustedPlan.exercises.map((exercise) => buildSessionExerciseSetLogs(exercise, history, trainingLevelAssessment));
  const explanations = buildTodayExplanations({
    template,
    adjustedPlan: { ...adjustedPlan, exercises },
    supportPlan: resolvedSupportPlan,
    weeklyPrescription: resolvedWeeklyPrescription,
    screening,
    todayStatus: status,
  });

  const supportExerciseLogs: SupportExerciseLog[] = [
    ...(resolvedSupportPlan.correctionModules || []).flatMap((module) =>
      module.exercises.map((exercise) => ({
        moduleId: module.id,
        exerciseId: exercise.exerciseId,
        exerciseName: exercise.name,
        blockType: 'correction' as const,
        plannedSets: Math.max(0, exercise.sets),
        completedSets: 0,
      }))
    ),
    ...(resolvedSupportPlan.functionalAddons || []).flatMap((module) =>
      module.exercises.map((exercise) => ({
        moduleId: module.id,
        exerciseId: exercise.exerciseId,
        exerciseName: exercise.name,
        blockType: 'functional' as const,
        plannedSets: Math.max(0, exercise.sets),
        completedSets: 0,
      }))
    ),
  ];

  const baselineExplanation =
    trainingLevelAssessment.level === 'unknown'
      ? '系统仍在建立训练基线，因此本次默认关闭激进进阶和复杂顶组/回退组。完成 2–3 次训练后，会开始估算当前力量、有效组和训练等级。'
      : trainingLevelAssessment.limitations.some((item) => item.includes('不适') || item.includes('poor'))
        ? `当前自动等级为${formatAutoTrainingLevel(trainingLevelAssessment.level)}，但动作质量或不适信号限制了高级推荐。`
        : `当前自动等级为${formatAutoTrainingLevel(trainingLevelAssessment.level)}，系统会按真实记录逐步开放更完整的训练处方。`;

  const session: TrainingSession = {
    id: `session-${Date.now()}`,
    date: todayKey(),
    templateId: template.id,
    templateName: adjustedPlan.name,
    programTemplateId: template.id,
    programTemplateName: adjustedPlan.name,
    isExperimentalTemplate: Boolean(template.isExperimentalTemplate),
    focus: adjustedPlan.focus,
    trainingMode,
    status: clone(status),
    startedAt: new Date().toISOString(),
    completed: false,
    durationMin: adjustedPlan.duration,
    supportPlan: resolvedSupportPlan,
    correctionBlock: clone(resolvedSupportPlan.correctionModules || []),
    functionalBlock: clone(resolvedSupportPlan.functionalAddons || []),
    supportExerciseLogs,
    exercises,
    currentExerciseId: exercises[0]?.id,
    currentSetIndex: 0,
    currentFocusStepId: supportExerciseLogs.find((log) => log.blockType === 'correction' && log.plannedSets > 0)
      ? `correction:${supportExerciseLogs.find((log) => log.blockType === 'correction' && log.plannedSets > 0)?.moduleId}:${supportExerciseLogs.find((log) => log.blockType === 'correction' && log.plannedSets > 0)?.exerciseId}:0`
      : exercises[0]?.warmupSets?.length
        ? `main:${exercises[0].id}:warmup:0`
        : `main:${exercises[0]?.id}:working:0`,
    currentFocusStepType: supportExerciseLogs.some((log) => log.blockType === 'correction' && log.plannedSets > 0)
      ? 'correction'
      : exercises[0]?.warmupSets?.length
        ? 'warmup'
        : 'working',
    focusSessionComplete: false,
    focusActualSetDrafts: [],
    focusCompletedStepIds: [],
    focusSkippedStepIds: [],
    focusWarmupSetLogs: [],
    deloadDecision: adjustedPlan.deloadDecision,
    explanations: [baselineExplanation, ...explanations],
  };

  return {
    ...session,
    explanations: [baselineExplanation, ...buildSessionExplanations(session)],
  };
};

export const pickSuggestedTemplate = (data: Partial<AppData>) => {
  const status = data.todayStatus || DEFAULT_STATUS;
  if (Number(status.time) <= 30) return 'quick-30';

  const screening = reconcileScreeningProfile(data.screeningProfile, data.history || []);
  const deloadDecision = buildAdaptiveDeloadDecision({ ...data, screeningProfile: screening });
  if (deloadDecision.autoSwitchTemplateId) return deloadDecision.autoSwitchTemplateId;

  const weekly = buildWeeklyPrescription({ ...data, screeningProfile: screening });
  const soreness = status.soreness || [];
  const templates = data.templates || [];

  const scores = templates.map((template) => {
    const prescribed = applyStatusRules(template, status, data.trainingMode || 'hybrid', weekly, data.history || [], screening);
    const score = prescribed.exercises.reduce((sum, exercise) => {
      const primary = getPrimaryMuscles(exercise)[0];
      const remaining = getMuscleRemaining(weekly, primary);
      const sorenessPenalty = soreness.includes(primary as never) ? 8 : 0;
      const fatiguePenalty = exercise.fatigueCost === 'high' && status.energy === '低' ? 3 : 0;
      const replacementPenalty = exercise.replacementSuggested ? 1.5 : 0;
      const conservativePenalty = exercise.conservativeTopSet ? 1 : 0;
      return sum + Math.max(0, remaining) - sorenessPenalty - fatiguePenalty - replacementPenalty - conservativePenalty;
    }, 0);

    return { id: template.id, score };
  });

  const best = [...scores].sort((left, right) => right.score - left.score)[0];
  if (best?.score > 0) return best.id;

  const lastTemplateId = data.history?.[0]?.templateId;
  if (lastTemplateId && TEMPLATE_ROTATION[lastTemplateId]) return TEMPLATE_ROTATION[lastTemplateId];

  const selected = typeof data.selectedTemplateId === 'string' ? data.selectedTemplateId : 'push-a';
  return findTemplate(templates, selected)?.id || 'push-a';
};
