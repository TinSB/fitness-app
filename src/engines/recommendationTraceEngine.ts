import { DEFAULT_PROGRAM_TEMPLATE, DEFAULT_SCREENING_PROFILE, DEFAULT_STATUS, DEFAULT_USER_PROFILE } from '../data/trainingData';
import {
  formatExerciseName,
  formatMuscleName,
  formatPrimaryGoal,
  formatTemplateName,
  formatTrainingMode,
} from '../i18n/formatters';
import type {
  AppData,
  ExercisePrescription,
  HealthMetricSample,
  ImportedWorkoutSample,
  TrainingMode,
  TrainingSession,
  TrainingTemplate,
  WeeklyPrescription,
} from '../models/training-model';
import { auditGoalModeConsistency, normalizePrimaryGoal, normalizeTrainingMode } from './goalConsistencyEngine';
import { buildLoadFeedbackSummary } from './loadFeedbackEngine';
import { buildPainPatterns, getExercisePainPattern } from './painPatternEngine';
import { applyStatusRules } from './progressionEngine';
import { buildWeeklyPrescription, getMuscleBudget } from './supportPlanEngine';
import { buildTrainingDecisionContext, toStatusRulesDecisionContext } from './trainingDecisionContext';
import { buildTrainingLevelAssessment, formatAutoTrainingLevel, type AutoTrainingLevel } from './trainingLevelEngine';
import { findTemplate, getPrimaryMuscles, number, sessionCompletedSets, sessionVolume } from './engineUtils';

export type RecommendationFactor = {
  id: string;
  label: string;
  effect: 'increase' | 'decrease' | 'maintain' | 'block' | 'informational';
  magnitude: 'small' | 'moderate' | 'large';
  reason: string;
  source:
    | 'primaryGoal'
    | 'trainingMode'
    | 'trainingLevel'
    | 'readiness'
    | 'history'
    | 'muscleVolume'
    | 'loadFeedback'
    | 'techniqueQuality'
    | 'painPattern'
    | 'healthData'
    | 'template'
    | 'defaultPolicy';
};

export type RecommendationTrace = {
  sessionTemplateId: string;
  primaryGoal: string;
  trainingMode: string;
  trainingLevel: string;
  readinessScore?: number;
  globalFactors: RecommendationFactor[];
  exerciseFactors: Record<string, RecommendationFactor[]>;
  volumeFactors: RecommendationFactor[];
  loadFeedbackFactors: RecommendationFactor[];
  finalSummary: string;
};

export type RecommendationTraceContext = Partial<AppData> & {
  template?: TrainingTemplate;
  sessionTemplateId?: string;
  weeklyPrescription?: WeeklyPrescription | null;
  primaryGoal?: unknown;
  trainingMode?: TrainingMode | string;
  trainingLevel?: AutoTrainingLevel | string;
  readinessScore?: number;
  healthMetricSamples?: HealthMetricSample[];
  importedWorkoutSamples?: ImportedWorkoutSample[];
};

const factor = (input: RecommendationFactor): RecommendationFactor => ({
  ...input,
  label: input.label || '推荐因素',
  reason: input.reason || '当前使用默认处方。',
});

const hasMeaningfulInfluence = (factorItem: RecommendationFactor) =>
  factorItem.effect !== 'informational' || factorItem.source !== 'template';

const resolveTraceTemplate = (context: RecommendationTraceContext): TrainingTemplate => {
  if (context.template) return context.template;
  const templates = context.templates || [];
  const id = context.sessionTemplateId || context.selectedTemplateId || templates[0]?.id || 'push-a';
  return findTemplate(templates, id) || (templates[0] as TrainingTemplate);
};

const recentHistoryFactor = (history: TrainingSession[]): RecommendationFactor => {
  if (!history.length) {
    return factor({
      id: 'history-baseline',
      label: '历史记录',
      effect: 'maintain',
      magnitude: 'small',
      source: 'defaultPolicy',
      reason: '当前主要使用起始模板和默认处方，历史数据仍在积累中。',
    });
  }
  const latest = history[0];
  const sets = sessionCompletedSets(latest);
  const volume = sessionVolume(latest);
  if (sets >= 18 || volume >= 8000) {
    return factor({
      id: 'history-global-fatigue',
      label: '最近训练量',
      effect: 'decrease',
      magnitude: sets >= 24 || volume >= 12000 ? 'moderate' : 'small',
      source: 'history',
      reason: '最近一次训练量较高，只能作为整体疲劳提醒，不会直接改动无关肌群的局部处方。',
    });
  }
  return factor({
    id: 'history-available',
    label: '历史记录',
    effect: 'informational',
    magnitude: 'small',
    source: 'history',
    reason: `已有 ${history.length} 次正式训练记录，系统会优先使用同动作或同肌群记录校准推荐。`,
  });
};

