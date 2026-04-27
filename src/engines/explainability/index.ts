export {
  buildE1RMExplanation,
  buildSessionExplanations,
  buildSessionSummaryExplanations,
  buildTodayExplanationItems,
  buildTodayExplanations,
} from './trainingExplainability';
export { buildWeeklyActionExplanation, buildWeeklyCoachReview, explainMuscleVolumeAction } from './weeklyActionExplainability';
export {
  explainAddNewExerciseDecision,
  explainAdjustmentDefaultSelection,
  explainAdjustmentDraftStale,
  explainAdjustmentReview,
  explainAdjustmentRisk,
  explainAdjustmentRollbackDecision,
  explainAdjustmentTooEarly,
  explainExperimentalTemplatePolicy,
  explainSupportAdjustmentChange,
} from './adjustmentExplainability';
export { buildEvidenceRuleExplanation, formatEvidenceSourceBoundary, formatExplanationEvidence } from './evidenceExplainability';
export {
  buildTemplate,
  formatExplainabilityConfidence,
  formatExplanationItem,
  formatMaybeDecimal,
  hasUnsafeExplanationText,
  limitSentences,
  makeExplanationItem,
  safeText,
} from './shared';
