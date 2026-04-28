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
import { buildTrainingDecisionContext, toStatusRulesDecisionContext, type TrainingDecisionContext } from './trainingDecisionContext';

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

const isAnalyticsSession = (session: TrainingSession) => session.dataFlag !== 'test' && session.dataFlag !== 'excluded';

const sessionSortKey = (session: TrainingSession) => session.finishedAt || session.startedAt || session.date || '';

export const getLatestCompletedSession = (history: TrainingSession[] = []) =>
  [...history]
    .filter((session) => isAnalyticsSession(session) && session.completed !== false)
    .sort((left, right) => sessionSortKey(right).localeCompare(sessionSortKey(left)))[0];

export const getNextTemplateAfterLastCompletedSession = (
  history: TrainingSession[] = [],
  templates: TrainingTemplate[] = [],
): string | null => {
  const latest = getLatestCompletedSession(history);
  const latestTemplateId = latest?.templateId;
  if (!latestTemplateId) return null;
  const rotatedId = TEMPLATE_ROTATION[latestTemplateId];
  if (rotatedId && findTemplate(templates, rotatedId)) return rotatedId;
  const templateIds = templates.map((template) => template.id);
  const latestIndex = templateIds.indexOf(latestTemplateId);
  if (latestIndex >= 0 && templateIds.length > 1) return templateIds[(latestIndex + 1) % templateIds.length];
  return null;
};

