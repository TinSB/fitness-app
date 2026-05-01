import { DEFAULT_PROGRAM_TEMPLATE, DEFAULT_SCREENING_PROFILE, DEFAULT_STATUS } from '../data/trainingData';
import {
  formatExerciseName,
  formatMuscleName,
  formatPrimaryGoal,
  formatTemplateName,
  formatTrainingMode,
} from '../i18n/formatters';
import type { AppData, TrainingMode, TrainingSession, TrainingTemplate } from '../models/training-model';
import { normalizePrimaryGoal, normalizeTrainingMode } from './goalConsistencyEngine';
import { buildLoadFeedbackSummary } from './loadFeedbackEngine';
import { buildPainPatterns } from './painPatternEngine';
import { applyStatusRules, makeSuggestion } from './progressionEngine';
import { buildRecommendationTrace, type RecommendationTraceContext } from './recommendationTraceEngine';
import { buildWeeklyPrescription } from './supportPlanEngine';
import { buildTrainingDecisionContext, toStatusRulesDecisionContext } from './trainingDecisionContext';
import { buildTrainingLevelAssessment } from './trainingLevelEngine';
import { completedSets, findTemplate, getPrimaryMuscles, number, setVolume } from './engineUtils';

export type RecommendationDifferenceCategory =
  | 'primaryGoal'
  | 'trainingMode'
  | 'history'
  | 'trainingLevel'
  | 'readiness'
  | 'loadFeedback'
  | 'techniqueQuality'
  | 'painPattern'
  | 'unit'
  | 'template'
  | 'unknown';

export type RecommendationDifferenceReport = {
  isComparable: boolean;
  sameSettings: boolean;
  differences: Array<{
    category: RecommendationDifferenceCategory;
    label: string;
    explanation: string;
    expectedImpact: string;
  }>;
  summary: string;
  possibleBugWarnings: string[];
};

const addDiff = (
  differences: RecommendationDifferenceReport['differences'],
  category: RecommendationDifferenceCategory,
  label: string,
  explanation: string,
  expectedImpact: string,
) => {
  differences.push({ category, label, explanation, expectedImpact });
};

const resolveTemplate = (context: RecommendationTraceContext): TrainingTemplate => {
  if (context.template) return context.template;
  const templates = context.templates || [];
  const id = context.sessionTemplateId || context.selectedTemplateId || templates[0]?.id || 'push-a';
  return findTemplate(templates, id) || templates[0];
};

const normalizedGoal = (context: RecommendationTraceContext) =>
  normalizePrimaryGoal(context.primaryGoal ?? context.userProfile?.primaryGoal ?? context.programTemplate?.primaryGoal ?? context.mesocyclePlan?.primaryGoal);

const normalizedMode = (context: RecommendationTraceContext): TrainingMode =>
  normalizeTrainingMode(context.trainingMode ?? context.trainingMode ?? 'hybrid');

const unit = (context: RecommendationTraceContext) => context.unitSettings?.weightUnit || 'kg';

const recommendationSignature = (context: RecommendationTraceContext) => {
  const template = resolveTemplate(context);
  const mode = normalizedMode(context);
  const decisionContext = buildTrainingDecisionContext(
    {
      ...context,
      templates: context.templates || [template],
      selectedTemplateId: template.id,
      todayStatus: context.todayStatus || DEFAULT_STATUS,
      trainingMode: mode,
      screeningProfile: context.screeningProfile || DEFAULT_SCREENING_PROFILE,
      programTemplate: context.programTemplate || DEFAULT_PROGRAM_TEMPLATE,
    },
    { trainingMode: mode },
  );
  const weeklyPrescription =
    context.weeklyPrescription ||
    buildWeeklyPrescription({
      ...context,
      history: decisionContext.history,
      todayStatus: decisionContext.todayStatus,
      trainingMode: mode,
      screeningProfile: decisionContext.screeningProfile,
      programTemplate: decisionContext.programTemplate || DEFAULT_PROGRAM_TEMPLATE,
    });
  const adjusted = applyStatusRules(
    template,
    decisionContext.todayStatus,
    mode,
    weeklyPrescription,
    decisionContext.history,
    decisionContext.screeningProfile,
    decisionContext.mesocyclePlan,
    toStatusRulesDecisionContext(decisionContext),
  );

  return adjusted.exercises.map((exercise) => {
    const suggestion = makeSuggestion(exercise, decisionContext.history);
    return {
      id: exercise.canonicalExerciseId || exercise.baseId || exercise.id,
      sets: number(exercise.sets),
      repMin: number(exercise.repMin),
      repMax: number(exercise.repMax),
      weight: number(suggestion.weight),
      reps: number(suggestion.reps),
      conservative: Boolean(exercise.conservativeTopSet || exercise.progressLocked),
      adjustment: exercise.adjustment || '',
      warning: exercise.warning || '',
    };
  });
};