const trainingModeReason = (mode: TrainingMode) => {
  if (mode === 'strength') return '本次训练侧重力量，主复合动作会偏低次数、较长休息。';
  if (mode === 'hypertrophy') return '本次训练侧重肌肥大（增肌），处方会更重视有效刺激和中等次数范围。';
  return '本次训练侧重综合，主动作和辅助动作会在力量、肌肥大和疲劳成本之间折中。';
};

const goalReason = (goal: string, mode: TrainingMode) => {
  if (goal === 'fat_loss' && mode === 'hybrid') {
    return '主目标是减脂，训练侧重为综合。力量训练仍用于维持肌肉和力量，因此次数范围不会自动降低。';
  }
  if (goal === 'hypertrophy') return '主目标是肌肥大（增肌），长期计划会优先积累可恢复的有效训练量。';
  if (goal === 'strength') return '主目标是力量，长期计划会更重视主复合动作表现。';
  return '主目标用于长期方向，本次训练仍由训练侧重、准备度和历史记录共同决定。';
};

const trainingLevelFactor = (level: AutoTrainingLevel | string, historyCount: number): RecommendationFactor => {
  const label = formatAutoTrainingLevel((level as AutoTrainingLevel) || 'unknown');
  if (level === 'unknown' || level === 'beginner') {
    return factor({
      id: `training-level-${level || 'unknown'}`,
      label: '训练等级',
      effect: 'decrease',
      magnitude: level === 'unknown' ? 'moderate' : 'small',
      source: 'trainingLevel',
      reason: historyCount < 3 ? '系统仍在建立训练基线，因此建议更保守。' : `当前自动等级为${label}，推荐会避免激进推进。`,
    });
  }
  if (level === 'advanced') {
    return factor({
      id: 'training-level-advanced',
      label: '训练等级',
      effect: 'increase',
      magnitude: 'small',
      source: 'trainingLevel',
      reason: '训练等级显示已有较稳定记录，但仍不会绕过不适、动作质量和准备度限制。',
    });
  }
  return factor({
    id: `training-level-${level}`,
    label: '训练等级',
    effect: 'maintain',
    magnitude: 'small',
    source: 'trainingLevel',
    reason: `当前自动等级为${label}，推荐按真实记录逐步校准。`,
  });
};

const readinessFactor = (score?: number, reasons: string[] = []): RecommendationFactor => {
  if (typeof score !== 'number') {
    return factor({
      id: 'readiness-default',
      label: '准备度',
      effect: 'informational',
      magnitude: 'small',
      source: 'readiness',
      reason: '准备度没有明显限制，按当前模板推进。',
    });
  }
  const reason = reasons[0] ? `准备度 ${score}/100：${reasons[0]}。` : `准备度 ${score}/100。`;
  if (score < 50) {
    return factor({ id: 'readiness-low', label: '准备度', effect: 'decrease', magnitude: 'large', source: 'readiness', reason: `${reason} 本次建议优先恢复和保底完成。` });
  }
  if (score < 65) {
    return factor({ id: 'readiness-conservative', label: '准备度', effect: 'decrease', magnitude: 'moderate', source: 'readiness', reason: `${reason} 本次整体训练量保持克制。` });
  }
  return factor({ id: 'readiness-normal', label: '准备度', effect: 'maintain', magnitude: 'small', source: 'readiness', reason: `${reason} 可以按计划推进，但仍以动作质量和余力（RIR）控制强度。` });
};

const techniqueFactorForExercise = (history: TrainingSession[], exerciseId: string): RecommendationFactor | null => {
  const recentSets = history
    .flatMap((session) => session.exercises || [])
    .filter((exercise) => exercise.id === exerciseId || exercise.baseId === exerciseId || exercise.canonicalExerciseId === exerciseId)
    .flatMap((exercise) => (Array.isArray(exercise.sets) ? exercise.sets : []))
    .slice(0, 12);
  const poorCount = recentSets.filter((set) => set.techniqueQuality === 'poor').length;
  if (!poorCount) return null;
  return factor({
    id: `technique-${exerciseId}`,
    label: '动作质量',
    effect: 'decrease',
    magnitude: poorCount >= 2 ? 'moderate' : 'small',
    source: 'techniqueQuality',
    reason: '该动作近期出现动作质量偏差，本次推荐会避免激进加重。',
  });
};