const buildSessionExerciseSetLogs = (
  exercise: ExercisePrescription,
  history: TrainingSession[],
  trainingLevelAssessment?: TrainingLevelAssessment,
): ExercisePrescription => {
  const suggestion = makeSuggestion(exercise, history);
  const setPrescription = buildSetPrescription(exercise, suggestion);
  const resolvedName = exercise.name;
  const resolvedId = exercise.id;
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
    baseId: exercise.baseId || exercise.id,
    originalName: exercise.name,
    name: resolvedName,
    autoReplaced: false,
    targetSummary: suggestion.targetSummary,
    lastSummary: suggestion.lastSummary,
    suggestion: `${suggestion.note} ${setPrescription.summary}`.trim(),
    setPrescription,
    warmupSets: buildWarmupSets(setPrescription.topWeight, exercise),
    alternatives: exercise.alternatives || [],
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
  mesocyclePlan?: AppData['mesocyclePlan'],
  decisionContext: Partial<TrainingDecisionContext> = {}
) => {
  const context = buildTrainingDecisionContext(
    {
      history,
      todayStatus: status,
      trainingMode,
      screeningProfile: screening,
      mesocyclePlan,
      programTemplate: DEFAULT_PROGRAM_TEMPLATE,
    },
    decisionContext
  );
  const resolvedStatus = context.todayStatus;
  const resolvedHistory = context.history;
  const resolvedTrainingMode = context.trainingMode;
  const resolvedScreening = context.screeningProfile || screening;
  const resolvedMesocyclePlan = context.mesocyclePlan || mesocyclePlan;
  const resolvedProgramTemplate = context.programTemplate || DEFAULT_PROGRAM_TEMPLATE;
  const statusRulesContext = toStatusRulesDecisionContext(context);
  const trainingLevelAssessment = buildTrainingLevelAssessment({ history: resolvedHistory });
  const adjustedPlan = applyStatusRules(
    template,
    resolvedStatus,
    resolvedTrainingMode,
    weeklyPrescription,
    resolvedHistory,
    resolvedScreening,
    resolvedMesocyclePlan,
    statusRulesContext
  );
  const resolvedWeeklyPrescription =
    weeklyPrescription ||
    buildWeeklyPrescription({
      history: resolvedHistory,
      activeSession: null,
      trainingMode: resolvedTrainingMode,
      todayStatus: resolvedStatus,
      screeningProfile: resolvedScreening,
      programTemplate: resolvedProgramTemplate,
    });

  const rawSupportPlan =
    supportPlan ||
    buildSupportPlan(
      {
        history: resolvedHistory,
        todayStatus: resolvedStatus,
        screeningProfile: resolvedScreening,
        programTemplate: resolvedProgramTemplate,
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

  const exercises = adjustedPlan.exercises.map((exercise) => buildSessionExerciseSetLogs(exercise, resolvedHistory, trainingLevelAssessment));
  const explanations = buildTodayExplanations({
    template,
    adjustedPlan: { ...adjustedPlan, exercises },
    supportPlan: resolvedSupportPlan,
    weeklyPrescription: resolvedWeeklyPrescription,
    screening: resolvedScreening,
    todayStatus: resolvedStatus,
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
    trainingMode: resolvedTrainingMode,
    status: clone(resolvedStatus),
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

export const scoreSuggestedTemplates = (data: Partial<AppData>, decisionContext: Partial<TrainingDecisionContext> = {}) => {
  const context = buildTrainingDecisionContext(data, decisionContext);
  const status = context.todayStatus || DEFAULT_STATUS;
  const screening = reconcileScreeningProfile(context.screeningProfile, context.history || []);
  const weekly = buildWeeklyPrescription({
    ...data,
    history: context.history,
    todayStatus: status,
    trainingMode: context.trainingMode,
    screeningProfile: screening,
    programTemplate: context.programTemplate || data.programTemplate,
  });
  const soreness = status.soreness || [];
  const templates = data.templates || [];
  const statusRulesContext = toStatusRulesDecisionContext(context);

  return templates.map((template) => {
    const prescribed = applyStatusRules(template, status, context.trainingMode, weekly, context.history || [], screening, context.mesocyclePlan, statusRulesContext);
    const score = prescribed.exercises.reduce((sum, exercise) => {
      const primary = getPrimaryMuscles(exercise)[0];
      const remaining = getMuscleRemaining(weekly, primary);
      const sorenessPenalty = soreness.includes(primary as never) ? 8 : 0;
      const fatiguePenalty = exercise.fatigueCost === 'high' && status.energy === '低' ? 3 : 0;
      const replacementPenalty = exercise.replacementSuggested ? 1.5 : 0;
      const conservativePenalty = exercise.conservativeTopSet ? 1 : 0;
      const healthRecoveryPenalty =
        prescribed.readinessResult?.trainingAdjustment === 'recovery'
          ? exercise.fatigueCost === 'high'
            ? 4
            : exercise.kind === 'compound'
              ? 2
              : 0
          : prescribed.readinessResult?.trainingAdjustment === 'conservative' && exercise.fatigueCost === 'high'
            ? 2
            : 0;
      return sum + Math.max(0, remaining) - sorenessPenalty - fatiguePenalty - replacementPenalty - conservativePenalty - healthRecoveryPenalty;
    }, 0);

    return { id: template.id, score };
  });
};

export const pickSuggestedTemplate = (data: Partial<AppData>, decisionContext: Partial<TrainingDecisionContext> = {}) => {
  const context = buildTrainingDecisionContext(data, decisionContext);
  const status = context.todayStatus || DEFAULT_STATUS;
  if (Number(status.time) <= 30) return 'quick-30';

  const screening = reconcileScreeningProfile(context.screeningProfile, context.history || []);
  const deloadDecision = buildAdaptiveDeloadDecision({ ...data, history: context.history, todayStatus: status, trainingMode: context.trainingMode, screeningProfile: screening });
  if (deloadDecision.autoSwitchTemplateId) return deloadDecision.autoSwitchTemplateId;

  const scores = scoreSuggestedTemplates(data, context);
  const templates = data.templates || [];
  const latestCompleted = getLatestCompletedSession(context.history || []);
  const nextAfterCompleted = getNextTemplateAfterLastCompletedSession(context.history || [], templates);

  const best = [...scores].sort((left, right) => right.score - left.score)[0];
  if (best?.score > 0) {
    if (latestCompleted?.templateId && best.id === latestCompleted.templateId && nextAfterCompleted) return nextAfterCompleted;
    return best.id;
  }

  if (nextAfterCompleted) return nextAfterCompleted;

  const selected = typeof data.selectedTemplateId === 'string' ? data.selectedTemplateId : 'push-a';
  return findTemplate(templates, selected)?.id || 'push-a';
};