const signatureDistance = (left: ReturnType<typeof recommendationSignature>, right: ReturnType<typeof recommendationSignature>) => {
  const rightMap = new Map(right.map((item) => [item.id, item]));
  return left.reduce((distance, item) => {
    const other = rightMap.get(item.id);
    if (!other) return distance + 3;
    return (
      distance +
      Math.abs(item.sets - other.sets) +
      Math.abs(item.repMin - other.repMin) +
      Math.abs(item.repMax - other.repMax) +
      Math.min(3, Math.abs(item.weight - other.weight) / 5) +
      (item.conservative === other.conservative ? 0 : 1)
    );
  }, 0);
};

const historyMuscleSet = (history: TrainingSession[]) => {
  const muscles = new Set<string>();
  history.forEach((session) => {
    (session.exercises || []).forEach((exercise) => {
      getPrimaryMuscles(exercise).forEach((muscle) => muscles.add(muscle));
    });
  });
  return muscles;
};

const templateMuscleSet = (template: TrainingTemplate) => {
  const muscles = new Set<string>();
  (template.exercises || []).forEach((exercise) => getPrimaryMuscles(exercise).forEach((muscle) => muscles.add(muscle)));
  return muscles;
};

const historyVolume = (history: TrainingSession[]) =>
  Math.round(
    history.reduce(
      (sum, session) =>
        sum +
        (session.exercises || []).reduce(
          (exerciseSum, exercise) => exerciseSum + completedSets(exercise).reduce((setSum, set) => setSum + setVolume(set), 0),
          0,
        ),
      0,
    ),
  );

const loadFeedbackSignature = (context: RecommendationTraceContext, template: TrainingTemplate) => {
  const decisionContext = buildTrainingDecisionContext(context);
  return (template.exercises || [])
    .map((exercise) => {
      const id = exercise.canonicalExerciseId || exercise.baseId || exercise.id;
      const summary = buildLoadFeedbackSummary(decisionContext.history, id);
      return `${id}:${summary.adjustment.direction}:${summary.adjustment.dominantFeedback || '无'}`;
    })
    .join('|');
};

const poorTechniqueCount = (history: TrainingSession[]) =>
  history.reduce(
    (sum, session) =>
      sum +
      (session.exercises || []).reduce(
        (exerciseSum, exercise) =>
          exerciseSum + (Array.isArray(exercise.sets) ? exercise.sets.filter((set) => set.techniqueQuality === 'poor').length : 0),
        0,
      ),
    0,
  );

const painSignature = (history: TrainingSession[]) =>
  buildPainPatterns(history)
    .map((pattern) => `${pattern.exerciseId || pattern.area}:${pattern.suggestedAction}:${pattern.frequency}`)
    .join('|');

