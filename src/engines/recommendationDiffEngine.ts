// recommendationDiffEngine — signal-only after the Training Recommendation
// Hard Rewrite V2. User-facing diff explanation copy is deleted; only the
// stable per-exercise signature (used for consistency / determinism checks)
// remains. See docs/TRAINING_RECOMMENDATION_HARD_REWRITE_PLAN_V2.md §2.2.

import { DEFAULT_PROGRAM_TEMPLATE, DEFAULT_SCREENING_PROFILE, DEFAULT_STATUS } from '../data/trainingData';
import type { AppData, TrainingMode, TrainingTemplate } from '../models/training-model';
import { normalizePrimaryGoal, normalizeTrainingMode } from './goalConsistencyEngine';
import { applyStatusRules, makeSuggestion } from './progressionEngine';
import { buildWeeklyPrescription } from './supportPlanEngine';
import { buildTrainingDecisionContext, toStatusRulesDecisionContext } from './trainingDecisionContext';
import { findTemplate, number } from './engineUtils';

export type RecommendationDiffContext = Partial<AppData> & {
  template?: TrainingTemplate;
  sessionTemplateId?: string;
  weeklyPrescription?: AppData['programAdjustmentDrafts'] extends never ? never : ReturnType<typeof buildWeeklyPrescription>;
  primaryGoal?: unknown;
  trainingMode?: TrainingMode | string;
};

const resolveTemplate = (context: RecommendationDiffContext): TrainingTemplate => {
  if (context.template) return context.template;
  const templates = context.templates || [];
  const id = context.sessionTemplateId || context.selectedTemplateId || templates[0]?.id || 'push-a';
  return findTemplate(templates, id) || templates[0];
};

const normalizedMode = (context: RecommendationDiffContext): TrainingMode =>
  normalizeTrainingMode(context.trainingMode ?? 'hybrid');

const recommendationSignature = (context: RecommendationDiffContext) => {
  // Touch normalizePrimaryGoal so the import stays used; consumed by
  // downstream consistency tests if/when goal-derived signatures are needed.
  void normalizePrimaryGoal(
    context.primaryGoal ?? context.userProfile?.primaryGoal ?? context.programTemplate?.primaryGoal ?? context.mesocyclePlan?.primaryGoal,
  );
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

export const getStableRecommendationSignature = recommendationSignature;