const exerciseIdForTrace = (exercise: ExercisePrescription) => exercise.canonicalExerciseId || exercise.baseId || exercise.id;

export const buildRecommendationTrace = (context: RecommendationTraceContext): RecommendationTrace => {
  const template = resolveTraceTemplate(context);
  const userProfileForAudit = context.userProfile
    ? { ...context.userProfile, primaryGoal: normalizePrimaryGoal(context.primaryGoal ?? context.userProfile.primaryGoal) }
    : context.primaryGoal
      ? { ...DEFAULT_USER_PROFILE, primaryGoal: normalizePrimaryGoal(context.primaryGoal) }
      : context.userProfile;
  const goalAudit = auditGoalModeConsistency({
    ...context,
    userProfile: userProfileForAudit,
  });
  const trainingMode = normalizeTrainingMode(context.trainingMode ?? context.trainingMode ?? goalAudit.trainingMode);
  const decisionContext = buildTrainingDecisionContext(
    {
      ...context,
      templates: context.templates || [template],
      selectedTemplateId: template.id,
      todayStatus: context.todayStatus || DEFAULT_STATUS,
      trainingMode,
      screeningProfile: context.screeningProfile || DEFAULT_SCREENING_PROFILE,
      programTemplate: context.programTemplate || DEFAULT_PROGRAM_TEMPLATE,
    },
    { trainingMode }
  );
  const weeklyPrescription =
    context.weeklyPrescription ||
    buildWeeklyPrescription({
      ...context,
      history: decisionContext.history,
      todayStatus: decisionContext.todayStatus,
      trainingMode,
      screeningProfile: decisionContext.screeningProfile,
      programTemplate: decisionContext.programTemplate || DEFAULT_PROGRAM_TEMPLATE,
    });
  const adjusted = applyStatusRules(
    template,
    decisionContext.todayStatus,
    trainingMode,
    weeklyPrescription,
    decisionContext.history,
    decisionContext.screeningProfile,
    decisionContext.mesocyclePlan,
    toStatusRulesDecisionContext(decisionContext),
  );
  const assessment = buildTrainingLevelAssessment({ history: decisionContext.history });
  const trainingLevel = context.trainingLevel || assessment.level;
  const readinessScore = context.readinessScore ?? adjusted.readinessResult?.score;
  const painPatterns = buildPainPatterns(decisionContext.history);

  const globalFactors: RecommendationFactor[] = [
    factor({
      id: 'primary-goal',
      label: '主目标',
      effect: 'informational',
      magnitude: 'small',
      source: 'primaryGoal',
      reason: goalReason(goalAudit.primaryGoal, trainingMode),
    }),
    factor({
      id: 'training-mode',
      label: '训练侧重',
      effect: trainingMode === 'strength' ? 'decrease' : trainingMode === 'hypertrophy' ? 'increase' : 'maintain',
      magnitude: trainingMode === 'hybrid' ? 'small' : 'moderate',
      source: 'trainingMode',
      reason: trainingModeReason(trainingMode),
    }),
    readinessFactor(readinessScore, adjusted.readinessResult?.reasons || []),
    trainingLevelFactor(trainingLevel, decisionContext.history.length),
    recentHistoryFactor(decisionContext.history),
  ];
  if (decisionContext.healthSummary) {
    globalFactors.push(
      factor({
        id: 'health-data',
        label: '健康数据',
        effect: 'informational',
        magnitude: 'small',
        source: 'healthData',
        reason: '导入健康数据只通过准备度和整体疲劳提示影响推荐，不会直接改写力量动作处方。',
      }),
    );
  }

  const volumeFactors = adjusted.exercises.flatMap((exercise) => {
    const primaryMuscle = getPrimaryMuscles(exercise)[0] || exercise.muscle;
    const budget = getMuscleBudget(weeklyPrescription, primaryMuscle);
    if (!budget) return [];
    const effect: RecommendationFactor['effect'] = number(budget.remainingCapacity) <= 0 ? 'decrease' : number(budget.remaining) > 0 ? 'maintain' : 'decrease';
    return [
      factor({
        id: `volume-${primaryMuscle}`,
        label: `${formatMuscleName(primaryMuscle)}训练量`,
        effect,
        magnitude: effect === 'decrease' ? 'moderate' : 'small',
        source: 'muscleVolume',
        reason:
          effect === 'decrease'
            ? `${formatMuscleName(primaryMuscle)}本周训练量接近目标，相关动作会优先控制组数。`
            : `${formatMuscleName(primaryMuscle)}本周仍有可恢复训练额度，保持当前处方。`,
      }),
    ];
  });

  const dedupedVolumeFactors = [...new Map(volumeFactors.map((item) => [item.id, item])).values()];
  const exerciseFactors: Record<string, RecommendationFactor[]> = {};
  const loadFeedbackFactors: RecommendationFactor[] = [];

  adjusted.exercises.forEach((exercise) => {
    const exerciseId = exerciseIdForTrace(exercise);
    const items: RecommendationFactor[] = [
      factor({
        id: `${exerciseId}-template`,
        label: formatExerciseName(exercise),
        effect: 'informational',
        magnitude: 'small',
        source: 'template',
        reason: `当前模板安排 ${number(exercise.sets)} 组，目标 ${exercise.repMin}-${exercise.repMax} 次。`,
      }),
    ];
    if (exercise.prescription?.rule) {
      items.push(
        factor({
          id: `${exerciseId}-mode`,
          label: '训练侧重',
          effect: 'informational',
          magnitude: 'small',
          source: 'trainingMode',
          reason: exercise.prescription.rule,
        }),
      );
    }
    if (exercise.adjustment) {
      items.push(
        factor({
          id: `${exerciseId}-adjustment`,
          label: '本次调整',
          effect: exercise.adjustment.includes('减少') || exercise.adjustment.includes('下修') || exercise.adjustment.includes('保守') ? 'decrease' : 'informational',
          magnitude: 'small',
          source: exercise.adjustment.includes('反馈') ? 'loadFeedback' : exercise.adjustment.includes('周') || exercise.adjustment.includes('恢复额度') ? 'muscleVolume' : 'history',
          reason: exercise.adjustment,
        }),
      );
    }
    if (exercise.warning) {
      items.push(
        factor({
          id: `${exerciseId}-warning`,
          label: '不适风险',
          effect: 'decrease',
          magnitude: 'moderate',
          source: 'painPattern',
          reason: exercise.warning,
        }),
      );
    }
    const painPattern = getExercisePainPattern(painPatterns, exerciseId);
    if (painPattern) {
      items.push(
        factor({
          id: `${exerciseId}-pain-pattern`,
          label: '不适模式',
          effect: painPattern.suggestedAction === 'watch' ? 'informational' : 'decrease',
          magnitude: painPattern.suggestedAction === 'watch' ? 'small' : 'moderate',
          source: 'painPattern',
          reason: `该动作近期在${painPattern.area}出现不适记录，本次建议保持保守观察。`,
        }),
      );
    }
    const technique = techniqueFactorForExercise(decisionContext.history, exerciseId);
    if (technique) items.push(technique);

    const feedback = buildLoadFeedbackSummary(decisionContext.history, exerciseId).adjustment;
    if (feedback.direction !== 'normal') {
      const feedbackFactor = factor({
        id: `${exerciseId}-load-feedback`,
        label: '重量反馈',
        effect: feedback.direction === 'conservative' ? 'decrease' : 'increase',
        magnitude: 'small',
        source: 'loadFeedback',
        reason: feedback.reasons[0] || '该动作的重量反馈影响本次推荐。',
      });
      items.push(feedbackFactor);
      loadFeedbackFactors.push(feedbackFactor);
    }

    exerciseFactors[exerciseId] = items;
  });

  const important = [...globalFactors, ...dedupedVolumeFactors, ...loadFeedbackFactors].filter(hasMeaningfulInfluence);
  const finalSummary =
    important.length > 0
      ? important.slice(0, 3).map((item) => item.reason).join(' ')
      : '当前主要使用起始模板和默认处方，历史数据仍在积累中。';

  return {
    sessionTemplateId: template.id || '未指定模板',
    primaryGoal: formatPrimaryGoal(goalAudit.primaryGoal),
    trainingMode: formatTrainingMode(trainingMode),
    trainingLevel: formatAutoTrainingLevel(trainingLevel as AutoTrainingLevel),
    readinessScore,
    globalFactors,
    exerciseFactors,
    volumeFactors: dedupedVolumeFactors,
    loadFeedbackFactors,
    finalSummary,
  };
};

export const getRecommendationTraceReasons = (trace: RecommendationTrace, limit = 7) => {
  const reasons = [
    ...trace.globalFactors,
    ...trace.volumeFactors,
    ...trace.loadFeedbackFactors,
    ...Object.values(trace.exerciseFactors).flat(),
  ]
    .filter(hasMeaningfulInfluence)
    .map((item) => item.reason)
    .filter(Boolean);
  const unique = [...new Set(reasons)];
  return unique.length ? unique.slice(0, limit) : ['当前主要使用起始模板和默认处方，历史数据仍在积累中。'];
};