export const buildRecommendationDifferenceExplanation = (
  contextA: RecommendationTraceContext,
  contextB: RecommendationTraceContext,
): RecommendationDifferenceReport => {
  const templateA = resolveTemplate(contextA);
  const templateB = resolveTemplate(contextB);
  const traceA = buildRecommendationTrace({ ...contextA, template: templateA });
  const traceB = buildRecommendationTrace({ ...contextB, template: templateB });
  const decisionA = buildTrainingDecisionContext(contextA);
  const decisionB = buildTrainingDecisionContext(contextB);
  const differences: RecommendationDifferenceReport['differences'] = [];
  const possibleBugWarnings: string[] = [];

  const goalA = normalizedGoal(contextA);
  const goalB = normalizedGoal(contextB);
  if (goalA !== goalB) {
    addDiff(
      differences,
      'primaryGoal',
      '主目标不同',
      `一方主目标是${formatPrimaryGoal(goalA)}，另一方是${formatPrimaryGoal(goalB)}。主目标是长期方向，不会把每个动作都强行改成同一种次数。`,
      '主目标不同可能影响周训练量和长期保守程度，但不会单独说明所有组数/次数差异。',
    );
  }

  const modeA = normalizedMode(contextA);
  const modeB = normalizedMode(contextB);
  if (modeA !== modeB) {
    addDiff(
      differences,
      'trainingMode',
      '训练侧重不同',
      `一方训练侧重是${formatTrainingMode(modeA)}，另一方是${formatTrainingMode(modeB)}。`,
      '训练侧重会影响主复合动作、孤立动作的次数范围和休息，但综合不等于力量，也不等于肌肥大。',
    );
  }

  if (templateA.id !== templateB.id) {
    addDiff(
      differences,
      'template',
      '训练模板不同',
      `当前比较的是${formatTemplateName(templateA)}和${formatTemplateName(templateB)}。`,
      '模板不同会直接导致动作、组数和次数范围不同。',
    );
  }

  const levelA = contextA.trainingLevel || buildTrainingLevelAssessment({ history: decisionA.history }).level;
  const levelB = contextB.trainingLevel || buildTrainingLevelAssessment({ history: decisionB.history }).level;
  if (levelA !== levelB) {
    addDiff(
      differences,
      'trainingLevel',
      '训练等级不同',
      '训练等级来自多次正式记录，不会因为一次大重量直接升为高阶。',
      '同设置但训练等级不同，推荐不同是合理的；数据不足或新手阶段会更保守。',
    );
  }

  if (unit(contextA) !== unit(contextB)) {
    addDiff(
      differences,
      'unit',
      '显示单位不同',
      `一方使用 ${unit(contextA)}，另一方使用 ${unit(contextB)}。`,
      '单位只应改变显示和输入换算，不应改变推荐逻辑。',
    );
  }

  const readinessA = traceA.readinessScore ?? 0;
  const readinessB = traceB.readinessScore ?? 0;
  if (Math.abs(readinessA - readinessB) >= 5) {
    addDiff(
      differences,
      'readiness',
      '准备度不同',
      `准备度分别为 ${readinessA} 和 ${readinessB}。`,
      '准备度差异可以轻度或中度影响整体训练保守程度；它是全局影响，不是某个无关肌群的局部处方。',
    );
  }

  const historyCountDiff = decisionA.history.length !== decisionB.history.length;
  const historyVolumeDiff = Math.abs(historyVolume(decisionA.history) - historyVolume(decisionB.history));
  if (historyCountDiff || historyVolumeDiff > 0) {
    addDiff(
      differences,
      'history',
      '历史记录不同',
      `两边正式训练记录数量或训练量不同：${decisionA.history.length} 次 vs ${decisionB.history.length} 次。`,
      '新记录不同，推荐可以不同；局部肌群历史主要影响相关肌群，全局疲劳只能通过准备度或恢复状态产生轻度影响。',
    );
  }

  const feedbackA = loadFeedbackSignature(contextA, templateA);
  const feedbackB = loadFeedbackSignature(contextB, templateB);
  if (feedbackA !== feedbackB) {
    addDiff(
      differences,
      'loadFeedback',
      '重量反馈不同',
      '最近反馈某个动作偏重或偏轻时，只会影响同一实际动作或合理动作池。',
      '例如卧推偏重不应影响深蹲；三头下压偏重不应影响腿举。',
    );
  }

  const poorA = poorTechniqueCount(decisionA.history);
  const poorB = poorTechniqueCount(decisionB.history);
  if (poorA !== poorB) {
    addDiff(
      differences,
      'techniqueQuality',
      '动作质量记录不同',
      `poor 动作质量记录分别为 ${poorA} 和 ${poorB}。`,
      '动作质量只应限制对应动作或同动作链的推进，不应跨无关动作大幅影响。',
    );
  }

  const painA = painSignature(decisionA.history);
  const painB = painSignature(decisionB.history);
  if (painA !== painB) {
    addDiff(
      differences,
      'painPattern',
      '不适模式不同',
      '一方存在不同的不适记录或部位。',
      '腿部不适可以影响腿部训练；胸部不适不应直接大幅改变腿部局部处方。',
    );
  }

  const signatureA = recommendationSignature(contextA);
  const signatureB = recommendationSignature(contextB);
  const distance = signatureDistance(signatureA, signatureB);
  const musclesA = historyMuscleSet(decisionA.history);
  const musclesB = historyMuscleSet(decisionB.history);
  const templateMuscles = templateMuscleSet(templateA);
  const relatedHistory = [...musclesA, ...musclesB].some((muscle) => templateMuscles.has(muscle));
  const sameCoreSettings = goalA === goalB && modeA === modeB && templateA.id === templateB.id && unit(contextA) === unit(contextB);

  if (distance > 0 && differences.length === 0) {
    possibleBugWarnings.push('两个 context 看起来完全相同，但推荐签名不同；这可能是非确定性推荐逻辑，需要检查时间、随机数或可变数据引用。');
  }
  if (sameCoreSettings && !relatedHistory && distance >= 2) {
    possibleBugWarnings.push('只有无关肌群历史不同，却导致当前训练处方明显变化；应确认是否错误地让无关历史直接影响局部推荐。');
  }

  const sameSettings = sameCoreSettings && levelA === levelB;
  const isComparable = templateA.id === templateB.id;
  const summary =
    differences.length === 0
      ? distance === 0
        ? '两个用户的核心输入一致，推荐也保持一致。'
        : '核心设置未发现差异，但推荐存在变化，需要查看警告。'
      : `发现 ${differences.length} 类差异。${goalA === 'fat_loss' && modeA === 'hybrid' || goalB === 'fat_loss' && modeB === 'hybrid' ? '减脂 + 综合是合法组合，不是错误。' : '推荐差异需要按上述来源解释。'}`;

  return {
    isComparable,
    sameSettings,
    differences,
    summary,
    possibleBugWarnings,
  };
};

export const getStableRecommendationSignature = recommendationSignature;
